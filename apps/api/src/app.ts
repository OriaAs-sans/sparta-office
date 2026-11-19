import cors from "cors"
import express, { type ErrorRequestHandler } from "express"
import helmet from "helmet"
import { z } from "zod"

import { preApprovalInputSchema } from "./agents/preapproval.ts"
import { AGENTS, findAgent } from "./agents/registry.ts"
import { triageInputSchema } from "./agents/triage.ts"
import { chatRouter } from "./chat/routes.ts"
import { config } from "./config.ts"
import { convertDxf, summarize } from "./denah/convert.ts"
import { loadModel, saveModel } from "./denah/store.ts"
import { agentActivity, createTask, decideTask, getTask, insertFinishedTask, listTasks, type TaskStatus } from "./tasks.ts"

export const app = express()

app.use(helmet())
app.use(cors({ origin: config.webOrigin }))
// Batas besar karena laporan triase bisa membawa foto base64.
app.use(express.json({ limit: "8mb" }))

app.use("/api", chatRouter)

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, apiKeyConfigured: config.hasAnthropicKey, mode: config.mode, model: config.model })
})

app.get("/api/agents", (_req, res) => {
  res.json(
    AGENTS.map((agent) => ({
      ...agent,
      activity: agent.availability === "aktif" ? agentActivity(agent.id) : null,
    }))
  )
})

const statusSchema = z.enum(["antri", "berjalan", "menunggu_review", "disetujui", "ditolak", "gagal"])

app.get("/api/tasks", (req, res) => {
  const query = z
    .object({
      agentId: z.string().optional(),
      status: statusSchema.optional(),
      limit: z.coerce.number().int().positive().optional(),
    })
    .safeParse(req.query)
  if (!query.success) {
    res.status(400).json({ message: "Filter tidak valid." })
    return
  }
  res.json(listTasks(query.data as { agentId?: string; status?: TaskStatus; limit?: number }))
})

app.get("/api/tasks/:id", (req, res) => {
  const task = getTask(req.params.id)
  if (!task) {
    res.status(404).json({ message: "Tugas tidak ditemukan." })
    return
  }
  res.json(task)
})

const newTaskSchema = z.discriminatedUnion("agentId", [
  z.object({ agentId: z.literal("triase-maintenance"), input: triageInputSchema }),
  z.object({ agentId: z.literal("pre-approval"), input: preApprovalInputSchema }),
])

app.post("/api/tasks", (req, res) => {
  const agentId = typeof req.body?.agentId === "string" ? req.body.agentId : ""
  const agent = findAgent(agentId)
  if (agent && agent.availability !== "aktif") {
    res.status(409).json({ message: `${agent.name} belum aktif.` })
    return
  }
  const parsed = newTaskSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      message: parsed.error.issues[0]?.message ?? "Isi tugas belum lengkap.",
      issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    })
    return
  }
  res.status(201).json(createTask(parsed.data))
})

const denahUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  content: z.string().min(20, "File DXF kosong.").max(7_000_000, "File DXF terlalu besar. Maksimal sekitar 7 MB."),
  judul: z.string().trim().max(200).optional(),
})

// Upload DXF dari web: diubah ke 3D tanpa AI, lalu masuk Inbox Review.
app.post("/api/denah", (req, res) => {
  const parsed = denahUploadSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "File DXF tidak valid." })
    return
  }
  const { fileName, content, judul } = parsed.data
  if (!/\.dxf$/i.test(fileName)) {
    res.status(400).json({ message: "File harus DXF. Simpan ulang DWG sebagai DXF dari AutoCAD." })
    return
  }
  try {
    const model = convertDxf(content, fileName)
    const summary = summarize(model)
    const modelId = saveModel(model)
    const task = insertFinishedTask({
      agentId: "denah-bangunan",
      title: judul || `Denah ${fileName}`,
      input: { file: fileName },
      mode: "konverter",
      result: {
        ringkasan: `Denah ${fileName} diubah ke model 3D: ${summary.lebar_m} x ${summary.panjang_m} m.`,
        model_id: modelId,
        ...summary,
        catatan: [
          summary.layer_dinding.length === summary.layer.length
            ? "Tidak ada layer bernama dinding, jadi semua garis diangkat jadi dinding. Minta Studio Denah di Claude Code memilih layer dinding yang tepat."
            : `Layer dinding dipilih otomatis dari namanya: ${summary.layer_dinding.join(", ")}.`,
        ],
      },
    })
    res.status(201).json(task)
  } catch (error) {
    res.status(422).json({
      message: error instanceof Error ? `DXF tidak bisa dibaca: ${error.message}` : "DXF tidak bisa dibaca.",
    })
  }
})

app.get("/api/denah/:id", (req, res) => {
  const model = loadModel(req.params.id)
  if (!model) {
    res.status(404).json({ message: "Model denah tidak ditemukan." })
    return
  }
  res.json(model)
})

const decisionSchema = z.object({
  decision: z.enum(["disetujui", "ditolak"]),
  note: z.string().trim().max(1000).default(""),
})

app.post("/api/tasks/:id/decision", (req, res) => {
  const parsed = decisionSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: "Keputusan tidak valid." })
    return
  }
  if (parsed.data.decision === "ditolak" && !parsed.data.note) {
    res.status(400).json({ message: "Tulis alasan penolakan." })
    return
  }
  const result = decideTask(req.params.id, parsed.data.decision, parsed.data.note)
  if (result.error === "not_found") {
    res.status(404).json({ message: "Tugas tidak ditemukan." })
    return
  }
  if (result.error === "not_reviewable") {
    res.status(409).json({ message: "Tugas ini sudah diputuskan atau belum selesai diproses." })
    return
  }
  res.json(result.task)
})

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error?.type === "entity.too.large") {
    res.status(413).json({ message: "File terlalu besar. Maksimal sekitar 6 MB." })
    return
  }
  if (error?.type === "entity.parse.failed") {
    res.status(400).json({ message: "Data yang dikirim bukan JSON yang valid." })
    return
  }
  console.error(error)
  res.status(500).json({ message: "Terjadi error di server." })
}
app.use(errorHandler)

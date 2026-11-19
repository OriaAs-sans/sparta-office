import { rmSync } from "node:fs"
import { join } from "node:path"

import { Router } from "express"
import { z } from "zod"

import { paths } from "../paths.ts"
import { cancelRun, engineInfo, isRunning, runBrain, type BrainEvent } from "./engine.ts"
import { AGENT_TO_SUBAGENT, busyAgents, clearBusy, listOffice, markBusy, onOffice, recordOffice, toAgentId } from "./office.ts"
import { isAllowedMention, listKnowledge, saveAttachment, saveKnowledge, searchFiles } from "./files.ts"
import {
  addMessage,
  createChat,
  deleteChat,
  getChat,
  listChats,
  setSession,
  updateAssistantMessage,
  type ChatStep,
} from "./store.ts"

export const chatRouter = Router()

chatRouter.get("/chat/status", (_req, res) => {
  res.json({ engine: engineInfo.name, available: engineInfo.available, reason: engineInfo.reason })
})

chatRouter.get("/chats", (_req, res) => {
  res.json(listChats())
})

const createSchema = z.object({
  // Id agent Sparta untuk percakapan langsung, tanpa Otak.
  agent: z.enum(["denah-bangunan", "triase-maintenance", "pre-approval"]).optional(),
})

chatRouter.post("/chats", (req, res) => {
  const parsed = createSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({ message: "Agent tidak dikenal." })
    return
  }
  res.status(201).json(createChat(parsed.data.agent ?? null))
})

chatRouter.get("/chats/:id", (req, res) => {
  const chat = getChat(req.params.id)
  if (!chat) {
    res.status(404).json({ message: "Percakapan tidak ditemukan." })
    return
  }
  res.json({ ...chat, running: isRunning(chat.id) })
})

chatRouter.delete("/chats/:id", (req, res) => {
  if (isRunning(req.params.id)) {
    res.status(409).json({ message: "Hentikan dulu Otak Sparta sebelum menghapus percakapan ini." })
    return
  }
  if (!deleteChat(req.params.id)) {
    res.status(404).json({ message: "Percakapan tidak ditemukan." })
    return
  }
  // Lampiran percakapan ikut dihapus. id sudah pasti ada di database (UUID).
  rmSync(join(paths.attachments, req.params.id), { recursive: true, force: true })
  res.status(204).end()
})

chatRouter.post("/chats/:id/cancel", (req, res) => {
  res.json({ cancelled: cancelRun(req.params.id) })
})

const messageSchema = z.object({
  text: z.string().trim().min(1, "Tulis pesan dulu.").max(8000, "Pesan terlalu panjang."),
  files: z.array(z.string()).max(20, "Maksimal 20 file per pesan.").default([]),
})

// Mengirim pesan, lalu mengalirkan langkah dan jawaban Otak Sparta lewat
// Server-Sent Events. Semua juga disimpan, jadi kalau browser ditutup di
// tengah jalan, jawabannya tetap bisa dibaca nanti.
chatRouter.post("/chats/:id/messages", async (req, res) => {
  const chat = getChat(req.params.id)
  if (!chat) {
    res.status(404).json({ message: "Percakapan tidak ditemukan." })
    return
  }
  if (isRunning(chat.id)) {
    res.status(409).json({ message: "Otak Sparta masih mengerjakan pesan sebelumnya." })
    return
  }
  const parsed = messageSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Pesan tidak valid." })
    return
  }
  const { text, files } = parsed.data
  const rejected = files.filter((file) => !isAllowedMention(file))
  if (rejected.length) {
    res.status(400).json({ message: `File di luar folder C:\\ALfa tidak bisa dilampirkan: ${rejected[0]}` })
    return
  }
  if (!engineInfo.available) {
    res.status(503).json({ message: engineInfo.reason })
    return
  }

  addMessage(chat.id, { role: "user", content: text, files, status: "selesai" })
  const assistantId = addMessage(chat.id, { role: "assistant", content: "", files: [], status: "berjalan" })

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  })
  res.write(`data: ${JSON.stringify({ type: "start", messageId: assistantId })}\n\n`)

  const steps: ChatStep[] = []
  const models: string[] = []
  const parts: string[] = []

  const send = (event: BrainEvent) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`)
  }

  // Pengingat bahasa ikut di setiap pesan karena pengaturan Claude Code
  // global user bisa lebih kuat dari prompt sistem tambahan (terjadi saat uji).
  const prompt = [
    text,
    files.length ? `File yang disebut user (baca dulu sebelum menjawab):\n${files.map((file) => `- ${file}`).join("\n")}` : "",
    "(Jawab dalam Bahasa Indonesia.)",
  ]
    .filter(Boolean)
    .join("\n\n")

  // Pemimpin percakapan: Otak, atau agent spesialis kalau mode langsung.
  const leader = chat.agent ?? "otak"
  const subagent = chat.agent ? AGENT_TO_SUBAGENT[chat.agent] : undefined
  recordOffice({ chatId: chat.id, kind: "perintah", from: "user", to: leader, text: text.slice(0, 160), full: text })
  markBusy(chat.id, leader, true)

  const office = (event: BrainEvent) => {
    if (event.type === "handoff") {
      const to = toAgentId(event.to)
      recordOffice({ chatId: chat.id, kind: "tugas", from: leader, to, text: event.text, full: event.full })
      markBusy(chat.id, to, true)
    } else if (event.type === "step") {
      const from = event.agent ? toAgentId(event.agent) : leader
      recordOffice({ chatId: chat.id, kind: "langkah", from, to: from, text: event.label, full: "" })
    } else if (event.type === "report") {
      const from = toAgentId(event.from)
      recordOffice({ chatId: chat.id, kind: "laporan", from, to: leader, text: event.text, full: event.full })
      markBusy(chat.id, from, false)
    } else if (event.type === "done") {
      const summary = event.text.replace(/[`*_#>|]/g, "").replace(/\s+/g, " ").trim()
      recordOffice({ chatId: chat.id, kind: "jawaban", from: leader, to: "user", text: summary.slice(0, 160), full: event.text })
      clearBusy(chat.id)
    } else if (event.type === "error") {
      recordOffice({ chatId: chat.id, kind: "gagal", from: leader, to: "user", text: event.message, full: event.message })
      clearBusy(chat.id)
    }
  }

  await runBrain({
    chatId: chat.id,
    prompt,
    sessionId: chat.sessionId,
    agent: subagent,
    onEvent: (event) => {
      office(event)
      if (event.type === "step") steps.push({ id: event.id, label: event.label, agent: event.agent })
      if (event.type === "step-result") {
        const step = steps.find((item) => item.id === event.id)
        if (step) step.ok = event.ok
      }
      if (event.type === "model" && !models.includes(event.modelId)) models.push(event.modelId)
      if (event.type === "text") parts.push(event.text)
      if (event.type === "done") {
        if (event.sessionId) setSession(chat.id, event.sessionId)
        updateAssistantMessage(assistantId, {
          content: event.text || parts.join("\n\n"),
          steps,
          models,
          status: "selesai",
        })
      } else if (event.type === "error") {
        updateAssistantMessage(assistantId, {
          content: parts.join("\n\n"),
          steps,
          models,
          status: "gagal",
          error: event.message,
        })
      } else {
        updateAssistantMessage(assistantId, { content: parts.join("\n\n"), steps, models })
      }
      send(event)
    },
  })

  res.end()
})

const attachmentSchema = z.object({
  fileName: z.string().trim().min(1).max(160),
  // base64, maksimal sekitar 6 MB file asli (batas body JSON 8 MB)
  data: z.string().min(1).max(8_000_000),
})

// Lampiran dari komputer user: disimpan di dalam C:\ALfa supaya otak boleh membacanya.
chatRouter.post("/chats/:id/attachments", (req, res) => {
  if (!getChat(req.params.id)) {
    res.status(404).json({ message: "Percakapan tidak ditemukan." })
    return
  }
  const parsed = attachmentSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: "File tidak valid atau terlalu besar (maksimal sekitar 6 MB)." })
    return
  }
  const saved = saveAttachment(req.params.id, parsed.data.fileName, Buffer.from(parsed.data.data, "base64"))
  if ("error" in saved) {
    res.status(400).json({
      message:
        saved.error === "excel"
          ? "File Excel belum bisa dibaca otak. Ekspor dulu ke CSV atau PDF."
          : "Format file belum didukung. Pakai PDF, TXT, MD, CSV, DXF, PNG, JPG, WEBP, atau JSON.",
    })
    return
  }
  res.status(201).json(saved)
})

// Percakapan Kantor: riwayat terakhir, dan aliran langsung untuk halaman Kantor.
chatRouter.get("/kantor/events", (_req, res) => {
  res.json({ events: listOffice(60), busy: busyAgents() })
})

chatRouter.get("/kantor/stream", (req, res) => {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" })
  const write = (payload: unknown) => res.write(`data: ${JSON.stringify(payload)}\n\n`)
  write({ type: "state", busy: busyAgents() })
  const stop = onOffice(
    (event) => write({ type: "event", event }),
    (busy) => write({ type: "state", busy })
  )
  // Komentar berkala supaya koneksi tidak diputus proxy.
  const heartbeat = setInterval(() => res.write(": tetap-hidup\n\n"), 25000)
  req.on("close", () => {
    clearInterval(heartbeat)
    stop()
  })
})

chatRouter.get("/files", (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.slice(0, 100) : ""
  res.json(searchFiles(query))
})

chatRouter.get("/knowledge", (_req, res) => {
  res.json(listKnowledge())
})

const knowledgeSchema = z.object({
  fileName: z.string().trim().min(1).max(160),
  // base64, maksimal sekitar 6 MB file asli (batas body JSON 8 MB)
  data: z.string().min(1).max(8_000_000),
})

chatRouter.post("/knowledge", (req, res) => {
  const parsed = knowledgeSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: "File tidak valid atau terlalu besar (maksimal sekitar 6 MB)." })
    return
  }
  const saved = saveKnowledge(parsed.data.fileName, Buffer.from(parsed.data.data, "base64"))
  if (!saved) {
    res.status(400).json({ message: "Format file belum didukung. Pakai PDF, TXT, MD, CSV, DXF, PNG, JPG, atau JSON." })
    return
  }
  res.status(201).json({ name: saved })
})

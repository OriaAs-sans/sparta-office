import { mkdirSync, readdirSync, readFileSync, renameSync } from "node:fs"
import { basename, join } from "node:path"
import { z } from "zod"

import { preApprovalResultSchema } from "./agents/preapproval.ts"
import { triageResultSchema } from "./agents/triage.ts"
import { denahResultSchema } from "./denah/result.ts"
import { paths } from "./paths.ts"
import { insertFinishedTask } from "./tasks.ts"

// Format file yang ditulis subagent Claude Code ke workspace/outbox.
// Dijelaskan juga di C:\ALfa\.claude\agents\*.md.
const outboxSchema = z.discriminatedUnion("agentId", [
  z.object({
    agentId: z.literal("triase-maintenance"),
    judul: z.string().min(1),
    prompt: z.string().default(""),
    files: z.array(z.string()).default([]),
    hasil: triageResultSchema,
  }),
  z.object({
    agentId: z.literal("pre-approval"),
    judul: z.string().min(1),
    prompt: z.string().default(""),
    files: z.array(z.string()).default([]),
    hasil: preApprovalResultSchema,
  }),
  z.object({
    agentId: z.literal("denah-bangunan"),
    judul: z.string().min(1),
    prompt: z.string().default(""),
    files: z.array(z.string()).default([]),
    hasil: denahResultSchema,
  }),
])

function importFile(file: string) {
  const name = basename(file)
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(file, "utf8"))
  } catch {
    insertFinishedTask({
      agentId: "claude-code",
      title: `File outbox rusak: ${name}`,
      input: { file: name },
      mode: "claude-code",
      error: "File bukan JSON yang valid. Minta agent menulis ulang hasilnya.",
    })
    return
  }
  const parsed = outboxSchema.safeParse(raw)
  if (!parsed.success) {
    const agentId =
      typeof (raw as { agentId?: unknown })?.agentId === "string"
        ? (raw as { agentId: string }).agentId
        : "claude-code"
    const issue = parsed.error.issues[0]
    insertFinishedTask({
      agentId,
      title: `Format hasil tidak valid: ${name}`,
      input: { file: name },
      mode: "claude-code",
      error: `Field "${issue?.path.join(".")}" ${issue?.message ?? "tidak sesuai"}. Minta agent memperbaiki file ${name}.`,
    })
    return
  }
  const { agentId, judul, prompt, files, hasil } = parsed.data
  insertFinishedTask({ agentId, title: judul, input: { prompt, file: files }, mode: "claude-code", result: hasil })
}

export function scanOutbox() {
  mkdirSync(paths.outboxDone, { recursive: true })
  for (const name of readdirSync(paths.outbox)) {
    if (!name.endsWith(".json")) continue
    const file = join(paths.outbox, name)
    try {
      importFile(file)
    } finally {
      // Dipindah setelah diambil supaya tidak diimpor dua kali.
      renameSync(file, join(paths.outboxDone, `${Date.now()}-${name}`))
    }
  }
}

export function watchOutbox(intervalMs = 2000) {
  scanOutbox()
  setInterval(() => {
    try {
      scanOutbox()
    } catch (error) {
      console.error("[outbox]", error)
    }
  }, intervalMs)
}

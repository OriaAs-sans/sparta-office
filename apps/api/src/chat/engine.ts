import { spawn, spawnSync, type ChildProcess } from "node:child_process"
import { existsSync } from "node:fs"
import { relative, sep } from "node:path"
import { createInterface } from "node:readline"

import { paths } from "../paths.ts"

/**
 * Mesin Otak Sparta.
 *
 * Saat ini satu-satunya mesin adalah Claude Code lokal (langganan Pro, mode
 * headless). Saat kantor menyediakan API key, tambahkan mesin "claude-api"
 * dengan bentuk fungsi yang sama (runBrain), lalu pilih lewat CHAT_ENGINE.
 * Tampilan chat tidak perlu diubah.
 */

export type BrainEvent =
  | { type: "step"; id: string; label: string; agent?: string }
  | { type: "step-result"; id: string; ok: boolean }
  | { type: "text"; text: string }
  | { type: "model"; modelId: string }
  // Otak memberi tugas ke agent spesialis (isi diambil dari pesan tugas asli).
  | { type: "handoff"; id: string; to: string; text: string; full: string }
  // Agent spesialis melapor balik ke Otak (ringkasan dari jawaban asli).
  | { type: "report"; id: string; from: string; text: string; full: string; ok: boolean }
  | { type: "done"; text: string; sessionId: string | null }
  | { type: "error"; message: string }

function findClaudeCode(): string | null {
  const fromEnv = process.env.CLAUDE_CODE_PATH?.trim()
  if (fromEnv) return existsSync(fromEnv) ? fromEnv : null
  const lookup = spawnSync(process.platform === "win32" ? "where" : "which", ["claude"], { encoding: "utf8" })
  const first = lookup.status === 0 ? lookup.stdout.split(/\r?\n/).find(Boolean) : undefined
  return first?.trim() || null
}

export const engineInfo = (() => {
  const path = findClaudeCode()
  return {
    name: "claude-code" as const,
    available: path !== null,
    path,
    reason: path
      ? null
      : process.env.CLAUDE_CODE_PATH
        ? `CLAUDE_CODE_PATH menunjuk ke file yang tidak ada: ${process.env.CLAUDE_CODE_PATH}`
        : "Perintah claude tidak ditemukan. Pasang Claude Code CLI atau isi CLAUDE_CODE_PATH di apps/api/.env.",
  }
})()

// Path dalam aturan izin Claude Code ditulis sebagai //c/ALfa/... di Windows.
const rulePath = (absolute: string) =>
  "/" + absolute.replace(/\\/g, "/").replace(/^([A-Za-z]):/, (_, drive: string) => `/${drive.toLowerCase()}`)

const API_DIR = paths.apiRoot.replace(/\\/g, "/")

// Hanya alat ini yang boleh dipakai. Mode dontAsk menolak semua yang lain
// tanpa bertanya (sudah diuji: tulis di luar outbox dan perintah lain ditolak).
const ALLOWED_TOOLS = [
  `Read(${rulePath(paths.alfaRoot)}/**)`,
  "Grep",
  "Glob",
  "Task",
  `Write(${rulePath(paths.outbox)}/**)`,
  `Bash(pnpm --dir ${API_DIR} denah:*)`,
]
const DENIED_TOOLS = [`Read(${rulePath(paths.alfaRoot)}/**/.env)`, `Read(${rulePath(paths.alfaRoot)}/**/.env.*)`]

const runs = new Map<string, ChildProcess>()

export function isRunning(chatId: string) {
  return runs.has(chatId)
}

export function cancelRun(chatId: string) {
  const child = runs.get(chatId)
  if (!child) return false
  child.kill()
  return true
}

function shortPath(file: unknown) {
  if (typeof file !== "string") return "file"
  const rel = relative(paths.alfaRoot, file)
  return rel.startsWith("..") ? file : rel.split(sep).join("/")
}

function describeTool(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case "Read":
      return `Membaca ${shortPath(input.file_path)}`
    case "Grep":
      return `Mencari "${String(input.pattern ?? "").slice(0, 60)}"`
    case "Glob":
      return `Mencari file ${String(input.pattern ?? "")}`
    case "Task":
    case "Agent":
      return `Memanggil agent ${String(input.subagent_type ?? "")}: ${String(input.description ?? "")}`
    case "Write":
      return String(input.file_path ?? "").replace(/\\/g, "/").includes("workspace/outbox")
        ? "Mengirim hasil ke Inbox Review"
        : `Menulis ${shortPath(input.file_path)}`
    case "Bash": {
      const command = String(input.command ?? "")
      if (command.includes(" denah kirim")) return "Membuat model 3D dan mengirim ke Inbox Review"
      if (command.includes(" denah analisa")) return "Menganalisa file denah"
      return "Menjalankan perintah"
    }
    default:
      return `Memakai ${name}`
  }
}

type StreamEvent = {
  type: string
  subtype?: string
  session_id?: string
  parent_tool_use_id?: string | null
  result?: string
  is_error?: boolean
  message?: {
    content?: {
      type: string
      id?: string
      name?: string
      input?: Record<string, unknown>
      text?: string
      tool_use_id?: string
      is_error?: boolean
      content?: unknown
    }[]
  }
}

// Isi tool_result bisa string atau daftar blok; ambil teksnya saja.
function readableText(content: unknown): string {
  if (typeof content === "string") return content
  if (Array.isArray(content)) {
    return content
      .map((item) => (item && typeof item === "object" && "text" in item ? String((item as { text: unknown }).text) : ""))
      .filter(Boolean)
      .join("\n")
  }
  return ""
}

// Claude Code membungkus laporan subagent dengan pembuka "[Subagent hand-back]
// ... The report follows:", isi menjorok 2 spasi, lalu metadata (agentId,
// <usage>). Yang ditampilkan di kantor hanya isi laporannya.
function unwrapReport(text: string) {
  const marker = "The report follows:"
  const start = text.startsWith("[Subagent hand-back]") ? text.indexOf(marker) : -1
  let body = start >= 0 ? text.slice(start + marker.length) : text
  const meta = body.search(/\n(agentId:|<usage>)/)
  if (meta >= 0) body = body.slice(0, meta)
  return body
    .split("\n")
    .map((line) => line.replace(/^ {2}/, ""))
    .join("\n")
    .trim()
}

// Ringkasan untuk gelembung bicara: kalimat pertama tanpa tanda markdown.
function firstSentence(text: string) {
  const plain = text.replace(/[`*_#>|]/g, "").replace(/\s+/g, " ").trim()
  const sentence = plain.match(/^.{10,160}?[.!?](\s|$)/)?.[0] ?? plain.slice(0, 140)
  return sentence.trim() || "Selesai."
}

const MODEL_ID_PATTERN = /"model_id":\s*"([0-9a-f-]{36})"/g
const RUN_TIMEOUT_MS = 10 * 60 * 1000

export function runBrain(options: {
  chatId: string
  prompt: string
  sessionId: string | null
  /** Nama subagent untuk mode langsung (tanpa Otak). */
  agent?: string
  onEvent: (event: BrainEvent) => void
}): Promise<void> {
  const { chatId, prompt, sessionId, onEvent, agent: directAgent } = options
  if (!engineInfo.available || !engineInfo.path) {
    onEvent({ type: "error", message: engineInfo.reason ?? "Mesin otak tidak tersedia." })
    return Promise.resolve()
  }

  const args = [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--permission-mode",
    "dontAsk",
    "--strict-mcp-config",
    "--tools",
    "Read,Grep,Glob,Task,Write,Bash",
    "--allowedTools",
    ...ALLOWED_TOOLS,
    "--disallowedTools",
    ...DENIED_TOOLS,
  ]
  // Mode langsung: satu agent spesialis dijalankan tanpa Otak (claude --agent).
  // Mode biasa: Otak Sparta dengan prompt sistem tambahan.
  if (directAgent) args.push("--agent", directAgent)
  else args.push("--append-system-prompt-file", paths.otakPrompt)
  if (sessionId) args.push("--resume", sessionId)

  return new Promise((resolve) => {
    // Tanpa shell: argumen dikirim apa adanya, prompt lewat stdin.
    const child = spawn(engineInfo.path!, args, { cwd: paths.alfaRoot, windowsHide: true })
    runs.set(chatId, child)
    const timer = setTimeout(() => child.kill(), RUN_TIMEOUT_MS)
    let finished = false
    let latestSession = sessionId
    const replyParts: string[] = []
    const agentByToolId = new Map<string, string>()
    let stderr = ""

    const finish = (event: BrainEvent) => {
      if (finished) return
      finished = true
      onEvent(event)
    }

    child.stderr?.on("data", (chunk) => {
      stderr = (stderr + String(chunk)).slice(-2000)
    })

    createInterface({ input: child.stdout! }).on("line", (line) => {
      let event: StreamEvent
      try {
        event = JSON.parse(line) as StreamEvent
      } catch {
        return
      }
      if (event.session_id) latestSession = event.session_id
      const parent = event.parent_tool_use_id ?? null
      const agent = parent ? agentByToolId.get(parent) : undefined

      if (event.type === "assistant") {
        for (const block of event.message?.content ?? []) {
          if (block.type === "tool_use" && block.id && block.name) {
            if (block.name === "Task" || block.name === "Agent") {
              const to = String(block.input?.subagent_type ?? "agent")
              agentByToolId.set(block.id, to)
              onEvent({
                type: "handoff",
                id: block.id,
                to,
                text: String(block.input?.description ?? "Tugas baru"),
                full: String(block.input?.prompt ?? "").slice(0, 4000),
              })
            }
            onEvent({ type: "step", id: block.id, label: describeTool(block.name, block.input ?? {}), agent })
          }
          // Teks dari agent spesialis tidak ikut jadi jawaban; yang tampil
          // hanya jawaban Otak Sparta sendiri.
          if (block.type === "text" && block.text && !parent) {
            replyParts.push(block.text)
            onEvent({ type: "text", text: block.text })
          }
        }
      }

      if (event.type === "user") {
        for (const block of event.message?.content ?? []) {
          if (block.type !== "tool_result" || !block.tool_use_id) continue
          onEvent({ type: "step-result", id: block.tool_use_id, ok: !block.is_error })
          const text = typeof block.content === "string" ? block.content : JSON.stringify(block.content ?? "")
          const reporter = agentByToolId.get(block.tool_use_id)
          if (reporter) {
            const full = unwrapReport(readableText(block.content)).slice(0, 4000)
            onEvent({ type: "report", id: block.tool_use_id, from: reporter, text: firstSentence(full), full, ok: !block.is_error })
          }
          for (const match of text.replace(/\\"/g, '"').matchAll(MODEL_ID_PATTERN)) {
            onEvent({ type: "model", modelId: match[1] })
          }
        }
      }

      if (event.type === "result") {
        if (event.is_error && !replyParts.length) {
          finish({ type: "error", message: event.result || "Otak Sparta berhenti dengan error." })
        } else {
          finish({ type: "done", text: event.result ?? replyParts.join("\n\n"), sessionId: latestSession })
        }
      }
    })

    child.on("error", (error) => {
      finish({ type: "error", message: `Claude Code tidak bisa dijalankan: ${error.message}` })
    })

    child.on("close", (code, signal) => {
      clearTimeout(timer)
      runs.delete(chatId)
      if (signal || code === null) {
        finish({ type: "error", message: "Dihentikan sebelum selesai." })
      } else if (code !== 0) {
        const hint = /log ?in|auth|credential/i.test(stderr)
          ? " Claude Code belum login. Jalankan claude sekali di terminal lalu login."
          : ""
        finish({ type: "error", message: `Claude Code berhenti dengan kode ${code}.${hint}` })
      } else {
        finish({ type: "done", text: replyParts.join("\n\n"), sessionId: latestSession })
      }
      resolve()
    })

    child.stdin?.end(prompt)
  })
}

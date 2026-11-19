import { randomUUID } from "node:crypto"

import { AgentRunError } from "./agents/claude.ts"
import { runDemoPreApproval, runDemoTriage } from "./agents/demo.ts"
import { runPreApproval, type PreApprovalInput } from "./agents/preapproval.ts"
import { runTriage, type TriageInput } from "./agents/triage.ts"
import { config } from "./config.ts"
import { db } from "./db.ts"

export type TaskStatus =
  | "antri"
  | "berjalan"
  | "menunggu_review"
  | "disetujui"
  | "ditolak"
  | "gagal"

// live: Claude API dari web. demo: aturan sederhana. claude-code: hasil
// subagent Claude Code lewat outbox. konverter: DXF diubah ke 3D tanpa AI.
export type TaskMode = "live" | "demo" | "claude-code" | "konverter"

type TaskRow = {
  id: string
  agent_id: string
  title: string
  input_json: string
  status: TaskStatus
  result_json: string | null
  error: string | null
  decision_note: string | null
  created_at: string
  updated_at: string
  decided_at: string | null
  mode: TaskMode
}

export type Task = {
  id: string
  agentId: string
  title: string
  input: unknown
  status: TaskStatus
  result: unknown
  error: string | null
  decisionNote: string | null
  createdAt: string
  updatedAt: string
  decidedAt: string | null
  mode: TaskMode
}

function toTask(row: TaskRow): Task {
  const input = JSON.parse(row.input_json) as Record<string, unknown>
  // Foto tidak dikirim balik di daftar tugas supaya respons tetap kecil.
  if (input.foto && typeof input.foto === "object") {
    input.foto = { terlampir: true }
  }
  return {
    id: row.id,
    agentId: row.agent_id,
    title: row.title,
    input,
    status: row.status,
    result: row.result_json ? JSON.parse(row.result_json) : null,
    error: row.error,
    decisionNote: row.decision_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    decidedAt: row.decided_at,
    mode: row.mode,
  }
}

const now = () => new Date().toISOString()

export function listTasks(filter: { agentId?: string; status?: TaskStatus; limit?: number }) {
  const where: string[] = []
  const params: string[] = []
  if (filter.agentId) {
    where.push("agent_id = ?")
    params.push(filter.agentId)
  }
  if (filter.status) {
    where.push("status = ?")
    params.push(filter.status)
  }
  const sql = `SELECT * FROM tasks ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY created_at DESC LIMIT ${Math.min(filter.limit ?? 50, 200)}`
  return (db.prepare(sql).all(...params) as TaskRow[]).map(toTask)
}

export function getTask(id: string) {
  const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as TaskRow | undefined
  return row ? toTask(row) : null
}

function updateTask(id: string, fields: Partial<Record<keyof TaskRow, string | null>>) {
  const entries = Object.entries({ ...fields, updated_at: now() })
  db.prepare(`UPDATE tasks SET ${entries.map(([key]) => `${key} = ?`).join(", ")} WHERE id = ?`).run(
    ...entries.map(([, value]) => value ?? null),
    id
  )
}

type NewTask =
  | { agentId: "triase-maintenance"; input: TriageInput }
  | { agentId: "pre-approval"; input: PreApprovalInput }

function titleFor(task: NewTask) {
  if (task.agentId === "triase-maintenance") {
    const firstLine = task.input.laporan.split("\n")[0].slice(0, 80)
    return `${task.input.toko}: ${firstLine}`
  }
  return `${task.input.toko}: ${task.input.judul}`
}

export function createTask(task: NewTask) {
  const id = randomUUID()
  const timestamp = now()
  db.prepare(
    `INSERT INTO tasks (id, agent_id, title, input_json, status, mode, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'antri', ?, ?, ?)`
  ).run(id, task.agentId, titleFor(task), JSON.stringify(task.input), config.mode, timestamp, timestamp)

  // Dijalankan di belakang. UI memantau status lewat polling.
  void execute(id, task)
  return getTask(id)!
}

async function execute(id: string, task: NewTask) {
  updateTask(id, { status: "berjalan" })
  try {
    const demo = config.mode === "demo"
    const result =
      task.agentId === "triase-maintenance"
        ? await (demo ? runDemoTriage : runTriage)(task.input)
        : await (demo ? runDemoPreApproval : runPreApproval)(task.input)
    updateTask(id, { status: "menunggu_review", result_json: JSON.stringify(result) })
  } catch (error) {
    const message =
      error instanceof AgentRunError ? error.message : "Terjadi error tak terduga di server."
    if (!(error instanceof AgentRunError)) console.error(`[task ${id}]`, error)
    updateTask(id, { status: "gagal", error: message })
  }
}

/** Menyimpan tugas yang sudah selesai dikerjakan di luar server (outbox, konverter). */
export function insertFinishedTask(task: {
  agentId: string
  title: string
  input: unknown
  mode: TaskMode
  result?: unknown
  error?: string
}) {
  const id = randomUUID()
  const timestamp = now()
  db.prepare(
    `INSERT INTO tasks (id, agent_id, title, input_json, status, result_json, error, mode, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    task.agentId,
    task.title.slice(0, 200),
    JSON.stringify(task.input ?? {}),
    task.error ? "gagal" : "menunggu_review",
    task.result === undefined ? null : JSON.stringify(task.result),
    task.error ?? null,
    task.mode,
    timestamp,
    timestamp
  )
  return getTask(id)!
}

export function decideTask(id: string, decision: "disetujui" | "ditolak", note: string) {
  const task = getTask(id)
  if (!task) return { error: "not_found" as const }
  if (task.status !== "menunggu_review") return { error: "not_reviewable" as const }
  updateTask(id, { status: decision, decision_note: note || null, decided_at: now() })
  return { task: getTask(id)! }
}

export function agentActivity(agentId: string) {
  const rows = db
    .prepare(
      `SELECT status, COUNT(*) AS jumlah FROM tasks WHERE agent_id = ? GROUP BY status`
    )
    .all(agentId) as { status: TaskStatus; jumlah: number }[]
  const count = (status: TaskStatus) => rows.find((row) => row.status === status)?.jumlah ?? 0
  return {
    berjalan: count("antri") + count("berjalan"),
    menungguReview: count("menunggu_review"),
    gagal: count("gagal"),
    selesai: count("disetujui") + count("ditolak"),
  }
}

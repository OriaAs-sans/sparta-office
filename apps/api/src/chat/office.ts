import { randomUUID } from "node:crypto"
import { EventEmitter } from "node:events"

import { db } from "../db.ts"

/**
 * Percakapan Kantor: catatan siapa memberi tugas ke siapa, dan apa laporannya.
 * Semua isi berasal dari kejadian asli di mesin otak (perintah user, pesan
 * tugas Otak ke agent, laporan agent, jawaban akhir). Tidak ada obrolan
 * yang dikarang untuk meramaikan kantor.
 */

db.exec(`
  CREATE TABLE IF NOT EXISTS office_events (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    from_agent TEXT NOT NULL,
    to_agent TEXT NOT NULL,
    text TEXT NOT NULL,
    full_text TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS office_events_time_idx ON office_events (created_at);
`)

export type OfficeKind = "perintah" | "tugas" | "langkah" | "laporan" | "jawaban" | "gagal"

export type OfficeEvent = {
  id: string
  chatId: string
  kind: OfficeKind
  from: string
  to: string
  text: string
  full: string
  createdAt: string
}

// Nama subagent di Claude Code dipetakan ke id agent di Sparta Office.
const SUBAGENT_TO_AGENT: Record<string, string> = {
  "studio-denah": "denah-bangunan",
  "triase-maintenance": "triase-maintenance",
  "pre-approval": "pre-approval",
}
export const AGENT_TO_SUBAGENT = Object.fromEntries(Object.entries(SUBAGENT_TO_AGENT).map(([k, v]) => [v, k]))

export const toAgentId = (subagent: string) => SUBAGENT_TO_AGENT[subagent] ?? subagent

const bus = new EventEmitter()
bus.setMaxListeners(50)

// Siapa yang sedang bekerja saat ini, per percakapan yang berjalan.
const busy = new Map<string, Set<string>>()

export function busyAgents() {
  const all = new Set<string>()
  for (const set of busy.values()) for (const id of set) all.add(id)
  return [...all]
}

function emitState() {
  bus.emit("state", busyAgents())
}

export function markBusy(chatId: string, agentId: string, on: boolean) {
  const set = busy.get(chatId) ?? new Set<string>()
  if (on) set.add(agentId)
  else set.delete(agentId)
  if (set.size) busy.set(chatId, set)
  else busy.delete(chatId)
  emitState()
}

export function clearBusy(chatId: string) {
  busy.delete(chatId)
  emitState()
}

export function recordOffice(event: Omit<OfficeEvent, "id" | "createdAt">) {
  const full: OfficeEvent = { ...event, id: randomUUID(), createdAt: new Date().toISOString() }
  // Langkah (membaca file, mencari) hanya disiarkan langsung untuk gelembung,
  // tidak disimpan, supaya catatan percakapan tetap ringkas.
  if (event.kind !== "langkah") {
    db.prepare(
      `INSERT INTO office_events (id, chat_id, kind, from_agent, to_agent, text, full_text, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(full.id, full.chatId, full.kind, full.from, full.to, full.text.slice(0, 300), full.full.slice(0, 4000), full.createdAt)
  }
  bus.emit("event", full)
  return full
}

type Row = {
  id: string
  chat_id: string
  kind: OfficeKind
  from_agent: string
  to_agent: string
  text: string
  full_text: string
  created_at: string
}

export function listOffice(limit = 60): OfficeEvent[] {
  const rows = db
    .prepare("SELECT * FROM office_events ORDER BY created_at DESC, rowid DESC LIMIT ?")
    .all(Math.min(limit, 200)) as Row[]
  return rows.reverse().map((row) => ({
    id: row.id,
    chatId: row.chat_id,
    kind: row.kind,
    from: row.from_agent,
    to: row.to_agent,
    text: row.text,
    full: row.full_text,
    createdAt: row.created_at,
  }))
}

export function onOffice(listener: (event: OfficeEvent) => void, onState: (busy: string[]) => void) {
  bus.on("event", listener)
  bus.on("state", onState)
  return () => {
    bus.off("event", listener)
    bus.off("state", onState)
  }
}

import { randomUUID } from "node:crypto"

import { db } from "../db.ts"

db.exec(`
  CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    session_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    files_json TEXT NOT NULL DEFAULT '[]',
    steps_json TEXT NOT NULL DEFAULT '[]',
    models_json TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL,
    error TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS chat_messages_chat_idx ON chat_messages (chat_id, created_at);
`)

// Kolom agent: percakapan "langsung ke agent" (tanpa Otak). Kosong = Otak.
const chatColumns = db.prepare("PRAGMA table_info(chats)").all() as { name: string }[]
if (!chatColumns.some((column) => column.name === "agent")) {
  db.exec("ALTER TABLE chats ADD COLUMN agent TEXT")
}

// Jawaban yang masih "berjalan" saat server mati tidak akan selesai.
db.prepare(
  "UPDATE chat_messages SET status = 'gagal', error = ? WHERE status = 'berjalan'"
).run("Server dimulai ulang saat Otak Sparta bekerja. Kirim ulang pesannya.")

export type ChatStep = { id: string; label: string; agent?: string; ok?: boolean }

export type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  files: string[]
  steps: ChatStep[]
  models: string[]
  status: "selesai" | "berjalan" | "gagal"
  error: string | null
  createdAt: string
}

type MessageRow = {
  id: string
  role: "user" | "assistant"
  content: string
  files_json: string
  steps_json: string
  models_json: string
  status: ChatMessage["status"]
  error: string | null
  created_at: string
}

type ChatRow = { id: string; title: string; session_id: string | null; agent: string | null; created_at: string; updated_at: string }

const now = () => new Date().toISOString()

const toMessage = (row: MessageRow): ChatMessage => ({
  id: row.id,
  role: row.role,
  content: row.content,
  files: JSON.parse(row.files_json),
  steps: JSON.parse(row.steps_json),
  models: JSON.parse(row.models_json),
  status: row.status,
  error: row.error,
  createdAt: row.created_at,
})

// Cuplikan pesan terakhir untuk daftar riwayat. Tanda markdown dibuang
// supaya yang tampil teks biasa.
const plain = (text: string) =>
  text.replace(/[`*_#>|[\]()-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 90)

export function listChats() {
  const rows = db
    .prepare(
      `SELECT c.*, (SELECT content FROM chat_messages m WHERE m.chat_id = c.id AND m.content != ''
                    ORDER BY m.created_at DESC, m.rowid DESC LIMIT 1) AS last_content
       FROM chats c ORDER BY c.updated_at DESC LIMIT 100`
    )
    .all() as (ChatRow & { last_content: string | null })[]
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    agent: row.agent,
    preview: row.last_content ? plain(row.last_content) : "",
    updatedAt: row.updated_at,
  }))
}

export function createChat(agent: string | null = null) {
  const id = randomUUID()
  const timestamp = now()
  db.prepare("INSERT INTO chats (id, title, agent, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(
    id,
    "Percakapan baru",
    agent,
    timestamp,
    timestamp
  )
  return { id, title: "Percakapan baru", agent, preview: "", updatedAt: timestamp }
}

export function getChat(id: string) {
  const chat = db.prepare("SELECT * FROM chats WHERE id = ?").get(id) as ChatRow | undefined
  if (!chat) return null
  const messages = (
    db.prepare("SELECT * FROM chat_messages WHERE chat_id = ? ORDER BY created_at, rowid").all(id) as MessageRow[]
  ).map(toMessage)
  return { id: chat.id, title: chat.title, agent: chat.agent, sessionId: chat.session_id, updatedAt: chat.updated_at, messages }
}

export function deleteChat(id: string) {
  db.prepare("DELETE FROM chat_messages WHERE chat_id = ?").run(id)
  return db.prepare("DELETE FROM chats WHERE id = ?").run(id).changes > 0
}

export function addMessage(chatId: string, message: Pick<ChatMessage, "role" | "content" | "files" | "status">) {
  const id = randomUUID()
  const timestamp = now()
  db.prepare(
    `INSERT INTO chat_messages (id, chat_id, role, content, files_json, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, chatId, message.role, message.content, JSON.stringify(message.files), message.status, timestamp)
  // Judul percakapan diambil dari pesan pertama user.
  if (message.role === "user") {
    db.prepare("UPDATE chats SET title = CASE WHEN title = 'Percakapan baru' THEN ? ELSE title END, updated_at = ? WHERE id = ?").run(
      message.content.slice(0, 60),
      timestamp,
      chatId
    )
  }
  return id
}

export function updateAssistantMessage(
  id: string,
  fields: { content?: string; steps?: ChatStep[]; models?: string[]; status?: ChatMessage["status"]; error?: string | null }
) {
  const sets: string[] = []
  const values: (string | null)[] = []
  if (fields.content !== undefined) sets.push("content = ?"), values.push(fields.content)
  if (fields.steps) sets.push("steps_json = ?"), values.push(JSON.stringify(fields.steps))
  if (fields.models) sets.push("models_json = ?"), values.push(JSON.stringify(fields.models))
  if (fields.status) sets.push("status = ?"), values.push(fields.status)
  if (fields.error !== undefined) sets.push("error = ?"), values.push(fields.error)
  if (!sets.length) return
  db.prepare(`UPDATE chat_messages SET ${sets.join(", ")} WHERE id = ?`).run(...values, id)
}

export function setSession(chatId: string, sessionId: string) {
  db.prepare("UPDATE chats SET session_id = ?, updated_at = ? WHERE id = ?").run(sessionId, now(), chatId)
}

import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { DatabaseSync } from "node:sqlite"

import { config } from "./config.ts"

// SQLite bawaan Node dipakai untuk prototipe supaya tidak perlu menyiapkan
// Postgres. Saat digabung ke Sparta, tabel ini dipindah ke Prisma + Postgres.
mkdirSync(dirname(config.dbPath), { recursive: true })
export const db = new DatabaseSync(config.dbPath)

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    title TEXT NOT NULL,
    input_json TEXT NOT NULL,
    status TEXT NOT NULL,
    result_json TEXT,
    error TEXT,
    decision_note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    decided_at TEXT
  );
  CREATE INDEX IF NOT EXISTS tasks_agent_idx ON tasks (agent_id, created_at);
`)

// Kolom mode ditambah setelah tabel pertama dibuat, jadi database lama
// perlu di-upgrade. Tugas lama dianggap live.
const columns = db.prepare("PRAGMA table_info(tasks)").all() as { name: string }[]
if (!columns.some((column) => column.name === "mode")) {
  db.exec("ALTER TABLE tasks ADD COLUMN mode TEXT NOT NULL DEFAULT 'live'")
}

// Tugas yang masih "antri" atau "berjalan" saat server mati tidak akan
// pernah selesai, jadi tandai gagal supaya tidak menggantung di UI.
db.prepare(
  `UPDATE tasks SET status = 'gagal', error = ?, updated_at = ?
   WHERE status IN ('antri', 'berjalan')`
).run("Server dimulai ulang saat tugas ini berjalan. Kirim ulang tugasnya.", new Date().toISOString())

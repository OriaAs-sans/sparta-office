import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

// Semua path dihitung dari lokasi file ini, supaya CLI dan server sama-sama
// menemukan folder yang sama walau dijalankan dari folder berbeda.
const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const projectRoot = resolve(apiRoot, "../..")

export const paths = {
  apiRoot,
  db: process.env.DB_PATH ? resolve(process.env.DB_PATH) : resolve(apiRoot, "data/office.db"),
  denahModels: resolve(apiRoot, "data/denah"),
  // Subagent Claude Code menaruh hasil kerja di sini, lalu API mengambilnya.
  outbox: resolve(projectRoot, "workspace/outbox"),
  outboxDone: resolve(projectRoot, "workspace/outbox/sudah-diambil"),
  // Basis pengetahuan Otak Sparta.
  knowledge: resolve(projectRoot, "knowledge"),
  // File yang dilampirkan dari kotak chat, satu folder per percakapan.
  attachments: resolve(projectRoot, "workspace/lampiran"),
  // Folder kerja Claude Code (tempat .claude/agents berada).
  alfaRoot: resolve(projectRoot, ".."),
  otakPrompt: resolve(apiRoot, "src/chat/otak.md"),
}

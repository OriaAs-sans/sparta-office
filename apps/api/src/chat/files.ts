import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { extname, isAbsolute, join, relative, sep } from "node:path"

import { paths } from "../paths.ts"

// Jenis file yang bisa dibaca Otak Sparta.
export const READABLE_EXT = new Set([".pdf", ".txt", ".md", ".csv", ".dxf", ".png", ".jpg", ".jpeg", ".webp", ".json"])
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "graphify-out", ".next", "data", "sudah-diambil", ".claude"])
const MAX_DEPTH = 5
const MAX_FILES = 3000

type FileEntry = { path: string; rel: string; size: number }

let cache: { at: number; files: FileEntry[] } | null = null

function walk(dir: string, depth: number, out: FileEntry[]) {
  if (depth > MAX_DEPTH || out.length >= MAX_FILES) return
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (out.length >= MAX_FILES) return
    if (entry.name.startsWith(".env")) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full, depth + 1, out)
    } else if (READABLE_EXT.has(extname(entry.name).toLowerCase())) {
      let size = 0
      try {
        size = statSync(full).size
      } catch {
        continue
      }
      out.push({ path: full, rel: relative(paths.alfaRoot, full).split(sep).join("/"), size })
    }
  }
}

/** Mencari file di C:\ALfa untuk fitur @mention di chat. */
export function searchFiles(query: string, limit = 20) {
  if (!cache || Date.now() - cache.at > 30_000) {
    const files: FileEntry[] = []
    walk(paths.alfaRoot, 0, files)
    cache = { at: Date.now(), files }
  }
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const matches = cache.files.filter((file) => words.every((word) => file.rel.toLowerCase().includes(word)))
  // File basis pengetahuan didahulukan.
  matches.sort((a, b) => Number(b.rel.includes("sparta-office/knowledge/")) - Number(a.rel.includes("sparta-office/knowledge/")))
  return matches.slice(0, limit).map((file) => ({ path: file.path, rel: file.rel, size: file.size }))
}

export function listKnowledge() {
  mkdirSync(paths.knowledge, { recursive: true })
  return readdirSync(paths.knowledge, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const stat = statSync(join(paths.knowledge, entry.name))
      return { name: entry.name, size: stat.size, updatedAt: stat.mtime.toISOString() }
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function saveKnowledge(fileName: string, data: Buffer) {
  // Nama file dibersihkan supaya tidak bisa keluar dari folder knowledge.
  const safe = fileName.replace(/[\\/:*?"<>|]/g, "-").replace(/^\.+/, "").slice(0, 120)
  if (!safe || !READABLE_EXT.has(extname(safe).toLowerCase())) return null
  mkdirSync(paths.knowledge, { recursive: true })
  writeFileSync(join(paths.knowledge, safe), data)
  cache = null
  return safe
}

// Garis miring (kedua arah) dan karakter terlarang Windows diganti, supaya
// nama file tidak bisa membuat path keluar dari foldernya.
const safeName = (fileName: string) =>
  fileName.replace(/[\\/:*?"<>|]/g, "-").replace(/^\.+/, "").slice(0, 120)

/** Menyimpan lampiran chat ke workspace/lampiran/<chatId>/. */
export function saveAttachment(chatId: string, fileName: string, data: Buffer) {
  const safe = safeName(fileName)
  const ext = extname(safe).toLowerCase()
  if (!safe || !READABLE_EXT.has(ext)) return { error: ext === ".xlsx" || ext === ".xls" ? "excel" : "format" } as const
  const dir = join(paths.attachments, chatId)
  mkdirSync(dir, { recursive: true })
  const full = join(dir, safe)
  if (relative(dir, full).startsWith("..")) return { error: "format" } as const
  writeFileSync(full, data)
  cache = null
  return { path: full, rel: relative(paths.alfaRoot, full).split(sep).join("/"), size: data.length } as const
}

/** Hanya file di dalam C:\ALfa yang boleh dilampirkan ke pesan. */
export function isAllowedMention(path: string) {
  if (!isAbsolute(path)) return false
  const rel = relative(paths.alfaRoot, path)
  return !rel.startsWith("..") && !rel.includes(`${sep}.env`) && !rel.startsWith(".env")
}

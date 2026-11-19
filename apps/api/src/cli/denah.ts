/**
 * Alat untuk subagent Studio Denah di Claude Code.
 *
 *   pnpm --dir C:/ALfa/sparta-office/apps/api denah analisa "<file.dxf>"
 *   pnpm --dir C:/ALfa/sparta-office/apps/api denah kirim "<file.dxf>" \
 *     --judul "TZ01: Denah toko" --dinding "DINDING,KUSEN" \
 *     --catatan "..." --catatan "..." --prompt "prompt asli user"
 *
 * "analisa" hanya membaca dan mencetak ringkasan (JSON).
 * "kirim" membuat model 3D lalu menaruh hasil di outbox, dan web
 * mengambilnya otomatis ke Inbox Review.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { basename, join, resolve } from "node:path"
import { parseArgs } from "node:util"

import { convertDxf, summarize } from "../denah/convert.ts"
import { saveModel } from "../denah/store.ts"
import { paths } from "../paths.ts"

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    judul: { type: "string" },
    dinding: { type: "string" },
    catatan: { type: "string", multiple: true },
    prompt: { type: "string" },
  },
})

const [command, fileArg] = positionals

function fail(message: string): never {
  console.error(`Error: ${message}`)
  process.exit(1)
}

if (!command || !["analisa", "kirim"].includes(command) || !fileArg) {
  fail('Pakai: denah analisa "<file.dxf>"  atau  denah kirim "<file.dxf>" --judul "..." [--dinding "A,B"] [--catatan "..."]')
}

const file = resolve(fileArg)
if (!/\.dxf/i.test(file)) {
  fail("File harus DXF. File DWG perlu disimpan ulang sebagai DXF dari AutoCAD (Save As > DXF).")
}

let text: string
try {
  text = readFileSync(file, "utf8")
} catch {
  fail(`File tidak ditemukan: ${file}`)
}

const wallLayers = values.dinding?.split(",").map((name) => name.trim()).filter(Boolean)
const model = convertDxf(text, basename(file), wallLayers)
const summary = summarize(model)

if (wallLayers?.length) {
  const unknown = wallLayers.filter((name) => !model.layers.some((layer) => layer.name === name))
  if (unknown.length) fail(`Layer tidak ada di file: ${unknown.join(", ")}. Layer yang ada: ${model.layers.map((l) => l.name).join(", ")}`)
}

if (command === "analisa") {
  console.log(
    JSON.stringify(
      { file: basename(file), ...summary, contoh_teks: [...new Set(model.labels.map((l) => l.text))].slice(0, 30) },
      null,
      2
    )
  )
  process.exit(0)
}

if (!values.judul) fail('Isi --judul, misal --judul "TZ01: Denah toko"')

const modelId = saveModel(model)
const catatan = values.catatan ?? []
const entry = {
  agentId: "denah-bangunan",
  judul: values.judul,
  prompt: values.prompt ?? "",
  files: [file],
  hasil: {
    ringkasan: `Denah ${basename(file)} diubah ke model 3D: ${summary.lebar_m} x ${summary.panjang_m} m, dinding dari layer ${summary.layer_dinding.join(", ")}.`,
    model_id: modelId,
    ...summary,
    catatan,
  },
}

mkdirSync(paths.outbox, { recursive: true })
const outFile = join(paths.outbox, `denah-${Date.now()}.json`)
writeFileSync(outFile, JSON.stringify(entry, null, 2))
console.log(JSON.stringify({ terkirim: outFile, model_id: modelId, ...summary, layer: undefined }, null, 2))

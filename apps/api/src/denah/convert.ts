import { createRequire } from "node:module"

// dxf-parser hanya menyediakan CommonJS.
const require = createRequire(import.meta.url)
const DxfParser = require("dxf-parser") as new () => { parseSync(text: string): Dxf }

type Point = { x: number; y: number }
type DxfEntity = {
  type: string
  layer?: string
  vertices?: (Point & { bulge?: number })[]
  shape?: boolean
  center?: Point
  radius?: number
  startAngle?: number
  endAngle?: number
  name?: string
  position?: Point
  xScale?: number
  yScale?: number
  rotation?: number
  text?: string
  startPoint?: Point
}
type Dxf = {
  header?: Record<string, unknown>
  entities: DxfEntity[]
  blocks?: Record<string, { entities?: DxfEntity[]; position?: Point }>
}

export type DenahModel = {
  sourceName: string
  unitsHeader: number | null
  scaleToMeter: number
  scaleGuessed: boolean
  width: number
  depth: number
  layers: { name: string; segments: number }[]
  wallLayers: string[]
  // [x1, y1, x2, y2, indeks layer], dalam meter, titik nol di pojok kiri bawah
  segments: [number, number, number, number, number][]
  labels: { text: string; x: number; y: number }[]
}

const UNIT_TO_METER: Record<number, number> = { 1: 0.0254, 2: 0.3048, 4: 0.001, 5: 0.01, 6: 1 }

type Transform = { dx: number; dy: number; sx: number; sy: number; rot: number }
const IDENTITY: Transform = { dx: 0, dy: 0, sx: 1, sy: 1, rot: 0 }

function apply(t: Transform, p: Point): Point {
  const x = p.x * t.sx
  const y = p.y * t.sy
  const cos = Math.cos(t.rot)
  const sin = Math.sin(t.rot)
  return { x: x * cos - y * sin + t.dx, y: x * sin + y * cos + t.dy }
}

function compose(parent: Transform, child: Transform): Transform {
  // Titik di block anak diubah dulu oleh transform anak, lalu oleh induk.
  const origin = apply(parent, { x: child.dx, y: child.dy })
  return {
    dx: origin.x,
    dy: origin.y,
    sx: parent.sx * child.sx,
    sy: parent.sy * child.sy,
    rot: parent.rot + child.rot,
  }
}

function arcPoints(center: Point, radius: number, start: number, end: number, steps: number) {
  let sweep = end - start
  if (sweep <= 0) sweep += Math.PI * 2
  return Array.from({ length: steps + 1 }, (_, i) => {
    const angle = start + (sweep * i) / steps
    return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) }
  })
}

// Membersihkan kode format MTEXT, misal "{\\A1;\\farial|b0;Lampu}" menjadi "Lampu".
function cleanText(raw: string) {
  return raw
    .replace(/\\[A-Za-z][^;\\{}]*;/g, "")
    .replace(/\\P/g, " ")
    .replace(/[{}]/g, "")
    .trim()
}

type RawSegment = { a: Point; b: Point; layer: string }

function flatten(
  entities: DxfEntity[],
  dxf: Dxf,
  t: Transform,
  out: { segments: RawSegment[]; labels: { text: string; at: Point }[] },
  depth = 0,
  parentLayer?: string
) {
  if (depth > 8) return
  for (const entity of entities) {
    // Entitas di layer "0" di dalam block ikut layer INSERT-nya (aturan AutoCAD).
    const layer = entity.layer && entity.layer !== "0" ? entity.layer : (parentLayer ?? entity.layer ?? "0")
    const push = (points: Point[], closed = false) => {
      for (let i = 0; i < points.length - 1; i++) {
        out.segments.push({ a: apply(t, points[i]), b: apply(t, points[i + 1]), layer })
      }
      if (closed && points.length > 2) {
        out.segments.push({ a: apply(t, points[points.length - 1]), b: apply(t, points[0]), layer })
      }
    }
    switch (entity.type) {
      case "LINE":
      case "LWPOLYLINE":
      case "POLYLINE":
        if (entity.vertices?.length) push(entity.vertices, entity.shape)
        break
      case "ARC":
        if (entity.center && entity.radius) {
          push(arcPoints(entity.center, entity.radius, entity.startAngle ?? 0, entity.endAngle ?? Math.PI * 2, 12))
        }
        break
      case "CIRCLE":
        if (entity.center && entity.radius) push(arcPoints(entity.center, entity.radius, 0, Math.PI * 2, 24))
        break
      case "TEXT":
      case "MTEXT": {
        const at = entity.startPoint ?? entity.position
        const text = entity.text ? cleanText(entity.text) : ""
        if (at && text) out.labels.push({ text, at: apply(t, at) })
        break
      }
      case "INSERT": {
        const block = entity.name ? dxf.blocks?.[entity.name] : undefined
        if (!block?.entities || !entity.position) break
        const base = block.position ?? { x: 0, y: 0 }
        const child: Transform = {
          dx: entity.position.x,
          dy: entity.position.y,
          sx: entity.xScale ?? 1,
          sy: entity.yScale ?? 1,
          rot: ((entity.rotation ?? 0) * Math.PI) / 180,
        }
        const shifted = compose(compose(t, child), { dx: -base.x, dy: -base.y, sx: 1, sy: 1, rot: 0 })
        flatten(block.entities, dxf, shifted, out, depth + 1, layer)
        break
      }
    }
  }
}

const WALL_LAYER_PATTERN = /dinding|tembok|wall|bata/i

export function convertDxf(text: string, sourceName: string, wallLayers?: string[]): DenahModel {
  const dxf = new DxfParser().parseSync(text)
  const raw = { segments: [] as RawSegment[], labels: [] as { text: string; at: Point }[] }
  flatten(dxf.entities, dxf, IDENTITY, raw)
  if (!raw.segments.length) {
    throw new Error("DXF tidak berisi garis yang bisa dibaca (LINE, POLYLINE, ARC, atau block).")
  }

  const xs = raw.segments.flatMap((s) => [s.a.x, s.b.x])
  const ys = raw.segments.flatMap((s) => [s.a.y, s.b.y])
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const extent = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY)

  // Toko berukuran kira-kira 5 sampai 300 meter. Kalau satuan di header
  // menghasilkan ukuran di luar itu, satuannya kemungkinan salah tercatat.
  const unitsHeader = typeof dxf.header?.$INSUNITS === "number" ? (dxf.header.$INSUNITS as number) : null
  let scale = unitsHeader !== null ? UNIT_TO_METER[unitsHeader] : undefined
  let guessed = false
  const plausible = (s: number) => extent * s >= 3 && extent * s <= 300
  if (!scale || !plausible(scale)) {
    scale = [0.001, 0.01, 1].find(plausible) ?? 1
    guessed = true
  }

  const layerNames = [...new Set(raw.segments.map((s) => s.layer))]
  const counts = new Map<string, number>()
  for (const s of raw.segments) counts.set(s.layer, (counts.get(s.layer) ?? 0) + 1)

  const chosen = wallLayers?.length
    ? wallLayers.filter((name) => layerNames.includes(name))
    : layerNames.filter((name) => WALL_LAYER_PATTERN.test(name))

  const round = (v: number) => Math.round(v * 1000) / 1000
  return {
    sourceName,
    unitsHeader,
    scaleToMeter: scale,
    scaleGuessed: guessed,
    width: round((Math.max(...xs) - minX) * scale),
    depth: round((Math.max(...ys) - minY) * scale),
    layers: layerNames.map((name) => ({ name, segments: counts.get(name) ?? 0 })),
    // Kalau tidak ada layer bernama dinding, semua layer diangkat jadi dinding.
    wallLayers: chosen.length ? chosen : layerNames,
    segments: raw.segments.map((s) => [
      round((s.a.x - minX) * scale),
      round((s.a.y - minY) * scale),
      round((s.b.x - minX) * scale),
      round((s.b.y - minY) * scale),
      layerNames.indexOf(s.layer),
    ]),
    labels: raw.labels.slice(0, 200).map((l) => ({
      text: l.text.slice(0, 40),
      x: round((l.at.x - minX) * scale),
      y: round((l.at.y - minY) * scale),
    })),
  }
}

export function summarize(model: DenahModel) {
  const wallSet = new Set(model.wallLayers)
  const wallLength = model.segments
    .filter((s) => wallSet.has(model.layers[s[4]].name))
    .reduce((sum, s) => sum + Math.hypot(s[2] - s[0], s[3] - s[1]), 0)
  return {
    lebar_m: model.width,
    panjang_m: model.depth,
    luas_bounding_m2: Math.round(model.width * model.depth * 100) / 100,
    panjang_garis_dinding_m: Math.round(wallLength * 100) / 100,
    jumlah_garis: model.segments.length,
    layer: model.layers,
    layer_dinding: model.wallLayers,
    satuan: model.scaleGuessed
      ? `ditebak (${model.scaleToMeter} m per unit), header INSUNITS=${model.unitsHeader ?? "kosong"}`
      : `dari header INSUNITS=${model.unitsHeader} (${model.scaleToMeter} m per unit)`,
  }
}

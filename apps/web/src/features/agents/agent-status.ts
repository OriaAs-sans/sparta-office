import type { Agent } from "@/lib/api"

export type AgentStatusKey =
  "nonaktif" | "bekerja" | "menunggu" | "gagal" | "siaga"

// Satu sumber warna status. Dipakai titik status, teks status, dan keterangan
// warna, supaya ketiganya tidak bisa berbeda. Warna selalu dipasangkan dengan
// label teks, tidak berdiri sendiri.
const STATUS_STYLE: Record<
  AgentStatusKey,
  { dotClass: string; textClass: string; legend: string }
> = {
  siaga: {
    dotClass: "bg-muted-foreground",
    textClass: "text-muted-foreground",
    legend: "Siaga",
  },
  bekerja: {
    dotClass: "bg-working",
    textClass: "text-working",
    legend: "Bekerja",
  },
  menunggu: {
    dotClass: "bg-review",
    textClass: "text-review",
    legend: "Perlu review",
  },
  nonaktif: {
    dotClass: "bg-transparent ring-1 ring-muted-foreground",
    textClass: "text-muted-foreground",
    legend: "Belum aktif",
  },
  gagal: {
    dotClass: "bg-destructive",
    textClass: "text-destructive",
    legend: "Gagal",
  },
}

export type AgentStatus = {
  key: AgentStatusKey
  label: string
  dotClass: string
  textClass: string
}

const status = (key: AgentStatusKey, label: string): AgentStatus => ({
  key,
  label,
  ...STATUS_STYLE[key],
})

export function agentStatus(agent: Agent, liveBusy = false): AgentStatus {
  if (agent.availability !== "aktif" || !agent.activity)
    return status("nonaktif", "Belum aktif")
  // liveBusy: agent sedang dipanggil Otak saat ini (dari aliran Percakapan Kantor).
  if (liveBusy) return status("bekerja", "Sedang bekerja")
  const { berjalan, menungguReview } = agent.activity
  if (berjalan > 0)
    return status(
      "bekerja",
      berjalan > 1 ? `Mengerjakan ${berjalan} tugas` : "Sedang bekerja"
    )
  if (menungguReview > 0)
    return status("menunggu", `${menungguReview} menunggu review`)
  return status("siaga", "Siaga")
}

/** Keterangan warna untuk ruang kontrol (urutan tampil). */
export const STATUS_LEGEND = (
  ["siaga", "bekerja", "menunggu", "nonaktif"] as const
).map((key) => ({
  key,
  label: STATUS_STYLE[key].legend,
  dotClass: STATUS_STYLE[key].dotClass,
}))

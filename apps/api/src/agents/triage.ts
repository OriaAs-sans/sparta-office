import type Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"

import { runStructured } from "./claude.ts"

export const triageInputSchema = z.object({
  toko: z.string().trim().min(1, "Kode atau nama toko wajib diisi").max(120),
  laporan: z.string().trim().min(10, "Ceritakan kerusakannya minimal 10 karakter").max(4000),
  foto: z
    .object({
      mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      // base64 tanpa prefix data URL, maksimal sekitar 5 MB file asli
      data: z.string().max(7_000_000),
    })
    .optional(),
})

export type TriageInput = z.infer<typeof triageInputSchema>

export const triageResultSchema = z.object({
  ringkasan: z.string(),
  kategori: z.enum([
    "Sipil",
    "Mekanikal-Elektrikal",
    "AC & Pendingin",
    "Plumbing",
    "Signage & Fasad",
    "Peralatan Toko",
    "Lainnya",
  ]),
  urgensi: z.enum(["Darurat", "Tinggi", "Sedang", "Rendah"]),
  alasan_urgensi: z.string(),
  tindakan_awal: z.array(z.string()),
  jenis_vendor: z.string(),
  pertanyaan_lanjutan: z.array(z.string()),
})

export type TriageResult = z.infer<typeof triageResultSchema>

const SYSTEM = `Kamu agent triase di divisi Building & Maintenance jaringan toko ritel.
Tugasmu membaca satu laporan kerusakan dari toko dan menyiapkan bahan untuk PIC maintenance.

Aturan urgensi:
- Darurat: ada risiko keselamatan orang (listrik terbuka, konsleting, kebakaran, struktur retak membahayakan) atau toko tidak bisa beroperasi.
- Tinggi: operasional terganggu besar atau kerusakan akan cepat meluas (bocor ke area listrik, AC mati di jam ramai, pintu tidak bisa dikunci).
- Sedang: mengganggu tapi toko tetap jalan normal.
- Rendah: kosmetik atau bisa dijadwalkan bersama perawatan rutin.

Aturan penulisan:
- Bahasa Indonesia yang lugas, kalimat pendek.
- Tindakan awal adalah langkah yang aman dilakukan staf toko sebelum teknisi datang, maksimal 4 poin.
- Jangan mengarang data yang tidak ada di laporan (riwayat, nama vendor, biaya). Tulis jenis vendornya saja, misalnya "teknisi AC" atau "kontraktor sipil".
- Kalau informasi kurang untuk menentukan urgensi dengan yakin, pilih urgensi yang lebih tinggi dan tulis apa yang perlu ditanyakan di pertanyaan_lanjutan.
- Kalau ada foto, gunakan isi foto sebagai bukti. Kalau foto tidak sesuai laporan, sebutkan di pertanyaan_lanjutan.`

export function runTriage(input: TriageInput): Promise<TriageResult> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = []
  if (input.foto) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: input.foto.mediaType, data: input.foto.data },
    })
  }
  content.push({
    type: "text",
    text: `Toko: ${input.toko}\n\nLaporan kerusakan:\n${input.laporan}`,
  })

  return runStructured({ system: SYSTEM, content, schema: triageResultSchema, effort: "medium" })
}

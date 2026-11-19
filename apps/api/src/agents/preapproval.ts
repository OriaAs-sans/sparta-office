import { z } from "zod"

import { runStructured } from "./claude.ts"

export const DOKUMEN_PENGAJUAN = [
  "RAB",
  "Penawaran vendor",
  "Foto kondisi",
  "Gambar kerja",
  "Draft SPK",
] as const

export const preApprovalInputSchema = z.object({
  judul: z.string().trim().min(3, "Judul pekerjaan wajib diisi").max(200),
  jenis: z.enum(["Pembangunan Baru", "Renovasi", "Maintenance"]),
  toko: z.string().trim().min(1, "Kode atau nama toko wajib diisi").max(120),
  vendor: z.string().trim().max(160).default(""),
  nilai: z.number().int().positive("Nilai pengajuan harus lebih dari 0"),
  rincian: z.string().trim().min(10, "Isi rincian item pekerjaan").max(8000),
  dokumen: z.array(z.enum(DOKUMEN_PENGAJUAN)),
})

export type PreApprovalInput = z.infer<typeof preApprovalInputSchema>

export const preApprovalResultSchema = z.object({
  ringkasan: z.string(),
  rekomendasi: z.enum(["Lanjut ke Approver", "Perlu Klarifikasi", "Lengkapi Dulu"]),
  total_rincian: z.number().nullable(),
  selisih_dengan_nilai: z.number().nullable(),
  temuan: z.array(
    z.object({
      tingkat: z.enum(["Kritis", "Perlu Dicek", "Info"]),
      item: z.string(),
      penjelasan: z.string(),
    })
  ),
  dokumen_kurang: z.array(z.string()),
})

export type PreApprovalResult = z.infer<typeof preApprovalResultSchema>

const SYSTEM = `Kamu agent pre-approval di divisi Building & Maintenance jaringan toko ritel.
Kamu BUKAN approver. Tugasmu memeriksa satu pengajuan pekerjaan supaya approver manusia bisa memutuskan lebih cepat.

Yang kamu periksa:
1. Konsistensi angka: jumlahkan semua item di rincian (volume x harga satuan bila ada), isi total_rincian, lalu selisih_dengan_nilai = nilai pengajuan dikurangi total_rincian. Kalau rincian tidak bisa dijumlahkan, isi keduanya null dan jelaskan di temuan.
2. Kualitas rincian: item tanpa satuan, tanpa volume, item ganda, item yang tidak cocok dengan jenis pekerjaan.
3. Kelengkapan dokumen: Renovasi dan Pembangunan Baru wajib RAB, Penawaran vendor, Foto kondisi, Gambar kerja. Maintenance wajib RAB dan Foto kondisi. Tulis dokumen wajib yang belum ada di dokumen_kurang.
4. Vendor kosong untuk pekerjaan yang jelas butuh vendor.

Batasan:
- Kamu tidak punya daftar harga satuan standar atau matriks wewenang. Jangan menilai harga mahal atau murah berdasarkan tebakan, dan jangan menyebut siapa yang berwenang approve.
- Jangan mengarang data yang tidak ada di pengajuan.

Rekomendasi:
- Lengkapi Dulu: ada dokumen wajib yang kurang atau temuan Kritis.
- Perlu Klarifikasi: ada temuan Perlu Dicek.
- Lanjut ke Approver: tidak ada temuan selain Info.

Tulis dalam Bahasa Indonesia yang lugas. Ringkasan maksimal 3 kalimat.`

const rupiah = new Intl.NumberFormat("id-ID")

export function runPreApproval(input: PreApprovalInput): Promise<PreApprovalResult> {
  const text = [
    `Judul: ${input.judul}`,
    `Jenis pekerjaan: ${input.jenis}`,
    `Toko: ${input.toko}`,
    `Vendor: ${input.vendor || "(kosong)"}`,
    `Nilai pengajuan: Rp ${rupiah.format(input.nilai)} (${input.nilai})`,
    `Dokumen terlampir: ${input.dokumen.length ? input.dokumen.join(", ") : "(tidak ada)"}`,
    "",
    "Rincian item:",
    input.rincian,
  ].join("\n")

  return runStructured({
    system: SYSTEM,
    content: [{ type: "text", text }],
    schema: preApprovalResultSchema,
    effort: "high",
  })
}

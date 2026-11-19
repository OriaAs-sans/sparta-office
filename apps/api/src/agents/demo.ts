import type { PreApprovalInput, PreApprovalResult } from "./preapproval.ts"
import type { TriageInput, TriageResult } from "./triage.ts"

// Mode demo: dipakai saat belum ada API key. Tidak ada AI di sini.
// Triase memakai pencocokan kata kunci; Pre-Approval menjalankan
// pengecekan yang memang bisa dihitung pasti (dokumen wajib, vendor kosong,
// penjumlahan rincian). Setiap teks diberi awalan [DEMO] supaya hasilnya
// tidak pernah tertukar dengan analisis sungguhan.

const DEMO = "[DEMO]"

// Jeda kecil supaya status "Bekerja" di denah sempat terlihat.
const wait = () => new Promise((resolve) => setTimeout(resolve, 2500 + Math.random() * 1500))

const includesAny = (text: string, words: string[]) => words.some((word) => text.includes(word))

type Rule = { kategori: TriageResult["kategori"]; words: string[]; vendor: string }

const CATEGORY_RULES: Rule[] = [
  { kategori: "AC & Pendingin", words: ["ac ", "ac,", "ac.", " ac", "pendingin", "chiller", "freezer", "showcase"], vendor: "teknisi AC dan pendingin" },
  { kategori: "Mekanikal-Elektrikal", words: ["listrik", "kabel", "mcb", "panel", "lampu", "konslet", "korslet", "genset", "stop kontak"], vendor: "teknisi listrik" },
  { kategori: "Plumbing", words: ["bocor", "pipa", "air", "wastafel", "toilet", "saluran", "mampet"], vendor: "tukang plumbing" },
  { kategori: "Sipil", words: ["plafon", "dinding", "keramik", "lantai", "atap", "retak", "pintu", "rolling door"], vendor: "kontraktor sipil" },
  { kategori: "Signage & Fasad", words: ["signage", "papan nama", "neon box", "fasad", "kanopi"], vendor: "vendor signage" },
  { kategori: "Peralatan Toko", words: ["rak", "kasir", "mesin edc", "timbangan", "cctv"], vendor: "vendor peralatan toko" },
]

export async function runDemoTriage(input: TriageInput): Promise<TriageResult> {
  await wait()
  const text = ` ${input.laporan.toLowerCase()} `
  const rule = CATEGORY_RULES.find((item) => includesAny(text, item.words))

  let urgensi: TriageResult["urgensi"] = "Sedang"
  let alasan = "tidak ada kata kunci bahaya atau gangguan besar di laporan"
  if (includesAny(text, ["api", "asap", "terbakar", "konslet", "korslet", "setrum", "kesetrum", "roboh", "ambruk"])) {
    urgensi = "Darurat"
    alasan = "laporan menyebut kata yang berkaitan dengan risiko keselamatan"
  } else if (includesAny(text, ["mati", "bocor", "tidak bisa", "tidak menyala", "rusak total", "banjir"])) {
    urgensi = "Tinggi"
    alasan = "laporan menyebut peralatan mati atau kebocoran"
  }

  return {
    ringkasan: `${DEMO} Laporan dari ${input.toko} dikelompokkan dengan pencocokan kata kunci, bukan dibaca oleh AI.${input.foto ? " Foto tidak dianalisis di mode demo." : ""}`,
    kategori: rule?.kategori ?? "Lainnya",
    urgensi,
    alasan_urgensi: `${DEMO} Urgensi ${urgensi.toLowerCase()} karena ${alasan}.`,
    tindakan_awal: [
      `${DEMO} Amankan area yang rusak dan beri tanda supaya pelanggan tidak mendekat.`,
      `${DEMO} Foto kondisi terbaru dan kirim ke PIC maintenance.`,
    ],
    jenis_vendor: `${DEMO} ${rule?.vendor ?? "belum bisa ditentukan dari kata kunci"}`,
    pertanyaan_lanjutan: [`${DEMO} Sejak kapan kerusakan ini terjadi dan apakah makin parah?`],
  }
}

const REQUIRED_DOCS: Record<PreApprovalInput["jenis"], string[]> = {
  Renovasi: ["RAB", "Penawaran vendor", "Foto kondisi", "Gambar kerja"],
  "Pembangunan Baru": ["RAB", "Penawaran vendor", "Foto kondisi", "Gambar kerja"],
  Maintenance: ["RAB", "Foto kondisi"],
}

// Angka yang menempel ke huruf (misal "m2") tidak dihitung.
// Format Indonesia: titik pemisah ribuan, koma desimal.
function numbersIn(line: string) {
  const matches = line.match(/(?<![A-Za-z\d])\d[\d.,]*(?![A-Za-z\d])/g) ?? []
  return matches
    .map((token) => Number(token.replace(/[.,]$/, "").replace(/\./g, "").replace(",", ".")))
    .filter((value) => Number.isFinite(value))
}

function sumRincian(rincian: string) {
  const lines = rincian.split("\n").map((line) => line.trim()).filter(Boolean)
  let total = 0
  const unreadable: string[] = []
  for (const line of lines) {
    const numbers = numbersIn(line)
    if (numbers.length < 2) {
      unreadable.push(line)
      continue
    }
    // Angka pertama dianggap volume, angka terakhir harga satuan.
    total += numbers[0] * numbers[numbers.length - 1]
  }
  return { total: unreadable.length ? null : total, unreadable }
}

export async function runDemoPreApproval(input: PreApprovalInput): Promise<PreApprovalResult> {
  await wait()
  const temuan: PreApprovalResult["temuan"] = []
  const dokumenKurang = REQUIRED_DOCS[input.jenis].filter((doc) => !input.dokumen.includes(doc as never))

  if (!input.vendor) {
    temuan.push({
      tingkat: "Perlu Dicek",
      item: "Vendor",
      penjelasan: `${DEMO} Nama vendor kosong.`,
    })
  }

  const { total, unreadable } = sumRincian(input.rincian)
  const selisih = total === null ? null : input.nilai - total
  if (unreadable.length) {
    temuan.push({
      tingkat: "Perlu Dicek",
      item: "Rincian",
      penjelasan: `${DEMO} ${unreadable.length} baris tidak punya volume dan harga satuan, jadi total tidak bisa dihitung. Contoh: "${unreadable[0].slice(0, 60)}".`,
    })
  } else if (selisih !== null && selisih !== 0) {
    temuan.push({
      tingkat: "Kritis",
      item: "Nilai pengajuan",
      penjelasan: `${DEMO} Nilai pengajuan berbeda dengan jumlah rincian.`,
    })
  }
  temuan.push({
    tingkat: "Info",
    item: "Mode demo",
    penjelasan: `${DEMO} Kewajaran item dan kecocokan dengan jenis pekerjaan hanya diperiksa di mode AI.`,
  })

  const rekomendasi: PreApprovalResult["rekomendasi"] =
    dokumenKurang.length || temuan.some((item) => item.tingkat === "Kritis")
      ? "Lengkapi Dulu"
      : temuan.some((item) => item.tingkat === "Perlu Dicek")
        ? "Perlu Klarifikasi"
        : "Lanjut ke Approver"

  return {
    ringkasan: `${DEMO} Pengecekan aturan dasar untuk ${input.judul}: ${dokumenKurang.length} dokumen wajib kurang, ${temuan.length - 1} temuan.`,
    rekomendasi,
    total_rincian: total,
    selisih_dengan_nilai: selisih,
    temuan,
    dokumen_kurang: dokumenKurang,
  }
}

// Semua format angka dan waktu memakai locale id-ID dan dikumpulkan di sini.

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
})

export function formatRupiah(value: number) {
  return rupiahFormatter.format(value)
}

const numberFormatters = new Map<number, Intl.NumberFormat>()

/** Angka dengan pemisah ribuan titik, misal 8.000 atau 11,92. */
export function formatNumber(value: number, maximumFractionDigits = 0) {
  let formatter = numberFormatters.get(maximumFractionDigits)
  if (!formatter) {
    formatter = new Intl.NumberFormat("id-ID", { maximumFractionDigits })
    numberFormatters.set(maximumFractionDigits, formatter)
  }
  return formatter.format(value)
}

const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

/** Tanggal dan jam, misal "18 Nov, 13.40". */
export function formatTime(iso: string) {
  return dateTimeFormatter.format(new Date(iso))
}

const clockFormatter = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
})

/** Jam saja, misal "13.40". */
export function formatClock(iso: string) {
  return clockFormatter.format(new Date(iso))
}

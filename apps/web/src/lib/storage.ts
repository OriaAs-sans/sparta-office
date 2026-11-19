// Kunci sessionStorage dipusatkan di sini supaya penulis dan pembacanya
// tidak bisa berbeda ejaan.
export const STORAGE_KEYS = {
  /** Percakapan yang dibuka di Chat setelah tombol "Buka di Chat" di Kantor. */
  openChat: "sparta-open-chat",
} as const

// sessionStorage bisa melempar error (mode privat, data situs diblokir), jadi
// semua akses dibungkus try/catch dan aplikasi tetap jalan tanpanya.
export const session = {
  set(key: string, value: string) {
    try {
      sessionStorage.setItem(key, value)
    } catch {
      // diabaikan
    }
  },
  /** Ambil lalu hapus. */
  take(key: string) {
    try {
      const value = sessionStorage.getItem(key)
      sessionStorage.removeItem(key)
      return value
    } catch {
      return null
    }
  },
}

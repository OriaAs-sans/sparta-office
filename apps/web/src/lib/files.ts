// Aturan file yang sama dengan API (apps/api/src/chat/files.ts): format yang
// bisa dibaca Otak Sparta dan batas ukuran body JSON.
export const READABLE_ACCEPT =
  ".pdf,.txt,.md,.csv,.dxf,.png,.jpg,.jpeg,.webp,.json"
export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024

/** Isi file sebagai base64 tanpa awalan data URL. */
export function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "")
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function formatFileSize(bytes: number) {
  return bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function fileName(path: string) {
  return path.split(/[\\/]/).pop() ?? path
}

import { useRef } from "react"

type FilePickerOptions = {
  accept: string
  multiple?: boolean
  onFiles: (files: File[]) => void
}

/**
 * Pemilih file tanpa input file yang terlihat. Tombol mana pun (Button
 * shadcn, InputGroupButton) cukup memanggil `open()`; elemen `input`
 * dirender sekali di dekatnya. Setelah memilih, nilai input dikosongkan
 * supaya file yang sama bisa dipilih lagi.
 */
export function useFilePicker({
  accept,
  multiple = false,
  onFiles,
}: FilePickerOptions) {
  const ref = useRef<HTMLInputElement>(null)

  const input = (
    <input
      ref={ref}
      type="file"
      accept={accept}
      multiple={multiple}
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={(event) => {
        const files = Array.from(event.target.files ?? [])
        event.target.value = ""
        if (files.length) onFiles(files)
      }}
    />
  )

  return { open: () => ref.current?.click(), input }
}

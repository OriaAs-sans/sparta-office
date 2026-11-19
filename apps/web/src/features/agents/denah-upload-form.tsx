import { FileUp } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { useFilePicker } from "@/hooks/use-file-picker"
import { formatFileSize } from "@/lib/files"

// DXF dikirim sebagai teks, jadi batasnya sama dengan API (/api/denah, 7 MB).
const MAX_DXF_BYTES = 7 * 1024 * 1024

type DenahUploadFormProps = {
  onUpload: (fileName: string, content: string) => Promise<boolean>
}

// Upload langsung dari web: converter mengubah DXF ke 3D tanpa AI.
// Layer dinding ditebak dari nama layer; untuk pemilihan yang lebih tepat
// pakai agent studio-denah di Claude Code.
function DenahUploadForm({ onUpload }: DenahUploadFormProps) {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const picker = useFilePicker({
    accept: ".dxf",
    onFiles: ([next]) => pick(next),
  })

  function pick(next: File) {
    if (!/\.dxf$/i.test(next.name)) {
      setError(
        "File harus DXF. Simpan ulang DWG sebagai DXF dari AutoCAD (Save As > DXF)."
      )
      return
    }
    if (next.size > MAX_DXF_BYTES) {
      setError(`Ukuran file maksimal ${formatFileSize(MAX_DXF_BYTES)}.`)
      return
    }
    setError("")
    setFile(next)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!file) {
      setError("Pilih file DXF dulu.")
      return
    }
    setSubmitting(true)
    const ok = await onUpload(file.name, await file.text())
    setSubmitting(false)
    if (ok) setFile(null)
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor="denah-file">File denah (DXF)</FieldLabel>
        {picker.input}
        <Button
          id="denah-file"
          type="button"
          variant="outline"
          size="touch"
          onClick={picker.open}
        >
          <FileUp data-icon="inline-start" />
          {file ? file.name : "Pilih File DXF"}
        </Button>
        <FieldDescription className={error ? "text-destructive" : undefined}>
          {error ||
            `Layer dinding ditebak dari nama layer. Maksimal ${formatFileSize(MAX_DXF_BYTES)}.`}
        </FieldDescription>
      </Field>
      <Button type="submit" size="touch" disabled={submitting}>
        {submitting && <Spinner data-icon="inline-start" />}
        Ubah ke Model 3D
      </Button>
    </form>
  )
}

export { DenahUploadForm }

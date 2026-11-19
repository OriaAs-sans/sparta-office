import { ImagePlus, X } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { useFilePicker } from "@/hooks/use-file-picker"
import { formatFileSize, readFileAsBase64 } from "@/lib/files"

const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const

type Photo = {
  mediaType: (typeof PHOTO_TYPES)[number]
  data: string
  previewUrl: string
  name: string
}

export type TriageFormValues = {
  toko: string
  laporan: string
  foto?: { mediaType: Photo["mediaType"]; data: string }
}

type TriageFormProps = {
  onSubmit: (values: TriageFormValues) => Promise<boolean>
}

function TriageForm({ onSubmit }: TriageFormProps) {
  const [toko, setToko] = useState("")
  const [laporan, setLaporan] = useState("")
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const picker = useFilePicker({
    accept: PHOTO_TYPES.join(","),
    onFiles: ([file]) => void handleFile(file),
  })

  async function handleFile(file: File | undefined) {
    if (!file) return
    if (!PHOTO_TYPES.includes(file.type as Photo["mediaType"])) {
      setErrors((prev) => ({
        ...prev,
        foto: "Format foto harus JPG, PNG, atau WEBP.",
      }))
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setErrors((prev) => ({
        ...prev,
        foto: `Ukuran foto maksimal ${formatFileSize(MAX_PHOTO_BYTES)}.`,
      }))
      return
    }
    const data = await readFileAsBase64(file)
    setPhoto({
      mediaType: file.type as Photo["mediaType"],
      data,
      previewUrl: URL.createObjectURL(file),
      name: file.name,
    })
    setErrors((prev) => ({ ...prev, foto: "" }))
  }

  function clearPhoto() {
    if (photo) URL.revokeObjectURL(photo.previewUrl)
    setPhoto(null)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}
    if (!toko.trim()) nextErrors.toko = "Isi kode atau nama toko."
    if (laporan.trim().length < 10)
      nextErrors.laporan = "Ceritakan kerusakannya minimal 10 karakter."
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setSubmitting(true)
    const ok = await onSubmit({
      toko: toko.trim(),
      laporan: laporan.trim(),
      foto: photo
        ? { mediaType: photo.mediaType, data: photo.data }
        : undefined,
    })
    setSubmitting(false)
    if (ok) {
      setToko("")
      setLaporan("")
      clearPhoto()
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FieldGroup>
        <Field data-invalid={errors.toko ? true : undefined}>
          <FieldLabel htmlFor="triage-toko">Kode atau nama toko</FieldLabel>
          <Input
            id="triage-toko"
            value={toko}
            onChange={(event) => setToko(event.target.value)}
            aria-invalid={errors.toko ? true : undefined}
            className="text-base md:text-sm"
          />
          {errors.toko && (
            <FieldDescription className="text-destructive">
              {errors.toko}
            </FieldDescription>
          )}
        </Field>
        <Field data-invalid={errors.laporan ? true : undefined}>
          <FieldLabel htmlFor="triage-laporan">Laporan kerusakan</FieldLabel>
          <Textarea
            id="triage-laporan"
            value={laporan}
            onChange={(event) => setLaporan(event.target.value)}
            rows={4}
            aria-invalid={errors.laporan ? true : undefined}
            placeholder="Apa yang rusak, sejak kapan, dan dampaknya ke toko"
            className="text-base md:text-sm"
          />
          {errors.laporan && (
            <FieldDescription className="text-destructive">
              {errors.laporan}
            </FieldDescription>
          )}
        </Field>
        <Field data-invalid={errors.foto ? true : undefined}>
          <FieldLabel htmlFor="triage-foto">
            Foto kerusakan (opsional)
          </FieldLabel>
          {picker.input}
          {photo ? (
            <Item variant="outline" size="xs">
              <ItemMedia variant="image">
                <img src={photo.previewUrl} alt="Pratinjau foto kerusakan" />
              </ItemMedia>
              <ItemContent className="min-w-0">
                <ItemTitle className="truncate">{photo.name}</ItemTitle>
              </ItemContent>
              <ItemActions>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-touch"
                  onClick={clearPhoto}
                  aria-label="Hapus foto"
                >
                  <X />
                </Button>
              </ItemActions>
            </Item>
          ) : (
            <Button
              id="triage-foto"
              type="button"
              variant="outline"
              size="touch"
              onClick={picker.open}
            >
              <ImagePlus data-icon="inline-start" />
              Pilih Foto
            </Button>
          )}
          <FieldDescription
            className={errors.foto ? "text-destructive" : undefined}
          >
            {errors.foto ||
              `JPG, PNG, atau WEBP, maksimal ${formatFileSize(MAX_PHOTO_BYTES)}.`}
          </FieldDescription>
        </Field>
        <Button type="submit" size="touch" disabled={submitting}>
          {submitting && <Spinner data-icon="inline-start" />}
          Kirim ke Agent Triase
        </Button>
      </FieldGroup>
    </form>
  )
}

export { TriageForm }

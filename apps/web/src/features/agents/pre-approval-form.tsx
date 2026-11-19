import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"

const JENIS = ["Renovasi", "Maintenance", "Pembangunan Baru"] as const
const DOKUMEN = [
  "RAB",
  "Penawaran vendor",
  "Foto kondisi",
  "Gambar kerja",
  "Draft SPK",
] as const

export type PreApprovalFormValues = {
  judul: string
  jenis: (typeof JENIS)[number]
  toko: string
  vendor: string
  nilai: number
  rincian: string
  dokumen: (typeof DOKUMEN)[number][]
}

type PreApprovalFormProps = {
  onSubmit: (values: PreApprovalFormValues) => Promise<boolean>
}

const digitsOnly = (value: string) => value.replace(/\D/g, "")
const groupThousands = (digits: string) =>
  digits ? Number(digits).toLocaleString("id-ID") : ""

function PreApprovalForm({ onSubmit }: PreApprovalFormProps) {
  const [judul, setJudul] = useState("")
  const [jenis, setJenis] = useState<PreApprovalFormValues["jenis"]>("Renovasi")
  const [toko, setToko] = useState("")
  const [vendor, setVendor] = useState("")
  const [nilai, setNilai] = useState("")
  const [rincian, setRincian] = useState("")
  const [dokumen, setDokumen] = useState<PreApprovalFormValues["dokumen"]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  function toggleDokumen(
    item: PreApprovalFormValues["dokumen"][number],
    checked: boolean
  ) {
    setDokumen((prev) =>
      checked ? [...prev, item] : prev.filter((value) => value !== item)
    )
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}
    if (judul.trim().length < 3) nextErrors.judul = "Isi judul pekerjaan."
    if (!toko.trim()) nextErrors.toko = "Isi kode atau nama toko."
    if (!Number(nilai)) nextErrors.nilai = "Isi nilai pengajuan dalam rupiah."
    if (rincian.trim().length < 10)
      nextErrors.rincian = "Isi rincian item pekerjaan."
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setSubmitting(true)
    const ok = await onSubmit({
      judul: judul.trim(),
      jenis,
      toko: toko.trim(),
      vendor: vendor.trim(),
      nilai: Number(nilai),
      rincian: rincian.trim(),
      dokumen,
    })
    setSubmitting(false)
    if (ok) {
      setJudul("")
      setToko("")
      setVendor("")
      setNilai("")
      setRincian("")
      setDokumen([])
    }
  }

  const errorText = (key: string) =>
    errors[key] ? (
      <FieldDescription className="text-destructive">
        {errors[key]}
      </FieldDescription>
    ) : null

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FieldGroup>
        <Field data-invalid={errors.judul ? true : undefined}>
          <FieldLabel htmlFor="pa-judul">Judul pekerjaan</FieldLabel>
          <Input
            id="pa-judul"
            value={judul}
            onChange={(event) => setJudul(event.target.value)}
            aria-invalid={errors.judul ? true : undefined}
            className="text-base md:text-sm"
          />
          {errorText("judul")}
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="pa-jenis">Jenis pekerjaan</FieldLabel>
            <NativeSelect
              id="pa-jenis"
              value={jenis}
              onChange={(event) =>
                setJenis(event.target.value as PreApprovalFormValues["jenis"])
              }
            >
              {JENIS.map((item) => (
                <NativeSelectOption key={item} value={item}>
                  {item}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field data-invalid={errors.toko ? true : undefined}>
            <FieldLabel htmlFor="pa-toko">Kode atau nama toko</FieldLabel>
            <Input
              id="pa-toko"
              value={toko}
              onChange={(event) => setToko(event.target.value)}
              aria-invalid={errors.toko ? true : undefined}
              className="text-base md:text-sm"
            />
            {errorText("toko")}
          </Field>
          <Field>
            <FieldLabel htmlFor="pa-vendor">Vendor</FieldLabel>
            <Input
              id="pa-vendor"
              value={vendor}
              onChange={(event) => setVendor(event.target.value)}
              className="text-base md:text-sm"
            />
          </Field>
          <Field data-invalid={errors.nilai ? true : undefined}>
            <FieldLabel htmlFor="pa-nilai">Nilai pengajuan (Rp)</FieldLabel>
            <Input
              id="pa-nilai"
              inputMode="numeric"
              value={groupThousands(nilai)}
              onChange={(event) => setNilai(digitsOnly(event.target.value))}
              aria-invalid={errors.nilai ? true : undefined}
              className="text-base md:text-sm"
            />
            {errorText("nilai")}
          </Field>
        </div>
        <Field data-invalid={errors.rincian ? true : undefined}>
          <FieldLabel htmlFor="pa-rincian">Rincian item</FieldLabel>
          <Textarea
            id="pa-rincian"
            value={rincian}
            onChange={(event) => setRincian(event.target.value)}
            rows={5}
            aria-invalid={errors.rincian ? true : undefined}
            placeholder={
              "Satu item per baris: uraian, volume, satuan, harga satuan"
            }
            className="font-mono text-base md:text-sm"
          />
          {errorText("rincian") ?? (
            <FieldDescription>
              Bisa ditempel langsung dari Excel RAB.
            </FieldDescription>
          )}
        </Field>
        <FieldSet>
          <FieldLegend variant="label">Dokumen terlampir</FieldLegend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DOKUMEN.map((item) => {
              const id = `pa-dok-${item.replace(/\s/g, "-").toLowerCase()}`
              return (
                <Field
                  key={item}
                  orientation="horizontal"
                  className="min-h-11 items-center"
                >
                  <Checkbox
                    id={id}
                    checked={dokumen.includes(item)}
                    onCheckedChange={(checked) =>
                      toggleDokumen(item, checked === true)
                    }
                  />
                  <FieldLabel htmlFor={id} className="font-normal">
                    {item}
                  </FieldLabel>
                </Field>
              )
            })}
          </div>
        </FieldSet>
        <Button type="submit" size="touch" disabled={submitting}>
          {submitting && <Spinner data-icon="inline-start" />}
          Periksa Pengajuan
        </Button>
      </FieldGroup>
    </form>
  )
}

export { PreApprovalForm }

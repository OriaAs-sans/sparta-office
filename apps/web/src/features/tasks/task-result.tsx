import { lazy, Suspense } from "react"

import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import type {
  DenahResult,
  PreApprovalResult,
  Task,
  TriageResult,
} from "@/lib/api"
import { formatRupiah } from "@/lib/format"
import { cn } from "@/lib/utils"

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <h4 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {title}
      </h4>
      {children}
    </div>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  )
}

const URGENCY_CLASS: Record<TriageResult["urgensi"], string> = {
  Darurat: "bg-destructive text-background",
  Tinggi: "bg-destructive/10 text-destructive",
  Sedang: "border-working/30 bg-working/10 text-working",
  Rendah: "border-border bg-muted text-foreground",
}

function TriageResultView({ result }: { result: TriageResult }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={URGENCY_CLASS[result.urgensi]}>
          Urgensi {result.urgensi}
        </Badge>
        <Badge variant="outline">{result.kategori}</Badge>
      </div>
      <p className="text-sm">{result.ringkasan}</p>
      <Section title="Alasan urgensi">
        <p className="text-sm">{result.alasan_urgensi}</p>
      </Section>
      {result.tindakan_awal.length > 0 && (
        <Section title="Tindakan awal di toko">
          <BulletList items={result.tindakan_awal} />
        </Section>
      )}
      <Section title="Jenis vendor">
        <p className="text-sm">{result.jenis_vendor}</p>
      </Section>
      {result.pertanyaan_lanjutan.length > 0 && (
        <Section title="Perlu ditanyakan ke toko">
          <BulletList items={result.pertanyaan_lanjutan} />
        </Section>
      )}
    </div>
  )
}

const FINDING_CLASS = {
  Kritis: "bg-destructive/10 text-destructive",
  "Perlu Dicek": "border-working/30 bg-working/10 text-working",
  Info: "border-border bg-muted text-foreground",
} as const

function PreApprovalResultView({
  result,
  nilai,
}: {
  result: PreApprovalResult
  nilai?: number
}) {
  return (
    <div className="flex flex-col gap-4">
      <Badge
        variant="outline"
        className={cn(
          result.rekomendasi === "Lanjut ke Approver"
            ? "border-border bg-muted text-foreground"
            : FINDING_CLASS[
                result.rekomendasi === "Lengkapi Dulu"
                  ? "Kritis"
                  : "Perlu Dicek"
              ]
        )}
      >
        {result.rekomendasi}
      </Badge>
      <p className="text-sm">{result.ringkasan}</p>
      <dl className="grid grid-cols-1 gap-2 rounded-xl bg-muted/50 p-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">Nilai pengajuan</dt>
          <dd className="font-semibold">
            {nilai !== undefined ? formatRupiah(nilai) : "-"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Total rincian</dt>
          <dd className="font-semibold">
            {result.total_rincian !== null
              ? formatRupiah(result.total_rincian)
              : "Tidak bisa dihitung"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Selisih</dt>
          <dd
            className={cn(
              "font-semibold",
              result.selisih_dengan_nilai !== null &&
                result.selisih_dengan_nilai !== 0 &&
                "text-destructive"
            )}
          >
            {result.selisih_dengan_nilai !== null
              ? formatRupiah(result.selisih_dengan_nilai)
              : "-"}
          </dd>
        </div>
      </dl>
      {result.dokumen_kurang.length > 0 && (
        <Section title="Dokumen wajib yang belum ada">
          <BulletList items={result.dokumen_kurang} />
        </Section>
      )}
      {result.temuan.length > 0 && (
        <Section title="Temuan">
          <ul className="flex flex-col gap-2">
            {result.temuan.map((finding, index) => (
              <li
                key={index}
                className="flex flex-col gap-1 rounded-xl border p-3"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={FINDING_CLASS[finding.tingkat]}
                  >
                    {finding.tingkat}
                  </Badge>
                  <span className="text-sm font-medium">{finding.item}</span>
                </span>
                <span className="text-sm text-muted-foreground">
                  {finding.penjelasan}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}

// three.js cukup besar, jadi viewer baru dimuat saat ada hasil denah dibuka.
const DenahViewer = lazy(() => import("@/features/denah/denah-viewer"))

const meter = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 })

function DenahResultView({ result }: { result: DenahResult }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">{result.ringkasan}</p>
      <Suspense
        fallback={<Skeleton className="h-72 w-full rounded-xl sm:h-96" />}
      >
        <DenahViewer modelId={result.model_id} />
      </Suspense>
      <dl className="grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">Lebar x panjang</dt>
          <dd className="font-semibold">
            {meter.format(result.lebar_m)} x {meter.format(result.panjang_m)} m
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Luas bidang luar</dt>
          <dd className="font-semibold">
            {meter.format(result.luas_bounding_m2)} m²
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Panjang dinding</dt>
          <dd className="font-semibold">
            {meter.format(result.panjang_garis_dinding_m)} m
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Layer dinding</dt>
          <dd className="font-semibold break-words">
            {result.layer_dinding.join(", ")}
          </dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">
        Satuan {result.satuan}. Luas bidang luar dihitung dari kotak terluar
        denah, bukan luas lantai bersih.
      </p>
      {result.catatan.length > 0 && (
        <Section title="Catatan">
          <BulletList items={result.catatan} />
        </Section>
      )}
    </div>
  )
}

function TaskResult({ task }: { task: Task }) {
  if (!task.result) return null
  if (task.agentId === "denah-bangunan") {
    return <DenahResultView result={task.result as DenahResult} />
  }
  if (task.agentId === "triase-maintenance") {
    return <TriageResultView result={task.result as TriageResult} />
  }
  return (
    <PreApprovalResultView
      result={task.result as PreApprovalResult}
      nilai={
        typeof task.input.nilai === "number" ? task.input.nilai : undefined
      }
    />
  )
}

export { TaskResult }

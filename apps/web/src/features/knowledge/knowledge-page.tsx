import { BookOpen, FileText, Upload } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { ErrorAlert } from "@/components/common/error-alert"
import { PageHeading } from "@/components/common/page-heading"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { knowledgeApi } from "@/features/knowledge/knowledge-api"
import { useFilePicker } from "@/hooks/use-file-picker"
import { usePolling } from "@/hooks/use-polling"
import {
  formatFileSize,
  MAX_UPLOAD_BYTES,
  READABLE_ACCEPT,
  readFileAsBase64,
} from "@/lib/files"
import { formatTime } from "@/lib/format"
import { cn } from "@/lib/utils"

const WHAT_TO_ADD = [
  "SOP dan alur kerja Building & Maintenance",
  "Standar toko per tipe (PDF atau DXF)",
  "Harga satuan dan daftar vendor (CSV)",
  "Matriks wewenang approval",
]

function KnowledgePage() {
  const files = usePolling(knowledgeApi.list, 15000)
  const [uploading, setUploading] = useState(0)
  const [dragging, setDragging] = useState(false)
  const picker = useFilePicker({
    accept: READABLE_ACCEPT,
    multiple: true,
    onFiles: (picked) => void upload(picked),
  })

  async function upload(picked: File[]) {
    const list = picked.slice(0, 10)
    if (!list.length) return
    setUploading(list.length)
    for (const file of list) {
      try {
        if (file.size > MAX_UPLOAD_BYTES)
          throw new Error(`lebih dari ${formatFileSize(MAX_UPLOAD_BYTES)}`)
        const saved = await knowledgeApi.upload(
          file.name,
          await readFileAsBase64(file)
        )
        toast.success(`${saved.name} masuk ke basis pengetahuan.`)
      } catch (error) {
        toast.error(
          `${file.name}: ${error instanceof Error ? error.message : "gagal diunggah"}`
        )
      }
      setUploading((count) => count - 1)
    }
    await files.refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        title="Basis Pengetahuan"
        description="Dokumen yang selalu dibaca Otak Sparta sebelum menjawab. Jawaban menyebut file mana yang dipakai."
        actions={
          <Button size="touch" disabled={uploading > 0} onClick={picker.open}>
            {uploading > 0 ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Upload data-icon="inline-start" />
            )}
            {uploading > 0
              ? `Mengunggah ${uploading} File...`
              : "Tambah Dokumen"}
          </Button>
        }
      />
      {picker.input}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section
          aria-label="Daftar dokumen"
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes("Files")) return
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node))
              setDragging(false)
          }}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            void upload(Array.from(event.dataTransfer.files))
          }}
          className={cn(
            "flex flex-col rounded-2xl border",
            dragging && "border-primary ring-[3px] ring-primary/30"
          )}
        >
          {files.loading && !files.data ? (
            <div className="flex flex-col gap-2 p-4" aria-busy="true">
              <Skeleton className="h-11 w-full rounded-lg" />
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
          ) : files.error && !files.data ? (
            <ErrorAlert
              className="border-0"
              title="Daftar dokumen gagal dimuat"
              message={files.error.message}
              onRetry={() => void files.refresh()}
            />
          ) : files.data && files.data.length > 0 ? (
            <ItemGroup className="p-1">
              {files.data.map((file) => (
                <Item key={file.name} size="xs">
                  <ItemMedia variant="icon">
                    <FileText className="text-muted-foreground" />
                  </ItemMedia>
                  <ItemContent className="min-w-0">
                    <ItemTitle className="w-full truncate" title={file.name}>
                      {file.name}
                    </ItemTitle>
                  </ItemContent>
                  <ItemActions className="gap-4 text-xs text-muted-foreground">
                    <span className="hidden sm:inline">
                      {formatTime(file.updatedAt)}
                    </span>
                    <span className="w-14 text-right">
                      {formatFileSize(file.size)}
                    </span>
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BookOpen />
                </EmptyMedia>
                <EmptyTitle>Belum ada dokumen</EmptyTitle>
                <EmptyDescription>
                  Tambah dokumen atau seret file ke sini.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          <p className="border-t px-4 py-3 text-xs text-muted-foreground">
            Seret file ke kotak ini untuk menambah. PDF, TXT, MD, CSV, DXF, PNG,
            JPG, WEBP, JSON, maksimal {formatFileSize(MAX_UPLOAD_BYTES)}. Excel
            perlu diekspor ke CSV atau PDF dulu.
          </p>
        </section>

        <aside className="flex flex-col gap-3 rounded-2xl bg-muted/60 p-4">
          <h2 className="text-sm font-semibold">
            Yang paling berguna ditambahkan
          </h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
            {WHAT_TO_ADD.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Nama file yang jelas membantu otak menemukan dokumen yang tepat,
            misalnya standar-toko-tipe-A-2026.pdf.
          </p>
        </aside>
      </div>
    </div>
  )
}

export { KnowledgePage }

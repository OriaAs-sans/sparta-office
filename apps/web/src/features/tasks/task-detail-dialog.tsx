import { useState } from "react"
import { toast } from "sonner"

import { ErrorAlert } from "@/components/common/error-alert"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { TaskModeBadge } from "@/features/tasks/task-mode-badge"
import { TaskResult } from "@/features/tasks/task-result"
import { isTaskActive } from "@/features/tasks/task-status"
import { TaskStatusBadge } from "@/features/tasks/task-status-badge"
import { api, type Task } from "@/lib/api"
import { formatRupiah, formatTime } from "@/lib/format"
import { cn } from "@/lib/utils"

const INPUT_LABELS: Record<string, string> = {
  toko: "Toko",
  laporan: "Laporan",
  foto: "Foto",
  judul: "Judul",
  jenis: "Jenis",
  vendor: "Vendor",
  nilai: "Nilai",
  rincian: "Rincian",
  dokumen: "Dokumen",
  prompt: "Prompt",
  file: "File",
}

function formatInputValue(key: string, value: unknown) {
  if (key === "foto") return "Terlampir"
  if (key === "nilai" && typeof value === "number") return formatRupiah(value)
  if (Array.isArray(value)) return value.length ? value.join(", ") : "Tidak ada"
  if (value === "" || value === undefined || value === null) return "-"
  return String(value)
}

type TaskDetailDialogProps = {
  task: Task | null
  agentName?: string
  onClose: () => void
  onDecided: () => void
}

function TaskDetailDialog({
  task,
  agentName,
  onClose,
  onDecided,
}: TaskDetailDialogProps) {
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState<"disetujui" | "ditolak" | null>(
    null
  )
  const [noteError, setNoteError] = useState("")

  async function decide(decision: "disetujui" | "ditolak") {
    if (!task) return
    if (decision === "ditolak" && !note.trim()) {
      setNoteError(
        "Tulis alasan penolakan supaya pengaju tahu apa yang harus diperbaiki."
      )
      return
    }
    setSubmitting(decision)
    try {
      await api.decide(task.id, decision, note.trim())
      toast.success(
        decision === "disetujui"
          ? "Hasil agent disetujui."
          : "Hasil agent ditolak."
      )
      onDecided()
      onClose()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Keputusan gagal disimpan."
      )
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <Dialog open={task !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "max-h-[90dvh] overflow-y-auto",
          task?.agentId === "denah-bangunan" ? "sm:max-w-3xl" : "sm:max-w-xl"
        )}
      >
        {task && (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <TaskStatusBadge status={task.status} />
                <TaskModeBadge mode={task.mode} />
                <span className="text-xs text-muted-foreground">
                  {agentName} · {formatTime(task.createdAt)}
                </span>
              </div>
              <DialogTitle>{task.title}</DialogTitle>
              <DialogDescription>
                {task.status === "gagal"
                  ? "Tugas ini tidak menghasilkan apa pun. Lihat penyebabnya di bawah."
                  : "Hasil agent adalah draft. Periksa dulu sebelum disetujui."}
              </DialogDescription>
            </DialogHeader>

            <dl className="flex flex-col gap-2 rounded-xl bg-muted/50 p-3 text-sm">
              {Object.entries(task.input).map(([key, value]) => (
                <div key={key} className="grid grid-cols-[6rem_1fr] gap-2">
                  <dt className="text-muted-foreground">
                    {INPUT_LABELS[key] ?? key}
                  </dt>
                  <dd className="break-words whitespace-pre-wrap">
                    {formatInputValue(key, value)}
                  </dd>
                </div>
              ))}
            </dl>

            <Separator />

            {isTaskActive(task.status) && (
              <p
                className="flex items-center gap-2 text-sm text-working"
                role="status"
              >
                <Spinner aria-hidden />
                Agent sedang mengerjakan tugas ini.
              </p>
            )}

            {task.mode === "demo" && task.result && (
              <Alert className="border-working/40 bg-working/5">
                <AlertTitle>Hasil contoh dari mode demo</AlertTitle>
                <AlertDescription>
                  Dibuat dari aturan sederhana, bukan analisis AI. Jangan
                  dipakai untuk keputusan pekerjaan sungguhan.
                </AlertDescription>
              </Alert>
            )}

            {task.status === "gagal" && (
              <ErrorAlert
                title="Agent gagal menyelesaikan tugas"
                message={task.error ?? "Penyebabnya tidak diketahui."}
              />
            )}

            <TaskResult task={task} />

            {task.decisionNote && (
              <p className="rounded-xl border p-3 text-sm">
                <span className="font-medium">Catatan reviewer: </span>
                {task.decisionNote}
              </p>
            )}

            {task.status === "menunggu_review" && (
              <>
                <Field data-invalid={noteError ? true : undefined}>
                  <FieldLabel htmlFor="decision-note">
                    Catatan reviewer
                  </FieldLabel>
                  <Textarea
                    id="decision-note"
                    value={note}
                    onChange={(event) => {
                      setNote(event.target.value)
                      setNoteError("")
                    }}
                    aria-invalid={noteError ? true : undefined}
                    placeholder="Wajib diisi kalau ditolak"
                  />
                  <FieldDescription
                    className={noteError ? "text-destructive" : undefined}
                  >
                    {noteError || "Opsional kalau disetujui."}
                  </FieldDescription>
                </Field>
                <DialogFooter>
                  <Button
                    variant="destructive"
                    // Latar merah tipis supaya teks merah tetap AA di tema gelap.
                    className="dark:bg-destructive/10"
                    size="touch"
                    onClick={() => decide("ditolak")}
                    disabled={submitting !== null}
                  >
                    {submitting === "ditolak" && (
                      <Spinner data-icon="inline-start" />
                    )}
                    Tolak Hasil
                  </Button>
                  <Button
                    size="touch"
                    onClick={() => decide("disetujui")}
                    disabled={submitting !== null}
                  >
                    {submitting === "disetujui" && (
                      <Spinner data-icon="inline-start" />
                    )}
                    Setujui Hasil
                  </Button>
                </DialogFooter>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export { TaskDetailDialog }

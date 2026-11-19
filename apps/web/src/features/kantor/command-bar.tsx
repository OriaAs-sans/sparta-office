import { Paperclip, SendHorizontal, Square } from "lucide-react"
import { useId, useImperativeHandle, useRef, useState, type Ref } from "react"

import { FileChip } from "@/components/common/file-chip"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import type { FileHit } from "@/features/chat/chat-api"
import { useFilePicker } from "@/hooks/use-file-picker"
import { fileName, READABLE_ACCEPT } from "@/lib/files"
import { cn } from "@/lib/utils"

export type CommandTarget = { value: string; label: string }

export type CommandBarHandle = { focus: () => void }

type CommandBarProps = {
  ref?: Ref<CommandBarHandle>
  targets: CommandTarget[]
  target: string
  onTargetChange: (value: string) => void
  running: boolean
  disabledReason: string | null
  onSend: (text: string, files: FileHit[]) => Promise<boolean>
  /** Mengunggah satu file; mengembalikan file yang tersimpan, atau null kalau gagal. */
  onAttach: (file: File) => Promise<FileHit | null>
  onStop: () => void
}

// Bilah perintah di bawah panggung 3D. Perintah masuk ke Otak (dibagi
// otomatis) atau langsung ke satu agent, memakai mesin yang sama dengan Chat.
// Lampiran memakai aturan file yang sama dengan Chat.
function CommandBar({
  ref,
  targets,
  target,
  onTargetChange,
  running,
  disabledReason,
  onSend,
  onAttach,
  onStop,
}: CommandBarProps) {
  const input = useRef<HTMLInputElement>(null)
  const targetId = useId()
  const inputId = useId()
  const [text, setText] = useState("")
  const [files, setFiles] = useState<FileHit[]>([])
  const [uploading, setUploading] = useState(0)
  const [sending, setSending] = useState(false)
  const [dragging, setDragging] = useState(false)
  const picker = useFilePicker({
    accept: READABLE_ACCEPT,
    multiple: true,
    onFiles: (picked) => void attach(picked),
  })

  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }))

  async function attach(picked: File[]) {
    if (!picked.length || disabledReason || running) return
    const list = picked.slice(0, 10)
    setUploading((count) => count + list.length)
    for (const file of list) {
      const hit = await onAttach(file)
      setUploading((count) => count - 1)
      if (hit)
        setFiles((prev) =>
          prev.some((item) => item.path === hit.path) ? prev : [...prev, hit]
        )
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const value = text.trim()
    if (!value || running || sending || uploading || disabledReason) return
    setSending(true)
    const sent = files
    setText("")
    setFiles([])
    const ok = await onSend(value, sent)
    setSending(false)
    // Kalau gagal dikirim, teks dan lampiran dikembalikan supaya tidak hilang.
    if (!ok) {
      setText(value)
      setFiles(sent)
    }
  }

  const busy = running || sending
  // Lampiran tersimpan di percakapan untuk tujuan yang dipilih, jadi tujuan
  // dikunci selama ada lampiran.
  const targetLocked = busy || files.length > 0 || uploading > 0

  return (
    <form
      onSubmit={submit}
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
        void attach(Array.from(event.dataTransfer.files))
      }}
      className={cn(
        "relative flex flex-col gap-2 rounded-2xl border bg-card/95 p-2 shadow-lg",
        dragging && "border-primary ring-[3px] ring-primary/30"
      )}
      aria-label="Beri perintah ke kantor"
    >
      {picker.input}
      {dragging && (
        <p className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-card/95 text-sm font-medium">
          Lepas file untuk dilampirkan
        </p>
      )}

      {(files.length > 0 || uploading > 0) && (
        <ul
          className="flex flex-wrap items-center gap-1.5 px-1"
          aria-label="File yang akan dibaca"
        >
          {uploading > 0 && (
            <li
              className="flex h-7 items-center gap-1.5 text-xs text-muted-foreground"
              role="status"
            >
              <Spinner className="size-3.5" aria-hidden />
              Mengunggah {uploading} file...
            </li>
          )}
          {files.map((file) => (
            <li key={file.path}>
              <FileChip
                name={fileName(file.rel)}
                title={file.rel}
                onRemove={() =>
                  setFiles((prev) =>
                    prev.filter((item) => item.path !== file.path)
                  )
                }
              />
            </li>
          ))}
          {files.length > 0 && (
            <li className="text-xs text-muted-foreground">
              Hapus lampiran untuk mengganti tujuan.
            </li>
          )}
        </ul>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor={targetId} className="sr-only">
          Kirim ke
        </label>
        <NativeSelect
          id={targetId}
          value={target}
          onChange={(event) => onTargetChange(event.target.value)}
          disabled={targetLocked}
          className="sm:w-56"
        >
          {targets.map((item) => (
            <NativeSelectOption key={item.value} value={item.value}>
              {item.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <InputGroup className="flex-1 border-transparent bg-transparent dark:bg-transparent">
          <label htmlFor={inputId} className="sr-only">
            Perintah
          </label>
          <InputGroupInput
            ref={input}
            id={inputId}
            value={text}
            onChange={(event) => setText(event.target.value)}
            disabled={Boolean(disabledReason)}
            maxLength={8000}
            placeholder={
              disabledReason ??
              (running ? "Kantor sedang bekerja..." : "Beri perintah ke kantor")
            }
            className="text-base md:text-sm"
          />
          <InputGroupAddon align="inline-end" className="gap-1">
            <InputGroupButton
              size="icon-touch"
              disabled={Boolean(disabledReason) || running}
              onClick={picker.open}
              aria-label="Lampirkan file"
            >
              <Paperclip />
            </InputGroupButton>
            {running ? (
              <InputGroupButton
                size="icon-touch"
                variant="outline"
                onClick={onStop}
                aria-label="Hentikan pekerjaan"
              >
                <Square />
              </InputGroupButton>
            ) : (
              <InputGroupButton
                type="submit"
                size="icon-touch"
                variant="default"
                disabled={
                  !text.trim() ||
                  busy ||
                  uploading > 0 ||
                  Boolean(disabledReason)
                }
                aria-label="Kirim perintah"
              >
                {sending ? <Spinner /> : <SendHorizontal />}
              </InputGroupButton>
            )}
          </InputGroupAddon>
        </InputGroup>
      </div>
    </form>
  )
}

export { CommandBar }

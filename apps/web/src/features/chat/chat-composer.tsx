import {
  AtSign,
  FileText,
  Lightbulb,
  Paperclip,
  SendHorizontal,
  Square,
} from "lucide-react"
import {
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react"

import { FileChip } from "@/components/common/file-chip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { chatApi, type FileHit } from "@/features/chat/chat-api"
import { useFilePicker } from "@/hooks/use-file-picker"
import { READABLE_ACCEPT } from "@/lib/files"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

// Sama dengan batas pesan di API (apps/api/src/chat/routes.ts).
export const MAX_MESSAGE = 8000

// Contoh perintah yang memakai data yang memang ada di C:\ALfa.
const EXAMPLES = [
  "Buat model 3D dari denah Uji Tebedak Ngabang, lalu sebutkan ukurannya",
  "Rangkum laporan progress maintenance bulan September",
  "Bandingkan ukuran semua denah DXF yang ada di folder Kalkulator files",
  "Dokumen apa saja yang perlu ditambahkan ke basis pengetahuan?",
]

export type ComposerHandle = {
  /** Isi kotak ketik (opsional), fokus, lalu buka daftar file (@). */
  startMention: (text?: string) => void
  focus: () => void
}

type ChatComposerProps = {
  ref?: Ref<ComposerHandle>
  running: boolean
  disabled: boolean
  draft: string
  onDraftChange: (value: string) => void
  onSend: (text: string, files: FileHit[]) => Promise<boolean>
  onAttach: (file: File) => Promise<FileHit | null>
  onStop: () => void
}

// Mencari "@kata" yang sedang diketik tepat sebelum kursor.
function mentionAt(text: string, caret: number) {
  const match = /(^|\s)@([^\s@]*)$/.exec(text.slice(0, caret))
  return match ? { start: caret - match[2].length - 1, query: match[2] } : null
}

function ChatComposer({
  ref,
  running,
  disabled,
  draft,
  onDraftChange,
  onSend,
  onAttach,
  onStop,
}: ChatComposerProps) {
  const textarea = useRef<HTMLTextAreaElement>(null)
  const listId = useId()
  const [files, setFiles] = useState<FileHit[]>([])
  const [mention, setMention] = useState<{
    start: number
    query: string
  } | null>(null)
  const [hits, setHits] = useState<FileHit[]>([])
  const [active, setActive] = useState(0)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(0)
  const [dragging, setDragging] = useState(false)

  const tooLong = draft.length > MAX_MESSAGE
  const picker = useFilePicker({
    accept: READABLE_ACCEPT,
    multiple: true,
    onFiles: (picked) => void attach(picked),
  })

  function startMention(value = draft, fromText = false) {
    const element = textarea.current
    // Teks dari kartu pekerjaan: @ selalu ditaruh di akhir teks itu.
    const caret =
      !fromText && element === document.activeElement
        ? (element?.selectionStart ?? value.length)
        : value.length
    const prefix = caret > 0 && !/\s/.test(value[caret - 1]) ? " @" : "@"
    onDraftChange(value.slice(0, caret) + prefix + value.slice(caret))
    setMention({ start: caret + prefix.length - 1, query: "" })
    requestAnimationFrame(() => {
      element?.focus()
      element?.setSelectionRange(caret + prefix.length, caret + prefix.length)
    })
  }

  useImperativeHandle(ref, () => ({
    startMention: (text?: string) =>
      text === undefined ? startMention() : startMention(text, true),
    focus: () =>
      requestAnimationFrame(() => {
        const element = textarea.current
        element?.focus()
        element?.setSelectionRange(element.value.length, element.value.length)
      }),
  }))

  async function attach(picked: File[]) {
    if (!picked.length || disabled) return
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

  useEffect(() => {
    if (!mention) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      chatApi
        .files(mention.query)
        .then((result) => {
          if (cancelled) return
          setHits(result)
          setActive(0)
        })
        .catch(() => !cancelled && setHits([]))
    }, 150)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [mention])

  // Tinggi kotak ikut isi, maksimal sekitar 8 baris.
  useEffect(() => {
    const element = textarea.current
    if (!element) return
    element.style.height = "auto"
    element.style.height = `${Math.min(element.scrollHeight, 200)}px`
  }, [draft])

  function pick(hit: FileHit) {
    if (!mention) return
    const element = textarea.current
    const caret = element?.selectionStart ?? draft.length
    onDraftChange(draft.slice(0, mention.start) + draft.slice(caret))
    setFiles((prev) =>
      prev.some((file) => file.path === hit.path) ? prev : [...prev, hit]
    )
    setMention(null)
    requestAnimationFrame(() => {
      element?.focus()
      element?.setSelectionRange(mention.start, mention.start)
    })
  }

  async function submit() {
    const text = draft.trim()
    if (!text || tooLong || running || disabled || sending || uploading) return
    setSending(true)
    // Chip file langsung dikosongkan saat pesan terkirim; dikembalikan
    // kalau pengiriman gagal supaya user tidak perlu memilih ulang.
    const sent = files
    setFiles([])
    setMention(null)
    const ok = await onSend(text, sent)
    setSending(false)
    if (!ok) setFiles(sent)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mention && hits.length) {
      if (event.key === "ArrowDown") {
        event.preventDefault()
        setActive((index) => (index + 1) % hits.length)
        return
      }
      if (event.key === "ArrowUp") {
        event.preventDefault()
        setActive((index) => (index - 1 + hits.length) % hits.length)
        return
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault()
        pick(hits[active])
        return
      }
    }
    if (event.key === "Escape" && mention) {
      event.preventDefault()
      setMention(null)
      return
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      void submit()
    }
  }

  const showList = mention !== null
  const canSend =
    !disabled &&
    !sending &&
    uploading === 0 &&
    !tooLong &&
    draft.trim().length > 0

  return (
    <div
      className="relative"
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
    >
      {picker.input}

      {showList && (
        <div className="absolute right-0 bottom-full left-0 z-20 mb-2 overflow-hidden rounded-xl border bg-popover shadow-md">
          <p className="border-b px-3 py-2 text-xs text-muted-foreground">
            File di C:\ALfa{" "}
            {mention.query ? `yang cocok dengan "${mention.query}"` : ""}. Panah
            untuk memilih, Enter untuk menambah.
          </p>
          {hits.length ? (
            <ul
              id={listId}
              role="listbox"
              aria-label="Pilih file"
              className="max-h-64 overflow-y-auto py-1"
            >
              {hits.map((hit, index) => (
                <li
                  key={hit.path}
                  role="option"
                  aria-selected={index === active}
                  // Pilihan dengan mouse; keyboard lewat panah + Enter di kotak ketik.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(hit)}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm",
                    index === active ? "bg-muted" : "hover:bg-muted/60"
                  )}
                >
                  <FileText
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="truncate">{hit.rel}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              Tidak ada file yang cocok.
            </p>
          )}
        </div>
      )}

      <InputGroup
        className={cn(
          "rounded-2xl bg-card shadow-sm has-[[data-slot=input-group-control]:focus-visible]:ring-primary/15",
          dragging && "border-primary ring-[3px] ring-primary/30"
        )}
      >
        {dragging && (
          <p className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-card/95 text-sm font-medium">
            Lepas file untuk dilampirkan
          </p>
        )}

        {(files.length > 0 || uploading > 0) && (
          <InputGroupAddon align="block-start">
            <ul
              className="flex flex-wrap gap-1.5"
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
                    name={file.rel.split("/").pop() ?? file.rel}
                    title={file.rel}
                    onRemove={() =>
                      setFiles((prev) =>
                        prev.filter((item) => item.path !== file.path)
                      )
                    }
                  />
                </li>
              ))}
            </ul>
          </InputGroupAddon>
        )}

        <InputGroupTextarea
          ref={textarea}
          id="chat-input"
          rows={1}
          value={draft}
          disabled={disabled}
          onChange={(event) => {
            onDraftChange(event.target.value)
            setMention(
              mentionAt(event.target.value, event.target.selectionStart)
            )
          }}
          onKeyDown={onKeyDown}
          onClick={(event) =>
            setMention(mentionAt(draft, event.currentTarget.selectionStart))
          }
          onBlur={() => window.setTimeout(() => setMention(null), 150)}
          role="combobox"
          aria-label="Pesan untuk Otak Sparta"
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          aria-autocomplete="list"
          aria-invalid={tooLong || undefined}
          placeholder="Tulis perintah untuk Otak Sparta"
          className="min-h-11 px-4 py-3 text-base md:text-sm"
        />

        <InputGroupAddon
          align="block-end"
          className="gap-1 border-t bg-muted/40 px-1 py-1 sm:px-2 [.border-t]:pt-1"
        >
          <InputGroupButton
            size="touch"
            disabled={disabled}
            onClick={picker.open}
          >
            <Paperclip />
            <span className="sr-only sm:not-sr-only">Lampirkan</span>
          </InputGroupButton>
          <InputGroupButton
            size="touch"
            disabled={disabled}
            onClick={() => startMention()}
          >
            <AtSign />
            <span className="sr-only sm:not-sr-only">Sebut File</span>
          </InputGroupButton>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <InputGroupButton size="touch" disabled={disabled}>
                <Lightbulb />
                <span className="sr-only sm:not-sr-only">Contoh Perintah</span>
              </InputGroupButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-80 max-w-[calc(100vw-2rem)]"
            >
              <DropdownMenuLabel>
                Pilih untuk mengisi kotak ketik
              </DropdownMenuLabel>
              {EXAMPLES.map((example) => (
                <DropdownMenuItem
                  key={example}
                  className="min-h-11 whitespace-normal"
                  onSelect={() => {
                    onDraftChange(example)
                    requestAnimationFrame(() => textarea.current?.focus())
                  }}
                >
                  {example}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <span
            className={cn(
              "ml-auto px-2 text-xs tabular-nums",
              tooLong
                ? "font-semibold text-destructive"
                : "text-muted-foreground"
            )}
            aria-live={tooLong ? "polite" : undefined}
          >
            {formatNumber(draft.length)} / {formatNumber(MAX_MESSAGE)}
            {tooLong && (
              <span className="sr-only"> Pesan terlalu panjang.</span>
            )}
          </span>
          {running ? (
            <InputGroupButton
              size="icon-touch"
              variant="outline"
              onClick={onStop}
              aria-label="Hentikan Otak Sparta"
            >
              <Square />
            </InputGroupButton>
          ) : (
            <InputGroupButton
              size="icon-touch"
              variant="default"
              disabled={!canSend}
              onClick={() => void submit()}
              aria-label="Kirim pesan"
            >
              {sending ? <Spinner /> : <SendHorizontal />}
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}

export { ChatComposer }

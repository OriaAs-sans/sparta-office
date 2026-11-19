import {
  BookOpen,
  ClipboardCheck,
  History,
  MessageSquarePlus,
  PencilRuler,
  Plus,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { ActionItem } from "@/components/common/action-item"
import { ErrorAlert } from "@/components/common/error-alert"
import { IconTile } from "@/components/common/icon-tile"
import { PageHeading } from "@/components/common/page-heading"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  chatApi,
  type ChatMessage,
  type FileHit,
} from "@/features/chat/chat-api"
import {
  ChatComposer,
  type ComposerHandle,
} from "@/features/chat/chat-composer"
import { ChatHistory } from "@/features/chat/chat-history"
import { ChatMessageView } from "@/features/chat/chat-message"
import { usePolling } from "@/hooks/use-polling"
import { formatFileSize, MAX_UPLOAD_BYTES, readFileAsBase64 } from "@/lib/files"
import { session, STORAGE_KEYS } from "@/lib/storage"
import { cn } from "@/lib/utils"

// Kartu pekerjaan di layar sambutan (setara kartu aksi di referensi).
// Mengklik mengisi kotak ketik, tidak langsung mengirim; yang butuh file
// langsung membuka daftar file (@).
type QuickAction = {
  icon: LucideIcon
  title: string
  hint: string
  prompt: string
  needsFile: boolean
}

const ACTIONS: QuickAction[] = [
  {
    icon: PencilRuler,
    title: "Buat 3D dari Denah",
    hint: "Sebut atau lampirkan file DXF",
    prompt: "Buat model 3D dari denah ini, lalu sebutkan ukurannya.",
    needsFile: true,
  },
  {
    icon: Wrench,
    title: "Triase Kerusakan Toko",
    hint: "Tulis laporan, lampirkan foto",
    prompt: "Triase laporan kerusakan ini: ",
    needsFile: false,
  },
  {
    icon: ClipboardCheck,
    title: "Cek Pengajuan",
    hint: "Sebut atau lampirkan RAB dan penawaran",
    prompt: "Cek kelengkapan dan hitungan pengajuan ini.",
    needsFile: true,
  },
  {
    icon: BookOpen,
    title: "Tanya Basis Pengetahuan",
    hint: "SOP, standar toko, harga satuan",
    prompt: "Menurut basis pengetahuan, ",
    needsFile: false,
  },
]

function ChatView() {
  const status = usePolling(chatApi.status, 30000)
  const chats = usePolling(chatApi.list, 10000)
  const [chatId, setChatIdState] = useState<string | null>(null)
  // Ref dipakai supaya beberapa lampiran yang diunggah berurutan memakai
  // percakapan yang sama, bukan masing-masing membuat percakapan baru.
  const chatIdRef = useRef<string | null>(null)
  const creating = useRef<Promise<string | null> | null>(null)
  const setChatId = (id: string | null) => {
    chatIdRef.current = id
    setChatIdState(id)
  }

  async function ensureChat() {
    if (chatIdRef.current) return chatIdRef.current
    creating.current ??= newChat().finally(() => {
      creating.current = null
    })
    return creating.current
  }
  const [messages, setMessages] = useState<ChatMessage[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [draft, setDraft] = useState("")
  const [showHistory, setShowHistory] = useState(false)

  // Dari Kantor ("Buka di Chat"): buka percakapan yang barusan dijalankan.
  useEffect(() => {
    const id = session.take(STORAGE_KEYS.openChat)
    if (id) queueMicrotask(() => void open(id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const bottom = useRef<HTMLDivElement>(null)
  const composer = useRef<ComposerHandle>(null)

  function startAction(action: QuickAction) {
    if (action.needsFile) {
      composer.current?.startMention(action.prompt)
    } else {
      setDraft(action.prompt)
      composer.current?.focus()
    }
  }

  async function open(id: string) {
    setChatId(id)
    setMessages(null)
    setLoadError(null)
    setShowHistory(false)
    try {
      const detail = await chatApi.get(id)
      setMessages(detail.messages)
      setRunning(detail.running)
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Percakapan gagal dimuat."
      )
    }
  }

  // Kalau percakapan sedang dikerjakan dari tab lain atau setelah reload,
  // ambil ulang isinya sampai selesai.
  useEffect(() => {
    if (!chatId || !running) return
    const timer = window.setInterval(async () => {
      try {
        const detail = await chatApi.get(chatId)
        if (!detail.running) {
          setMessages(detail.messages)
          setRunning(false)
        }
      } catch {
        // dicoba lagi di putaran berikutnya
      }
    }, 3000)
    return () => window.clearInterval(timer)
  }, [chatId, running])

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" })
  }, [messages])

  async function newChat() {
    try {
      const chat = await chatApi.create()
      await chats.refresh()
      setChatId(chat.id)
      setMessages([])
      setLoadError(null)
      setShowHistory(false)
      return chat.id
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Percakapan baru gagal dibuat."
      )
      return null
    }
  }

  async function remove(id: string) {
    try {
      await chatApi.remove(id)
      if (id === chatId) {
        setChatId(null)
        setMessages(null)
      }
      await chats.refresh()
      toast.success("Percakapan dihapus.")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Percakapan gagal dihapus."
      )
    }
  }

  async function send(text: string, files: FileHit[]) {
    const id = await ensureChat()
    if (!id) return false
    const now = new Date().toISOString()
    const userMessage: ChatMessage = {
      id: `lokal-${now}`,
      role: "user",
      content: text,
      files: files.map((file) => file.path),
      steps: [],
      models: [],
      status: "selesai",
      error: null,
      createdAt: now,
    }
    const reply: ChatMessage = {
      ...userMessage,
      id: `balasan-${now}`,
      role: "assistant",
      content: "",
      files: [],
      status: "berjalan",
    }
    setMessages((prev) => [...(prev ?? []), userMessage, reply])
    setDraft("")
    setRunning(true)

    const patch = (update: (message: ChatMessage) => ChatMessage) =>
      setMessages(
        (prev) =>
          prev?.map((message) =>
            message.id === reply.id ? update(message) : message
          ) ?? prev
      )

    try {
      await chatApi.send(
        id,
        text,
        files.map((file) => file.path),
        (event) => {
          if (event.type === "step") {
            patch((m) => ({
              ...m,
              steps: [
                ...m.steps,
                { id: event.id, label: event.label, agent: event.agent },
              ],
            }))
          } else if (event.type === "step-result") {
            patch((m) => ({
              ...m,
              steps: m.steps.map((s) =>
                s.id === event.id ? { ...s, ok: event.ok } : s
              ),
            }))
          } else if (event.type === "text") {
            patch((m) => ({
              ...m,
              content: m.content ? `${m.content}\n\n${event.text}` : event.text,
            }))
          } else if (event.type === "model") {
            patch((m) =>
              m.models.includes(event.modelId)
                ? m
                : { ...m, models: [...m.models, event.modelId] }
            )
          } else if (event.type === "done") {
            patch((m) => ({
              ...m,
              content: event.text || m.content,
              status: "selesai",
            }))
          } else if (event.type === "error") {
            patch((m) => ({ ...m, status: "gagal", error: event.message }))
          }
        }
      )
    } catch (error) {
      // Pesan gagal dikirim: kembalikan teks ke kotak ketik supaya tidak hilang.
      setMessages(
        (prev) =>
          prev?.filter(
            (message) =>
              message.id !== userMessage.id && message.id !== reply.id
          ) ?? prev
      )
      setDraft(text)
      setRunning(false)
      toast.error(
        error instanceof Error ? error.message : "Pesan gagal dikirim."
      )
      return false
    }
    setRunning(false)
    void chats.refresh()
    return true
  }

  // Lampiran butuh percakapan; kalau belum ada, dibuat dulu.
  async function attach(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(
        `${file.name} lebih dari ${formatFileSize(MAX_UPLOAD_BYTES)}.`
      )
      return null
    }
    const id = await ensureChat()
    if (!id) return null
    try {
      return await chatApi.attach(id, file.name, await readFileAsBase64(file))
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `${file.name}: ${error.message}`
          : `${file.name} gagal diunggah.`
      )
      return null
    }
  }

  async function stop() {
    if (!chatId) return
    try {
      await chatApi.cancel(chatId)
    } catch {
      toast.error("Gagal menghentikan. Coba lagi.")
    }
  }

  const engineDown = status.data && !status.data.available

  const history = (
    <ChatHistory
      chats={chats.data}
      loading={chats.loading}
      error={chats.error}
      activeId={chatId}
      running={running}
      onOpen={(id) => void open(id)}
      onNew={() => void newChat()}
      onRemove={(id) => void remove(id)}
    />
  )
  const empty =
    !loadError && !(chatId && messages === null) && !messages?.length

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        title="Chat Otak"
        actions={
          <div className="flex gap-2 xl:hidden">
            <Button
              variant="outline"
              size="touch"
              onClick={() => setShowHistory(true)}
            >
              <History data-icon="inline-start" />
              Riwayat
            </Button>
            <Button
              variant="outline"
              size="touch"
              onClick={() => void newChat()}
              disabled={running}
            >
              <MessageSquarePlus data-icon="inline-start" />
              Baru
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="mx-auto flex min-h-[calc(100dvh-12rem)] w-full max-w-3xl flex-col gap-4">
          {engineDown && (
            <ErrorAlert
              title="Otak Sparta belum bisa dijalankan"
              message={status.data?.reason ?? "Mesin otak tidak tersedia."}
            />
          )}

          <div
            className={cn(
              "flex flex-1 flex-col gap-6",
              empty && "justify-center"
            )}
            aria-live="polite"
          >
            {loadError ? (
              <ErrorAlert
                title="Percakapan gagal dimuat"
                message={loadError}
                onRetry={() => chatId && void open(chatId)}
              />
            ) : chatId && messages === null ? (
              <div className="flex flex-col gap-4" aria-busy="true">
                <Skeleton className="ml-auto h-12 w-2/3 rounded-2xl" />
                <Skeleton className="h-28 w-full rounded-2xl" />
              </div>
            ) : messages?.length ? (
              messages.map((message) => (
                <ChatMessageView key={message.id} message={message} />
              ))
            ) : (
              <div className="flex flex-col items-center gap-8 py-10 text-center">
                <div className="flex flex-col gap-3">
                  <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
                    Mau dikerjakan apa hari ini?
                  </h2>
                  <p className="mx-auto max-w-xl text-base text-pretty text-muted-foreground">
                    Tulis perintah atau pilih pekerjaan di bawah. Otak Sparta
                    membaca basis pengetahuan dan file di C:\ALfa, lalu membagi
                    tugas ke agent.
                  </p>
                </div>
                <ul
                  className="grid w-full grid-cols-1 gap-3 text-left sm:grid-cols-2"
                  aria-label="Pekerjaan yang bisa dimulai"
                >
                  {ACTIONS.map((action) => (
                    <li key={action.title}>
                      <ActionItem
                        size="default"
                        className="min-h-16"
                        media={<IconTile icon={action.icon} />}
                        title={action.title}
                        description={action.hint}
                        disabled={Boolean(engineDown)}
                        onClick={() => startAction(action)}
                        actions={
                          <span
                            className="flex size-8 items-center justify-center rounded-full border text-muted-foreground"
                            aria-hidden
                          >
                            <Plus className="size-4" />
                          </span>
                        }
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div ref={bottom} />
          </div>

          <div className="sticky bottom-0 -mx-4 bg-background px-4 pt-2 pb-4">
            <ChatComposer
              ref={composer}
              running={running}
              disabled={Boolean(engineDown)}
              draft={draft}
              onDraftChange={setDraft}
              onSend={send}
              onAttach={attach}
              onStop={() => void stop()}
            />
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Jawaban bisa salah, cek sumber yang disebut. Mesin: Claude Code di
              laptop ini.
            </p>
          </div>
        </div>

        <aside className="sticky top-8 hidden max-h-[calc(100dvh-4rem)] border-l pl-6 xl:flex xl:flex-col">
          {history}
        </aside>
      </div>

      <Sheet open={showHistory} onOpenChange={setShowHistory}>
        <SheetContent side="right" className="w-80 p-4 pt-12">
          <SheetTitle className="sr-only">Riwayat percakapan</SheetTitle>
          <SheetDescription className="sr-only">
            Buka atau hapus percakapan sebelumnya.
          </SheetDescription>
          {history}
        </SheetContent>
      </Sheet>
    </div>
  )
}

export { ChatView }

import { MessageSquarePlus, Trash2 } from "lucide-react"

import { ActionItem } from "@/components/common/action-item"
import { ErrorAlert } from "@/components/common/error-alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { ChatSummary } from "@/features/chat/chat-api"
import { formatTime } from "@/lib/format"

type ChatHistoryProps = {
  chats: ChatSummary[] | undefined
  loading: boolean
  error: Error | null
  activeId: string | null
  running: boolean
  onOpen: (id: string) => void
  onNew: () => void
  onRemove: (id: string) => void
}

// Panel kanan, setara daftar Projects di referensi: tiap percakapan tampil
// sebagai kartu berisi judul dan cuplikan pesan terakhir.
function ChatHistory({
  chats,
  loading,
  error,
  activeId,
  running,
  onOpen,
  onNew,
  onRemove,
}: ChatHistoryProps) {
  return (
    <section
      aria-labelledby="riwayat-judul"
      className="flex min-h-0 flex-col gap-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="riwayat-judul" className="text-sm font-semibold">
          Riwayat{" "}
          <span className="font-normal text-muted-foreground">
            ({chats?.length ?? 0})
          </span>
        </h2>
        <Button variant="ghost" size="touch" onClick={onNew} disabled={running}>
          <MessageSquarePlus data-icon="inline-start" />
          Baru
        </Button>
      </div>

      {loading && !chats ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      ) : error && !chats ? (
        <ErrorAlert title="Riwayat gagal dimuat" message={error.message} />
      ) : chats?.length ? (
        <ul className="flex flex-col gap-2 overflow-y-auto pr-1">
          {chats.map((chat) => {
            const active = chat.id === activeId
            return (
              <li key={chat.id}>
                <ActionItem
                  title={chat.title}
                  description={
                    <>
                      {chat.preview && (
                        <span className="block truncate">{chat.preview}</span>
                      )}
                      <span className="block">
                        {formatTime(chat.updatedAt)}
                      </span>
                    </>
                  }
                  selected={active}
                  disabled={running && !active}
                  onClick={() => onOpen(chat.id)}
                  actions={
                    <Button
                      variant="ghost"
                      size="icon-touch"
                      aria-label={`Hapus percakapan ${chat.title}`}
                      disabled={running && active}
                      onClick={() => onRemove(chat.id)}
                    >
                      <Trash2 />
                    </Button>
                  }
                />
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Belum ada percakapan. Pesan pertamamu akan tersimpan di sini.
        </p>
      )}
    </section>
  )
}

export { ChatHistory }

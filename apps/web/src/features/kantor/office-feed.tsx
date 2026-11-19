import { ArrowRight, MessagesSquare } from "lucide-react"
import { useEffect, useRef } from "react"

import { CollapsibleSection } from "@/components/common/collapsible-section"
import { ErrorAlert } from "@/components/common/error-alert"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import type { OfficeEvent } from "@/features/kantor/office-stream"
import { formatClock } from "@/lib/format"
import { cn } from "@/lib/utils"

type OfficeFeedProps = {
  events: OfficeEvent[]
  busy: string[]
  lastStep: Record<string, string>
  nameOf: (id: string) => string
  onFocusAgent: (id: string) => void
  error: string | null
}

// Catatan siapa memberi tugas ke siapa. Pengirim dan penerima bisa diklik
// untuk menyorot robotnya di panggung 3D.
function OfficeFeed({
  events,
  busy,
  lastStep,
  nameOf,
  onFocusAgent,
  error,
}: OfficeFeedProps) {
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" })
  }, [events.length, busy.length])

  // Fungsi biasa (bukan komponen) supaya tombol tidak dibuat ulang tiap render.
  const person = (id: string) =>
    id === "user" ? (
      <span className="font-semibold">Kamu</span>
    ) : (
      // Tautan di dalam baris teks (pengecualian target sentuh untuk teks inline).
      <Button
        variant="link"
        onClick={() => onFocusAgent(id)}
        className="h-auto p-0 text-xs font-semibold text-foreground"
      >
        {nameOf(id)}
      </Button>
    )

  if (error && !events.length) {
    return (
      <ErrorAlert title="Percakapan Kantor tidak bisa dimuat" message={error} />
    )
  }

  if (!events.length && !busy.length) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MessagesSquare />
          </EmptyMedia>
          <EmptyTitle>Kantor masih sepi</EmptyTitle>
          <EmptyDescription>
            Beri perintah lewat bilah di bawah panggung. Pembagian tugas
            antar-agent akan tercatat di sini.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <ol
      className="flex flex-col gap-1"
      aria-live="polite"
      aria-label="Percakapan kantor"
    >
      {events.map((event, index) => {
        const newRun = index > 0 && events[index - 1].chatId !== event.chatId
        return (
          <li key={event.id} className="flex flex-col">
            {newRun && <span className="my-2 h-px bg-border" aria-hidden />}
            <article
              className={cn(
                "flex flex-col gap-1 rounded-xl px-3 py-2.5",
                event.kind === "perintah" && "bg-muted/50",
                event.kind === "gagal" && "bg-destructive/10"
              )}
            >
              <header className="flex items-center gap-1.5 text-xs">
                {person(event.from)}
                <ArrowRight
                  className="size-3 text-muted-foreground"
                  aria-label="ke"
                />
                {person(event.to)}
                <time
                  className="ml-auto text-muted-foreground"
                  dateTime={event.createdAt}
                >
                  {formatClock(event.createdAt)}
                </time>
              </header>
              <p
                className={cn(
                  "text-sm break-words",
                  event.kind === "gagal" && "text-destructive"
                )}
              >
                {event.text}
              </p>
              {event.full && event.full.length > event.text.length + 20 && (
                <CollapsibleSection
                  title="Lihat pesan lengkap"
                  variant="inline"
                >
                  <p className="max-h-60 overflow-y-auto text-xs whitespace-pre-wrap">
                    {event.full}
                  </p>
                </CollapsibleSection>
              )}
            </article>
          </li>
        )
      })}
      {busy.map((id) => (
        <li
          key={`busy-${id}`}
          className="flex items-center gap-2 px-3 py-2 text-xs text-working"
          role="status"
        >
          <Spinner className="size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0">
            <span className="font-semibold">{nameOf(id)}</span> sedang bekerja
            {lastStep[id] ? `: ${lastStep[id]}` : ""}
          </span>
        </li>
      ))}
      <div ref={end} />
    </ol>
  )
}

export { OfficeFeed }

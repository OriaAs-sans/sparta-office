import { Brain, Check, ChevronDown, X } from "lucide-react"
import { lazy, Suspense, useState } from "react"

import { ErrorAlert } from "@/components/common/error-alert"
import { FileChip } from "@/components/common/file-chip"
import { IconTile } from "@/components/common/icon-tile"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import type { ChatMessage as Message } from "@/features/chat/chat-api"
import { Markdown } from "@/features/chat/markdown"
import { fileName } from "@/lib/files"
import { cn } from "@/lib/utils"

const DenahViewer = lazy(() => import("@/features/denah/denah-viewer"))

// Langkah kerja Otak. Saat berjalan selalu terbuka; setelah selesai dilipat
// dan bisa dibuka lagi (Collapsible shadcn).
function StepList({ message }: { message: Message }) {
  const running = message.status === "berjalan"
  const [open, setOpen] = useState(false)
  if (!message.steps.length && !running) return null

  return (
    <Collapsible
      open={running || open}
      onOpenChange={setOpen}
      className="group/steps flex flex-col gap-2"
    >
      <CollapsibleTrigger
        disabled={running}
        className="flex min-h-11 items-center gap-2 self-start rounded-lg px-2 text-xs font-medium text-muted-foreground outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/60 disabled:hover:bg-transparent"
      >
        {running ? (
          <Spinner className="text-working" aria-hidden />
        ) : (
          <ChevronDown
            className="size-4 transition-transform group-data-[state=open]/steps:rotate-180"
            aria-hidden
          />
        )}
        {running
          ? "Otak Sparta sedang bekerja"
          : `${message.steps.length} langkah dikerjakan`}
      </CollapsibleTrigger>
      {message.steps.length > 0 && (
        <CollapsibleContent asChild>
          <ol
            className="flex flex-col gap-1 border-l-2 border-border pl-3"
            aria-live="polite"
          >
            {message.steps.map((step) => (
              <li
                key={step.id}
                className={cn(
                  "flex items-start gap-2 text-xs",
                  step.agent && "pl-4"
                )}
              >
                <span className="mt-0.5 shrink-0" aria-hidden>
                  {step.ok === undefined ? (
                    <Spinner className="size-3.5 text-working" />
                  ) : step.ok ? (
                    <Check className="size-3.5 text-muted-foreground" />
                  ) : (
                    <X className="size-3.5 text-destructive" />
                  )}
                </span>
                <span className="min-w-0 break-words">
                  {step.agent && (
                    <span className="font-semibold">{step.agent}: </span>
                  )}
                  {step.label}
                  {step.ok === false && (
                    <span className="text-destructive">
                      {" "}
                      (ditolak atau gagal)
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </CollapsibleContent>
      )}
    </Collapsible>
  )
}

function ChatMessageView({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-muted px-4 py-2.5 text-sm whitespace-pre-wrap text-foreground">
          {message.content}
        </div>
        {message.files.length > 0 && (
          <ul
            className="flex max-w-[85%] flex-wrap justify-end gap-1.5"
            aria-label="File yang disebut"
          >
            {message.files.map((file) => (
              <li key={file}>
                <FileChip name={fileName(file)} title={file} />
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      <IconTile icon={Brain} size="sm" className="mt-1" />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <span className="sr-only">Otak Sparta:</span>
        <StepList message={message} />
        {message.content && <Markdown>{message.content}</Markdown>}
        {message.models.map((modelId) => (
          <Suspense
            key={modelId}
            fallback={<Skeleton className="h-72 w-full rounded-xl" />}
          >
            <DenahViewer modelId={modelId} />
          </Suspense>
        ))}
        {message.status === "gagal" && (
          <ErrorAlert
            title="Otak Sparta berhenti"
            message={message.error ?? "Penyebabnya tidak diketahui."}
          />
        )}
      </div>
    </div>
  )
}

export { ChatMessageView }

import { Check, Copy, Terminal } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

type ClaudeCodeGuideProps = {
  subagent: string
  examplePrompt: string
}

// Agent sungguhan berjalan di Claude Code (langganan Pro), bukan di web.
// Panel ini menunjukkan cara memanggilnya; hasilnya kembali ke web lewat outbox.
function ClaudeCodeGuide({ subagent, examplePrompt }: ClaudeCodeGuideProps) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(examplePrompt)
      setCopied(true)
      toast.success("Contoh prompt disalin.")
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Browser menolak akses clipboard. Salin teksnya manual.")
    }
  }

  return (
    <section
      aria-labelledby={`guide-${subagent}`}
      className="flex flex-col gap-3 rounded-xl border p-4"
    >
      <h3
        id={`guide-${subagent}`}
        className="flex items-center gap-2 text-sm font-semibold"
      >
        <Terminal className="size-4" aria-hidden />
        Prompt di Claude Code
      </h3>
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
        <li>Buka Claude Code di folder C:\ALfa.</li>
        <li>
          Sebut agent {subagent} dan mention file dengan @, seperti contoh di
          bawah.
        </li>
        <li>Hasilnya otomatis muncul di Inbox Review halaman ini.</li>
      </ol>
      <div className="flex items-start gap-2 rounded-lg bg-muted p-3">
        <code className="min-w-0 flex-1 font-mono text-sm break-words whitespace-pre-wrap">
          {examplePrompt}
        </code>
        <Button
          variant="ghost"
          size="icon-touch"
          onClick={copy}
          aria-label="Salin contoh prompt"
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
    </section>
  )
}

export { ClaudeCodeGuide }

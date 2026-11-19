import { MessageCircleReply } from "lucide-react"
import { toast } from "sonner"

import { CollapsibleSection } from "@/components/common/collapsible-section"
import { IconTile } from "@/components/common/icon-tile"
import { StatusDot } from "@/components/common/status-dot"
import { Button } from "@/components/ui/button"
import { agentIcon, CLAUDE_CODE_EXAMPLES } from "@/features/agents/agent-meta"
import { agentStatus } from "@/features/agents/agent-status"
import { ClaudeCodeGuide } from "@/features/agents/claude-code-guide"
import { DenahUploadForm } from "@/features/agents/denah-upload-form"
import { PreApprovalForm } from "@/features/agents/pre-approval-form"
import { TriageForm } from "@/features/agents/triage-form"
import { TaskList } from "@/features/tasks/task-list"
import { usePolling } from "@/hooks/use-polling"
import { api, type Agent, type Task } from "@/lib/api"

type AgentPanelProps = {
  agent: Agent
  demoMode: boolean
  canAskDirect: boolean
  onAskDirect: () => void
  onOpenTask: (task: Task) => void
  onTaskCreated: () => void
  refreshSignal: number
}

// Detail satu agent: aksi utama di atas, tugas terakhir, lalu cara pakai
// lain (Claude Code, upload, form demo) dilipat supaya tidak jadi tembok teks.
function AgentPanel({
  agent,
  demoMode,
  canAskDirect,
  onAskDirect,
  onOpenTask,
  onTaskCreated,
  refreshSignal,
}: AgentPanelProps) {
  const status = agentStatus(agent)
  const guide = CLAUDE_CODE_EXAMPLES[agent.id]
  const isActive = agent.availability === "aktif"
  const tasks = usePolling(
    () => (isActive ? api.tasks({ agentId: agent.id }) : Promise.resolve([])),
    3000,
    [agent.id, refreshSignal]
  )

  // Satu penangan untuk semua form: kirim, beri tahu, segarkan daftar.
  async function run(
    action: () => Promise<unknown>,
    success: string,
    failure: string
  ) {
    try {
      await action()
      toast.success(success)
      await tasks.refresh()
      onTaskCreated()
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : failure)
      return false
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start gap-3">
        <IconTile icon={agentIcon(agent.id)} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-lg font-semibold">{agent.name}</h2>
          <p className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">{agent.role}</span>
            <span className="text-muted-foreground" aria-hidden>
              /
            </span>
            <StatusDot
              className={status.dotClass}
              pulse={status.key === "bekerja"}
            />
            <span className={status.textClass}>{status.label}</span>
          </p>
        </div>
      </header>

      <p className="text-sm text-muted-foreground">{agent.description}</p>

      {canAskDirect && (
        <Button size="touch" variant="outline" onClick={onAskDirect}>
          <MessageCircleReply data-icon="inline-start" />
          Tanya {agent.name} Langsung
        </Button>
      )}

      {!isActive && (
        <div className="flex flex-col gap-2 rounded-xl border border-dashed p-4">
          <h3 className="text-sm font-semibold">
            Belum aktif. Yang perlu disiapkan:
          </h3>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
            {agent.prerequisites?.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {isActive && (
        <>
          <section
            aria-labelledby={`tugas-${agent.id}`}
            className="flex flex-col gap-3"
          >
            <h3 id={`tugas-${agent.id}`} className="text-sm font-semibold">
              Tugas terakhir
            </h3>
            <TaskList
              tasks={tasks.data?.slice(0, 5)}
              loading={tasks.loading}
              error={tasks.error}
              onRetry={() => void tasks.refresh()}
              onOpen={onOpenTask}
              emptyTitle="Belum ada tugas"
              emptyDescription={`Hasil kerja ${agent.name} akan muncul di sini.`}
            />
          </section>

          <div className="flex flex-col gap-2">
            {guide && (
              <CollapsibleSection title="Pakai dari Claude Code">
                <ClaudeCodeGuide
                  subagent={guide.subagent}
                  examplePrompt={guide.prompt}
                />
              </CollapsibleSection>
            )}
            {agent.id === "denah-bangunan" && (
              <CollapsibleSection title="Upload DXF Langsung">
                <DenahUploadForm
                  onUpload={(fileName, content) =>
                    run(
                      () => api.uploadDenah(fileName, content),
                      "Denah diubah ke 3D. Hasilnya ada di Tugas Terakhir dan Inbox Review.",
                      "Denah gagal diproses."
                    )
                  }
                />
              </CollapsibleSection>
            )}
            {(agent.id === "triase-maintenance" ||
              agent.id === "pre-approval") && (
              <CollapsibleSection
                title={demoMode ? "Form di Web (Mode Demo)" : "Form di Web"}
              >
                {demoMode && (
                  <p className="rounded-xl bg-working/10 p-3 text-sm">
                    Mode demo: hasil form dibuat dari aturan sederhana untuk
                    mencoba alurnya, bukan dari AI.
                  </p>
                )}
                {agent.id === "triase-maintenance" && (
                  <TriageForm
                    onSubmit={(input) =>
                      run(
                        () => api.createTask(agent.id, input),
                        `Tugas dikirim ke ${agent.name}.`,
                        "Tugas gagal dikirim."
                      )
                    }
                  />
                )}
                {agent.id === "pre-approval" && (
                  <PreApprovalForm
                    onSubmit={(input) =>
                      run(
                        () => api.createTask(agent.id, input),
                        `Tugas dikirim ke ${agent.name}.`,
                        "Tugas gagal dikirim."
                      )
                    }
                  />
                )}
              </CollapsibleSection>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export { AgentPanel }

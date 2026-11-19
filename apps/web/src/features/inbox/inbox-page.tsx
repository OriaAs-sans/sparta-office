import { useState } from "react"

import { PageHeading } from "@/components/common/page-heading"
import { TaskList } from "@/features/tasks/task-list"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePolling } from "@/hooks/use-polling"
import { api, type Task, type TaskStatus } from "@/lib/api"

const FILTERS: { status: TaskStatus; label: string; empty: string }[] = [
  {
    status: "menunggu_review",
    label: "Menunggu",
    empty: "Belum ada hasil agent yang perlu direview.",
  },
  {
    status: "disetujui",
    label: "Disetujui",
    empty: "Belum ada hasil yang disetujui.",
  },
  {
    status: "ditolak",
    label: "Ditolak",
    empty: "Belum ada hasil yang ditolak.",
  },
  { status: "gagal", label: "Gagal", empty: "Tidak ada tugas yang gagal." },
]

type InboxPageProps = {
  agentNames: Record<string, string>
  waitingCount: number
  onOpenTask: (task: Task) => void
  refreshSignal: number
}

function InboxPage({
  agentNames,
  waitingCount,
  onOpenTask,
  refreshSignal,
}: InboxPageProps) {
  const [status, setStatus] = useState<TaskStatus>("menunggu_review")
  const tasks = usePolling(() => api.tasks({ status }), 3000, [
    status,
    refreshSignal,
  ])
  const filter = FILTERS.find((item) => item.status === status) ?? FILTERS[0]

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        title="Inbox Review"
        description="Semua hasil agent, dari Chat Otak, Claude Code, maupun upload di web. Hasil baru berlaku setelah kamu setujui."
      />
      <Tabs
        value={status}
        onValueChange={(value) => setStatus(value as TaskStatus)}
      >
        <TabsList className="w-full group-data-horizontal/tabs:h-auto sm:w-fit">
          {FILTERS.map((item) => (
            <TabsTrigger
              key={item.status}
              value={item.status}
              className="min-h-11 px-4"
            >
              {item.label}
              {item.status === "menunggu_review" && waitingCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                  {waitingCount}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="max-w-3xl">
        <TaskList
          tasks={tasks.data}
          loading={tasks.loading}
          error={tasks.error}
          onRetry={() => void tasks.refresh()}
          onOpen={onOpenTask}
          agentNames={agentNames}
          emptyTitle={`Tidak ada di ${filter.label}`}
          emptyDescription={filter.empty}
        />
      </div>
    </div>
  )
}

export { InboxPage }

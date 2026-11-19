import { Inbox } from "lucide-react"

import { ActionItem } from "@/components/common/action-item"
import { ErrorAlert } from "@/components/common/error-alert"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { TaskModeBadge } from "@/features/tasks/task-mode-badge"
import { TaskStatusBadge } from "@/features/tasks/task-status-badge"
import type { Task } from "@/lib/api"
import { formatTime } from "@/lib/format"

type TaskListProps = {
  tasks: Task[] | undefined
  loading: boolean
  error: Error | null
  onRetry: () => void
  onOpen: (task: Task) => void
  emptyTitle: string
  emptyDescription: string
  agentNames?: Record<string, string>
}

function TaskList({
  tasks,
  loading,
  error,
  onRetry,
  onOpen,
  emptyTitle,
  emptyDescription,
  agentNames,
}: TaskListProps) {
  if (loading && !tasks) {
    return (
      <div
        className="flex flex-col gap-2"
        aria-busy="true"
        aria-label="Memuat tugas"
      >
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  if (error && !tasks) {
    return (
      <ErrorAlert
        title="Daftar tugas gagal dimuat"
        message={error.message}
        onRetry={onRetry}
      />
    )
  }

  if (!tasks?.length) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Inbox />
          </EmptyMedia>
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          <EmptyDescription>{emptyDescription}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {tasks.map((task) => (
        <li key={task.id}>
          <ActionItem
            title={task.title}
            description={
              <span className="flex flex-wrap items-center gap-1.5">
                <TaskModeBadge mode={task.mode} />
                <span>
                  {agentNames
                    ? `${agentNames[task.agentId] ?? task.agentId} / `
                    : ""}
                  {formatTime(task.createdAt)}
                </span>
              </span>
            }
            actions={<TaskStatusBadge status={task.status} />}
            onClick={() => onOpen(task)}
          />
        </li>
      ))}
    </ul>
  )
}

export { TaskList }

import { Badge } from "@/components/ui/badge"
import { TASK_STATUS_LABEL } from "@/features/tasks/task-status"
import type { TaskStatus } from "@/lib/api"
import { cn } from "@/lib/utils"

const STATUS_CLASS: Record<TaskStatus, string> = {
  antri: "border-border bg-muted text-muted-foreground",
  berjalan: "border-working/30 bg-working/10 text-working",
  menunggu_review: "bg-primary text-primary-foreground",
  disetujui: "border-border bg-muted text-foreground",
  ditolak: "border-border bg-muted text-foreground",
  gagal: "bg-destructive/10 text-destructive",
}

function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge variant="outline" className={cn(STATUS_CLASS[status])}>
      {TASK_STATUS_LABEL[status]}
    </Badge>
  )
}

export { TaskStatusBadge }

import { Badge } from "@/components/ui/badge"
import type { TaskMode } from "@/lib/api"

// Menunjukkan dari mana hasil berasal, supaya reviewer tahu seberapa jauh
// boleh percaya. Mode "live" (Claude API dari web) tidak diberi badge.
const MODE_LABEL: Partial<
  Record<TaskMode, { label: string; className: string }>
> = {
  demo: { label: "Demo", className: "border-working/40 text-working" },
  "claude-code": {
    label: "Claude Code",
    className: "border-border text-foreground",
  },
  konverter: { label: "Konverter", className: "border-border text-foreground" },
}

function TaskModeBadge({ mode }: { mode: TaskMode }) {
  const config = MODE_LABEL[mode]
  if (!config) return null
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  )
}

export { TaskModeBadge }

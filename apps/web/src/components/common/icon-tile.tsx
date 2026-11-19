import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type IconTileProps = {
  icon: LucideIcon
  size?: "sm" | "md"
  className?: string
}

// Ikon di dalam kotak abu, dipakai di kartu pekerjaan Chat dan kepala panel agent.
function IconTile({ icon: Icon, size = "md", className }: IconTileProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl bg-muted text-foreground",
        size === "md" ? "size-11" : "size-8 rounded-lg",
        className
      )}
    >
      <Icon className={size === "md" ? "size-5" : "size-4"} />
    </span>
  )
}

export { IconTile }

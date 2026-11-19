import { ChevronDown } from "lucide-react"
import type * as React from "react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

type CollapsibleSectionProps = {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  /** "card": kotak berbingkai. "inline": tautan kecil, misal "Lihat pesan lengkap". */
  variant?: "card" | "inline"
  className?: string
}

// Bagian buka-tutup berbasis Collapsible shadcn (keyboard dan aria-expanded
// sudah ditangani Radix).
function CollapsibleSection({
  title,
  children,
  defaultOpen,
  variant = "card",
  className,
}: CollapsibleSectionProps) {
  const inline = variant === "inline"
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className={cn("group/section", !inline && "rounded-xl border", className)}
    >
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center gap-2 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60",
          inline
            ? "min-h-11 text-xs text-muted-foreground hover:text-foreground"
            : "min-h-11 justify-between px-3 text-sm font-medium"
        )}
      >
        {title}
        <ChevronDown
          className={cn(
            "text-muted-foreground transition-transform group-data-[state=open]/section:rotate-180",
            inline ? "size-3.5" : "size-4"
          )}
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent
        className={cn(inline ? "pt-1" : "flex flex-col gap-4 border-t p-3")}
      >
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

export { CollapsibleSection }

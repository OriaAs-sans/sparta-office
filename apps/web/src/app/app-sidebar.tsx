import {
  BookOpen,
  Building2,
  Inbox,
  MessagesSquare,
  type LucideIcon,
} from "lucide-react"

import { Logo } from "@/components/common/logo"
import type { Route } from "@/hooks/use-hash-route"
import { cn } from "@/lib/utils"

const NAV: { route: Route; label: string; icon: LucideIcon }[] = [
  { route: "chat", label: "Chat Otak", icon: MessagesSquare },
  { route: "kantor", label: "Kantor Agent", icon: Building2 },
  { route: "inbox", label: "Inbox Review", icon: Inbox },
  { route: "pengetahuan", label: "Basis Pengetahuan", icon: BookOpen },
]

type AppSidebarProps = {
  route: Route
  onNavigate: (route: Route) => void
  reviewCount: number
  engineLabel: string | null
}

// Isi sidebar dipakai dua kali: menempel di kiri pada layar lebar, dan di
// dalam menu laci (Sheet) pada HP.
function AppSidebar({
  route,
  onNavigate,
  reviewCount,
  engineLabel,
}: AppSidebarProps) {
  return (
    <div className="flex h-full flex-col gap-8 px-4 py-5">
      <a
        href="#chat"
        className="flex min-h-11 items-center rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60"
        aria-label="Sparta Office, ke Chat Otak"
      >
        <Logo product="Office" className="gap-2 md:gap-3" />
      </a>

      <nav aria-label="Menu utama">
        <ul className="flex flex-col gap-1">
          {NAV.map(({ route: target, label, icon: Icon }) => {
            const active = target === route
            return (
              <li key={target}>
                <a
                  href={`#${target}`}
                  onClick={(event) => {
                    event.preventDefault()
                    onNavigate(target)
                  }}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60",
                    active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4.5 shrink-0",
                      active && "text-primary"
                    )}
                    aria-hidden
                  />
                  <span className="flex-1">{label}</span>
                  {target === "inbox" && reviewCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                      {reviewCount}
                      <span className="sr-only"> menunggu review</span>
                    </span>
                  )}
                </a>
              </li>
            )
          })}
        </ul>
      </nav>

      {engineLabel && (
        <p className="mt-auto px-3 text-xs text-muted-foreground">
          {engineLabel}
        </p>
      )}
    </div>
  )
}

export { AppSidebar }

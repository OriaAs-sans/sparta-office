import { Menu } from "lucide-react"
import { lazy, Suspense, useMemo, useState } from "react"

import { Logo } from "@/components/common/logo"
import { AppSidebar } from "@/app/app-sidebar"
import { TaskDetailDialog } from "@/features/tasks/task-detail-dialog"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { usePolling } from "@/hooks/use-polling"
import { useHashRoute, type Route } from "@/hooks/use-hash-route"
import { api } from "@/lib/api"
import { chatApi } from "@/features/chat/chat-api"
import { InboxPage } from "@/features/inbox/inbox-page"
import { KantorPage } from "@/features/kantor/kantor-page"
import { KnowledgePage } from "@/features/knowledge/knowledge-page"

// Chat (markdown dan viewer 3D) baru dimuat saat dibuka.
const ChatView = lazy(() =>
  import("@/features/chat/chat-view").then((module) => ({
    default: module.ChatView,
  }))
)

const PAGE_TITLE: Record<Route, string> = {
  chat: "Chat Otak",
  kantor: "Kantor Agent",
  inbox: "Inbox Review",
  pengetahuan: "Basis Pengetahuan",
}

function App() {
  const [route, navigate] = useHashRoute()
  const [menuOpen, setMenuOpen] = useState(false)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [refreshSignal, setRefreshSignal] = useState(0)

  const health = usePolling(api.health, 15000)
  const chatStatus = usePolling(chatApi.status, 30000)
  const agents = usePolling(api.agents, 3000)
  // Jumlah di sidebar dihitung dari data agent, jadi tidak perlu polling tambahan.
  const reviewCount = (agents.data ?? []).reduce(
    (sum, agent) => sum + (agent.activity?.menungguReview ?? 0),
    0
  )
  // Detail tugas yang terbuka ikut diperbarui, supaya hasil muncul sendiri.
  const openTask = usePolling(
    () => (openTaskId ? api.task(openTaskId) : Promise.resolve(null)),
    2000,
    [openTaskId]
  )

  const agentNames = useMemo(
    () =>
      Object.fromEntries(
        (agents.data ?? []).map((agent) => [agent.id, agent.name])
      ),
    [agents.data]
  )

  function refreshAll() {
    setRefreshSignal((value) => value + 1)
    void agents.refresh()
  }

  function go(next: Route) {
    navigate(next)
    setMenuOpen(false)
  }

  const engineLabel = chatStatus.data
    ? chatStatus.data.available
      ? "Mesin chat: Claude Code di laptop ini"
      : "Mesin chat belum tersedia"
    : null
  const dialogTask =
    openTaskId && openTask.data?.id === openTaskId ? openTask.data : null
  const sidebar = (
    <AppSidebar
      route={route}
      onNavigate={go}
      reviewCount={reviewCount}
      engineLabel={engineLabel}
    />
  )

  return (
    // Tema ruang kontrol berlaku di seluruh aplikasi (class di <html>).
    <div className="min-h-dvh bg-background text-foreground lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh border-r bg-sidebar lg:block">
        {sidebar}
      </aside>

      {/* HP dan tablet: bilah atas dengan menu laci. */}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background px-2 lg:hidden">
        <Button
          variant="ghost"
          size="icon-touch"
          aria-label="Buka menu"
          onClick={() => setMenuOpen(true)}
        >
          <Menu />
        </Button>
        <Logo product="Office" className="gap-2" />
        <span className="sr-only">Halaman: {PAGE_TITLE[route]}</span>
      </header>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar p-0 pt-10">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetDescription className="sr-only">
            Pindah ke halaman lain di Sparta Office.
          </SheetDescription>
          {sidebar}
        </SheetContent>
      </Sheet>

      <div className="min-h-dvh">
        <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 pb-16 lg:px-8 lg:py-8">
          {route === "chat" && (
            <Suspense
              fallback={<Skeleton className="h-[60dvh] w-full rounded-2xl" />}
            >
              <ChatView />
            </Suspense>
          )}
          {route === "kantor" && (
            <KantorPage
              agents={agents.data}
              agentsError={agents.error}
              onRetry={() => void agents.refresh()}
              health={health.data}
              engineReason={
                chatStatus.data && !chatStatus.data.available
                  ? (chatStatus.data.reason ?? "Mesin otak belum tersedia.")
                  : null
              }
              onOpenTask={(task) => setOpenTaskId(task.id)}
              onTaskCreated={refreshAll}
              onNavigate={go}
              refreshSignal={refreshSignal}
            />
          )}
          {route === "inbox" && (
            <InboxPage
              agentNames={agentNames}
              waitingCount={reviewCount}
              onOpenTask={(task) => setOpenTaskId(task.id)}
              refreshSignal={refreshSignal}
            />
          )}
          {route === "pengetahuan" && <KnowledgePage />}
        </main>
      </div>

      {/* key per tugas supaya catatan reviewer kosong lagi tiap membuka tugas lain */}
      <TaskDetailDialog
        key={openTaskId ?? "tertutup"}
        task={dialogTask}
        agentName={dialogTask ? agentNames[dialogTask.agentId] : undefined}
        onClose={() => setOpenTaskId(null)}
        onDecided={refreshAll}
      />
    </div>
  )
}

export { App }

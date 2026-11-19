import { ArrowUpRight, RotateCcw } from "lucide-react"
import { lazy, Suspense, useCallback, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { ActionItem } from "@/components/common/action-item"
import { ErrorAlert } from "@/components/common/error-alert"
import { StatusDot } from "@/components/common/status-dot"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  agentIcon,
  canAskDirect,
  DIRECT_AGENTS,
  OTAK_ID,
} from "@/features/agents/agent-meta"
import { AgentPanel } from "@/features/agents/agent-panel"
import { agentStatus, STATUS_LEGEND } from "@/features/agents/agent-status"
import { chatApi, type FileHit } from "@/features/chat/chat-api"
import {
  CommandBar,
  type CommandBarHandle,
  type CommandTarget,
} from "@/features/kantor/command-bar"
import type { SceneHandle } from "@/features/kantor/kantor-scene"
import { OfficeFeed } from "@/features/kantor/office-feed"
import {
  useOfficeStream,
  type OfficeEvent,
} from "@/features/kantor/office-stream"
import type { Route } from "@/hooks/use-hash-route"
import type { Agent, Health, Task } from "@/lib/api"
import { formatFileSize, MAX_UPLOAD_BYTES, readFileAsBase64 } from "@/lib/files"
import { session, STORAGE_KEYS } from "@/lib/storage"

// three.js hanya dimuat saat halaman Kantor dibuka.
const KantorScene = lazy(() => import("@/features/kantor/kantor-scene"))

const OTAK = OTAK_ID

type KantorPageProps = {
  agents: Agent[] | undefined
  agentsError: Error | null
  onRetry: () => void
  health: Health | undefined
  engineReason: string | null
  onOpenTask: (task: Task) => void
  onTaskCreated: () => void
  onNavigate: (route: Route) => void
  refreshSignal: number
}

function KantorPage({
  agents,
  agentsError,
  onRetry,
  health,
  engineReason,
  onOpenTask,
  onTaskCreated,
  onNavigate,
  refreshSignal,
}: KantorPageProps) {
  const [selectedId, setSelectedId] = useState("triase-maintenance")
  const [panelTab, setPanelTab] = useState("percakapan")
  const [target, setTarget] = useState(OTAK)
  const [runChatId, setRunChatId] = useState<string | null>(null)
  const [lastStep, setLastStep] = useState<Record<string, string>>({})
  const scene = useRef<SceneHandle>(null)
  const commandBar = useRef<CommandBarHandle>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [barInset, setBarInset] = useState(0)
  // Tinggi bilah perintah diukur langsung (berubah saat ada lampiran) supaya
  // panggung 3D bisa memusatkan lantai di atasnya.
  const barRef = useCallback((element: HTMLDivElement | null) => {
    if (!element) return
    const observer = new ResizeObserver(() =>
      setBarInset(element.offsetHeight + 12)
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Setiap kejadian asli di kantor diterjemahkan ke gerakan di panggung 3D.
  const onLive = useCallback((event: OfficeEvent) => {
    const view = scene.current
    if (event.kind === "langkah") {
      setLastStep((prev) => ({ ...prev, [event.from]: event.text }))
      view?.say(event.from, event.text, "langkah")
      return
    }
    if (event.kind === "perintah") {
      view?.resetView()
      view?.say(event.to, event.text, "tugas")
    } else if (event.kind === "tugas") {
      view?.beam(event.from, event.to, "tugas")
      view?.say(event.to, event.text, "tugas")
    } else if (event.kind === "laporan") {
      view?.beam(event.from, event.to, "laporan")
      view?.say(event.from, event.text, "laporan")
    } else {
      view?.say(event.from, event.text, "jawaban")
    }
  }, [])

  const office = useOfficeStream(onLive)

  const nameOf = useCallback(
    (id: string) =>
      id === OTAK
        ? "Otak Sparta"
        : (agents?.find((agent) => agent.id === id)?.name ?? id),
    [agents]
  )

  const targets: CommandTarget[] = useMemo(
    () => [
      { value: OTAK, label: "Otak (bagi tugas otomatis)" },
      ...DIRECT_AGENTS.map((id) => ({
        value: id,
        label: `Langsung: ${nameOf(id)}`,
      })),
    ],
    [nameOf]
  )

  function focusAgent(agentId: string) {
    setSelectedId(agentId)
    setPanelTab(agentId === OTAK ? "percakapan" : "agent")
    if (window.matchMedia("(max-width: 1279px)").matches) {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches
      requestAnimationFrame(() =>
        panelRef.current?.scrollIntoView({
          behavior: reduceMotion ? "auto" : "smooth",
          block: "start",
        })
      )
    }
  }

  // Lampiran butuh percakapan. Percakapan dibuat saat file pertama dilampirkan
  // (untuk tujuan yang sedang dipilih) lalu dipakai lagi saat perintah dikirim.
  const pendingChat = useRef<{ id: string; target: string } | null>(null)

  async function chatFor(currentTarget: string) {
    if (pendingChat.current?.target === currentTarget)
      return pendingChat.current.id
    // Tujuan sudah diganti: percakapan lama (berisi lampiran yang sudah
    // dihapus dari bilah) dibuang supaya tidak tertinggal kosong di riwayat.
    if (pendingChat.current)
      void chatApi.remove(pendingChat.current.id).catch(() => undefined)
    const chat = await chatApi.create(
      currentTarget === OTAK ? undefined : currentTarget
    )
    pendingChat.current = { id: chat.id, target: currentTarget }
    return chat.id
  }

  async function attachFile(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(
        `${file.name} lebih dari ${formatFileSize(MAX_UPLOAD_BYTES)}.`
      )
      return null
    }
    try {
      const chatId = await chatFor(target)
      return await chatApi.attach(
        chatId,
        file.name,
        await readFileAsBase64(file)
      )
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `${file.name}: ${error.message}`
          : `${file.name} gagal diunggah.`
      )
      return null
    }
  }

  async function sendCommand(text: string, files: FileHit[]) {
    try {
      const chatId = await chatFor(target)
      pendingChat.current = null
      setRunChatId(chatId)
      setPanelTab("percakapan")
      let failure: string | null = null
      await chatApi.send(
        chatId,
        text,
        files.map((file) => file.path),
        (event) => {
          if (event.type === "error") failure = event.message
        }
      )
      setRunChatId(null)
      onTaskCreated()
      if (failure) {
        toast.error(failure)
      } else {
        toast.success("Selesai. Jawaban lengkapnya ada di Chat Otak.", {
          action: {
            label: "Buka di Chat",
            onClick: () => {
              session.set(STORAGE_KEYS.openChat, chatId)
              onNavigate("chat")
            },
          },
        })
      }
      return true
    } catch (error) {
      setRunChatId(null)
      toast.error(
        error instanceof Error ? error.message : "Perintah gagal dikirim."
      )
      return false
    }
  }

  async function stopCommand() {
    if (!runChatId) return
    try {
      await chatApi.cancel(runChatId)
    } catch {
      toast.error("Gagal menghentikan. Coba lagi.")
    }
  }

  if (agentsError && !agents) {
    return (
      <ErrorAlert
        title="Ruang kontrol belum bisa dibuka"
        message={agentsError.message}
        onRetry={onRetry}
      />
    )
  }

  const review =
    agents?.reduce(
      (sum, agent) => sum + (agent.activity?.menungguReview ?? 0),
      0
    ) ?? 0
  const activeCount =
    agents?.filter((agent) => agent.availability === "aktif").length ?? 0
  const working = office.busy.filter((id) => id !== OTAK)
  const selectedAgent = agents?.find((agent) => agent.id === selectedId)
  const running = runChatId !== null || office.busy.length > 0

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Kantor Agent
          </h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            {activeCount} agent aktif. Beri perintah di bawah panggung, lalu
            lihat Otak membagi tugas ke agent.
            {health?.mode === "demo" &&
              " Form di web masih mode demo; agent AI berjalan lewat Otak."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm">
            <StatusDot
              className={
                office.busy.length ? "bg-working" : "bg-muted-foreground"
              }
              pulse={office.busy.length > 0}
            />
            {office.busy.length
              ? `${working.length || 1} sedang bekerja`
              : "Semua siaga"}
          </span>
          <Button
            size="touch"
            variant={review ? "default" : "outline"}
            onClick={() => onNavigate("inbox")}
          >
            {review ? `${review} Menunggu Review` : "Inbox Review"}
            <ArrowUpRight data-icon="inline-end" />
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_25rem]">
        {/* Panggung: 3D di belakang, kontrol menempel di atasnya. */}
        <section
          aria-label="Ruang kontrol"
          className="relative h-[68dvh] min-h-[28rem] overflow-hidden rounded-3xl border bg-background"
        >
          {agents ? (
            <Suspense
              fallback={<Skeleton className="absolute inset-0 rounded-none" />}
            >
              <KantorScene
                ref={scene}
                agents={agents}
                busy={office.busy}
                selectedId={selectedId}
                onSelect={focusAgent}
                bottomInset={barInset}
                className="absolute inset-0"
              />
            </Suspense>
          ) : (
            <Skeleton
              className="absolute inset-0 rounded-none"
              aria-label="Memuat ruang kontrol"
            />
          )}

          <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
            <ul
              className="pointer-events-auto hidden flex-wrap gap-x-3 gap-y-1 rounded-full border bg-card/90 px-3 py-2 sm:flex"
              aria-label="Keterangan warna mata robot"
            >
              {STATUS_LEGEND.map((item) => (
                <li
                  key={item.key}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <StatusDot className={item.dotClass} />
                  {item.label}
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              size="touch"
              className="pointer-events-auto ml-auto bg-card/90"
              onClick={() => scene.current?.resetView()}
            >
              <RotateCcw data-icon="inline-start" />
              <span className="sr-only sm:not-sr-only">Reset Tampilan</span>
            </Button>
          </div>

          <div ref={barRef} className="absolute inset-x-3 bottom-3">
            <CommandBar
              ref={commandBar}
              targets={targets}
              target={target}
              onTargetChange={setTarget}
              running={running}
              disabledReason={engineReason}
              onSend={sendCommand}
              onAttach={attachFile}
              onStop={() => void stopCommand()}
            />
          </div>
        </section>

        <div
          ref={panelRef}
          className="flex scroll-mt-20 flex-col xl:h-[68dvh] xl:min-h-[28rem]"
        >
          <Tabs
            value={panelTab}
            onValueChange={setPanelTab}
            className="flex min-h-0 flex-1 flex-col gap-3"
          >
            <TabsList className="w-full group-data-horizontal/tabs:h-auto">
              <TabsTrigger value="percakapan" className="min-h-11">
                Percakapan
              </TabsTrigger>
              <TabsTrigger value="agent" className="min-h-11">
                Agent
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="percakapan"
              className="min-h-0 flex-1 overflow-y-auto rounded-2xl border bg-card p-2"
            >
              <OfficeFeed
                events={office.events}
                busy={office.busy}
                lastStep={lastStep}
                nameOf={nameOf}
                onFocusAgent={focusAgent}
                error={office.error}
              />
            </TabsContent>

            <TabsContent
              value="agent"
              className="min-h-0 flex-1 overflow-y-auto rounded-2xl border bg-card p-4"
            >
              <div className="flex flex-col gap-5">
                <ul
                  className="grid grid-cols-2 gap-1.5"
                  aria-label="Pilih agent"
                >
                  {(agents ?? []).map((agent) => {
                    const Icon = agentIcon(agent.id)
                    const status = agentStatus(
                      agent,
                      office.busy.includes(agent.id)
                    )
                    return (
                      <li key={agent.id}>
                        <ActionItem
                          size="xs"
                          variant="default"
                          className="bg-transparent text-xs"
                          media={
                            <span className="flex items-center gap-1.5">
                              <StatusDot
                                className={status.dotClass}
                                pulse={status.key === "bekerja"}
                              />
                              <Icon
                                className="size-4 text-muted-foreground"
                                aria-hidden
                              />
                            </span>
                          }
                          title={agent.name}
                          ariaLabel={`${agent.name}, ${status.label}`}
                          selected={agent.id === selectedId}
                          onClick={() => focusAgent(agent.id)}
                        />
                      </li>
                    )
                  })}
                </ul>
                {selectedAgent && (
                  <AgentPanel
                    key={selectedAgent.id}
                    agent={selectedAgent}
                    demoMode={health?.mode === "demo"}
                    canAskDirect={
                      canAskDirect(selectedAgent.id) && !engineReason
                    }
                    onAskDirect={() => {
                      setTarget(selectedAgent.id)
                      commandBar.current?.focus()
                    }}
                    onOpenTask={onOpenTask}
                    onTaskCreated={onTaskCreated}
                    refreshSignal={refreshSignal}
                  />
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

export { KantorPage }

import { useEffect, useRef, useState } from "react"

import { apiRequest } from "@/lib/api"

export type OfficeKind =
  "perintah" | "tugas" | "langkah" | "laporan" | "jawaban" | "gagal"

export type OfficeEvent = {
  id: string
  chatId: string
  kind: OfficeKind
  from: string
  to: string
  text: string
  full: string
  createdAt: string
}

type StreamMessage =
  { type: "state"; busy: string[] } | { type: "event"; event: OfficeEvent }

/**
 * Riwayat Percakapan Kantor + aliran langsung (Server-Sent Events).
 * EventSource menyambung ulang sendiri kalau koneksi putus; setiap kali
 * tersambung, riwayat diambil ulang supaya tidak ada yang terlewat.
 */
export function useOfficeStream(onLive: (event: OfficeEvent) => void) {
  const [events, setEvents] = useState<OfficeEvent[]>([])
  const [busy, setBusy] = useState<string[]>([])
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const onLiveRef = useRef(onLive)

  useEffect(() => {
    onLiveRef.current = onLive
  })

  useEffect(() => {
    let closed = false

    async function loadHistory() {
      try {
        const data = await apiRequest<{
          events: OfficeEvent[]
          busy: string[]
        }>("/api/kantor/events")
        if (closed) return
        setEvents(data.events)
        setBusy(data.busy)
        setError(null)
      } catch {
        if (!closed)
          setError(
            "Percakapan Kantor tidak bisa dimuat. Pastikan API sudah jalan."
          )
      }
    }

    void loadHistory()
    const source = new EventSource("/api/kantor/stream")
    source.onopen = () => {
      setConnected(true)
      void loadHistory()
    }
    source.onerror = () => setConnected(false)
    source.onmessage = (message) => {
      let data: StreamMessage
      try {
        data = JSON.parse(message.data) as StreamMessage
      } catch {
        return
      }
      if (data.type === "state") setBusy(data.busy)
      if (data.type === "event") {
        // Langkah hanya untuk gelembung di 3D; catatan tetap ringkas.
        if (data.event.kind !== "langkah")
          setEvents((prev) => [...prev.slice(-199), data.event])
        onLiveRef.current(data.event)
      }
    }
    return () => {
      closed = true
      source.close()
    }
  }, [])

  return { events, busy, connected, error }
}

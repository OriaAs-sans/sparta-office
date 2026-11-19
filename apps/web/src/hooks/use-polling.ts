import { useCallback, useEffect, useRef, useState } from "react"

type PollingState<T> = {
  data: T | undefined
  error: Error | null
  loading: boolean
  refresh: () => Promise<void>
}

type Snapshot<T> = { key: string | null; data?: T; error: Error | null }

/**
 * Mengambil data lalu mengulanginya tiap `intervalMs`. Polling dipilih
 * daripada websocket supaya prototipe tetap sederhana; status agent cukup
 * diperbarui tiap beberapa detik. Saat `deps` berubah, data lama tidak
 * ditampilkan lagi sampai data untuk deps baru datang.
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
  deps: unknown[] = []
): PollingState<T> {
  const depsKey = JSON.stringify(deps)
  const [snapshot, setSnapshot] = useState<Snapshot<T>>({
    key: null,
    error: null,
  })
  const fetcherRef = useRef(fetcher)
  const keyRef = useRef(depsKey)

  useEffect(() => {
    fetcherRef.current = fetcher
    keyRef.current = depsKey
  })

  const refresh = useCallback(async () => {
    const key = keyRef.current
    try {
      const data = await fetcherRef.current()
      if (key === keyRef.current) setSnapshot({ key, data, error: null })
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      // Data terakhir tetap disimpan supaya layar tidak kosong saat satu polling gagal.
      if (key === keyRef.current)
        setSnapshot((prev) => ({
          key,
          data: prev.key === key ? prev.data : undefined,
          error,
        }))
    }
  }, [])

  useEffect(() => {
    keyRef.current = depsKey
    void refresh()
    const timer = window.setInterval(() => void refresh(), intervalMs)
    return () => window.clearInterval(timer)
  }, [depsKey, intervalMs, refresh])

  const current = snapshot.key === depsKey
  return {
    data: current ? snapshot.data : undefined,
    error: current ? snapshot.error : null,
    loading: !current,
    refresh,
  }
}

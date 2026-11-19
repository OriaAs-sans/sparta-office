import { useEffect, useState } from "react"

export const ROUTES = ["chat", "kantor", "inbox", "pengetahuan"] as const
export type Route = (typeof ROUTES)[number]

const DEFAULT_ROUTE: Route = "chat"

function readHash(): Route {
  const value = window.location.hash.replace(/^#/, "")
  return (ROUTES as readonly string[]).includes(value)
    ? (value as Route)
    : DEFAULT_ROUTE
}

/**
 * Halaman aktif disimpan di alamat (#chat, #kantor, ...) supaya bertahan
 * saat reload, bisa dibagikan, dan tombol Back browser tetap berfungsi.
 */
export function useHashRoute() {
  const [route, setRoute] = useState<Route>(readHash)

  useEffect(() => {
    const onChange = () => setRoute(readHash())
    window.addEventListener("hashchange", onChange)
    return () => window.removeEventListener("hashchange", onChange)
  }, [])

  return [route, (next: Route) => (window.location.hash = next)] as const
}

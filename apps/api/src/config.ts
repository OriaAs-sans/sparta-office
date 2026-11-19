import { paths } from "./paths.ts"

const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY?.trim())

// "live": agent memanggil Claude API. "demo": agent memakai aturan sederhana
// dan setiap hasil diberi label contoh. Tanpa key, otomatis demo.
// AGENT_MODE=demo memaksa demo walau key ada (misal untuk presentasi).
const mode: "live" | "demo" =
  process.env.AGENT_MODE === "demo" || !hasAnthropicKey ? "demo" : "live"

export const config = {
  port: Number(process.env.PORT ?? 10100),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5174",
  // Hanya dicek ada atau tidak. Nilainya tidak pernah dikirim ke browser.
  hasAnthropicKey,
  mode,
  model: "claude-opus-5-5",
  dbPath: paths.db,
}

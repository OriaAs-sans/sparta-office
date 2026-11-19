import { app } from "./app.ts"
import { config } from "./config.ts"
import { watchOutbox } from "./outbox.ts"
import { paths } from "./paths.ts"

app.listen(config.port, () => {
  console.log(`Sparta Office API jalan di http://localhost:${config.port}`)
  watchOutbox()
  console.log(`Memantau outbox Claude Code: ${paths.outbox}`)
  if (config.mode === "demo") {
    console.warn(
      config.hasAnthropicKey
        ? "Mode demo (AGENT_MODE=demo). Agent tidak memanggil Claude API."
        : "Mode demo: ANTHROPIC_API_KEY belum diisi. Agent memakai aturan sederhana, bukan AI."
    )
  }
})

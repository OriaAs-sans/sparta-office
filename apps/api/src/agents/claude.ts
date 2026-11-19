import Anthropic from "@anthropic-ai/sdk"
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod"
import type { z } from "zod"

import { config } from "../config.ts"

let client: Anthropic | null = null

function getClient() {
  // Klien dibuat saat dibutuhkan, supaya server tetap bisa jalan tanpa key
  // dan UI bisa menampilkan pesan "API key belum diisi".
  client ??= new Anthropic()
  return client
}

export class AgentRunError extends Error {}

type RunOptions<S extends z.ZodType> = {
  system: string
  content: Anthropic.Beta.BetaContentBlockParam[]
  schema: S
  effort: "low" | "medium" | "high"
}

export async function runStructured<S extends z.ZodType>({
  system,
  content,
  schema,
  effort,
}: RunOptions<S>): Promise<z.infer<S>> {
  if (!config.hasAnthropicKey) {
    throw new AgentRunError(
      "API key Anthropic belum diisi. Isi ANTHROPIC_API_KEY di apps/api/.env lalu jalankan ulang API."
    )
  }

  try {
    const response = await getClient().beta.messages.parse({
      model: config.model,
      max_tokens: 16000,
      system,
      messages: [{ role: "user", content }],
      output_config: { effort, format: betaZodOutputFormat(schema) },
      // Kalau model menolak karena filter keamanan, API mencoba ulang
      // dengan model cadangan yang dipilih server.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    })

    if (response.stop_reason === "refusal") {
      throw new AgentRunError(
        "Model menolak memproses permintaan ini. Ubah isi laporan lalu coba lagi."
      )
    }
    if (response.stop_reason === "max_tokens") {
      throw new AgentRunError("Jawaban agent terpotong. Coba kirim ulang tugasnya.")
    }
    if (!response.parsed_output) {
      throw new AgentRunError("Format jawaban agent tidak sesuai. Coba kirim ulang tugasnya.")
    }
    return response.parsed_output as z.infer<S>
  } catch (error) {
    if (error instanceof AgentRunError) throw error
    if (error instanceof Anthropic.AuthenticationError) {
      throw new AgentRunError("API key Anthropic ditolak. Cek lagi isi ANTHROPIC_API_KEY.")
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new AgentRunError("Batas pemakaian API tercapai. Tunggu sebentar lalu coba lagi.")
    }
    if (error instanceof Anthropic.BadRequestError) {
      throw new AgentRunError(`Permintaan ke API ditolak: ${error.message}`)
    }
    if (error instanceof Anthropic.APIConnectionError) {
      throw new AgentRunError("Tidak bisa terhubung ke API Anthropic. Cek koneksi internet server.")
    }
    if (error instanceof Anthropic.APIError) {
      throw new AgentRunError(`API Anthropic error (${error.status}). Coba lagi nanti.`)
    }
    throw error
  }
}

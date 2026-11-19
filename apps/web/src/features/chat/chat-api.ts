import { apiRequest, ApiError } from "@/lib/api"

export type ChatSummary = {
  id: string
  title: string
  agent?: string | null
  preview: string
  updatedAt: string
}

export type ChatStep = {
  id: string
  label: string
  agent?: string
  ok?: boolean
}

export type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  files: string[]
  steps: ChatStep[]
  models: string[]
  status: "selesai" | "berjalan" | "gagal"
  error: string | null
  createdAt: string
}

export type ChatDetail = {
  id: string
  title: string
  messages: ChatMessage[]
  running: boolean
}

export type ChatStatus = {
  engine: string
  available: boolean
  reason: string | null
}

export type FileHit = { path: string; rel: string; size: number }

export type StreamEvent =
  | { type: "start"; messageId: string }
  | { type: "step"; id: string; label: string; agent?: string }
  | { type: "step-result"; id: string; ok: boolean }
  | { type: "text"; text: string }
  | { type: "model"; modelId: string }
  | { type: "done"; text: string }
  | { type: "error"; message: string }

export const chatApi = {
  status: () => apiRequest<ChatStatus>("/api/chat/status"),
  list: () => apiRequest<ChatSummary[]>("/api/chats"),
  create: (agent?: string) =>
    apiRequest<ChatSummary>("/api/chats", {
      method: "POST",
      body: JSON.stringify(agent ? { agent } : {}),
    }),
  get: (id: string) => apiRequest<ChatDetail>(`/api/chats/${id}`),
  remove: (id: string) =>
    apiRequest<void>(`/api/chats/${id}`, { method: "DELETE" }),
  cancel: (id: string) =>
    apiRequest<{ cancelled: boolean }>(`/api/chats/${id}/cancel`, {
      method: "POST",
    }),
  attach: (chatId: string, fileName: string, data: string) =>
    apiRequest<FileHit>(`/api/chats/${chatId}/attachments`, {
      method: "POST",
      body: JSON.stringify({ fileName, data }),
    }),
  files: (query: string) =>
    apiRequest<FileHit[]>(`/api/files?q=${encodeURIComponent(query)}`),

  /** Mengirim pesan lalu membaca aliran Server-Sent Events sampai selesai. */
  async send(
    chatId: string,
    text: string,
    files: string[],
    onEvent: (event: StreamEvent) => void
  ) {
    let response: Response
    try {
      response = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, files }),
      })
    } catch {
      throw new ApiError(
        0,
        "Server Sparta Office tidak bisa dihubungi. Pastikan API sudah jalan."
      )
    }
    if (!response.ok || !response.body) {
      const body = await response.json().catch(() => null)
      throw new ApiError(
        response.status,
        body?.message ?? `Server error (${response.status}).`
      )
    }
    const reader = response.body
      .pipeThrough(new TextDecoderStream())
      .getReader()
    let buffer = ""
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += value
      const chunks = buffer.split("\n\n")
      buffer = chunks.pop() ?? ""
      for (const chunk of chunks) {
        const line = chunk.split("\n").find((item) => item.startsWith("data: "))
        if (!line) continue
        try {
          onEvent(JSON.parse(line.slice(6)) as StreamEvent)
        } catch {
          // baris rusak diabaikan, sisa aliran tetap dibaca
        }
      }
    }
  },
}

import { apiRequest } from "@/lib/api"

export type KnowledgeFile = { name: string; size: number; updatedAt: string }

export const knowledgeApi = {
  list: () => apiRequest<KnowledgeFile[]>("/api/knowledge"),
  /** `data` berupa base64 (lihat readFileAsBase64 di lib/files). */
  upload: (fileName: string, data: string) =>
    apiRequest<{ name: string }>("/api/knowledge", {
      method: "POST",
      body: JSON.stringify({ fileName, data }),
    }),
}

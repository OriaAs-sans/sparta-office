export type AgentAvailability = "aktif" | "belum_aktif"

export type AgentActivity = {
  berjalan: number
  menungguReview: number
  gagal: number
  selesai: number
}

export type Agent = {
  id: string
  name: string
  role: string
  room: string
  availability: AgentAvailability
  description: string
  prerequisites?: string[]
  activity: AgentActivity | null
}

export type TaskStatus =
  "antri" | "berjalan" | "menunggu_review" | "disetujui" | "ditolak" | "gagal"

export type TriageResult = {
  ringkasan: string
  kategori: string
  urgensi: "Darurat" | "Tinggi" | "Sedang" | "Rendah"
  alasan_urgensi: string
  tindakan_awal: string[]
  jenis_vendor: string
  pertanyaan_lanjutan: string[]
}

export type PreApprovalResult = {
  ringkasan: string
  rekomendasi: "Lanjut ke Approver" | "Perlu Klarifikasi" | "Lengkapi Dulu"
  total_rincian: number | null
  selisih_dengan_nilai: number | null
  temuan: {
    tingkat: "Kritis" | "Perlu Dicek" | "Info"
    item: string
    penjelasan: string
  }[]
  dokumen_kurang: string[]
}

export type DenahResult = {
  ringkasan: string
  model_id: string
  lebar_m: number
  panjang_m: number
  luas_bounding_m2: number
  panjang_garis_dinding_m: number
  jumlah_garis: number
  layer: { name: string; segments: number }[]
  layer_dinding: string[]
  satuan: string
  catatan: string[]
}

export type DenahModel = {
  sourceName: string
  width: number
  depth: number
  layers: { name: string; segments: number }[]
  wallLayers: string[]
  segments: [number, number, number, number, number][]
  labels: { text: string; x: number; y: number }[]
}

export type TaskMode = "live" | "demo" | "claude-code" | "konverter"

export type Task = {
  id: string
  agentId: string
  title: string
  input: Record<string, unknown>
  status: TaskStatus
  result: TriageResult | PreApprovalResult | DenahResult | null
  error: string | null
  decisionNote: string | null
  createdAt: string
  updatedAt: string
  decidedAt: string | null
  mode: TaskMode
}

export type Health = {
  ok: boolean
  apiKeyConfigured: boolean
  mode: "live" | "demo"
  model: string
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// Satu-satunya pembungkus fetch untuk API Sparta Office. Dipakai semua fitur.
export async function apiRequest<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    })
  } catch {
    throw new ApiError(
      0,
      "Server Sparta Office tidak bisa dihubungi. Pastikan API sudah jalan."
    )
  }
  // 204 (misal setelah hapus) tidak punya isi.
  if (response.status === 204) return undefined as T
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(
      response.status,
      body?.message ?? `Server error (${response.status}).`
    )
  }
  return body as T
}

export const api = {
  health: () => apiRequest<Health>("/api/health"),
  agents: () => apiRequest<Agent[]>("/api/agents"),
  tasks: (params: { agentId?: string; status?: TaskStatus } = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter((entry): entry is [string, string] =>
        Boolean(entry[1])
      )
    )
    return apiRequest<Task[]>(`/api/tasks${query.size ? `?${query}` : ""}`)
  },
  denahModel: (modelId: string) =>
    apiRequest<DenahModel>(`/api/denah/${modelId}`),
  uploadDenah: (fileName: string, content: string) =>
    apiRequest<Task>("/api/denah", {
      method: "POST",
      body: JSON.stringify({ fileName, content }),
    }),
  task: (taskId: string) => apiRequest<Task>(`/api/tasks/${taskId}`),
  createTask: (agentId: string, input: unknown) =>
    apiRequest<Task>("/api/tasks", {
      method: "POST",
      body: JSON.stringify({ agentId, input }),
    }),
  decide: (taskId: string, decision: "disetujui" | "ditolak", note: string) =>
    apiRequest<Task>(`/api/tasks/${taskId}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision, note }),
    }),
}

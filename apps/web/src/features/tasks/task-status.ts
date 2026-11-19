import type { TaskStatus } from "@/lib/api"

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  antri: "Antri",
  berjalan: "Diproses",
  menunggu_review: "Menunggu Review",
  disetujui: "Disetujui",
  ditolak: "Ditolak",
  gagal: "Gagal",
}

export function isTaskActive(status: TaskStatus) {
  return status === "antri" || status === "berjalan"
}

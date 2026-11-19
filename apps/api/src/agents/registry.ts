export type AgentAvailability = "aktif" | "belum_aktif"

export type AgentDefinition = {
  id: string
  name: string
  role: string
  room: string
  availability: AgentAvailability
  description: string
  // Untuk agent yang belum aktif: apa yang perlu disiapkan sebelum dibangun.
  prerequisites?: string[]
}

export const AGENTS: AgentDefinition[] = [
  {
    id: "triase-maintenance",
    name: "Triase Maintenance",
    role: "Maintenance",
    room: "maintenance",
    availability: "aktif",
    description:
      "Membaca laporan kerusakan toko (teks dan foto), lalu menentukan kategori, urgensi, tindakan awal, dan jenis vendor yang dibutuhkan.",
  },
  {
    id: "pre-approval",
    name: "Pre-Approval Checker",
    role: "Approval",
    room: "review",
    availability: "aktif",
    description:
      "Memeriksa kelengkapan dan konsistensi pengajuan pekerjaan sebelum sampai ke approver. Agent ini tidak menyetujui apa pun, keputusan tetap di approver.",
  },
  {
    id: "denah-bangunan",
    name: "Studio Denah",
    role: "Building",
    room: "studio",
    availability: "aktif",
    description:
      "Mengubah denah DXF menjadi model 3D: dinding diangkat dari garis denah. Di Claude Code, agent memilih layer dinding yang tepat dan mencatat temuan.",
  },
  {
    id: "rab-vendor",
    name: "RAB & Vendor Checker",
    role: "Building",
    room: "rab",
    availability: "belum_aktif",
    description:
      "Membandingkan penawaran vendor dengan harga satuan standar dan menandai item yang tidak wajar.",
    prerequisites: [
      "Daftar harga satuan standar yang berlaku",
      "Contoh penawaran vendor yang sudah diputus",
    ],
  },
  {
    id: "dokumen",
    name: "Dokumen SPK & BAST",
    role: "Administrasi",
    room: "dokumen",
    availability: "belum_aktif",
    description:
      "Menyusun draft SPK dan BAST dari pengajuan yang sudah disetujui.",
    prerequisites: ["Template SPK dan BAST resmi", "Alur tanda tangan yang berlaku"],
  },
  {
    id: "dev-frontend",
    name: "Agent Frontend",
    role: "Developer",
    room: "lab",
    availability: "belum_aktif",
    description:
      "Mengerjakan tampilan Sparta dari spec, mengikuti aturan shadcn dan DESIGN.md.",
    prerequisites: ["Repo Sparta yang dituju", "Alur review PR oleh tim dev"],
  },
  {
    id: "dev-backend",
    name: "Agent Backend",
    role: "Developer",
    room: "lab",
    availability: "belum_aktif",
    description: "Mengerjakan API dan database Sparta dari spec.",
    prerequisites: ["Repo Sparta yang dituju", "Database staging untuk uji coba"],
  },
  {
    id: "dev-qa",
    name: "Agent QA",
    role: "Developer",
    room: "lab",
    availability: "belum_aktif",
    description:
      "Menjalankan test, mengecek kondisi kosong dan error, lalu melaporkan bug sebelum PR di-merge.",
    prerequisites: ["Test suite di tiap repo", "Lingkungan staging"],
  },
]

export function findAgent(id: string) {
  return AGENTS.find((agent) => agent.id === id)
}

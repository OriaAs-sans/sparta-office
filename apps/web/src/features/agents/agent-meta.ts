import {
  Brain,
  ClipboardCheck,
  Code,
  FileSignature,
  FlaskConical,
  PencilRuler,
  ReceiptText,
  Server,
  Wrench,
  type LucideIcon,
} from "lucide-react"

/*
 * Data tampilan per agent yang dipakai di banyak tempat (Kantor, panel agent,
 * percakapan). Data agent sendiri (nama, status) tetap datang dari API.
 */

export const OTAK_ID = "otak"

// Ikon dipilih dari pekerjaannya: kunci untuk maintenance, papan cek untuk
// approval, penggaris untuk denah, dan seterusnya.
const AGENT_ICONS: Record<string, LucideIcon> = {
  [OTAK_ID]: Brain,
  "triase-maintenance": Wrench,
  "pre-approval": ClipboardCheck,
  "denah-bangunan": PencilRuler,
  "rab-vendor": ReceiptText,
  dokumen: FileSignature,
  "dev-frontend": Code,
  "dev-backend": Server,
  "dev-qa": FlaskConical,
}

export function agentIcon(agentId: string): LucideIcon {
  return AGENT_ICONS[agentId] ?? Brain
}

/** Agent yang punya subagent Claude Code, jadi bisa ditanya langsung tanpa Otak. */
export const DIRECT_AGENTS = [
  "denah-bangunan",
  "triase-maintenance",
  "pre-approval",
] as const

export function canAskDirect(agentId: string) {
  return (DIRECT_AGENTS as readonly string[]).includes(agentId)
}

/** Contoh prompt per subagent di C:\ALfa\.claude\agents (Claude Code dibuka di C:\ALfa). */
export const CLAUDE_CODE_EXAMPLES: Record<
  string,
  { subagent: string; prompt: string }
> = {
  "triase-maintenance": {
    subagent: "triase-maintenance",
    prompt:
      "Pakai triase-maintenance: cek laporan toko TZ01, AC kasir mati sejak pagi. Foto: @<foto-kerusakan.jpg>",
  },
  "pre-approval": {
    subagent: "pre-approval",
    prompt:
      "Pakai pre-approval: cek pengajuan renovasi plafon TZ01 dari @<RAB.pdf> dan @<penawaran-vendor.pdf>",
  },
  "denah-bangunan": {
    subagent: "studio-denah",
    prompt:
      'Pakai studio-denah: buat model 3D dari @"sparta-energy/Kalkulator files/Uji Tebedak Ngabang.dxf"',
  },
}

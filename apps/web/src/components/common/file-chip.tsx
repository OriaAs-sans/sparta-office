import { FileText, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type FileChipProps = {
  name: string
  /** Teks lengkap saat kursor diarahkan, misal path file. */
  title?: string
  /** Kalau ada, tampil tombol hapus. */
  onRemove?: () => void
  className?: string
}

// Chip nama file, dipakai di kotak chat (lampiran) dan di pesan terkirim.
function FileChip({ name, title, onRemove, className }: FileChipProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-7 max-w-full gap-1.5 bg-muted/50 pl-2.5 text-xs",
        onRemove && "pr-1",
        className
      )}
    >
      <FileText aria-hidden />
      <span className="max-w-48 truncate" title={title ?? name}>
        {name}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Hapus ${name}`}
          // Ikon kecil, tapi area klik diperluas ke 44px (target sentuh Sparta).
          className="relative flex size-5 items-center justify-center rounded-full outline-none after:absolute after:-inset-3 hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/60"
        >
          <X className="size-3.5" />
        </button>
      )}
    </Badge>
  )
}

export { FileChip }

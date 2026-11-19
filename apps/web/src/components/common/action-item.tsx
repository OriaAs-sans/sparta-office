import type * as React from "react"

import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { cn } from "@/lib/utils"

type ActionItemProps = {
  title: React.ReactNode
  description?: React.ReactNode
  /** Ikon atau gambar di kiri. */
  media?: React.ReactNode
  /** Elemen di kanan (badge, tombol). Tombol di sini tetap bisa diklik sendiri. */
  actions?: React.ReactNode
  onClick: () => void
  selected?: boolean
  disabled?: boolean
  /** Label pembaca layar kalau judul saja kurang jelas. */
  ariaLabel?: string
  variant?: "default" | "outline" | "muted"
  size?: "default" | "sm" | "xs"
  className?: string
}

/**
 * Baris daftar yang bisa diklik, dibangun dari Item shadcn.
 * Tombol diletakkan di judul dan area kliknya direntangkan ke seluruh baris
 * (after:inset-0), jadi HTML tetap valid (tombol tidak berisi div), bisa
 * dipakai dengan keyboard, dan tombol lain di `actions` tetap terpisah.
 * Dipakai untuk daftar tugas, riwayat chat, daftar agent, dan kartu pekerjaan.
 */
function ActionItem({
  title,
  description,
  media,
  actions,
  onClick,
  selected,
  disabled,
  ariaLabel,
  variant = "outline",
  size = "sm",
  className,
}: ActionItemProps) {
  return (
    <Item
      variant={variant}
      size={size}
      data-selected={selected || undefined}
      className={cn(
        "relative min-h-11 bg-card",
        "has-[[data-slot=action-item-button]:focus-visible]:ring-[3px] has-[[data-slot=action-item-button]:focus-visible]:ring-ring/60",
        disabled ? "opacity-50" : "hover:bg-muted/60",
        selected && "border-primary/60 bg-muted/60",
        className
      )}
    >
      {media && <ItemMedia>{media}</ItemMedia>}
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full min-w-0">
          <button
            type="button"
            data-slot="action-item-button"
            onClick={onClick}
            disabled={disabled}
            aria-label={ariaLabel}
            aria-pressed={selected === undefined ? undefined : selected}
            className="truncate text-left outline-none after:absolute after:inset-0 after:rounded-2xl disabled:cursor-not-allowed"
          >
            {title}
          </button>
        </ItemTitle>
        {description && (
          <ItemDescription className="truncate">{description}</ItemDescription>
        )}
      </ItemContent>
      {actions && (
        <ItemActions className="relative z-10">{actions}</ItemActions>
      )}
    </Item>
  )
}

export { ActionItem }

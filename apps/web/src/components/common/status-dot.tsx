import { cn } from "@/lib/utils"

type StatusDotProps = {
  className: string
  pulse?: boolean
}

// Titik status agent. Denyut hanya muncul saat agent bekerja, supaya dari
// jauh terlihat meja mana yang sedang sibuk. Dimatikan untuk reduced motion.
function StatusDot({ className, pulse }: StatusDotProps) {
  return (
    <span className="relative inline-flex size-2.5 shrink-0" aria-hidden>
      {pulse && (
        <span
          className={cn(
            "absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping",
            className
          )}
        />
      )}
      <span
        className={cn("relative inline-flex size-2.5 rounded-full", className)}
      />
    </span>
  )
}

export { StatusDot }

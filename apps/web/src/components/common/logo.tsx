import alfamartEmblem from "@/assets/Alfamart-Emblem-small.png"
import spartaBuildingLogo from "@/assets/Building-Logo.png"
import { cn } from "@/lib/utils"

type LogoProps = {
  className?: string
  product?: string
}

// Sama dengan logo portal login-sparta, ditambah nama produk di belakang.
function Logo({ className, product }: LogoProps) {
  return (
    <div className={cn("flex shrink-0 items-center gap-3 md:gap-4", className)}>
      <img
        src={alfamartEmblem}
        alt="Alfamart"
        className="h-8 w-auto object-contain md:h-9"
      />
      <div className="h-7 w-px rounded-full bg-border" />
      <div className="flex items-center gap-2">
        <img
          src={spartaBuildingLogo}
          alt=""
          className="h-8 w-auto object-contain md:h-9"
        />
        <span className="text-base font-bold tracking-wider text-foreground">
          SPARTA
        </span>
        {product && (
          <span className="text-base font-semibold text-review">{product}</span>
        )}
      </div>
    </div>
  )
}

export { Logo }

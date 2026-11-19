import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

// Dari registry shadcn. Import cn diperbaiki (registry menulis "cn"), label
// diterjemahkan, dan putaran mati saat pengguna mengurangi gerakan.
function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      data-slot="spinner"
      role="status"
      aria-label="Memuat"
      className={cn("size-4 motion-safe:animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }

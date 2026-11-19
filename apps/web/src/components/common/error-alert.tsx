import { RotateCw } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

type ErrorAlertProps = {
  title: string
  message: string
  /** Kalau ada, tampil tombol Coba Lagi. */
  onRetry?: () => void
  className?: string
}

// Pesan error standar: apa yang gagal, kenapa, dan cara mencoba lagi.
function ErrorAlert({ title, message, onRetry, className }: ErrorAlertProps) {
  return (
    <Alert variant="destructive" className={className}>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-2">
        <span>{message}</span>
        {onRetry && (
          <Button variant="outline" size="touch" onClick={onRetry}>
            <RotateCw data-icon="inline-start" />
            Coba Lagi
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}

export { ErrorAlert }

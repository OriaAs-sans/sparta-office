import type * as React from "react"

type PageHeadingProps = {
  title: string
  description?: string
  actions?: React.ReactNode
}

// Satu h1 per halaman, gaya judul halaman Sparta (text-2xl semibold tight).
function PageHeading({ title, description, actions }: PageHeadingProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex max-w-prose flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions}
    </div>
  )
}

export { PageHeading }

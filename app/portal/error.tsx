"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, RotateCcw, Home } from "lucide-react"

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[PortalError] Caught unhandled portal route error:", error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20">
        <AlertTriangle className="size-7" />
      </div>
      <h2 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
        Workspace temporarily unavailable
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        An error occurred while loading this section. You can retry loading or return to your main portal dashboard.
      </p>
      {error?.message ? (
        <pre className="mt-4 max-w-lg overflow-x-auto rounded-lg bg-muted/60 p-3 font-mono text-xs text-muted-foreground border border-border">
          {error.message}
        </pre>
      ) : null}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition hover:opacity-90"
        >
          <RotateCcw className="size-4" />
          Try Again
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
        >
          <Home className="size-4" />
          Go to Portal Home
        </Link>
      </div>
    </div>
  )
}

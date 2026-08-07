'use client'

import { useEffect } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

/**
 * Last-resort route boundary.
 *
 * The per-tab boundaries in app/page.tsx catch almost everything; this catches
 * what they cannot — a failure in the shell itself (header, nav, providers).
 * Without it those become a blank white page, which tells the user nothing and
 * offers no way back.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('App shell failed:', error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-4 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Something broke while loading the app</h2>
        <p className="text-sm text-muted-foreground">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <RotateCcw className="h-4 w-4" /> Try again
        </button>
      </div>
    </div>
  )
}

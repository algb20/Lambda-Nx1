'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
  /** What failed, in the user's terms — e.g. "the world map". */
  label?: string
  /** Optional custom fallback; the default is a small, retryable card. */
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface State {
  error: Error | null
}

/**
 * Contains a render/lifecycle failure to one panel.
 *
 * React unmounts the whole tree when a component throws and nothing catches it,
 * which is why a single broken widget produced a blank white page — the user
 * lost the entire product to one failing card, with no message and no way back.
 *
 * A boundary turns that into a local, honest failure: the rest of the app keeps
 * working, the panel says what broke, and "Try again" remounts just that subtree.
 *
 * Error boundaries must be class components — there is no hook equivalent.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep the stack in the console for diagnosis; never surface it to the user.
    console.error(`[${this.props.label ?? 'panel'}] render failed:`, error, info.componentStack)
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback(error, this.reset)

    return (
      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-medium">
              {this.props.label ? `${this.props.label} could not be displayed` : 'This section could not be displayed'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              The rest of the app is unaffected. {error.message ? `Reason: ${error.message}` : null}
            </p>
          </div>
          <button
            onClick={this.reset}
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground ring-1 ring-border transition-colors hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" /> Try again
          </button>
        </div>
      </div>
    )
  }
}

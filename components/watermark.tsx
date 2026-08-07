import type { ReactNode } from "react"
import { BrandMark } from "./brand-mark"

/**
 * Wraps rendered research or a post and stamps the λ signature in a corner. The
 * mark is the app's real logo (the lambda symbol, no text) — our signature on
 * anything that leaves the app or is captured/shared.
 *
 * Non-interactive and screen-reader-silent: it's a mark, not content.
 */
export function Watermarked({
  children,
  corner = "bottom-right",
  size = 34,
  opacity = 0.5,
  className,
}: {
  children: ReactNode
  corner?: "bottom-right" | "bottom-left" | "top-right" | "top-left"
  size?: number
  opacity?: number
  className?: string
}) {
  const pos: Record<string, string> = {
    "bottom-right": "bottom-3 right-3",
    "bottom-left": "bottom-3 left-3",
    "top-right": "top-3 right-3",
    "top-left": "top-3 left-3",
  }
  return (
    <div className={`relative ${className ?? ""}`}>
      {children}
      <span
        aria-hidden
        className={`pointer-events-none absolute ${pos[corner]} text-foreground`}
        style={{ opacity }}
      >
        <BrandMark size={size} />
      </span>
    </div>
  )
}

import {
  LAMBDA_STROKES,
  LAMBDA_STROKE_WIDTH,
  LAMBDA_VIEWBOX,
} from "@/lib/brand/mark"

/**
 * The Lambda logo — the λ symbol alone, no text. Shares its geometry with the
 * export watermark (`lib/brand/mark.ts`), so the on-screen mark and the stamp on
 * exported work are identical.
 *
 * Colour follows `currentColor` by default, so it inherits from CSS and adapts
 * to theme without extra props.
 */
export function BrandMark({
  size = 24,
  className,
  title,
  strokeWidth = LAMBDA_STROKE_WIDTH,
  opacity = 1,
}: {
  size?: number
  className?: string
  /** Accessible label; omit to render as decorative. */
  title?: string
  strokeWidth?: number
  opacity?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${LAMBDA_VIEWBOX} ${LAMBDA_VIEWBOX}`}
      fill="none"
      className={className}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <g
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={opacity}
      >
        {LAMBDA_STROKES.map((s, i) => (
          <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />
        ))}
      </g>
    </svg>
  )
}

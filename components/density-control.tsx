'use client'

import { DENSITY_LEVELS, type Density } from '@/lib/prefs/density'

/**
 * How much of the analysis to show at once.
 *
 * Four levels, each named for the reader's job rather than its size — the
 * tooltip carries the job and what the level adds, so choosing one is an
 * informed choice rather than a guess between four adjectives.
 *
 * It sits in the control band with the layer chips because it is the same kind
 * of control: it changes what the page shows, not what the data is. Putting it
 * in a settings panel would make it a thing a reader configures once and
 * forgets, when the whole value is switching it — Minimal to glance, Extreme to
 * work a developing event, and back.
 */
export function DensityControl({
  density,
  onChange,
}: {
  density: Density
  onChange: (next: Density) => void
}) {
  return (
    <span
      className="scroll-row flex max-w-full items-center rounded-md ring-1 ring-border"
      role="group"
      aria-label="How much detail to show"
    >
      {DENSITY_LEVELS.map((level) => (
        <button
          key={level.id}
          onClick={() => onChange(level.id)}
          aria-pressed={density === level.id}
          title={`${level.job} — ${level.adds}`}
          className={`touch-target shrink-0 whitespace-nowrap px-2 py-1.5 text-[11px] transition-colors ${
            density === level.id
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          {level.label}
        </button>
      ))}
    </span>
  )
}

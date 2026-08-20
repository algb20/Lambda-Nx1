'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Command as CommandIcon, CornerDownLeft, Search } from 'lucide-react'
import { TAB_DEFS } from '@/lib/navigation'
import { GATEWAY_FAMILIES, GATEWAY_GUIDANCE } from '@/lib/gateways'
import { buildCommands, moveSelection, rankCommands, type RankedCommand } from '@/lib/command-palette'

/**
 * ⌘K — one keystroke to anywhere in the product.
 *
 * Five tabs and twenty-seven gateways. The tabs have navigation surfaces; the
 * gateways live behind a picker inside one of them, so reaching `space-weather`
 * from the feed costs three deliberate clicks through a hierarchy the user has
 * to understand first. This is one keystroke and a few letters.
 *
 * The ranking lives in `lib/command-palette.ts` and is tested there without a
 * DOM. This file is the keyboard, the focus and the list — the parts that only
 * make sense in a browser.
 *
 * Two decisions worth stating:
 *
 *  - **The trigger is discoverable.** A palette nobody knows about is dead
 *    weight, so the header carries a visible button showing the shortcut. Every
 *    product that ships ⌘K silently is relying on the user having met the
 *    pattern elsewhere.
 *  - **Escape always closes, and focus goes back where it was.** A modal that
 *    strands the keyboard is worse than no modal.
 */

const LABELS: Record<string, string> = Object.fromEntries(
  GATEWAY_FAMILIES.flatMap((f) => f.modes.map((m) => [m, humanise(m)])),
)

function humanise(mode: string): string {
  return mode
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function CommandPalette({ onNavigate }: { onNavigate: (target: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  const commands = useMemo(
    () =>
      buildCommands({
        tabs: TAB_DEFS.map((t) => ({ id: t.id, label: t.label, description: t.description })),
        gateways: GATEWAY_FAMILIES.flatMap((family) =>
          family.modes.map((mode) => ({
            id: mode,
            label: LABELS[mode] ?? humanise(mode),
          })),
        ),
      }).map((c) =>
        c.gateway
          ? { ...c, hint: GATEWAY_GUIDANCE[c.gateway as keyof typeof GATEWAY_GUIDANCE]?.answers.slice(0, 90) ?? c.hint }
          : c,
      ),
    [],
  )

  const results = useMemo(() => rankCommands(commands, query), [commands, query])

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setSelected(0)
    // Back where they were. A modal that strands the keyboard is worse than none.
    returnFocusRef.current?.focus()
  }, [])

  const run = useCallback(
    (command: RankedCommand | undefined) => {
      if (!command) return
      close()
      if (command.href) {
        window.location.href = command.href
        return
      }
      if (command.tab) onNavigate(command.tab)
      // A gateway lives inside the Investigate tab, so go there and name it.
      if (command.gateway) onNavigate(`gateway:${command.gateway}`)
    },
    [close, onNavigate],
  )

  // The global shortcut. ⌘K on a Mac, Ctrl-K everywhere else.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        returnFocusRef.current = document.activeElement as HTMLElement | null
        setOpen((wasOpen) => !wasOpen)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Selection must never point past the end when the query narrows the list.
  useEffect(() => setSelected(0), [query])

  if (!open) {
    return (
      <button
        onClick={() => {
          returnFocusRef.current = document.activeElement as HTMLElement | null
          setOpen(true)
        }}
        aria-label="Open the command palette"
        className="hidden items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted sm:flex"
      >
        <Search className="h-3 w-3" />
        <span>Search</span>
        <kbd className="ml-1 rounded border border-border px-1 font-mono text-[9px]">
          <CommandIcon className="mb-0.5 inline h-2.5 w-2.5" />K
        </kbd>
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh]"
      onClick={close}
      role="presentation"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') return close()
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                return setSelected((n) => moveSelection(n, 1, results.length))
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                return setSelected((n) => moveSelection(n, -1, results.length))
              }
              if (e.key === 'Enter') {
                e.preventDefault()
                return run(results[selected])
              }
            }}
            placeholder="Go to a tab, open a gateway, find a tool…"
            className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            // The browser's own suggestions would cover our list.
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="shrink-0 rounded border border-border px-1 font-mono text-[9px] text-muted-foreground">
            esc
          </kbd>
        </div>

        {results.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            Nothing matches “{query}”.
          </p>
        ) : (
          <ul className="max-h-[52vh] overflow-y-auto py-1">
            {results.map((command, i) => {
              const previous = results[i - 1]
              return (
                <li key={command.id}>
                  {previous?.group !== command.group ? (
                    <p className="px-3 pb-0.5 pt-2 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                      {command.group}
                    </p>
                  ) : null}
                  <button
                    onMouseEnter={() => setSelected(i)}
                    onClick={() => run(command)}
                    aria-selected={i === selected}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                      i === selected ? 'bg-primary/10' : 'hover:bg-muted/60'
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px]">{command.label}</span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {command.hint}
                      </span>
                    </span>
                    {i === selected ? (
                      <CornerDownLeft className="h-3 w-3 shrink-0 text-muted-foreground" />
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

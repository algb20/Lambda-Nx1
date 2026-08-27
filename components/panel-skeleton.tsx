'use client'

import { Skeleton } from '@/components/ui/skeleton'

/**
 * What a tab looks like in the moment between the tap and its code arriving.
 *
 * Each panel is fetched on demand now (see the note in `app/page.tsx`), so a
 * tab switch in a live session has a real gap — one request, usually tens of
 * milliseconds on a warm connection and longer on a phone. An empty `<main>`
 * for that gap reads as a hang, and a spinner says nothing about what is
 * coming; a shape the size of the panel says the app is working and the screen
 * is about to fill.
 *
 * It is announced politely rather than assertively: this is progress on
 * something the reader just asked for, not news interrupting them. The label is
 * the tab's own name, so a screen reader says which panel is loading instead of
 * "loading" with no subject.
 */
export function PanelSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-4 px-4 py-4" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{`Loading ${label}…`}</span>
      <Skeleton className="h-7 w-48" aria-hidden />
      <Skeleton className="h-4 w-full max-w-md" aria-hidden />
      <div className="space-y-3 pt-2">
        <Skeleton className="h-24 w-full rounded-lg" aria-hidden />
        <Skeleton className="h-24 w-full rounded-lg" aria-hidden />
        <Skeleton className="h-24 w-full rounded-lg" aria-hidden />
      </div>
    </div>
  )
}

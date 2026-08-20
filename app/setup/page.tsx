import type { Metadata } from 'next'
import { SetupCheck } from '@/components/setup-check'

export const metadata: Metadata = {
  title: 'Is this copy working? — Lambda',
  description:
    'Runs the checks that tell apart a static deployment, a blocked server and a missing database — the three causes of an empty map that look identical.',
}

/**
 * `/setup` — the page that must work when nothing else does.
 *
 * Deliberately outside the app shell: no Pi gate, no auth provider, no
 * preferences, no data fetching on the server. Somebody reaching this page is
 * already looking at something broken, and a diagnostic that depends on the
 * thing being diagnosed is worthless.
 */
export default function SetupPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <SetupCheck />
    </main>
  )
}

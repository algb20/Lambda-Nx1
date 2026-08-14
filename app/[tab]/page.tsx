import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import HomePage from '../page'
import { TABS, tabDef, type Tab } from '@/lib/navigation'

/**
 * The tabs, as real addresses.
 *
 * ## What was wrong
 *
 * `/globe`, `/intelligence`, `/monitor` and `/account` all answered **404**.
 * The product existed at exactly one URL, because the active tab was component
 * state and nothing else. Four consequences, all of them serious and none of
 * them obvious from inside the app:
 *
 *  - **Nothing could be linked to.** Not by a user, not in a message, not from
 *    our own documentation. Every comparable platform in the field has an
 *    addressable page per capability; we had one address.
 *  - **A reload lost the user's place**, every time.
 *  - **The back button did nothing**, which reads as a broken app.
 *  - **A crawler saw 79 characters** — the sign-in screen — and nothing else.
 *    The entire product was invisible to search.
 *
 * ## Why this file rather than four
 *
 * Every tab renders the same shell with a different panel, so four page files
 * would be four copies of one import. The dynamic segment is validated against
 * the tab list and anything else is a genuine 404 — `/nonsense` must not render
 * the feed, or every typo becomes a soft-404 that search engines index.
 *
 * `generateStaticParams` pre-renders all four at build time, so they are static
 * documents with real metadata rather than server work per request.
 */
export function generateStaticParams() {
  // `feed` is the root and is served by `app/page.tsx`; listing it here too
  // would give one screen two addresses, which splits every link and every
  // ranking signal between them.
  return TABS.filter((t) => t !== 'feed').map((tab) => ({ tab }))
}

export const dynamicParams = false

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tab: string }>
}): Promise<Metadata> {
  const { tab } = await params
  if (!(TABS as readonly string[]).includes(tab)) return {}
  const def = tabDef(tab as Tab)

  return {
    title: `${def.label} — Lambda NX`,
    description: def.description,
    alternates: { canonical: `/${tab}` },
    openGraph: {
      title: `${def.label} — Lambda NX`,
      description: def.description,
      url: `/${tab}`,
      type: 'website',
    },
  }
}

export default async function TabPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params
  // A path that is not a tab is not a tab. Rendering the shell for it would
  // make every mistyped URL a page that returns 200 and shows the feed.
  if (!(TABS as readonly string[]).includes(tab)) notFound()
  return <HomePage />
}

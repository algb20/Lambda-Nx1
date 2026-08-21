'use client'

import { useMemo } from 'react'
import { GlobeView } from '@/components/globe-view'
import { CategoryPanels } from '@/components/category-panels'
import { CountryDossier } from '@/components/country-dossier'
import { StandingBriefPanel } from '@/components/standing-brief'
import { WorkspaceTabs, type Workspace } from '@/components/workspace-tabs'
import { useWorldReport } from '@/hooks/use-world-report'

/**
 * The globe tab, as four workspaces rather than one endless column.
 *
 * ## The measurement that forced this
 *
 * The page was 11,439 pixels tall. Collapsing everything empty took it to
 * 8,989px and made it navigable — an index, real section edges, counts, sort
 * and filter. It did not make it *right*: what was left is genuine analysis,
 * and the reason it was still nine thousand pixels is that four unrelated jobs
 * were stacked on one another.
 *
 * They are not sections of a document. They are four questions:
 *
 *  - **Map** — where is it happening, and what did a source actually measure?
 *  - **Brief** — how much is this evidence worth?
 *  - **Countries** — what does it say about a country, and can we even see it?
 *  - **Categories** — what is each kind of event reporting right now?
 *
 * A reader arrives holding one of them. Now they get that one, with the other
 * three counted and one tap away.
 *
 * ## One world, four views
 *
 * Every panel here reads the same picture from the shared store
 * (`lib/world/report-store`), so switching workspace costs no fetch and cannot
 * show a different world from the globe. The counts on the tabs come from that
 * same picture, which is why they can be trusted before the panel is opened.
 */
export function GlobeWorkspace() {
  const { report } = useWorldReport()

  const workspaces: Workspace[] = useMemo(() => {
    /** Categories actually present in this run — never the catalogue's list. */
    const categories = new Set((report?.events ?? []).map((e) => e.category))
    for (const e of report?.unplaceable ?? []) categories.add(e.category)

    return [
      {
        id: 'map',
        label: 'Map',
        count: report ? report.summary.total : null,
        render: () => <GlobeView />,
      },
      {
        id: 'brief',
        label: 'Brief',
        count: null,
        hint: 'How much this evidence is worth: what agrees, what contradicts, how old it is, and what it rests on.',
        render: () => <StandingBriefPanel />,
      },
      {
        id: 'countries',
        label: 'Countries',
        count: null,
        hint: 'Two numbers per country, never combined: what was reported, and how well we can see the place at all.',
        render: () => <CountryDossier />,
      },
      {
        id: 'categories',
        label: 'Categories',
        count: categories.size,
        hint: 'Each kind of event with its own feed — most serious first, then newest, with the publisher’s own time on every line.',
        render: () => <CategoryPanels report={report} />,
      },
    ]
  }, [report])

  return <WorkspaceTabs workspaces={workspaces} label="Globe workspaces" />
}

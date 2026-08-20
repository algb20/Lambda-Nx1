/**
 * The board catalogue and its types — the half the browser is allowed to see.
 *
 * ## Why this file exists
 *
 * `lib/modules/board.ts` imports the orchestrator, which reaches `node:crypto`
 * through the guardrail. A client component importing so much as the board list
 * from it drags that entire chain into the browser bundle, and the build fails
 * outright with *"Reading from node:crypto is not handled"* — every page 500s.
 *
 * That is not a hypothetical. Wiring the seven boards into the dashboard did
 * exactly this, and the app was dead until it was split. `world-events-shared.ts`
 * exists for the same reason and for the same chain.
 *
 * So: everything pure lives here — the definitions, the shapes, the lookup —
 * and `board.ts` keeps only the part that actually collects. Both halves stay
 * importable from `board.ts`, so nothing downstream has to know there are two
 * files; the rule is simply that a `'use client'` component imports from *this*
 * one.
 */
import type { Capability, Evidence } from '../engine/types'

export interface BoardRow {
  group: string
  headline: string
  detail?: string
  value?: number
  unit?: string
  at: string | null
  url?: string
  sourceKey: string
}

export interface BoardGroup {
  name: string
  rows: BoardRow[]
}

export interface BoardSummary {
  rows: number
  groups: number
  sourcesOk: number
  sourcesFailed: number
  /** The newest publisher timestamp on the board, or null if none stated one. */
  newestAt: string | null
}

export interface BoardReport {
  generatedAt: string
  /** The gateway this is, so one renderer can label many boards. */
  board: string
  subject: string
  groups: BoardGroup[]
  findings: Evidence[]
  summary: BoardSummary
}

/**
 * What the platform needs to know about a gateway that reads one publisher and
 * groups what it returns. Adding the eighth board is a row here and a source in
 * `lib/engine/sources/boards.ts` — no route, no view, no branch.
 */
export interface BoardDefinition {
  /** Matches the `Mode` in lib/gateways.ts. */
  key: string
  capability: Capability
  title: string
  /** One line under the title: what this board is, from the reader's side. */
  note: string
  /** Whether typing a subject narrows it. False for boards with no search. */
  searchable: boolean
}

export const BOARDS: BoardDefinition[] = [
  {
    key: 'statements',
    capability: 'statements',
    title: 'Statements that carry weight',
    note: 'Nine institutions whose words are themselves acts — the White House, the UN, the European Commission, the Fed, the ECB, the UK government, the IAEA and the WHO. Ranked by consequence, with the reasoning shown on every line rather than a score you cannot check.',
    searchable: true,
  },
  {
    key: 'courts',
    capability: 'courts',
    title: 'Courts & litigation',
    note: 'American court opinions as filed, newest first, from the Free Law Project index. Search a party, a subject or a doctrine.',
    searchable: true,
  },
  {
    key: 'regulation',
    capability: 'regulation',
    title: 'Regulation & rulemaking',
    note: 'The US Federal Register — every proposed rule, final rule, notice and presidential document, on the day it publishes.',
    searchable: true,
  },
  {
    key: 'officials',
    capability: 'officials',
    title: 'Officials & statements',
    note: 'What central bank governors actually said, in their own words, collected by the BIS. Public acts of office — never private life.',
    searchable: true,
  },
  {
    key: 'resources',
    capability: 'resources',
    title: 'Resources & commodities',
    note: 'Metals, energy minerals and food, at the IMF price series that national budgets and mining investment are set against. Monthly, and dated as monthly.',
    searchable: false,
  },
  {
    key: 'grid',
    capability: 'power_grid',
    title: 'Power grid',
    note: 'Britain’s electricity, metered half-hourly by the body that settles the market — not an estimate of what the grid is doing, the figure it is paid on.',
    searchable: false,
  },
  {
    key: 'space-weather',
    capability: 'space_weather',
    title: 'Space weather',
    note: 'NOAA’s own scales and the planetary K index — the alerts airlines and grid operators act on. The one hazard that hits everybody at once.',
    searchable: false,
  },
  {
    key: 'orbital',
    capability: 'orbital',
    title: 'Orbital objects',
    note: 'What is overhead: crewed stations and the last thirty days of launches, from the tracking network’s own element sets.',
    searchable: true,
  },
]

export function boardByKey(key: string): BoardDefinition | undefined {
  return BOARDS.find((b) => b.key === key)
}

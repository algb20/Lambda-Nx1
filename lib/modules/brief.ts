/**
 * The standing brief — the analyst as the first thing you see.
 *
 * The analyst in this product only ever appeared *after* an investigation, and
 * only when somebody had bought an API key. Both of those are now false: the
 * mechanical reading needs no model (`lib/analysis/reasoning.ts`), and this
 * module turns the world picture the platform already holds into a brief that
 * is standing rather than requested.
 *
 * Everything pure lives in `brief-shared.ts` so a client component can render a
 * brief without dragging the engine — and therefore `node:crypto` — into the
 * browser bundle. What is left here is the part that actually goes and gets
 * things.
 */
import { getWorldEvents } from './world-events'
import { clusterStories, analyseStories, storyOrder } from '../analysis/stories'
import { getAiProvider } from '../ai'
import type { AiProvider } from '../ai/types'
import {
  assembleBrief,
  independenceTable,
  worldEvidence,
  type StandingBrief,
} from './brief-shared'

export * from './brief-shared'

/**
 * Build the brief.
 *
 * The provider is injected so the whole assembly is testable with a fake, and
 * so an operator who has configured a model gets one without this module
 * knowing which. It defaults to whatever `lib/ai` decides, which is the
 * deterministic analyst when no key is present — never a "not configured"
 * notice, because a brief that says "buy a key" is not a brief.
 */
export async function getStandingBrief(
  provider: AiProvider = getAiProvider(),
): Promise<StandingBrief> {
  const report = await getWorldEvents()
  const findings = worldEvidence(report)

  // Origins, not source keys: the same independence table the globe uses, so
  // the brief and the map can never disagree about who is independent of whom.
  const groups = independenceTable(report)
  const stories = clusterStories(findings, { groups }).sort(storyOrder)
  const storyAnalysis = analyseStories(stories, findings.length)

  const verdict = await provider.analyze({
    subject: 'World picture',
    gateway: 'world',
    findings,
  })

  return assembleBrief(report, verdict, stories, storyAnalysis, findings)
}

/**
 * Research & Tech-trend gateway. "What is the frontier saying about X?" from open
 * scholarship — OpenAlex + Crossref. Papers are claims (graded), not settled fact;
 * this is the lawful public-footprint view of the research/R&D frontier.
 */
import { collect } from '../engine/orchestrator'
import { registry } from '../engine/registry'
import { registerResearchGateway } from '../engine/sources'
import type { Evidence } from '../engine/types'

export interface ResearchReport {
  subject: string
  generatedAt: string
  findings: Evidence[]
  summary: { papers: number; sourcesOk: number; sourcesFailed: number }
}

export async function investigateResearch(input: string): Promise<ResearchReport> {
  registerResearchGateway()
  const subject = input.trim()
  if (subject.length < 2) throw new Error('Enter a topic, technology or research question')
  const generatedAt = new Date().toISOString()

  const r = await collect({ capability: 'research', value: subject }, { registry, mode: 'all' })
  // Most-cited first when a citation count is present.
  const findings = [...r.evidence].sort((a, b) => {
    const ca = (a.data as { citations?: number } | undefined)?.citations ?? -1
    const cb = (b.data as { citations?: number } | undefined)?.citations ?? -1
    return cb - ca
  })
  return {
    subject,
    generatedAt,
    findings,
    summary: {
      papers: findings.length,
      sourcesOk: r.results.filter((x) => x.ok).length,
      sourcesFailed: r.results.filter((x) => !x.ok).length,
    },
  }
}

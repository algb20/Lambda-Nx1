/**
 * Procurement & Public-Contracts gateway. Answers "who receives public money /
 * contracts, and for what?" from official published award records — US federal
 * awards (USAspending) and World Bank development finance.
 *
 * Passive and lawful: these are public government/IGO disclosures. We report the
 * record with source + timestamp; a "no match" is not a clearance.
 */
import { collect } from '../engine/orchestrator'
import { registry } from '../engine/registry'
import { registerProcurementGateway } from '../engine/sources'
import type { Evidence } from '../engine/types'

export interface ProcurementReport {
  subject: string
  generatedAt: string
  findings: Evidence[]
  summary: { matches: number; sourcesOk: number; sourcesFailed: number }
}

export async function investigateProcurement(input: string): Promise<ProcurementReport> {
  registerProcurementGateway()
  const subject = input.trim()
  if (subject.length < 3) throw new Error('Enter a recipient, company, agency or project name')
  const generatedAt = new Date().toISOString()

  const r = await collect({ capability: 'procurement', value: subject }, { registry, mode: 'all' })
  return {
    subject,
    generatedAt,
    findings: r.evidence,
    summary: {
      matches: r.evidence.length,
      sourcesOk: r.results.filter((x) => x.ok).length,
      sourcesFailed: r.results.filter((x) => !x.ok).length,
    },
  }
}

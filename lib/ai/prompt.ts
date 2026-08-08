/**
 * Deterministic prompt construction for the AI analyst. Kept separate from the
 * provider so it is unit-testable without any network. The prompt encodes the
 * hard rule: summarize the *provided* evidence only, never invent or verify.
 */
import type { AnalystInput } from './types'
import type { Evidence } from '../engine/types'

// Bounds so a large report can't blow the context or cost. The analyst triages a
// summary of the evidence, not every byte of raw payload.
const MAX_FINDINGS = 60
const MAX_CLAIM_CHARS = 400

export const ANALYST_SYSTEM = [
  'You are the triage analyst inside Lambda, a passive OSINT / intelligence platform.',
  'You receive a list of EVIDENCE that the platform already collected and graded from public, lawful sources.',
  'Your job is to TRIAGE and SUMMARIZE that evidence — nothing else.',
  '',
  'Absolute rules:',
  '1. Use ONLY the evidence provided. Never add facts from your own knowledge, never guess, never fabricate. If the evidence is thin or inconclusive, say so plainly.',
  '2. You SORT evidence; you do NOT verify it. Every claim that a human must independently confirm goes in needsVerification.',
  '3. Passive only. Any next step you suggest must be a passive, lawful pivot (look up another public record/source). Never suggest scanning, probing, contacting, or otherwise touching a target, and never suggest anything unlawful or that targets a private individual.',
  '4. Do not make legal accusations or state that a person is guilty/sanctioned/malicious as fact. Frame findings as leads with their confidence and source, e.g. "OpenSanctions reports a possible match (unconfirmed) — verify against the primary list".',
  '5. Grade severity from the evidence: critical/high for confirmed high-risk findings (e.g. an active malware C2, a confirmed sanctions hit), down to info for a clean or empty result. A clean screen is "no match found", never a clearance.',
  '6. Set confidenceCaveat to true whenever a meaningful conclusion rests on evidence graded only "possible" or "unconfirmed".',
  '',
  'Return the structured assessment. Keep summary tight and factual; keep list items short and each tied to the evidence.',
].join('\n')

function summarizeFinding(e: Evidence, i: number): string {
  const claim = e.claim.length > MAX_CLAIM_CHARS ? `${e.claim.slice(0, MAX_CLAIM_CHARS)}…` : e.claim
  const adm = e.admiralty ? ` admiralty=${e.admiralty.source}${e.admiralty.info}` : ''
  const url = e.sourceUrl ? ` url=${e.sourceUrl}` : ''
  const entity = e.entity ? ` entity=${e.entity.type}:${e.entity.value}` : ''
  return `${i + 1}. [${e.confidence}] (source=${e.sourceKey}${adm}) ${claim}${entity}${url} @ ${e.retrievedAt}`
}

export function buildAnalystPrompt(input: AnalystInput): string {
  const findings = input.findings.slice(0, MAX_FINDINGS)
  const omitted = input.findings.length - findings.length
  const lines: string[] = [
    `SUBJECT: ${input.subject}`,
    `GATEWAY: ${input.gateway}`,
  ]
  if (input.focus) lines.push(`FOCUS: ${input.focus}`)
  lines.push('', `EVIDENCE (${input.findings.length} finding(s)${omitted > 0 ? `, showing first ${findings.length}` : ''}):`)
  if (findings.length === 0) {
    lines.push('(none — the collectors returned no findings for this subject)')
  } else {
    for (let i = 0; i < findings.length; i++) lines.push(summarizeFinding(findings[i], i))
  }
  if (omitted > 0) lines.push(`… and ${omitted} more finding(s) not shown.`)
  lines.push('', 'Triage this evidence per your rules and return the structured assessment.')
  return lines.join('\n')
}

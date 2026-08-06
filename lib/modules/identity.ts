/**
 * Module 2 — Email / Username footprint. Runs the passive, keyless identity
 * sources over the engine and returns documented reports.
 */
import { collect } from '../engine/orchestrator'
import { registry } from '../engine/registry'
import { registerModuleTwoSources } from '../engine/sources'
import type { Evidence } from '../engine/types'

export interface UsernameReport {
  subject: string
  generatedAt: string
  found: Evidence[]
  summary: { platformsFound: number; sourcesOk: number; sourcesFailed: number }
}

export interface EmailReport {
  subject: string
  generatedAt: string
  breaches: Evidence[]
  profiles: Evidence[]
  summary: {
    breachCount: number
    hasGravatar: boolean
    sourcesOk: number
    sourcesFailed: number
  }
}

export function normalizeUsername(input: string): string {
  return input.trim().replace(/^@/, '')
}

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase()
}

export async function investigateUsername(input: string): Promise<UsernameReport> {
  registerModuleTwoSources()
  const subject = normalizeUsername(input)
  if (!/^[a-zA-Z0-9._-]{1,39}$/.test(subject)) {
    throw new Error(`Invalid username: "${input}"`)
  }
  const generatedAt = new Date().toISOString()
  const r = await collect({ capability: 'username_presence', value: subject }, { registry, mode: 'all' })
  return {
    subject,
    generatedAt,
    found: r.evidence,
    summary: {
      platformsFound: r.evidence.length,
      sourcesOk: r.results.filter((x) => x.ok).length,
      sourcesFailed: r.results.filter((x) => !x.ok).length,
    },
  }
}

export async function investigateEmail(input: string): Promise<EmailReport> {
  registerModuleTwoSources()
  const subject = normalizeEmail(input)
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(subject)) {
    throw new Error(`Invalid email: "${input}"`)
  }
  const generatedAt = new Date().toISOString()
  const r = await collect({ capability: 'email_breach', value: subject }, { registry, mode: 'all' })
  const breaches = r.evidence.filter((e) => e.sourceKey === 'xposedornot')
  const profiles = r.evidence.filter((e) => e.sourceKey === 'gravatar')
  return {
    subject,
    generatedAt,
    breaches,
    profiles,
    summary: {
      breachCount: breaches.length,
      hasGravatar: profiles.length > 0,
      sourcesOk: r.results.filter((x) => x.ok).length,
      sourcesFailed: r.results.filter((x) => !x.ok).length,
    },
  }
}

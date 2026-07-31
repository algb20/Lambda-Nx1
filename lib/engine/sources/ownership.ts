/**
 * Ownership & beneficial-control source — passive, keyless (GLEIF Level 2).
 *
 * GLEIF publishes not just legal entities but the *relationships* between them:
 * direct parents, ultimate parents and direct children. That is the public,
 * lawful backbone of an ownership graph — "who owns/controls whom". We resolve a
 * company name to its LEI, then pull its relationships in one pass.
 *
 * Every edge is an official filed relationship with its source and timestamp.
 */
import type { Evidence, Source } from '../types'

const BTC = /^(bc1[a-z0-9]{20,80}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/

export type OwnershipRelation = 'self' | 'direct-parent' | 'ultimate-parent' | 'direct-child'

interface LeiRecord {
  id?: string
  attributes?: {
    lei?: string
    entity?: { legalName?: { name?: string }; legalAddress?: { country?: string } }
  }
}
interface LeiResponse {
  data?: LeiRecord[]
}

function nameOf(rec: LeiRecord, fallback: string): string {
  return rec.attributes?.entity?.legalName?.name ?? fallback
}
function leiOf(rec: LeiRecord): string {
  return rec.attributes?.lei ?? rec.id ?? ''
}

function relEvidence(rec: LeiRecord, relation: OwnershipRelation, label: string): Evidence {
  const name = nameOf(rec, 'entity')
  const lei = leiOf(rec)
  const country = rec.attributes?.entity?.legalAddress?.country
  return {
    claim: `${label} (GLEIF): ${name}${lei ? ` — LEI ${lei}` : ''}${country ? ` [${country}]` : ''}`,
    entity: { type: 'company', value: name },
    sourceKey: 'gleif_ownership',
    sourceUrl: lei ? `https://search.gleif.org/#/record/${lei}` : 'https://search.gleif.org',
    retrievedAt: new Date().toISOString(),
    admiralty: { source: 'A', info: 2 },
    confidence: 'probable',
    data: { relation, lei, name, country },
  }
}

async function fetchRelated(
  ctx: { fetch: (url: string) => Promise<Response> },
  lei: string,
  path: string,
): Promise<LeiRecord[]> {
  const res = await ctx.fetch(`https://api.gleif.org/api/v1/lei-records/${encodeURIComponent(lei)}/${path}`)
  if (!res.ok) return []
  const j = (await res.json().catch(() => null)) as LeiResponse | null
  return j?.data ?? []
}

export const gleifOwnership: Source = {
  key: 'gleif_ownership',
  capability: 'ownership',
  passive: true,
  hosts: ['api.gleif.org'],
  minIntervalMs: 500,
  async run(input, ctx) {
    const q = input.value.trim()
    if (q.length < 3 || BTC.test(q)) return []
    // 1) Resolve the name to the best-matching LEI record.
    const searchRes = await ctx.fetch(
      `https://api.gleif.org/api/v1/lei-records?filter[entity.legalName]=${encodeURIComponent(q)}&page[size]=1`,
    )
    if (!searchRes.ok) return []
    const search = (await searchRes.json().catch(() => null)) as LeiResponse | null
    const root = search?.data?.[0]
    if (!root) return []
    const rootLei = leiOf(root)
    if (!rootLei) return []

    // 2) Pull the relationship neighbourhood in one pass.
    const [parents, ultimates, children] = await Promise.all([
      fetchRelated(ctx, rootLei, 'direct-parents'),
      fetchRelated(ctx, rootLei, 'ultimate-parents'),
      fetchRelated(ctx, rootLei, 'direct-children'),
    ])

    const out: Evidence[] = [relEvidence(root, 'self', 'Legal entity')]
    for (const p of parents.slice(0, 5)) out.push(relEvidence(p, 'direct-parent', 'Direct parent'))
    for (const u of ultimates.slice(0, 5)) out.push(relEvidence(u, 'ultimate-parent', 'Ultimate parent'))
    for (const c of children.slice(0, 10)) out.push(relEvidence(c, 'direct-child', 'Direct subsidiary'))
    return out
  },
}

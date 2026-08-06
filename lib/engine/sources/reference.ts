/**
 * Reference / knowledge-base source — Wikidata (passive, keyless).
 *
 * Wikidata is a structured, community-curated, well-sourced knowledge base. For a
 * named entity it gives typed facts — parent organization, country, headquarters,
 * founder, CEO, coordinates — which map cleanly onto our ontology predicates
 * (owned_by / located_in / founded_by / led_by). This is what turns a name into a
 * node with real, gradable relations in our own knowledge graph.
 *
 * Flow (all on www.wikidata.org, keyless): resolve name → QID, read its claims,
 * then batch-resolve the referenced entities' labels in one call. Facts are
 * curated but not primary → graded B/2 "probable".
 */
import type { Evidence, EntityType, Source } from '../types'

const WIKI_UA = {
  'User-Agent': 'Lambda NX OSINT (research; contact via app)',
  Accept: 'application/json',
}

// Entity-valued properties we lift into typed relations.
const REL_PROPS: Array<{ prop: string; relation: string; label: string; type: EntityType }> = [
  { prop: 'P749', relation: 'direct-parent', label: 'Parent organization', type: 'company' },
  { prop: 'P112', relation: 'founder', label: 'Founded by', type: 'person' },
  { prop: 'P169', relation: 'ceo', label: 'Chief executive', type: 'person' },
  { prop: 'P17', relation: 'country', label: 'Country', type: 'other' },
  { prop: 'P159', relation: 'hq', label: 'Headquarters', type: 'other' },
]

interface Snak {
  mainsnak?: { datavalue?: { value?: unknown } }
}
interface EntityData {
  labels?: { en?: { value?: string } }
  claims?: Record<string, Snak[]>
}
interface SearchResponse {
  search?: Array<{ id?: string; label?: string }>
}
interface EntitiesResponse {
  entities?: Record<string, EntityData>
}

function claimEntityId(snak: Snak): string | null {
  const v = snak.mainsnak?.datavalue?.value as { id?: string } | undefined
  return v?.id ?? null
}

export const wikidata: Source = {
  key: 'wikidata',
  capability: 'reference',
  passive: true,
  hosts: ['www.wikidata.org'],
  minIntervalMs: 1000,
  async run(input, ctx) {
    const q = input.value.trim()
    if (q.length < 2) return []

    // 1) name → QID
    const searchUrl =
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json` +
      `&language=en&limit=1&origin=*&search=${encodeURIComponent(q)}`
    const sRes = await ctx.fetch(searchUrl, { headers: WIKI_UA })
    if (!sRes.ok) return []
    const sJson = (await sRes.json().catch(() => null)) as SearchResponse | null
    const qid = sJson?.search?.[0]?.id
    if (!qid) return []

    // 2) claims for the resolved entity
    const dataUrl = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`
    const dRes = await ctx.fetch(dataUrl, { headers: WIKI_UA })
    if (!dRes.ok) return []
    const dJson = (await dRes.json().catch(() => null)) as EntitiesResponse | null
    const entity = dJson?.entities?.[qid]
    const claims = entity?.claims ?? {}

    // Collect entity-valued targets to resolve, preserving their relation.
    const targets: Array<{ id: string; relation: string; label: string; type: EntityType }> = []
    for (const { prop, relation, label, type } of REL_PROPS) {
      for (const snak of claims[prop] ?? []) {
        const id = claimEntityId(snak)
        if (id) targets.push({ id, relation, label, type })
      }
    }

    // 3) one batch call to resolve the referenced entities' labels
    const labels = new Map<string, string>()
    const uniqueIds = [...new Set(targets.map((t) => t.id))].slice(0, 30)
    if (uniqueIds.length > 0) {
      const labelsUrl =
        `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json` +
        `&props=labels&languages=en&origin=*&ids=${uniqueIds.join('|')}`
      const lRes = await ctx.fetch(labelsUrl, { headers: WIKI_UA })
      if (lRes.ok) {
        const lJson = (await lRes.json().catch(() => null)) as EntitiesResponse | null
        for (const [id, ent] of Object.entries(lJson?.entities ?? {})) {
          const v = ent.labels?.en?.value
          if (v) labels.set(id, v)
        }
      }
    }

    const now = new Date().toISOString()
    const wikidataUrl = `https://www.wikidata.org/wiki/${qid}`
    const out: Evidence[] = []

    // The entity's own coordinates (P625), when present, give a precise globe pin.
    const coord = claims['P625']?.[0]?.mainsnak?.datavalue?.value as
      | { latitude?: number; longitude?: number }
      | undefined
    const lat = typeof coord?.latitude === 'number' ? coord.latitude : undefined
    const lon = typeof coord?.longitude === 'number' ? coord.longitude : undefined
    const selfLabel = entity?.labels?.en?.value ?? q
    if (lat !== undefined && lon !== undefined) {
      out.push({
        claim: `${selfLabel} — located at ${lat.toFixed(3)}, ${lon.toFixed(3)}`,
        entity: { type: 'other', value: selfLabel },
        sourceKey: 'wikidata',
        sourceUrl: wikidataUrl,
        retrievedAt: now,
        admiralty: { source: 'B', info: 2 },
        confidence: 'probable',
        data: { relation: 'self', wikidataId: qid, lat, lon },
      })
    }

    for (const { id, relation, label, type } of targets) {
      const value = labels.get(id)
      if (!value) continue
      out.push({
        claim: `${label}: ${value}`,
        entity: { type, value },
        sourceKey: 'wikidata',
        sourceUrl: `https://www.wikidata.org/wiki/${id}`,
        retrievedAt: now,
        admiralty: { source: 'B', info: 2 },
        confidence: 'probable',
        data: { relation, wikidataId: id },
      })
    }

    return out
  },
}

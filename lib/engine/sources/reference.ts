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
 *
 * ## What the live page showed, and what it cost
 *
 * Walked with the subject **Marie Curie**: Wikidata resolves her to Q7186 in one
 * call, and this gateway returned **zero facts** and an empty page that reads
 * as a failure. The cause was that every property it lifted was a *corporate*
 * one — parent organization, founder, CEO, country, headquarters — so a person
 * resolves perfectly and then has nothing the extractor is looking for.
 *
 * Worse than the blank page: the ontology recorded the node as
 * `company:Marie Curie`. The type was assumed from the shape of the questions
 * being asked rather than read from the entity, so a person was written into
 * the knowledge graph as a company. A wrong fact stated confidently is the one
 * outcome this project's grading exists to prevent, and it was being generated
 * by the gateway whose whole job is turning a name into a typed node.
 *
 * So the entity's own `P31` (instance of) now decides the type, the extractor
 * lifts person and place relations as well as corporate ones, and the identity
 * itself — label, description, what kind of thing it is — is always returned
 * when the entity resolved. "We found her and this is what she is" is a
 * finding; a blank page is not.
 *
 * ## Scope
 *
 * Wikidata holds notable, publicly documented entities with cited sources. That
 * is public record about public figures, which §3 permits; it holds nothing
 * about private individuals, so there is nothing here for the private-life
 * prohibition to reach. This gateway reads that record and does not assemble
 * one.
 */
import type { Evidence, EntityType, Source } from '../types'
import { expectJson } from '../fetch-guard'

/**
 * `no-store` because a Wikidata entity is not a small document.
 *
 * Next's fetch layer caches responses and refuses to store large ones, and a
 * country or a major company carries megabytes of claims. Opting out keeps the
 * size of the answer from deciding whether there is an answer — the engine has
 * its own cache, with its own age reporting, which is the one that should
 * decide.
 */
const WIKI_HEADERS = {
  Accept: 'application/json',
}
const WIKI_INIT: RequestInit = { headers: WIKI_HEADERS, cache: 'no-store' }

/**
 * Entity-valued properties lifted into typed relations.
 *
 * The first five are corporate and were the whole list, which is why a person
 * came back empty. The rest cover the two other kinds of thing a reader
 * actually looks up — people and places — chosen because each one is a genuine
 * pivot: an employer, an alma mater, a position held or an administrative
 * parent all lead somewhere else in the graph, which is the point of this
 * gateway. Biographical detail that leads nowhere is not added.
 */
const REL_PROPS: Array<{ prop: string; relation: string; label: string; type: EntityType }> = [
  // Corporate.
  { prop: 'P749', relation: 'direct-parent', label: 'Parent organization', type: 'company' },
  { prop: 'P112', relation: 'founder', label: 'Founded by', type: 'person' },
  { prop: 'P169', relation: 'ceo', label: 'Chief executive', type: 'person' },
  { prop: 'P127', relation: 'owned-by', label: 'Owned by', type: 'company' },
  { prop: 'P452', relation: 'industry', label: 'Industry', type: 'other' },
  // Shared.
  { prop: 'P17', relation: 'country', label: 'Country', type: 'other' },
  { prop: 'P159', relation: 'hq', label: 'Headquarters', type: 'other' },
  { prop: 'P131', relation: 'admin-parent', label: 'Located in', type: 'other' },
  // Person.
  { prop: 'P27', relation: 'citizenship', label: 'Country of citizenship', type: 'other' },
  { prop: 'P106', relation: 'occupation', label: 'Occupation', type: 'other' },
  { prop: 'P108', relation: 'employer', label: 'Employer', type: 'company' },
  { prop: 'P69', relation: 'educated-at', label: 'Educated at', type: 'company' },
  { prop: 'P39', relation: 'position', label: 'Position held', type: 'other' },
  { prop: 'P463', relation: 'member-of', label: 'Member of', type: 'company' },
  { prop: 'P166', relation: 'award', label: 'Award received', type: 'other' },
]

/**
 * What `P31` (instance of) says this entity is, mapped to our own types.
 *
 * Read rather than assumed. The QIDs are Wikidata's own and stable: Q5 is
 * human, Q4830453 business, Q43229 organization, Q6256 country, Q515 city,
 * Q3957 town, Q532 village, Q56061 administrative territorial entity.
 */
const INSTANCE_TYPE: Array<{ qid: string; type: EntityType }> = [
  { qid: 'Q5', type: 'person' },
  { qid: 'Q4830453', type: 'company' },
  { qid: 'Q891723', type: 'company' },
  { qid: 'Q43229', type: 'organization' },
  { qid: 'Q6256', type: 'other' },
  { qid: 'Q515', type: 'other' },
  { qid: 'Q3957', type: 'other' },
  { qid: 'Q532', type: 'other' },
  { qid: 'Q56061', type: 'other' },
]

interface Snak {
  mainsnak?: { datavalue?: { value?: unknown } }
}
interface EntityData {
  labels?: { en?: { value?: string } }
  descriptions?: { en?: { value?: string } }
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
    /**
     * A refusal is a refusal, not an absence.
     *
     * These four steps each used to `return []` when the request failed, so a
     * provider error, a body too large to parse and "Wikidata has never heard
     * of this" all reached the reader as the same blank page — and reached the
     * orchestrator as a healthy source with nothing to say. Measured: the
     * subject "Kenya" produced zero facts in 0.6 seconds with `sourcesOk: 1`.
     *
     * Only the last of the three is genuinely an empty result, and it is the
     * only one that still returns `[]`.
     */
    const sJson = await expectJson<SearchResponse>('wikidata', await ctx.fetch(searchUrl, WIKI_INIT))
    const qid = sJson?.search?.[0]?.id
    // Wikidata holds no entity under this name. A real, reportable absence.
    if (!qid) return []

    // 2) claims for the resolved entity
    const dataUrl = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`
    const dJson = await expectJson<EntitiesResponse>('wikidata', await ctx.fetch(dataUrl, WIKI_INIT))
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

    /**
     * What kind of thing this is, from the entity rather than from us.
     *
     * The first `P31` value we recognise wins; an entity Wikidata classifies
     * as several things at once (a company that is also a brand) is typed by
     * the first match in `INSTANCE_TYPE`, which is ordered most specific
     * first. Nothing recognised stays `other` — an honest "we did not
     * classify this" rather than a guess dressed as a type.
     */
    const instanceIds = (claims['P31'] ?? []).map(claimEntityId).filter((id): id is string => !!id)
    const subjectType: EntityType =
      INSTANCE_TYPE.find((t) => instanceIds.includes(t.qid))?.type ?? 'other'

    // 3) one batch call to resolve the referenced entities' labels
    const labels = new Map<string, string>()
    const uniqueIds = [...new Set([...instanceIds, ...targets.map((t) => t.id)])].slice(0, 40)
    if (uniqueIds.length > 0) {
      const labelsUrl =
        `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json` +
        `&props=labels&languages=en&origin=*&ids=${uniqueIds.join('|')}`
      // The one tolerant call: labels are decoration on relations we already
      // hold, so losing them costs a name, not a finding.
      const lRes = await ctx.fetch(labelsUrl, WIKI_INIT)
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
    const selfDescription = entity?.descriptions?.en?.value

    /**
     * The identity itself, always.
     *
     * This is the finding that was missing when Marie Curie produced an empty
     * page: the gateway had resolved her, knew her label, her description and
     * that she is a human, and reported none of it because none of it was a
     * corporate relation. Resolving a name to a specific, citable entity **is**
     * the answer to the question this gateway is asked, and everything after it
     * is elaboration.
     */
    const isA = instanceIds.map((id) => labels.get(id)).filter(Boolean).join(', ')
    out.push({
      claim: [
        selfLabel,
        isA ? `— ${isA}` : '',
        selfDescription ? `· ${selfDescription}` : '',
      ]
        .filter(Boolean)
        .join(' '),
      entity: { type: subjectType, value: selfLabel },
      sourceKey: 'wikidata',
      sourceUrl: wikidataUrl,
      retrievedAt: now,
      admiralty: { source: 'B', info: 2 },
      confidence: 'probable',
      data: { relation: 'identity', wikidataId: qid, entityType: subjectType, isA, lat, lon },
    })

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

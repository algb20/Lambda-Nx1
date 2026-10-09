import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { CATALOG } from '@/lib/engine/catalog'
import { licenceProblem } from '@/lib/engine/catalog/licence'
import { Registry, registry } from '@/lib/engine/registry'
import * as sources from '@/lib/engine/sources'
import { opensky } from '@/lib/engine/sources/geo'
import { SOURCE_LICENSE_REGISTRY, licenseRecord, recordProblems, usagePolicy } from '@/lib/engine/licensing/registry'
import { activeSources } from '@/lib/engine/catalog'
import { PORTALS, activePortals } from '@/lib/engine/registries/ckan/portals'
import type { Source } from '@/lib/engine/types'

/**
 * S-INV-EX-01 — the S cross-contract invariants (Build Package §29.3) that can
 * be checked against the Existing System today.
 *
 * S is not closed (docs/reconciliation/PHASE30_CLOSURE_AUDIT_2026-10-04.md §E),
 * so nothing here implements a Master subsystem. These are checks of the
 * repository against invariants whose text is fixed and undisputed. A pass
 * means REPO-TESTED for the Existing System, never Master TESTED or ACCEPTED.
 * The full invariant matrix — including the ones that do not apply yet and the
 * ones that are gaps — is §F.1 of that document.
 */

const ROOT = process.cwd()

// ── Invariant 3 — "UI never bypasses API/security boundaries." ─────────────

/** Modules that hold credentials, sessions or direct data access. */
const SERVER_ONLY = [/^@\/lib\/db(\/|$)/, /^@\/lib\/auth\/(server|session)$/, /^@\/lib\/payments(\/|$)/, /^postgres$/, /^drizzle-orm(\/|$)/]

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === 'node_modules' || name.startsWith('.') ? [] : filesUnder(path)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

function isClientModule(text: string): boolean {
  return /^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use client['"]/.test(text)
}

/**
 * Value imports of server-only modules, and reads of server-only environment.
 *
 * `import type` is erased at compile time and ships nothing to the browser, so
 * it is allowed — two dashboards import row *types* from `@/lib/db`, which is
 * correct. A mixed `import { type A, b }` still ships `b`, so it counts.
 */
export function clientBoundaryViolations(file: string, text: string): string[] {
  const found: string[] = []
  const imports = /import\s+(type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g
  for (const m of text.matchAll(imports)) {
    const typeOnly = Boolean(m[1])
    const spec = m[2] ?? m[3]
    if (!typeOnly && SERVER_ONLY.some((re) => re.test(spec))) found.push(`${file}: imports ${spec}`)
  }
  for (const m of text.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
    // NEXT_PUBLIC_* is inlined for the browser by design; NODE_ENV is inlined
    // by the bundler. Anything else would be undefined at best and a secret at
    // worst.
    if (!m[1].startsWith('NEXT_PUBLIC_') && m[1] !== 'NODE_ENV') found.push(`${file}: reads process.env.${m[1]}`)
  }
  return found
}

describe('S invariant 3 — the browser never holds a path around the API', () => {
  const clientFiles = ['app', 'components', 'contexts', 'hooks']
    .flatMap((d) => filesUnder(join(ROOT, d)))
    .map((path) => ({ path: relative(ROOT, path), text: readFileSync(path, 'utf8') }))
    .filter((f) => isClientModule(f.text))

  it('finds the client modules it is meant to check', () => {
    // A scan that finds nothing passes for the wrong reason.
    expect(clientFiles.length).toBeGreaterThan(20)
  })

  it('has no client module importing a server-only module or reading server environment', () => {
    expect(clientFiles.flatMap((f) => clientBoundaryViolations(f.path, f.text))).toEqual([])
  })

  it('tells a type import from a value import (negative control)', () => {
    expect(clientBoundaryViolations('x.tsx', "import type { Monitor } from '@/lib/db'")).toEqual([])
    expect(clientBoundaryViolations('x.tsx', "import { db } from '@/lib/db'")).toHaveLength(1)
    expect(clientBoundaryViolations('x.tsx', "import { type A, b } from '@/lib/db/client'")).toHaveLength(1)
    expect(clientBoundaryViolations('x.tsx', 'const k = process.env.DATABASE_URL')).toHaveLength(1)
    expect(clientBoundaryViolations('x.tsx', 'const m = process.env.NEXT_PUBLIC_AUTH_MODE')).toEqual([])
  })
})

// ── Invariant 4 — "Agent/tool never bypasses authorization/policy/license." ─

/** Hosts whose catalogue record the licence gate refuses for this product. */
function licenceRefusedHosts(): Map<string, string> {
  const refused = new Map<string, string>()
  for (const record of CATALOG) {
    const problem = licenceProblem(record.licence)
    if (problem) refused.set(new URL(record.url).hostname, `${record.key} (${problem})`)
  }
  return refused
}

/** Every running source that would call a licence-refused host. */
export function licenceBoundaryViolations(reg: Registry): string[] {
  const refused = licenceRefusedHosts()
  return reg
    .capabilities()
    .flatMap((cap) => reg.sourcesFor(cap))
    .flatMap((s: Source) =>
      (s.hosts ?? []).filter((h) => refused.has(h)).map((h) => `${s.key} → ${h}: refused by ${refused.get(h)}`),
    )
}

describe('S invariant 4 — no source runs around the licence gate', () => {
  it('knows which hosts the gate refuses', () => {
    // OpenSky, EPO OPS and others are refused today; an empty set would make
    // the next assertion vacuous.
    expect(licenceRefusedHosts().has('opensky-network.org')).toBe(true)
  })

  it('registers nothing, in any gateway, that calls a licence-refused host', () => {
    // Register every gateway exactly as the routes do, then inspect what is
    // actually in the registry — not a list kept by hand beside it.
    for (const [name, fn] of Object.entries(sources)) {
      if (/^register[A-Z]/.test(name) && typeof fn === 'function') (fn as () => void)()
    }
    expect(registry.capabilities().length).toBeGreaterThan(5)
    expect(licenceBoundaryViolations(registry)).toEqual([])
  })

  it('would have caught the coded OpenSky source that batch 05 removed (negative control)', () => {
    const before = new Registry()
    before.register(opensky)
    expect(licenceBoundaryViolations(before)).toEqual([
      'opensky → opensky-network.org: refused by opensky_states (commercial)',
    ])
  })
})

describe('S invariant 4 — every source is in the licence & usage registry (R317)', () => {
  const registered = () => {
    for (const [name, fn] of Object.entries(sources)) {
      if (/^register[A-Z]/.test(name) && typeof fn === 'function') (fn as () => void)()
    }
    const catalogue = new Set(CATALOG.map((c) => c.key))
    return [...new Set(registry.capabilities().flatMap((c) => registry.sourcesFor(c).map((s) => s.key)))].filter(
      (k) => !catalogue.has(k),
    )
  }
  const policyOf = (id: string) => {
    const r = licenseRecord(id)
    return r ? usagePolicy(r.license_status) : 'MISSING'
  }

  it('holds a valid record for every coded source, catalogue record and CKAN portal', () => {
    const coded = registered()
    expect(coded.length).toBeGreaterThan(50)
    const missing = [
      ...coded.filter((k) => !licenseRecord(k)),
      ...CATALOG.map((c) => c.key).filter((k) => !licenseRecord(k)),
      ...PORTALS.map((p) => 'ckan:' + p.key).filter((k) => !licenseRecord(k)),
    ]
    expect(missing).toEqual([])
    const invalid = SOURCE_LICENSE_REGISTRY.flatMap((r) => recordProblems(r).map((p) => `${r.source_id}: ${p}`))
    expect(invalid).toEqual([])
  })

  it('never lets "no restriction mentioned" stand as a licence', () => {
    for (const r of SOURCE_LICENSE_REGISTRY) {
      if (r.basis === 'ABSENCE_OF_RESTRICTION') expect(r.license_status, r.source_id).toBe('UNCLEAR')
    }
  })

  it('never words an absence of restriction as a grant (R318)', () => {
    // Four records said "no restriction on commercial use is stated" under
    // basis EXPRESS_GRANT; the basis check alone could not see it.
    const absence = /no (restriction|prohibition)|not stated|no stated|state[sd]? no bar|does not (forbid|prohibit)/i
    const verifiedOnSilence = SOURCE_LICENSE_REGISTRY.filter(
      (r) => r.license_status.startsWith('VERIFIED') && r.evidence_reference.every((e) => absence.test(e.quote)),
    )
    expect(verifiedOnSilence.map((r) => r.source_id)).toEqual([])
  })

  it('runs nothing whose policy is WITHHOLD — coded, catalogue or portal', () => {
    expect(registered().filter((k) => policyOf(k) === 'WITHHOLD')).toEqual([])
    expect(activeSources().map((s) => s.key).filter((k) => policyOf(k) === 'WITHHOLD')).toEqual([])
    expect(activePortals().map((p) => 'ckan:' + p.key).filter((k) => policyOf(k) === 'WITHHOLD')).toEqual([])
  })

  it('keeps the withheld providers withheld', () => {
    for (const k of ['opensky', 'opensanctions', 'urlscan', 'shodan.internetdb', 'feodo', 'urlhaus', 'threatfox', 'who_outbreaks', 'bis_speeches']) {
      expect(policyOf(k), k).toBe('WITHHOLD')
    }
  })

  it('keeps the publishers whose terms were read in R318 withheld', () => {
    // Personal/non-commercial terms, business-use licences, or an outright ban
    // on automated access — each quoted in its registry record.
    for (const k of ['bbc_world', 'guardian_world', 'npr_world', 'aljazeera', 'scmp_news', 'spiegel_international', 'reliefweb_reports', 'ripe_stat_announced', 'sans_isc', 'bom_warnings']) {
      expect(policyOf(k), k).toBe('WITHHOLD')
      expect(activeSources().some((s) => s.key === k), k).toBe(false)
    }
  })

  it('keeps the publishers whose terms were first read in batch 21 withheld (R329)', () => {
    // Non-commercial or permission-required terms, quoted in each record:
    // OONI data is CC BY-NC-SA (it had been recorded as CC BY), WTO and BSI
    // require permission for commercial use, SNB and Canonical allow
    // non-commercial use only, Red Hat personal or internal business use only,
    // RNZ forbids aggregating its RSS feeds on other websites.
    for (const k of ['ooni_measurements', 'wto_news', 'snb_press', 'bsi_germany', 'ubuntu_usn', 'redhat_security', 'rnz_pacific']) {
      expect(policyOf(k), k).toBe('WITHHOLD')
      expect(activeSources().some((s) => s.key === k), k).toBe(false)
    }
  })

  it('never names a withheld source as a fallback (R330)', () => {
    // A fallback is what runs when the primary cannot. On 2026-10-09 the RIPE
    // Atlas record still offered ooni_measurements, withheld the day before
    // (its data is CC BY-NC-SA 4.0). A fallback that cannot run is a gap
    // written as if it were cover.
    const ids = new Set(SOURCE_LICENSE_REGISTRY.map((r) => r.source_id))
    const named = SOURCE_LICENSE_REGISTRY.flatMap((r) =>
      r.fallback_sources.map((f) => ({ from: r.source_id, to: f.split(/[\s(]/)[0] })).filter(({ to }) => ids.has(to)),
    )
    expect(named.length).toBeGreaterThan(0)
    expect(named.filter(({ to }) => policyOf(to) === 'WITHHOLD')).toEqual([])
  })

  it('keeps Companies House off until the owner decides on its personal data (R322)', () => {
    // Officers and persons with significant control are private individuals;
    // the OGL excludes personal data. Switching the record on — even by setting
    // its key — must be a deliberate decision, so it fails here first.
    const ch = CATALOG.find((c) => c.key === 'uk_companies_house')!
    expect(ch.enabled).toBe(false)
    expect(activeSources().some((s) => s.key === 'uk_companies_house')).toBe(false)
    expect(licenseRecord('uk_companies_house')?.license_status).toBe('LEGAL_REVIEW_REQUIRED')
  })

  it('labels our own notes as observations, never as the provider\'s words (R323)', () => {
    // A verbatim quote is what the terms-change check compares against the live
    // page; a note of ours ("answered 403 on 2026-10-05") would read as a
    // changed clause. Full dates appear only in our notes.
    const mislabelled = SOURCE_LICENSE_REGISTRY.flatMap((r) =>
      r.evidence_reference.filter((e) => e.kind === 'quote' && /\b20\d\d-\d\d-\d\d\b/.test(e.quote)).map(() => r.source_id),
    )
    expect(mislabelled).toEqual([])
  })

  it('has no record left standing on an unevidenced earlier licence', () => {
    // R318 read the terms behind every catalogue licence recorded before
    // 2026-10-04. A record may be UNCLEAR, but never silently inherited.
    expect(SOURCE_LICENSE_REGISTRY.filter((r) => r.basis === 'PRIOR_RECORD_NO_EVIDENCE').map((r) => r.source_id)).toEqual([])
  })
})

// ── Invariants 10 and 15 — already enforced; named here so the matrix is whole.

describe('S invariants 10 and 15 — degradation is visible; missing data is not "no event"', () => {
  it('is enforced by the existing refusal tests', () => {
    // lib/engine/no-laundered-refusals.test.ts holds every source to
    // lib/engine/fetch-guard.ts: a 429/403/5xx is a failure, never an empty
    // success. Asserting the file exists keeps this row of the matrix honest if
    // that suite is ever moved or deleted.
    expect(statSync(join(ROOT, 'lib/engine/no-laundered-refusals.test.ts')).isFile()).toBe(true)
  })
})

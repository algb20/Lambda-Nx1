import { SOURCE_LICENSE_REGISTRY, usagePolicy, type SourceLicenseRecord } from './registry'

/**
 * The standard licence texts the registry's sources are published under.
 *
 * CC BY, OGL and their kin ask for two things wherever the material appears: a
 * credit, and a link to the licence itself. The credits are collected from the
 * registry already (`/terms`, "Data sources and attributions"). The links were
 * a hand-written list of five. Batch 11 (R318) then verified sources under CC BY
 * 3.0 NZ, Licence Ouverte 2.0, the W3C Document License and Japan's Public Data
 * License, and nothing linked those texts. So the list now comes from the
 * registry. A test fails if a record names a standard licence that has no
 * entry here.
 *
 * Each URL is the licensor's own text, or the one the provider itself links.
 */
export interface LicenceText {
  id: string
  label: string
  url: string
  /** Matched against a registry record's `license` field. */
  pattern: RegExp
}

export const LICENCE_TEXTS: LicenceText[] = [
  {
    id: 'cc-by-4.0',
    label: 'CC BY 4.0',
    url: 'https://creativecommons.org/licenses/by/4.0/',
    pattern: /\bCC[- ]BY[- ]4\.0\b|Creative Commons Attribution 4\.0/i,
  },
  {
    id: 'cc-by-3.0-nz',
    label: 'CC BY 3.0 NZ',
    url: 'https://creativecommons.org/licenses/by/3.0/nz/',
    pattern: /\bCC BY 3\.0 NZ\b/i,
  },
  {
    id: 'cc-by-sa-4.0',
    label: 'CC BY-SA 4.0',
    url: 'https://creativecommons.org/licenses/by-sa/4.0/',
    pattern: /\bCC[- ]BY[- ]SA[- ]4\.0\b|Attribution-ShareAlike 4\.0/i,
  },
  {
    id: 'cc0-1.0',
    label: 'CC0 1.0',
    url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    pattern: /\bCC0\b/i,
  },
  {
    id: 'ogl-uk-3.0',
    label: 'Open Government Licence v3.0',
    url: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
    pattern: /\bOGL[- ](UK[- ])?v?3(\.0)?\b|Open Government Licence v3/i,
  },
  {
    id: 'ogl-canada-2.0',
    label: 'Open Government Licence – Canada',
    url: 'https://open.canada.ca/en/open-government-licence-canada',
    pattern: /Open Government Licence\s*[–-]\s*Canada|\bOGL[- ]Canada\b/i,
  },
  {
    id: 'odbl-1.0',
    label: 'ODbL 1.0',
    url: 'https://opendatacommons.org/licenses/odbl/1-0/',
    pattern: /\bODbL\b/i,
  },
  {
    // The address CERT-FR's legal notice links (read 2026-10-05).
    id: 'licence-ouverte-2.0',
    label: 'Licence Ouverte 2.0',
    url: 'https://www.etalab.gouv.fr/wp-content/uploads/2017/04/ETALAB-Licence-Ouverte-v2.0.pdf',
    pattern: /Licence Ouverte 2\.0/i,
  },
  {
    id: 'w3c-document-2023',
    label: 'W3C Document License',
    url: 'https://www.w3.org/copyright/document-license-2023/',
    pattern: /W3C Document License/i,
  },
  {
    // The address JMA's terms page links for 公共データ利用規約（第1.0版）.
    id: 'japan-public-data-1.0',
    label: 'Public Data License (Japan) v1.0',
    url: 'https://www.digital.go.jp/resources/open_data/public_data_license_v1.0',
    pattern: /Public Data License \(Japan\)/i,
  },
]

/** Words that mean a record names a standard licence rather than bespoke terms. */
export const STANDARD_LICENCE_WORDS = /Creative Commons|\bCC[- ]BY\b|\bCC0\b|\bOGL\b|Open Government Licence|\bODbL\b|Licence Ouverte|Document License|Public Data License/i

/** The standard licence texts a licence string refers to (several, for a per-ecosystem list). */
export function licenceTextsFor(licence: string): LicenceText[] {
  return LICENCE_TEXTS.filter((t) => t.pattern.test(licence))
}

/**
 * The texts owed by the sources Lambda actually shows. A withheld source shows
 * nothing and owes nothing; `include` narrows further (e.g. switched-off portals).
 */
export function licenceTextsInUse(
  records: SourceLicenseRecord[] = SOURCE_LICENSE_REGISTRY,
  include: (r: SourceLicenseRecord) => boolean = () => true,
): LicenceText[] {
  const used = new Set<string>()
  for (const r of records) {
    if (usagePolicy(r.license_status) === 'WITHHOLD' || !include(r)) continue
    for (const t of licenceTextsFor(r.license)) used.add(t.id)
  }
  return LICENCE_TEXTS.filter((t) => used.has(t.id))
}

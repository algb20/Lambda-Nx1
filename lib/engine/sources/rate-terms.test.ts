import { describe, expect, it } from 'vitest'
import { rdap } from './rdap'
import { nominatim } from './geo'
import { pubmed, arxiv } from './research'
import { issPosition } from './hazard'

/**
 * Spacing that providers' own terms require (read 2026-10-04/05; batch 09).
 *
 * Each figure below is the provider's published ceiling, turned into the
 * minimum gap between two calls from one process. A source may be gentler; it
 * may not be faster. rdap.org was: it allowed twenty calls in ten seconds
 * against a stated maximum of ten.
 */
const REQUIRED_GAP_MS: Array<[string, { minIntervalMs?: number }, number, string]> = [
  ['rdap.org', rdap, 1000, '"a maximum of 10 requests in 10 seconds"'],
  ['Nominatim', nominatim, 1000, '"an absolute maximum of 1 request per second"'],
  ['NCBI E-utilities', pubmed, 334, '"no more than 3 requests every 1 second"'],
  ['arXiv API', arxiv, 3000, '"no more than one request every three seconds"'],
  ['wheretheiss.at', issPosition, 1000, '"limited to roughly 1 per second"'],
]

describe('sources keep to the rate their provider publishes', () => {
  it.each(REQUIRED_GAP_MS)('%s', (_name, source, gap, _quote) => {
    expect(source.minIntervalMs ?? 0).toBeGreaterThanOrEqual(gap)
  })
})

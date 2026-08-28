/**
 * Generate the browser's copy of the catalogue's independence groups.
 *
 * ## Why the browser cannot simply import the catalogue
 *
 * `originOf` is four lines and it answers one question — which publisher is
 * behind this source key — but it reads `CATALOG`, and `CATALOG` is every feed
 * definition we own: 247 sources, their URLs, their Admiralty ratings, their
 * licences, their rate limits. Two client components call that function, so
 * webpack pulled all 192 KB of `lib/engine/catalog/feeds/` into the first
 * chunk of the *default page*, on every open, on every phone.
 *
 * The map itself is 187 entries. That is what ships now.
 *
 * ## Why generated rather than hand-written
 *
 * A hand-written mapping would drift from the independence groups the
 * confidence grade counts, and then the board and the grade would disagree
 * about who is speaking — which is exactly the failure `independence` exists to
 * prevent (charter §2a). So it is derived from `CATALOG` by this script and
 * `lib/engine/catalog/origins.test.ts` fails the build if the two ever differ.
 * Adding a source with an `independence` group and forgetting to regenerate is
 * a red test, not a silent wrong answer.
 *
 * Usage:  npx tsx scripts/build-origin-index.ts
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CATALOG } from '../lib/engine/catalog'

/**
 * Only the sources that belong to a *shared* group are listed.
 *
 * A source with no `independence` is its own group, and `originOf` already
 * returns the key it was given for anything it does not know — so writing those
 * out would be sixty entries mapping a string to itself.
 */
const entries = CATALOG.filter((s) => s.independence && s.independence !== s.key)
  .map((s) => [s.key, s.independence as string] as const)
  .sort(([a], [b]) => a.localeCompare(b))

const body = entries.map(([key, group]) => `  ${JSON.stringify(key)}: ${JSON.stringify(group)},`).join('\n')

const file = `/**
 * Which publisher is behind each source key — the catalogue's independence
 * groups, and nothing else.
 *
 * **Generated. Do not edit by hand.** Run \`npx tsx scripts/build-origin-index.ts\`
 * after changing any \`independence\` field in \`lib/engine/catalog/feeds/\`;
 * \`origins.test.ts\` recomputes this from \`CATALOG\` and fails if it has drifted.
 *
 * It exists so the browser can group events by publisher without importing the
 * whole catalogue. See the script's header for the measurement that forced it.
 *
 * ${entries.length} entries — every source that shares a group with another.
 * Anything absent is its own group, which is what \`originOf\` returns for an
 * unknown key.
 */

export const SOURCE_ORIGINS: Readonly<Record<string, string>> = {
${body}
}

/**
 * The publisher behind a source key.
 *
 * An unknown key is its own origin. That is the safe default: it constrains
 * nothing that was not already constrained, where guessing a group would
 * silently merge two voices that are not the same one.
 */
export function originOf(sourceKey: string): string {
  return SOURCE_ORIGINS[sourceKey] ?? sourceKey
}
`

const out = join(process.cwd(), 'lib/engine/catalog/origins.ts')
writeFileSync(out, file)
console.log(`origin index: ${entries.length} entries → ${out}`)

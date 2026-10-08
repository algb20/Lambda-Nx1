/**
 * Generate the browser's copy of the credits each source's licence requires.
 *
 * CC BY, OGL and their kin ask for a credit wherever the material appears, and
 * the reasonable place for it is beside the finding, not only on /terms (GL-04,
 * R323). The browser cannot import the catalogue or the licence registry (see
 * build-origin-index.ts for why), so this script derives a small map from both
 * and `credits.test.ts` fails the build if the two ever drift.
 *
 * The credit comes from the licence & usage registry when the record is
 * verified (its attribution was read from the provider's own terms), otherwise
 * from the catalogue licence. Withheld sources get no entry: nothing of theirs
 * is shown.
 *
 * Usage:  npx tsx scripts/build-credit-index.ts
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { creditEntries } from '../lib/engine/catalog/credit-derivation'

const entries = creditEntries()
const body = entries
  .map(([key, c]) => `  ${JSON.stringify(key)}: { credit: ${JSON.stringify(c.credit)}${c.licence ? `, licence: ${JSON.stringify(c.licence)}` : ''} },`)
  .join('\n')

const file = `/**
 * The credit each source's licence asks for, shown beside its findings.
 *
 * **Generated. Do not edit by hand.** Run \`npx tsx scripts/build-credit-index.ts\`
 * after changing a catalogue licence or a registry attribution;
 * \`credits.test.ts\` recomputes this and fails if it has drifted.
 *
 * ${entries.length} entries — sources that owe a credit and are not withheld.
 */

export interface SourceCredit {
  /** The words the provider asked for. */
  credit: string
  /** Short name of the standard licence, when there is one (links /terms#sources). */
  licence?: string
}

export const SOURCE_CREDITS: Readonly<Record<string, SourceCredit>> = {
${body}
}

/** The credit a source's licence requires, or undefined if it asks for none. */
export function creditOf(sourceKey: string): SourceCredit | undefined {
  return SOURCE_CREDITS[sourceKey]
}
`

const out = join(process.cwd(), 'lib/engine/catalog/credits.ts')
writeFileSync(out, file)
console.log(`credit index: ${entries.length} entries → ${out}`)

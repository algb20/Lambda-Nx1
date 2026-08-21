import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { SCHEMA_SQL, SCHEMA_MIGRATION_COUNT } from './schema-sql'

/**
 * The generated schema module, checked against the file it was generated with.
 *
 * Two artefacts now describe one schema: `db/schema.sql`, which a person can
 * paste, and `db/schema-sql.ts`, which the serverless bundle can import. They
 * are written in the same run of `scripts/build-schema.mjs` and therefore
 * cannot disagree — unless somebody edits one by hand, or regenerates and
 * commits only one of them.
 *
 * That is the failure this file exists to catch. A stale constant would be
 * applied by the schema installer without complaint, creating an older schema
 * than the migrations describe, and the symptom would surface much later as a
 * missing column in a query nobody connected to this.
 */
describe('db/schema-sql.ts is in step with db/schema.sql', () => {
  const file = readFileSync(join(process.cwd(), 'db/schema.sql'), 'utf8')

  it('carries exactly the same SQL', () => {
    expect(
      SCHEMA_SQL,
      'run `node scripts/build-schema.mjs` and commit both outputs',
    ).toBe(file)
  })

  it('reports the migration count the repository actually has', () => {
    const count = readdirSync(join(process.cwd(), 'db/migrations')).filter((f) =>
      f.endsWith('.sql'),
    ).length
    expect(SCHEMA_MIGRATION_COUNT).toBe(count)
  })

  /**
   * The escaping the generator does, verified on the real payload rather than
   * on a sample. A backtick or a `${` surviving unescaped would not be a subtle
   * bug — it would end the template literal early and produce a file that does
   * not compile, or worse, one that compiles into different SQL.
   */
  it('survived the round trip through a template literal intact', () => {
    expect(SCHEMA_SQL.length).toBe(file.length)
    expect(SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS "verification_codes"')
  })

  it('is not empty, which a broken generator would quietly produce', () => {
    expect(SCHEMA_SQL.length).toBeGreaterThan(10_000)
  })
})

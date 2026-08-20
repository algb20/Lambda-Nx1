import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The registration route, read as source.
 *
 * ## The bug this exists for
 *
 * Every layer below this route handled the user's real name correctly:
 * `registerUser` took a `fullName` argument, `normalizeFullName` trimmed and
 * length-checked it, `createUserAndCredential` wrote it to the column. Every
 * one of them had passing tests.
 *
 * The route never read `fullName` from the request body. So it always got the
 * parameter's default of `''`, which normalises to `null`, and **every account
 * ever created carried no name** — with nothing anywhere reporting a problem,
 * because nothing was broken except the one line that joined the parts.
 *
 * Found by registering an account against a real Postgres and reading the row
 * back. Unit tests could not have found it: they each tested one side of the
 * missing line.
 *
 * Asserting on the source is blunt, and it is the right blunt: the alternative
 * is booting Next.js and a database inside the unit suite to prove that one
 * argument is passed.
 */
const source = readFileSync(join(process.cwd(), 'app/api/auth/register/route.ts'), 'utf8')

describe('registration passes through everything the sign-up form collects', () => {
  it('reads fullName from the request body', () => {
    expect(source).toMatch(/body\.fullName/)
  })

  it('passes fullName on to registerUser rather than dropping it', () => {
    // The call must carry a fifth argument; `registerUser`'s signature is
    // (email, password, username, deps, fullName).
    // `[\s\S]` rather than the `s` flag: the project's TS target predates it.
    const call = /registerUser\(([\s\S]*?)\)/.exec(source)
    expect(call, 'registerUser is not called here at all').not.toBeNull()
    const args = call![1]
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean)
    expect(args, `registerUser called with: ${args.join(', ')}`).toHaveLength(5)
    expect(args[4]).toBe('fullName')
  })

  it('still reads the three credentials it always did', () => {
    for (const field of ['body.email', 'body.password', 'body.username']) {
      expect(source, field).toContain(field)
    }
  })

  /**
   * A name is optional. Requiring one would turn a nicety into a barrier, and
   * the type guard must therefore fall back to empty rather than reject.
   */
  it('treats a missing name as empty rather than as an error', () => {
    expect(source).toMatch(/typeof body\.fullName === 'string' \? body\.fullName : ''/)
  })
})

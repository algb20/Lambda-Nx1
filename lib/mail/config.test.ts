import { describe, expect, it } from 'vitest'
import { HTTP_MAIL_KEYS, isHttpMailService, MAIL_PROVIDER_VALUES, planMail } from './config'

/**
 * The rules for deciding whether this deployment can send email.
 *
 * The case that forced this file into existence is `MAIL_PROVIDER=resend`: a
 * variable that reads like the answer, was accepted by the environment, changed
 * nothing, and was mentioned by no surface in the product. Most of what follows
 * is about a plan that *says* what it did with the operator's input, which is a
 * stronger requirement than getting the routing right.
 */

const FROM = 'Lambda <no-reply@example.com>'

describe('MAIL_PROVIDER naming a provider', () => {
  it('selects that provider when its key is present', () => {
    const plan = planMail({ MAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'k', MAIL_FROM: FROM })
    expect(plan.mode).toBe('http')
    expect(plan.service).toBe('brevo')
    expect(plan.forced).toBe(true)
    expect(plan.problem).toBeNull()
  })

  it('is case- and whitespace-insensitive, because a pasted value carries both', () => {
    const plan = planMail({ MAIL_PROVIDER: '  ReSend  ', RESEND_API_KEY: 'k', MAIL_FROM: FROM })
    expect(plan.service).toBe('resend')
  })

  /**
   * The bug this whole file exists for.
   *
   * `MAIL_PROVIDER=resend` with no `RESEND_API_KEY` used to fall through to the
   * generic advice, which listed the variables to set and never named the one
   * the operator had already set — so the advice could be followed exactly and
   * still leave the deployment unable to send.
   */
  it('names the key it needs, and says MAIL_PROVIDER is not itself a credential', () => {
    const plan = planMail({ MAIL_PROVIDER: 'resend', MAIL_FROM: FROM })
    expect(plan.mode).toBe('off')
    expect(plan.problem).toContain('MAIL_PROVIDER=resend')
    expect(plan.problem).toContain('RESEND_API_KEY')
    expect(plan.problem).toContain('not itself a credential')
  })

  it('asks for MAIL_FROM too when neither is set', () => {
    const plan = planMail({ MAIL_PROVIDER: 'postmark' })
    expect(plan.problem).toContain('POSTMARK_TOKEN')
    expect(plan.problem).toContain('MAIL_FROM')
  })

  /**
   * Force has to mean force.
   *
   * An operator who names Resend and receives mail through Brevo has been
   * misled by the switch they used in order to be explicit — and the health
   * check would then report a provider they never chose.
   */
  it('does not fall back to another key when the named provider has none', () => {
    const plan = planMail({ MAIL_PROVIDER: 'resend', BREVO_API_KEY: 'k', MAIL_FROM: FROM })
    expect(plan.mode).toBe('off')
    expect(plan.service).toBeNull()
  })

  it('does not fall back to SMTP either', () => {
    const plan = planMail({
      MAIL_PROVIDER: 'resend',
      SMTP_URL: 'smtp://u:p@mail.example.com:587',
      MAIL_FROM: FROM,
    })
    expect(plan.mode).toBe('off')
  })

  it('refuses the named provider when the key is present but MAIL_FROM is not', () => {
    const plan = planMail({ MAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'k' })
    expect(plan.mode).toBe('off')
    expect(plan.problem).toContain('MAIL_FROM')
    expect(plan.problem).toContain('brevo has verified')
  })
})

describe('MAIL_PROVIDER values that are not provider names', () => {
  it('switches mail off for "disabled", and blames the switch rather than the keys', () => {
    const plan = planMail({ MAIL_PROVIDER: 'disabled', RESEND_API_KEY: 'k', MAIL_FROM: FROM })
    expect(plan.mode).toBe('off')
    expect(plan.problem).toContain('MAIL_PROVIDER=disabled')
    expect(plan.problem).toContain('overriding')
  })

  /** The setting that looks like success and is not. */
  it('reports "log" as a problem even though it is technically working', () => {
    const plan = planMail({ MAIL_PROVIDER: 'log' })
    expect(plan.mode).toBe('log')
    expect(plan.problem).toContain('never sent')
  })

  it('routes to SMTP when asked, and says so when there is no URL to connect to', () => {
    expect(planMail({ MAIL_PROVIDER: 'smtp', SMTP_URL: 'smtp://u:p@h:587' }).mode).toBe('smtp')
    const missing = planMail({ MAIL_PROVIDER: 'smtp' })
    expect(missing.mode).toBe('off')
    expect(missing.problem).toContain('SMTP_URL')
  })

  /**
   * An unrecognised value is ignored — the alternative is a deployment that
   * cannot send mail because of a typo — but never in silence, and the message
   * lists what it would have accepted.
   */
  it('names an unrecognised value, ignores it, and lists the ones that work', () => {
    const plan = planMail({ MAIL_PROVIDER: 'sendgrid', RESEND_API_KEY: 'k', MAIL_FROM: FROM })
    expect(plan.mode).toBe('http')
    expect(plan.service).toBe('resend')
    expect(plan.forced).toBe(false)
    expect(plan.problem).toContain('MAIL_PROVIDER=sendgrid')
    expect(plan.problem).toContain('is being ignored')
    for (const value of MAIL_PROVIDER_VALUES) expect(plan.problem).toContain(value)
  })

  it('carries the unrecognised value alongside the real problem, not instead of it', () => {
    const plan = planMail({ MAIL_PROVIDER: 'sendgrid' })
    expect(plan.problem).toContain('MAIL_PROVIDER=sendgrid')
    expect(plan.problem).toContain('MAIL_FROM')
  })
})

describe('with MAIL_PROVIDER unset', () => {
  it('picks the key that is present', () => {
    const plan = planMail({ POSTMARK_TOKEN: 'k', MAIL_FROM: FROM })
    expect(plan).toMatchObject({ mode: 'http', service: 'postmark', forced: false, problem: null })
  })

  /**
   * HTTPS wins over SMTP, and not as a matter of taste: serverless hosts
   * commonly refuse outbound connections on the SMTP ports, so a correct
   * SMTP_URL can work on a laptop and time out in production.
   */
  it('prefers an HTTPS key over SMTP when both are configured', () => {
    const plan = planMail({ RESEND_API_KEY: 'k', MAIL_FROM: FROM, SMTP_URL: 'smtp://u:p@h:587' })
    expect(plan.mode).toBe('http')
  })

  it('falls to SMTP when no HTTPS key is set', () => {
    expect(planMail({ SMTP_URL: 'smtp://u:p@h:587' }).mode).toBe('smtp')
  })

  /**
   * A key with no sender address is not a configured provider, however present
   * it looks: every one of these services rejects a `From:` on a domain nobody
   * has proved they own.
   */
  it('refuses a key with no MAIL_FROM, and names the keys that are set', () => {
    const plan = planMail({ RESEND_API_KEY: 'k', BREVO_API_KEY: 'k2' })
    expect(plan.mode).toBe('off')
    expect(plan.problem).toContain('RESEND_API_KEY and BREVO_API_KEY')
    expect(plan.problem).toContain('MAIL_FROM')
  })

  it('asks for a key when only MAIL_FROM is set', () => {
    const plan = planMail({ MAIL_FROM: FROM })
    expect(plan.mode).toBe('off')
    expect(plan.problem).toContain('MAIL_FROM is set but no provider key is')
  })

  it('gives the full instruction when nothing at all is set', () => {
    const plan = planMail({})
    expect(plan.mode).toBe('off')
    for (const key of Object.values(HTTP_MAIL_KEYS)) expect(plan.problem).toContain(key)
    expect(plan.problem).toContain('SMTP_URL')
  })
})

describe('the rules the advice depends on', () => {
  /**
   * A variable set to spaces is set as far as a hosting dashboard is concerned
   * and empty as far as sending is concerned. The plan has to agree with the
   * sender, not with the dashboard.
   */
  it('treats whitespace-only variables as absent', () => {
    const plan = planMail({ RESEND_API_KEY: '   ', MAIL_FROM: '  ' })
    expect(plan.mode).toBe('off')
    expect(plan.problem).toContain('Set MAIL_FROM plus one of')
  })

  it('every advice sentence tells the operator to redeploy', () => {
    // Adding a variable to the host does not restart the running instance, and
    // an operator who sets the right key and sees no change concludes the key
    // is wrong. Each off-state message has to close that gap itself.
    for (const env of [{}, { MAIL_FROM: FROM }, { MAIL_PROVIDER: 'resend' }, { RESEND_API_KEY: 'k' }]) {
      expect(planMail(env).problem, JSON.stringify(env)).toContain('redeploy')
    }
  })

  it('never repeats a secret value back', () => {
    const plan = planMail({ MAIL_PROVIDER: 'resend', RESEND_API_KEY: 'super-secret-key' })
    expect(plan.problem).not.toContain('super-secret-key')
  })

  it('recognises exactly the three HTTPS services and nothing else', () => {
    expect(isHttpMailService('resend')).toBe(true)
    expect(isHttpMailService('brevo')).toBe(true)
    expect(isHttpMailService('postmark')).toBe(true)
    expect(isHttpMailService('smtp')).toBe(false)
    expect(isHttpMailService('toString')).toBe(false)
  })
})

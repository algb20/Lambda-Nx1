/**
 * Following by email: the rules, with no database and no network in sight.
 *
 * ## What this module decides
 *
 * Everything about a subscription that is a *decision* rather than a query:
 * whether an address is worth accepting, what a token looks like, whether a
 * pending row has gone stale, and — the one that matters most — whether a given
 * row may be sent anything at all.
 *
 * It is separated from the routes because those three questions are the ones a
 * mistake would be expensive in, and a pure function is the only kind you can
 * exhaustively test. `mayReceive` in particular is a single predicate with four
 * inputs, and every one of them is a way to mail somebody who did not ask.
 *
 * ## Double opt-in
 *
 * Typing an address creates a *pending* row and sends exactly one message: the
 * one asking whether they meant it. Nothing else is ever sent until they click.
 *
 * The reason is not politeness. A subscribe box that mails on submit is a
 * machine for mailing strangers — anybody can type anybody's address — and it
 * sends from the same domain our sign-in codes come from. One abused form and
 * the verification codes stop arriving for everyone, because the domain has
 * been scored as a spam source. The account system and the mailing list share
 * one reputation, so they share one standard.
 *
 * ## Why a link here and a six-digit code for sign-up
 *
 * They are different moments. Someone finishing a sign-up has left the app,
 * fetched a code and come *back* — they are looking at our form, so a code they
 * can type is right. Someone confirming a subscription has no reason to return
 * to the app at all; they are in their mail client and a link finishes it there.
 * Asking them to carry a code back would lose most of them, for nothing.
 */

/** How long a pending confirmation stays valid. */
export const CONFIRM_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Bytes of randomness in each token.
 *
 * 32 bytes is 256 bits. The confirm token is a bearer credential for "yes, this
 * address is mine" and the unsubscribe token is one for "remove this address",
 * and both live in URLs that end up in mail logs and browser history — so they
 * are sized to be unguessable rather than to be short.
 */
export const TOKEN_BYTES = 32

/** The longest address we will accept. Longer is a paste error or an attack. */
export const MAX_EMAIL_LENGTH = 254

export interface FollowerRow {
  email: string
  confirmedAt: Date | null
  unsubscribedAt: Date | null
  /** When we last sent them anything, so one edition cannot go out twice. */
  lastSentAt: Date | null
  createdAt: Date
}

/**
 * Normalise an address for storage and comparison, or null if it is not one.
 *
 * Lowercased and trimmed so that one person cannot hold two subscriptions by
 * capitalising differently — and so that an unsubscribe typed in any case still
 * finds the row it means.
 *
 * The check is deliberately shallow: exactly one `@`, something either side, a
 * dot in the domain, no whitespace. Anything stricter rejects addresses that are
 * valid and in use (the RFC permits far more than people expect), and the real
 * test of an address is whether the confirmation arrives — which is the whole
 * point of the flow this belongs to.
 */
export function normaliseEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase()
  if (!email || email.length > MAX_EMAIL_LENGTH) return null
  if (/\s/.test(email)) return null
  const parts = email.split('@')
  if (parts.length !== 2) return null
  const [local, domain] = parts
  if (!local || !domain) return null
  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) return null
  return email
}

/**
 * Whether this row may be sent a brief.
 *
 * Every clause is a way somebody could be mailed without asking, so each is
 * spelled out rather than collapsed into one boolean:
 *
 *  - **Confirmed.** They clicked the link. Without this the list is whatever
 *    anyone typed into the box.
 *  - **Not unsubscribed.** Leaving means leaving. A row is kept after they go
 *    rather than deleted, precisely so that this check has something to read.
 *  - **Not already sent this edition.** Guards against a scheduler that fires
 *    twice, which is a thing schedulers do.
 */
export function mayReceive(row: FollowerRow, editionAt: Date): boolean {
  if (!row.confirmedAt) return false
  if (row.unsubscribedAt) return false
  if (row.lastSentAt && row.lastSentAt.getTime() >= editionAt.getTime()) return false
  return true
}

/** Whether a pending confirmation has run out of time. */
export function confirmationExpired(row: FollowerRow, now = new Date()): boolean {
  if (row.confirmedAt) return false
  return now.getTime() - row.createdAt.getTime() > CONFIRM_WINDOW_MS
}

/**
 * What to tell somebody who submits the form.
 *
 * The same sentence whichever branch was taken, and that is the security
 * property: "we already have that address" and "we have added that address" are
 * different answers, and the difference tells a stranger whether a given person
 * reads us. The subscribe box must not become a way to look people up.
 */
export const SUBMIT_REPLY =
  'If that address can receive mail, a confirmation is on its way. Nothing is sent until you click the link in it.'

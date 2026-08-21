# One codebase, two products

> **Standing rule S9.** Everything we build must work in the Pi Browser app *and*
> on the standalone `.com` site. Launched together, or one before the other, with
> no problem either way. Never build a surface that only one of them can run.

This document answers the question directly: *how does that actually work?*

## The short answer

There is **one repository, one build and one deployment**. Nothing is compiled
twice. The Pi app and the website are the same running program, reached through
two different front doors:

| | Pi Browser app | Standalone site |
|---|---|---|
| URL | the same URL, opened inside Pi Browser | the same URL, opened in any browser |
| Build | one | the same one |
| Deployment | one | the same one |
| Database, engine, sources, analysis | identical | identical |
| Sign-in | Pi username, one tap | email + passphrase |
| Payment | π, through the Pi SDK | card, through the standard gateway |

Only the last two rows differ, and both differences are decided **at the moment
a visitor arrives** — not when the code is built.

## Why "decided at build time" was wrong, and what it cost

The original arrangement used an environment variable, `NEXT_PUBLIC_AUTH_MODE`,
chosen when the bundle was built. That produces two builds, two URLs and two
things to keep in step. It is also wrong on its face, because **the same page can
be opened in either place**: a pioneer who follows a shared link from their
laptop lands on a build that offers only Pi sign-in, which cannot complete
outside Pi Browser. They see a button that hangs.

So the decision moved to where the visitor actually is (`lib/auth/environment.ts`):

1. **The user agent.** Pi Browser identifies itself. Available on the very first
   frame, so the right form renders without a flash of the wrong one.
2. **The bridge.** `window.Pi` is injected by Pi Browser — a stronger hint, and
   still a hint.
3. **The handshake.** `Pi.authenticate` resolving is proof. It is also the
   slowest, so it confirms rather than gates.

Either of the first two alone is enough to show the Pi door. Requiring both would
mean that a Pi Browser release changing its user-agent string leaves every
pioneer looking at an email form — failing towards the worse of the two errors.

**This is a presentation decision, not a security boundary.** A forged user agent
gets a visitor the Pi sign-in *form* and nothing more. The form is worthless
without a Pi access token, and that token is verified server-side against Pi's
own API before any session exists.

### The hydration trap, since it cost a real bug

The surface cannot simply be read during render. The server has no browser, so it
answers `web` and emits the web shell; a Pi client answers `pi-browser` and
renders a different tree. React finds two trees where it expected one, throws
**error #418**, discards the server HTML and re-renders the entire document — on
the slowest device we ship to, on every load, for exactly the users the Pi build
exists for.

The surface is therefore an external store. React hydrates with the server's
answer, so the two agree, then adopts the real one as an ordinary update. And
because `window.Pi` is injected by a script that can arrive a second or two after
first paint, the store *keeps watching* for five seconds rather than reading once.

### One tree, not two branches

The two shells are not alternative branches. If they were, the branch would flip
on the first update after hydration, the element type above `children` would
change with it, and React would unmount and rebuild **every screen in the app** —
losing all state and re-running every effect, on a Pi Browser phone.

So the structure is fixed and only the leaves differ: the Pi provider is always
mounted and told whether Pi is in play, and the web sign-in offer is a sibling
card rather than a wrapper. Swapping surfaces costs one card.

## Payments follow the payer

The same mistake existed one layer down and has now been fixed. `PAYMENT_PROVIDER`
was read at deploy time, which meant **one deployment could only ever take one
kind of payment**: set to `pi`, nobody on the website could buy anything; set to
`standard`, no pioneer could pay with π — the entire point of shipping a Pi app.

`lib/payments/rail.ts` now chooses per request:

- **Inside Pi Browser → π.** The SDK is there, the wallet is there, and π is what
  the plans are priced in.
- **Anywhere else → the standard gateway.** Pi payments cannot complete outside
  Pi Browser; the SDK never settles. A checkout that hangs is worse than one that
  is not offered.
- **An explicit `PAYMENT_PROVIDER` still wins**, so an operator running a
  deliberately single-purpose instance can say so — and so no existing deployment
  changes behaviour.

Like the sign-in door, this is routing rather than authorisation. A forged user
agent reaches the other rail's API and is rejected by it: a Pi payment id means
nothing to Stripe and a PaymentIntent means nothing to Pi. Nothing is granted
until the real provider confirms a real charge.

## What this means for launch order

Because there is one build, **the launch order does not matter**:

- **Site first.** Ship it. The Pi door already exists in the same bundle; the
  first visitor who opens the URL inside Pi Browser gets it, with no redeploy.
- **App first.** Submit it to Pi. The same URL served to an ordinary browser is
  already the complete website.
- **Both together.** Nothing extra to do — it is one deployment either way.

There is no migration between the two, no second environment to configure, and no
window in which one of them is broken because the other was released.

## How the rule is kept

Prose is not enforcement. `lib/platform/parity.test.ts` fails the build if any of
these is broken:

| Rule | Why |
|---|---|
| The build-time auth switch is read in **exactly one** place | Anything else reading it freezes a surface into the bundle and re-creates the two-builds arrangement. |
| `window.Pi` is touched only inside its adapter | The bridge does not exist on the website. A component reaching for it directly throws — or silently does nothing — for every web visitor. |
| No request handler picks the payment rail from the deployment | That is exactly how the rail got frozen. A handler serving a payer must read the payer. |
| Every surface has a working rail, including a request with no user agent | Health checks, scripts and stripped proxies must not crash. |

## Checklist for anything new

Before a feature is done, both answers must be yes:

1. **Does it work in Pi Browser?** Mobile viewport, no hover, slow network, and
   the Pi SDK present.
2. **Does it work on the open web?** No `window.Pi`, possibly signed out, on a
   desktop, and possibly indexed by a search engine.

If a capability genuinely belongs to one surface — paying with π is the honest
example — then the other surface gets a **working equivalent**, never a dead
button and never silence.

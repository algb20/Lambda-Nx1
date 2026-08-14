# Secrets

The repository is public. Everything in it is readable by anyone, forever,
including anything you delete later — git keeps history, and mirrors and forks
keep copies you do not control. **A credential committed once is a credential
that must be rotated**, not one that can be removed.

So the rule is short and has no exceptions:

> **No secret is ever written into a file in this repository.** Secrets live in
> the hosting environment, and the application reads them from `process.env`.

## What counts as a secret

| Variable | What it opens | Where it is set |
|---|---|---|
| `DATABASE_URL` | The whole database, read and write | Host dashboard |
| `SESSION_SECRET` | Signs session cookies — with it, anyone can mint a session for any user | Host dashboard |
| `CRON_SECRET` | The scheduled-job endpoints | Host dashboard |
| `ADMIN_SECRET` | The admin routes, including the usage registry | Host dashboard |
| `SOCIAL_SECRET_KEY` | Decrypts stored channel tokens | Host dashboard |
| `PI_API_KEY` | Acts as this app against Pi Network, including payments | Host dashboard |
| `STRIPE_SECRET_KEY` | Charges cards | Host dashboard |
| `ANTHROPIC_API_KEY` | Bills our account | Host dashboard |

`.env.example` lists every one of these with an **empty or placeholder value**.
It is documentation of the shape, and it is scanned like every other file: a
real value pasted into it fails the test suite exactly as it would anywhere
else. There is no allowlisted file.

## What is *not* a secret

- `public/validation-key.txt` and `public/piapp-link-verification.txt` are Pi
  **domain-verification** files. They are meant to be served publicly at a URL —
  that is their entire function. Publishing them proves we control the domain;
  it grants nothing.
- Anything named `NEXT_PUBLIC_*` is compiled into the browser bundle and is
  therefore public by construction. Never put a credential behind that prefix:
  the prefix does not protect it, it publishes it.

## How this is enforced

Three layers, in order of how early they catch a mistake:

1. **`.gitignore`** excludes `.env*` (except `.env.example`), so the common
   accident — committing your local environment file — cannot happen by
   default.
2. **`lib/security/secret-scan.test.ts`** reads *every tracked file* on every
   test run and fails if any of them contains something shaped like a
   credential: provider keys (Stripe, Anthropic, OpenAI, AWS, GitHub, Slack,
   Google), private-key blocks, JWTs, and connection strings carrying a
   password. A contributor cannot merge a key, because the suite goes red
   before review begins.
3. **`npm run package`** refuses to build a release bundle containing one,
   using the same scanner. The release gate and the test gate cannot drift
   apart, because there is one implementation.

The scanner distinguishes a placeholder from a credential by what the value
**is**, not where it sits. A connection string pointing at a host reserved for
documentation (RFC 2606 `example.com`, `.test`, `.invalid`; RFC 5737
`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`) or carrying obvious
placeholder credentials (`user:password`) is a worked example. Everything else
is treated as real. This is deliberately not an entropy heuristic: those flood
you with false positives on minified assets and hashes, and a scanner people
routinely override is a scanner that is off.

## Contributors

Outside contributors can read all the code and **none of the secrets**. That
separation is a property of where secrets live, not of anyone's discretion:

- Secrets are set in the Netlify/Vercel project dashboard, which is
  account-controlled and never mirrored into the repository.
- A pull request from a fork does **not** receive the production environment.
  It builds with whatever the preview context provides.
- Nothing in the build writes an environment variable into an artifact, so a
  deployed bundle a contributor can download carries no key.

When granting repository access, grant it to the repository only. Repository
access is not deployment access, and the two should stay separate people-wise
as well as technically.

## Rotating

Assume any secret that has ever been in a file is compromised, even if the
commit was amended away.

1. Generate a new value.
2. Set it in the host dashboard (every context: production, deploy previews,
   branch deploys).
3. Redeploy.
4. Revoke the old value at the provider — this step is the one that actually
   ends the exposure, and it is the one most often skipped.

`SESSION_SECRET` has one extra consequence worth knowing before you rotate it:
every existing session cookie becomes invalid, so every signed-in user is
signed out. That is the correct behaviour if the old value leaked — it is
exactly what revoking the sessions means — but it is not a silent change.

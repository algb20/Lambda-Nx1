import Link from 'next/link'
import type { Metadata } from 'next'

/**
 * The privacy notice.
 *
 * Written from the code rather than from a template: every claim below is one
 * that can be checked against a file in this repository, and the sections are
 * ordered by what a reader actually wants to know. A notice that describes
 * collection the app does not do is as much a lie as one that hides collection
 * it does.
 */
export const metadata: Metadata = {
  title: 'Privacy — Lambda',
  description: 'What Lambda collects, why, how long it is kept, and how to erase it.',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Privacy</h1>
        <p className="text-sm text-muted-foreground">
          What we collect, why, how long we keep it, and how you erase it.
        </p>
      </header>

      <Section title="You can use Lambda without an account">
        <p>
          Every intelligence gateway works signed out. No sign-up wall, no email address required to
          run an investigation. An account exists only to keep things for you across devices —
          history, monitors, groups, your picture.
        </p>
      </Section>

      <Section title="What we store if you create an account">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Your identifier</strong> — the email address you signed up with, or the Pi
            Network username if you signed in through Pi.
          </li>
          <li>
            <strong>A hash of your password</strong>, never the password itself. We cannot read it
            and cannot recover it for you.
          </li>
          <li>
            <strong>Your investigations</strong> — the subject you searched, which gateway, when,
            and how many findings came back — so you can reopen them.
          </li>
          <li>
            <strong>Your monitors, groups and profile picture</strong>, if you create them.
          </li>
        </ul>
      </Section>

      <Section title="What we store about visits">
        <p>
          One row per country, counting arrivals. If you are signed in, that row carries your
          username so we know a real person rather than a robot is using it. If you are not signed
          in, nothing identifies you: no per-visitor identifier is created, and the count is
          aggregated at country level only.
        </p>
        <p>
          <strong>We never store your IP address.</strong> The country comes from a header the
          hosting edge adds before the request reaches our code; the address itself is not written
          anywhere.
        </p>
      </Section>

      <Section title="What we do not do">
        <ul className="list-disc space-y-1 pl-5">
          <li>No advertising, no ad networks, no third-party analytics or tracking pixels.</li>
          <li>We do not sell, rent or share your data with anyone.</li>
          <li>No profile of you is built, and no behaviour of yours is scored.</li>
          <li>
            We do not redistribute breach data. Exposure checks answer yes or no; leaked passwords
            are never stored or shown.
          </li>
        </ul>
      </Section>

      <Section title="Passive collection — what the engine does to the world">
        <p>
          Lambda is passive by design and by code. The engine never contacts an investigation
          target: no port scans, no probing, no packet to a subject&rsquo;s own infrastructure. It
          reads public, read-only sources — company registers, sanctions lists, certificate
          transparency logs, seismic and satellite feeds, Wikipedia and Wikidata, government
          publications — and respects their robots.txt, terms and rate limits.
        </p>
        <p>
          It is not a surveillance tool. It monitors public signals — domains, infrastructure,
          brands, published records — not private individuals&rsquo; lives.
        </p>
      </Section>

      <Section title="Where it is stored, and for how long">
        <p>
          In a Postgres database in the European Union, over an encrypted connection. Investigations
          are kept until you delete them or delete your account. Country counts are kept as running
          totals with no personal data in them.
        </p>
      </Section>

      <Section title="Erasing everything">
        <p>
          Open <strong>Preferences → Account → Delete account</strong>. It happens immediately:
          your account, credentials, saved investigations, monitors, groups and picture are removed
          in one transaction. There is no grace period and no soft delete.
        </p>
        <p>
          Anything you chose to publish stays published, with your name detached from it. Deleting
          your account should not silently retract things other people are reading, and leaving your
          name on them would defeat the point of deleting.
        </p>
      </Section>

      <Section title="Cookies">
        <p>
          One: <code className="rounded bg-muted px-1 py-0.5 text-xs">lnx_session</code>, set only
          when you sign in. It is httpOnly, SameSite=Lax, and holds a signed token identifying your
          account — nothing else. There are no tracking cookies, so there is no cookie banner to
          click away.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          Under the GDPR you may access, correct, export or erase your data, and object to its
          processing. Erasure is self-service (above). For anything else, use the feedback button in
          the app — it reaches us directly.
        </p>
      </Section>

      <footer className="border-t pt-6 text-sm">
        <Link href="/" className="text-primary hover:underline">
          ← Back to Lambda
        </Link>
        <span className="px-2 text-muted-foreground">·</span>
        <Link href="/terms" className="text-primary hover:underline">
          Terms of use
        </Link>
      </footer>
    </main>
  )
}

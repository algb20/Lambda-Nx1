import Link from 'next/link'
import type { Metadata } from 'next'

/**
 * Terms of use.
 *
 * Deliberately short and specific. The obligations here are the ones the charter
 * already enforces in code (passive-only, public and lawful sources, no
 * targeting of private individuals) plus the honest limits of what an OSINT
 * result is worth — an analyst's lead, not a verdict.
 */
export const metadata: Metadata = {
  title: 'Terms — Lambda',
  description: 'The rules for using Lambda, and the limits of what its findings mean.',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  )
}

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Terms of use</h1>
        <p className="text-sm text-muted-foreground">
          The rules for using Lambda, and what its findings do and do not mean.
        </p>
      </header>

      <Section title="What Lambda is">
        <p>
          An open-source-intelligence platform. It reads public sources, cross-checks them, grades
          how much each one can be relied on, and documents where every statement came from. It is
          an analysis tool: its value is the pivoting, verification and documentation, not the raw
          data.
        </p>
      </Section>

      <Section title="What the engine will not do, whatever you ask it">
        <p>These are enforced in code, not left to good intentions:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Passive only.</strong> It never sends a packet to an investigation target. No
            port scans, no probes, no active reconnaissance of any kind.
          </li>
          <li>
            <strong>Public and lawful sources only</strong>, with robots.txt, terms of service and
            rate limits respected. Availability is not permission.
          </li>
          <li>
            <strong>No breach-data redistribution.</strong> Exposure checks answer yes or no; leaked
            credentials are never stored or shown.
          </li>
        </ul>
      </Section>

      <Section title="What you agree not to use it for">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Investigating, profiling, tracking or harassing a private individual. Lambda is for
            public signals — organisations, infrastructure, brands, published records.
          </li>
          <li>Stalking, doxxing, intimidation, or building a dossier on someone&rsquo;s private life.</li>
          <li>
            Any decision about a person&rsquo;s employment, credit, housing, insurance or legal
            status. Lambda is not a consumer-reporting or background-check service and must not be
            used as one.
          </li>
          <li>
            Anything unlawful where you are, or anything that breaches the terms of the underlying
            sources.
          </li>
          <li>
            Automated bulk extraction. The gateways are rate-limited because they read public
            providers that limit us in turn; one abusive client degrades the service for everyone.
          </li>
        </ul>
        <p>Accounts used this way are removed without notice.</p>
      </Section>

      <Section title="What a finding is worth">
        <p>
          Every finding carries its source, a timestamp, an Admiralty rating and a confidence grade
          precisely because none of them is a certainty. Sources go stale, registries carry errors,
          and corroboration is not proof.
        </p>
        <p>
          <strong>Verify before you act.</strong> Lambda gives you leads and the evidence trail to
          check them; the judgement is yours, and so is the responsibility for what you do with it.
          The platform is provided as-is, without warranty of accuracy, completeness or fitness for
          a particular purpose.
        </p>
      </Section>

      <Section title="Availability">
        <p>
          Lambda depends on third-party public providers. When one is down, slow or rate-limiting
          us, its section comes back empty and is reported as failed rather than filled with a
          guess. Nothing is ever fabricated to cover a gap. No uptime is guaranteed.
        </p>
      </Section>

      <Section title="Payments and plans">
        <p>
          The core gateways are free. Paid plans unlock additional gateways, the AI analyst,
          monitoring and higher limits, and can be paid in Pi inside the Pi Browser or by standard
          payment elsewhere. Payment is taken only after you approve it, and a plan applies from the
          moment it is confirmed.
        </p>
      </Section>

      <Section title="Your account">
        <p>
          You are responsible for keeping your password. Because we store only a hash of it, we
          cannot recover it — we can only help you start again. You may erase your account at any
          time from Preferences → Account, and it is erased immediately.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          These terms change when the product does. Material changes are announced in the app rather
          than made quietly.
        </p>
      </Section>

      <footer className="border-t pt-6 text-sm">
        <Link href="/" className="text-primary hover:underline">
          ← Back to Lambda
        </Link>
        <span className="px-2 text-muted-foreground">·</span>
        <Link href="/privacy" className="text-primary hover:underline">
          Privacy
        </Link>
      </footer>
    </main>
  )
}

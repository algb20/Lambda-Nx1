import type { CatalogSource, Licence } from '../types'
import { PUBLIC_DOMAIN, ccBy, publicFeed } from '../licence'

/**
 * Cyber threat and vulnerability sources.
 *
 * Ratings here follow a rule worth stating: a **vendor advisory about the
 * vendor's own product** is an A, because nobody is better placed to know. A
 * vendor advisory about somebody else's product, or a security company's blog
 * about an incident it is also selling protection against, is a C — useful,
 * interested, and not the same thing as a national CERT's bulletin.
 *
 * The passive guarantee applies unchanged. Every source here is a published
 * feed we read; none of it touches an investigated host.
 */
/**
 * abuse.ch releases its trackers for any use including commercial, asking only
 * that the source be named. Written out rather than reaching for a standard
 * licence, because it is genuinely its own terms and pretending otherwise is
 * how a licence gets mis-stated in the permissive direction.
 */
const ABUSE_CH: Licence = {
  id: 'abuse-ch',
  name: 'abuse.ch open data',
  commercialUse: true,
  storage: true,
  redistribute: true,
  attribution: 'abuse.ch',
  termsUrl: 'https://abuse.ch/',
}

export const CYBER_SOURCES: CatalogSource[] = [
  // ── National and governmental CERTs ──────────────────────────────────────
  {
    key: 'cisa_advisories',
    name: 'CISA cybersecurity advisories',
    publisher: 'US Cybersecurity and Infrastructure Security Agency',
    url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml',
    kind: 'rss',
    discipline: 'cyber',
    topics: ['cyber-advisory', 'vulnerability'],
    coverage: 'global',
    admiralty: 'A',
    independence: 'cisa',
    licence: PUBLIC_DOMAIN,
    minIntervalSec: 1800,
    keyless: true,
  },
  {
    key: 'cisa_kev',
    name: 'CISA Known Exploited Vulnerabilities',
    publisher: 'US Cybersecurity and Infrastructure Security Agency',
    url: 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
    kind: 'json',
    path: 'vulnerabilities',
    discipline: 'cyber',
    topics: ['vulnerability'],
    coverage: 'global',
    admiralty: 'A',
    independence: 'cisa',
    licence: PUBLIC_DOMAIN,
    minIntervalSec: 3600,
    keyless: true,
    map: { title: 'vulnerabilityName', time: 'dateAdded' },
    note: 'Vulnerabilities observed being exploited — not theoretical severity, evidence of use.',
  },
  {
    key: 'ncsc_uk',
    name: 'UK NCSC advisories',
    publisher: 'UK National Cyber Security Centre',
    url: 'https://www.ncsc.gov.uk/api/1/services/v1/report-rss-feed.xml',
    kind: 'rss',
    discipline: 'cyber',
    topics: ['cyber-advisory'],
    coverage: 'global',
    admiralty: 'A',
    licence: ccBy('UK NCSC, Open Government Licence v3.0', 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/'),
    minIntervalSec: 3600,
    keyless: true,
  },
  {
    key: 'cert_eu',
    name: 'CERT-EU security advisories',
    publisher: 'CERT-EU',
    url: 'https://cert.europa.eu/publications/security-advisories-rss',
    kind: 'rss',
    discipline: 'cyber',
    topics: ['cyber-advisory', 'vulnerability'],
    coverage: 'global',
    admiralty: 'A',
    licence: publicFeed('CERT-EU', 'https://cert.europa.eu/'),
    minIntervalSec: 3600,
    keyless: true,
  },
  {
    key: 'acsc_australia',
    name: 'Australian Cyber Security Centre alerts',
    publisher: 'Australian Signals Directorate (ACSC)',
    url: 'https://www.cyber.gov.au/rss/news',
    kind: 'rss',
    discipline: 'cyber',
    topics: ['cyber-advisory'],
    coverage: 'global',
    admiralty: 'A',
    licence: ccBy('Australian Cyber Security Centre', 'https://www.cyber.gov.au/'),
    minIntervalSec: 3600,
    keyless: true,
  },
  {
    key: 'jpcert',
    name: 'JPCERT/CC alerts',
    publisher: 'JPCERT Coordination Center',
    url: 'https://www.jpcert.or.jp/rss/jpcert.rdf',
    kind: 'rss',
    discipline: 'cyber',
    topics: ['cyber-advisory'],
    coverage: 'global',
    admiralty: 'A',
    licence: publicFeed('JPCERT/CC', 'https://www.jpcert.or.jp/'),
    minIntervalSec: 3600,
    keyless: true,
  },
  {
    key: 'cert_fr',
    name: 'CERT-FR avis de sécurité',
    publisher: 'ANSSI (France)',
    url: 'https://www.cert.ssi.gouv.fr/avis/feed',
    kind: 'rss',
    discipline: 'cyber',
    topics: ['cyber-advisory', 'vulnerability'],
    coverage: 'global',
    admiralty: 'A',
    licence: publicFeed('CERT-FR / ANSSI', 'https://www.cert.ssi.gouv.fr/'),
    minIntervalSec: 3600,
    keyless: true,
  },
  {
    key: 'bsi_germany',
    name: 'BSI Bürger-CERT warnings',
    publisher: 'Bundesamt für Sicherheit in der Informationstechnik',
    url: 'https://wid.cert-bund.de/content/public/securityAdvisory/rss',
    kind: 'rss',
    discipline: 'cyber',
    topics: ['cyber-advisory', 'vulnerability'],
    coverage: 'global',
    admiralty: 'A',
    licence: publicFeed('CERT-Bund / BSI', 'https://www.bsi.bund.de/'),
    minIntervalSec: 3600,
    keyless: true,
  },

  // ── Vulnerability databases ──────────────────────────────────────────────
  {
    key: 'nvd_recent',
    // Named for what the window actually asks: `lastModStartDate` returns a CVE
    // whose analysis changed yesterday as readily as one first published then,
    // and calling that "recently published" would be the same kind of quiet
    // inaccuracy the window was added to fix.
    name: 'NVD — CVEs published or revised in the last two days',
    publisher: 'NIST National Vulnerability Database',
    url: 'https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=50',
    /**
     * NVD returns its catalogue from the beginning when no date range is given,
     * so the address above — entered once and never re-read — delivered
     * **CVE-1999-0095** every hour under the name "recently published CVEs".
     * The window asks for what actually changed in the last two days.
     *
     * `lastModStartDate` rather than `pubStartDate` on purpose: a CVE whose
     * severity was revised yesterday is news to a defender even though it was
     * published last year, and the reverse — a CVE published with no analysis
     * yet — is not yet actionable. The API caps a range at 120 days; two is far
     * inside that and still wide enough to survive a day of failed runs.
     */
    urlFor: (now) => {
      const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, '.000')
      const from = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
      return (
        'https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=50' +
        `&lastModStartDate=${iso(from)}&lastModEndDate=${iso(now)}`
      )
    },
    kind: 'json',
    path: 'vulnerabilities',
    discipline: 'cyber',
    topics: ['vulnerability'],
    coverage: 'global',
    admiralty: 'A',
    licence: PUBLIC_DOMAIN,
    minIntervalSec: 3600,
    keyless: true,
    /**
     * The identifier alone is not a headline — "CVE-2026-1234" tells a reader
     * nothing they can act on. NVD carries the English description in the first
     * entry of `cve.descriptions`, so the row says what the flaw is and keeps
     * the identifier in front of it for anyone looking it up.
     */
    map: {
      titleTemplate: '{cve.id} — {cve.descriptions.0.value}',
      title: 'cve.id',
      time: 'cve.lastModified',
    },
  },
  {
    key: 'osv_dev',
    name: 'OSV — open-source vulnerabilities',
    publisher: 'Open Source Vulnerabilities (Google / OpenSSF)',
    url: 'https://api.osv.dev/v1/query',
    kind: 'json',
    path: 'vulns',
    discipline: 'cyber',
    topics: ['vulnerability'],
    coverage: 'global',
    admiralty: 'A',
    licence: ccBy('OSV.dev', 'https://osv.dev/'),
    minIntervalSec: 3600,
    keyless: true,
    enabled: false,
    note: 'Query-driven rather than a feed; enabled by the dependency gateway, not the sweep.',
  },
  {
    key: 'github_advisories',
    name: 'GitHub Security Advisories',
    publisher: 'GitHub',
    url: 'https://github.com/advisories.atom',
    kind: 'atom',
    discipline: 'cyber',
    topics: ['vulnerability'],
    coverage: 'global',
    admiralty: 'B',
    licence: publicFeed('GitHub Security Advisories', 'https://docs.github.com/site-policy'),
    minIntervalSec: 3600,
    keyless: true,
  },

  // ── Malicious infrastructure ─────────────────────────────────────────────
  {
    key: 'urlhaus_recent',
    name: 'URLhaus — recent malicious URLs',
    publisher: 'abuse.ch',
    url: 'https://urlhaus.abuse.ch/downloads/rss/',
    kind: 'rss',
    discipline: 'cyber',
    topics: ['malware'],
    coverage: 'global',
    admiralty: 'B',
    independence: 'abuse-ch',
    licence: ABUSE_CH,
    minIntervalSec: 1800,
    keyless: true,
  },
  {
    key: 'feodo_tracker',
    name: 'Feodo Tracker — botnet C2',
    publisher: 'abuse.ch',
    url: 'https://feodotracker.abuse.ch/downloads/ipblocklist.json',
    kind: 'json',
    discipline: 'cyber',
    topics: ['malware'],
    coverage: 'global',
    admiralty: 'B',
    independence: 'abuse-ch',
    licence: ABUSE_CH,
    minIntervalSec: 3600,
    keyless: true,
    map: { title: 'malware', time: 'first_seen' },
  },

  // ── Vendor advisories (about their own products) ─────────────────────────
  {
    key: 'microsoft_msrc',
    name: 'Microsoft Security Response Center',
    publisher: 'Microsoft',
    url: 'https://api.msrc.microsoft.com/update-guide/rss',
    kind: 'rss',
    discipline: 'cyber',
    topics: ['vulnerability', 'cyber-advisory'],
    coverage: 'global',
    // A about Microsoft products — nobody is better placed. Not a general A.
    admiralty: 'A',
    licence: publicFeed('Microsoft MSRC', 'https://www.microsoft.com/legal'),
    minIntervalSec: 3600,
    keyless: true,
  },
  {
    key: 'ubuntu_usn',
    name: 'Ubuntu Security Notices',
    publisher: 'Canonical',
    url: 'https://ubuntu.com/security/notices/rss.xml',
    kind: 'rss',
    discipline: 'cyber',
    topics: ['vulnerability'],
    coverage: 'global',
    admiralty: 'A',
    licence: publicFeed('Canonical', 'https://ubuntu.com/legal'),
    minIntervalSec: 3600,
    keyless: true,
  },
  {
    key: 'redhat_security',
    name: 'Red Hat security advisories',
    publisher: 'Red Hat',
    url: 'https://access.redhat.com/blogs/product-security/feed',
    kind: 'rss',
    discipline: 'cyber',
    topics: ['vulnerability'],
    coverage: 'global',
    admiralty: 'A',
    licence: publicFeed('Red Hat', 'https://www.redhat.com/en/about/terms-use'),
    minIntervalSec: 7200,
    keyless: true,
  },

  // ── Security reporting (interested parties — graded accordingly) ─────────
  {
    key: 'krebs',
    name: 'Krebs on Security',
    publisher: 'Brian Krebs',
    url: 'https://krebsonsecurity.com/feed/',
    kind: 'rss',
    discipline: 'cyber',
    topics: ['cyber-advisory', 'news'],
    coverage: 'global',
    admiralty: 'B',
    licence: publicFeed('Krebs on Security', 'https://krebsonsecurity.com/'),
    minIntervalSec: 7200,
    keyless: true,
  },
  {
    key: 'bleepingcomputer',
    name: 'BleepingComputer',
    publisher: 'BleepingComputer',
    url: 'https://www.bleepingcomputer.com/feed/',
    kind: 'rss',
    discipline: 'cyber',
    topics: ['cyber-advisory', 'news'],
    coverage: 'global',
    admiralty: 'C',
    licence: publicFeed('BleepingComputer', 'https://www.bleepingcomputer.com/'),
    minIntervalSec: 3600,
    keyless: true,
  },
  {
    key: 'thehackernews',
    name: 'The Hacker News',
    publisher: 'The Hacker News',
    url: 'https://feeds.feedburner.com/TheHackersNews',
    kind: 'rss',
    discipline: 'cyber',
    topics: ['cyber-advisory', 'news'],
    coverage: 'global',
    admiralty: 'C',
    licence: publicFeed('The Hacker News', 'https://thehackernews.com/'),
    minIntervalSec: 3600,
    keyless: true,
  },
  {
    key: 'sans_isc',
    name: 'SANS Internet Storm Center diaries',
    publisher: 'SANS Institute',
    url: 'https://isc.sans.edu/rssfeed_full.xml',
    kind: 'rss',
    discipline: 'cyber',
    topics: ['cyber-advisory', 'malware'],
    coverage: 'global',
    admiralty: 'B',
    licence: publicFeed('SANS Internet Storm Center', 'https://isc.sans.edu/'),
    minIntervalSec: 3600,
    keyless: true,
  },
  {
    key: 'project_zero',
    name: 'Google Project Zero',
    publisher: 'Google',
    url: 'https://googleprojectzero.blogspot.com/feeds/posts/default',
    kind: 'atom',
    discipline: 'cyber',
    topics: ['vulnerability'],
    coverage: 'global',
    admiralty: 'A',
    licence: publicFeed('Google Project Zero', 'https://googleprojectzero.blogspot.com/'),
    minIntervalSec: 21600,
    keyless: true,
  },
]

import type { CatalogSource } from '../types'
import { publicFeed } from '../licence'

/**
 * Fact-checking publishers — the claim record.
 *
 * ## The gap this closes
 *
 * `docs/OSINT_REFERENCE.md` §2.13 makes verification a discipline in its own
 * right, and the platform served exactly half of it. `lib/modules/media.ts`
 * verifies an **artefact** — an image's EXIF, its reverse-image trail, whether
 * it carries the fingerprints of generation. Nothing anywhere could tell a
 * reader whether the **claim** in front of them had already been checked and
 * found false, which is the half a reader actually asks for first.
 *
 * ## Why these five, and why all of them are C
 *
 * Every entry is an IFCN-signatory newsroom publishing its own checking work.
 * That earns a **C** — a reputable outlet reporting others' work — and not a
 * B, because a fact-check is a *conclusion about* evidence rather than the
 * evidence. The primary document a checker cites always outranks the check
 * itself, and the gateway is built so a reader can reach that document.
 *
 * ## Independence is the whole value here
 *
 * Five checkers agreeing is worth something only if they are five origins. They
 * are: five separate newsrooms, five owners, five countries of primary focus
 * (US, UK, US, US, US/international). So the gateway can honestly report *how
 * many independent checkers have addressed a subject*, which is a corroboration
 * reading rather than a headline count — and it is the thing this gateway does
 * that a list of links cannot.
 *
 * What that number is **not**: a verdict. Three checkers addressing a claim is
 * not three confirmations of any particular answer, and the gateway never
 * collapses them into one.
 *
 * ## Why `enabled: false`
 *
 * Driven by the verification gateway rather than by the ambient sweep, exactly
 * as the crypto publishers are. A fact-check has no coordinates, so letting it
 * into the world-events sweep would put claims on a map that cannot place them.
 * The gateway reads this list directly through `byTopic('factcheck')`, keeping
 * one list with two consumers instead of two lists that drift.
 */
export const FACTCHECK_SOURCES: CatalogSource[] = [
  {
    key: 'snopes',
    name: 'Snopes',
    publisher: 'Snopes Media Group',
    url: 'https://www.snopes.com/feed/',
    kind: 'rss',
    discipline: 'osint',
    topics: ['factcheck', 'news'],
    coverage: 'global',
    admiralty: 'C',
    independence: 'snopes',
    licence: publicFeed('Snopes', 'https://www.snopes.com/terms-of-use/'),
    minIntervalSec: 1800,
    keyless: true,
    enabled: false,
    note: 'The oldest continuously operating fact-checking outlet. Its verdict lives on the page rather than in the feed, and the gateway says so rather than guessing one.',
  },
  {
    key: 'fullfact',
    name: 'Full Fact',
    publisher: 'Full Fact (UK charity)',
    url: 'https://fullfact.org/feed/all/',
    kind: 'rss',
    discipline: 'osint',
    topics: ['factcheck', 'news'],
    coverage: 'global',
    admiralty: 'C',
    independence: 'fullfact',
    licence: publicFeed('Full Fact', 'https://fullfact.org/about/legal/'),
    minIntervalSec: 1800,
    keyless: true,
    enabled: false,
    note: 'A registered charity rather than a commercial newsroom, and the only non-US primary focus in this set — which is why it carries real weight in the independence count.',
  },
  {
    key: 'politifact',
    name: 'PolitiFact',
    publisher: 'Poynter Institute',
    url: 'https://www.politifact.com/rss/factchecks/',
    kind: 'rss',
    discipline: 'osint',
    topics: ['factcheck', 'news'],
    coverage: 'global',
    admiralty: 'C',
    independence: 'politifact',
    licence: publicFeed('PolitiFact', 'https://www.politifact.com/terms-of-use/'),
    minIntervalSec: 1800,
    keyless: true,
    enabled: false,
    note: 'Its feed begins with stray whitespace before the XML declaration, which defeats a strict parser. Ours reads feeds by pattern rather than by tree, so it survives — noted because it is the kind of thing that silently drops a publisher.',
  },
  {
    key: 'factcheck_org',
    name: 'FactCheck.org',
    publisher: 'Annenberg Public Policy Center, University of Pennsylvania',
    url: 'https://www.factcheck.org/feed/',
    kind: 'rss',
    discipline: 'osint',
    topics: ['factcheck', 'news'],
    coverage: 'global',
    admiralty: 'C',
    independence: 'factcheck-org',
    licence: publicFeed('FactCheck.org', 'https://www.factcheck.org/terms-of-use/'),
    minIntervalSec: 1800,
    keyless: true,
    enabled: false,
    note: 'University-based rather than commercial. Its feed carries reference material alongside checks, which the gateway separates.',
  },
  {
    key: 'lead_stories',
    name: 'Lead Stories',
    publisher: 'Lead Stories LLC',
    url: 'https://leadstories.com/atom.xml',
    kind: 'atom',
    discipline: 'osint',
    topics: ['factcheck', 'news'],
    coverage: 'global',
    admiralty: 'C',
    independence: 'lead-stories',
    licence: publicFeed('Lead Stories', 'https://leadstories.com/terms-of-service.html'),
    minIntervalSec: 1800,
    keyless: true,
    enabled: false,
    note: 'The one publisher here that encodes its finding in the title, after a double dash — so it is the only one whose verdict can be recovered from the feed without opening the page.',
  },
]

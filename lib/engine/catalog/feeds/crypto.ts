import type { CatalogSource } from '../types'
import { publicFeed } from '../licence'

/**
 * Crypto and blockchain publishers.
 *
 * ## Why this file did not exist, and why that was a hole
 *
 * The platform could already read the *chains* — Bitcoin's mempool, Ethereum
 * and Solana over JSON-RPC, Pi Network's own Horizon — and it could read the
 * *prices*. It could not read a single word anybody said about any of it. A
 * reader asking what happened to a network this week got a block height, which
 * is a measurement, not an answer.
 *
 * ## The ordering, which is the whole argument
 *
 * The first four entries are the networks **publishing about themselves**.
 * When the Ethereum Foundation announces a fork, the Foundation is the record
 * and every article about it is a report of the record. That is an A: an
 * official body publishing its own material within its own remit. It is also
 * the reason this file leads with them rather than with the press — an
 * announcement read from its source and an announcement read from a headline
 * are different evidence, and the catalogue is where that difference is stated
 * rather than assumed.
 *
 * Bitcoin has no foundation that speaks for it, which is a property of Bitcoin
 * and not a gap in this list. The closest thing to a primary technical record
 * is **Bitcoin Optech**, whose newsletter summarises what actually landed in
 * the protocol and its implementations, with citations, written by the people
 * doing the work. It is graded B rather than A: an established body reporting
 * within its remit, not the protocol itself, because no such thing exists.
 *
 * The last three are the specialist press. They are graded C — reputable
 * outlets reporting other people's work — and they earn their place by covering
 * the half the networks never publish about themselves: enforcement, failures,
 * bankruptcies and the regulators. A network's own blog will not tell you the
 * network is being sued.
 *
 * ## Independence, and the trap this sector sets
 *
 * Crypto coverage is unusually incestuous: the same funding rounds, exchanges
 * and foundations recur as both subject and sponsor. So the three press
 * entries are their own groups (separate newsrooms, separate owners) but none
 * of them is independent of the networks they cover in the way a wire service
 * is independent of a government. Corroboration between two of these is worth
 * less than corroboration between one of them and a chain reading, and that is
 * a judgement the rating carries rather than something a score smooths over.
 *
 * ## Why every record here is `enabled: false`
 *
 * These are not disabled — they are **driven by the crypto gateway** rather
 * than by the ambient sweep, exactly as `mempool_space` already is. Crypto news
 * has no coordinates, so letting it into the world-events sweep would put
 * headlines on a map that cannot place them. The gateway reads this list
 * directly (`byTopic('crypto')`), which keeps one list with two consumers
 * instead of two lists that drift apart.
 */
export const CRYPTO_SOURCES: CatalogSource[] = [
  // ── The networks, publishing about themselves ────────────────────────────
  {
    key: 'pi_network_blog',
    name: 'Pi Network — official announcements',
    publisher: 'Pi Core Team',
    url: 'https://minepi.com/blog/feed/',
    kind: 'rss',
    discipline: 'fin',
    topics: ['crypto', 'official'],
    coverage: 'global',
    // The Core Team announcing the Core Team's own decisions. Nothing is closer
    // to the record than the body that made it.
    admiralty: 'A',
    independence: 'pi-core-team',
    licence: publicFeed('Pi Core Team', 'https://minepi.com/terms-of-service/'),
    minIntervalSec: 1800,
    keyless: true,
    enabled: false,
    note: 'Driven by the crypto gateway. This is the primary record for the network this product also runs inside.',
  },
  {
    key: 'ethereum_foundation_blog',
    name: 'Ethereum Foundation — protocol and research',
    publisher: 'Ethereum Foundation',
    url: 'https://blog.ethereum.org/en/feed.xml',
    kind: 'rss',
    discipline: 'fin',
    topics: ['crypto', 'official'],
    coverage: 'global',
    admiralty: 'A',
    independence: 'ethereum-foundation',
    licence: publicFeed('Ethereum Foundation', 'https://ethereum.org/en/terms-of-use/'),
    minIntervalSec: 1800,
    keyless: true,
    enabled: false,
    note: 'Upgrade announcements, security disclosures and funding allocations, from the body that ships them.',
  },
  {
    key: 'solana_news',
    name: 'Solana — network news',
    publisher: 'Solana Foundation',
    url: 'https://solana.com/news/rss.xml',
    kind: 'rss',
    discipline: 'fin',
    topics: ['crypto', 'official'],
    coverage: 'global',
    admiralty: 'A',
    independence: 'solana-foundation',
    licence: publicFeed('Solana Foundation', 'https://solana.com/tos'),
    minIntervalSec: 1800,
    keyless: true,
    enabled: false,
  },
  {
    key: 'bitcoin_optech',
    name: 'Bitcoin Optech — protocol and implementation newsletter',
    publisher: 'Bitcoin Optech',
    url: 'https://bitcoinops.org/feed.xml',
    kind: 'rss',
    discipline: 'fin',
    topics: ['crypto'],
    coverage: 'global',
    // B, not A, and the distinction is deliberate: Bitcoin has no foundation
    // that speaks for it, so the nearest primary record is a technical
    // newsletter written by contributors — an established body reporting
    // within its remit, which is exactly what B means.
    admiralty: 'B',
    independence: 'bitcoin-optech',
    licence: publicFeed('Bitcoin Optech', 'https://bitcoinops.org/'),
    minIntervalSec: 3600,
    keyless: true,
    enabled: false,
    note: 'What actually landed in the protocol and its implementations, with citations. The closest thing Bitcoin has to an official changelog.',
  },

  // ── The specialist press — the half the networks do not publish ──────────
  {
    key: 'coindesk',
    name: 'CoinDesk',
    publisher: 'CoinDesk',
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss',
    kind: 'rss',
    discipline: 'osint',
    topics: ['crypto', 'markets'],
    coverage: 'global',
    admiralty: 'C',
    independence: 'coindesk',
    licence: publicFeed('CoinDesk', 'https://www.coindesk.com/terms-of-use'),
    minIntervalSec: 900,
    keyless: true,
    enabled: false,
  },
  {
    key: 'cointelegraph',
    name: 'Cointelegraph',
    publisher: 'Cointelegraph',
    url: 'https://cointelegraph.com/rss',
    kind: 'rss',
    discipline: 'osint',
    topics: ['crypto', 'markets'],
    coverage: 'global',
    admiralty: 'C',
    independence: 'cointelegraph',
    licence: publicFeed('Cointelegraph', 'https://cointelegraph.com/terms-and-privacy'),
    minIntervalSec: 900,
    keyless: true,
    enabled: false,
  },
  {
    key: 'bitcoin_magazine',
    name: 'Bitcoin Magazine',
    publisher: 'Bitcoin Magazine',
    url: 'https://bitcoinmagazine.com/feed',
    kind: 'rss',
    discipline: 'osint',
    topics: ['crypto'],
    coverage: 'global',
    // An outlet with a declared position on its own subject. That does not make
    // it unreliable, and it does make it a C rather than a B: §2a's discipline
    // about who is counting applies to who is reporting too.
    admiralty: 'C',
    independence: 'bitcoin-magazine',
    licence: publicFeed('Bitcoin Magazine', 'https://bitcoinmagazine.com/terms-of-use'),
    minIntervalSec: 1800,
    keyless: true,
    enabled: false,
  },
]

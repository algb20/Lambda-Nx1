import type { MetadataRoute } from 'next'
import { TABS } from '@/lib/navigation'

/**
 * The sitemap.
 *
 * Worth having only because the tabs became real addresses in the same change.
 * Before that there was exactly one URL to declare, and a sitemap listing one
 * page is a file that costs a request and says nothing.
 *
 * The base URL comes from the environment because this codebase deploys to more
 * than one host by design (charter §4: no lock-in). A hard-coded domain would
 * make every preview deployment advertise the production one, which is both
 * wrong and the kind of error nobody notices for months.
 */
function baseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.URL ?? // Netlify
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
    'https://lambdanx.netlify.app'
  return raw.replace(/\/+$/, '')
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = baseUrl()
  const now = new Date()

  return [
    { url: base, lastModified: now, changeFrequency: 'hourly', priority: 1 },
    // `feed` is the root above; listing it again under /feed would give one
    // screen two addresses and split every signal between them.
    ...TABS.filter((t) => t !== 'feed').map((tab) => ({
      url: `${base}/${tab}`,
      lastModified: now,
      // The globe and the gateways change with the world; the account screen
      // does not. Declaring one frequency for all four would be a guess that
      // wastes crawl budget on the static one and under-crawls the live ones.
      changeFrequency: (tab === 'account' ? 'monthly' : 'hourly') as 'monthly' | 'hourly',
      priority: tab === 'account' ? 0.3 : 0.8,
    })),
    // Higher priority than the legal pages and lower than the live boards:
    // these are what someone evaluating the product actually looks for, and
    // they are the two pages every comparable platform publishes.
    { url: `${base}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/docs/api`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ]
}

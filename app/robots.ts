import type { MetadataRoute } from 'next'

/**
 * What a crawler may read.
 *
 * The rules mirror what the middleware already enforces, on the principle that
 * a robots file and an access control that disagree is a bug waiting to be
 * found by the wrong party. `robots.txt` is a request, not a control — the
 * admin routes are protected because they check a secret, not because this file
 * asks politely — but a crawler that ignores it should find nothing anyway, and
 * a well-behaved one should not waste its budget discovering that.
 *
 * The API is disallowed for a different reason: those routes answer JSON, they
 * are expensive (a `/api/world` request sweeps every feed), and an indexed JSON
 * document helps nobody who is searching.
 */
function baseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
    'https://lambdanx.netlify.app'
  return raw.replace(/\/+$/, '')
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          // `/llms.txt` and `/pricing.md` are deliberately NOT disallowed:
          // they exist to be read by machines, and blocking them would defeat
          // the only reason they were written.
          '/api/', // JSON, expensive to serve, useless in an index
          '/admin/', // secret-gated; no reason to advertise the path
          '/p/', // per-investigation permalinks: shareable, not for indexing
        ],
      },
    ],
    sitemap: `${baseUrl()}/sitemap.xml`,
  }
}

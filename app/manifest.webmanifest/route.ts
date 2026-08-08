import { NextResponse } from 'next/server'

/**
 * The web app manifest, so Lambda installs to a home screen as an app rather
 * than a bookmark — the green λ icon, the platform's own colours, and no browser
 * chrome. Served from a route rather than a static file so the values stay
 * beside the rest of the app's configuration.
 */
export const runtime = 'nodejs'

export function GET() {
  return NextResponse.json(
    {
      name: 'Lambda — Open-Source Intelligence',
      short_name: 'Lambda',
      description:
        'Passive, lawful, public-source intelligence. Every finding carries its source, timestamp and confidence grade.',
      start_url: '/',
      display: 'standalone',
      // Matches the icon's backdrop and the world surface's ocean, so the splash
      // and the icon are the same object rather than two different ones.
      background_color: '#04090f',
      theme_color: '#0b1f33',
      icons: [
        { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        { src: '/icon-32x32.png', sizes: '32x32', type: 'image/png' },
        { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json' } },
  )
}

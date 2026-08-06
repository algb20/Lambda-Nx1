/** @type {import('next').NextConfig} */

// Security headers applied to every response, on every host (Netlify, Vercel,
// self-host) — portable defense-in-depth, not tied to one platform's config.
// Passive-only product: we never frame third parties and are never framed; the
// browser talks only to our own origin (API routes fan out to sources
// server-side) plus the Pi SDK/API when running inside Pi Browser.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=(), payment=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "img-src 'self' data: blob:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://sdk.minepi.com",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' https://api.minepi.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Charter: no errors. Type errors fail the build. (tsc is currently clean.)
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // The readiness probe must never be cached by a CDN or browser.
      { source: '/api/health', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ]
  },
}

export default nextConfig

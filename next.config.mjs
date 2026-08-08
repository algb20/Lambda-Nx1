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
  /**
   * Stamp the build with its own identity, so the running app can say which
   * commit it came from and when. Answering "is the live link the latest work?"
   * used to mean comparing git against a hosting dashboard by hand; a value
   * baked into a build describes that build by construction and cannot go stale.
   *
   * Each host names its git variables differently, so all three are read and
   * re-exported under one public name that reaches the browser bundle.
   */
  env: {
    NEXT_PUBLIC_COMMIT_SHA:
      process.env.COMMIT_REF ?? process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? '',
    NEXT_PUBLIC_COMMIT_BRANCH:
      process.env.BRANCH ?? process.env.VERCEL_GIT_COMMIT_REF ?? '',
    NEXT_PUBLIC_BUILT_AT: new Date().toISOString(),
    NEXT_PUBLIC_REPO_URL: process.env.REPOSITORY_URL ?? 'https://github.com/algb20/Lambda-Nx1',
  },
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

/** @type {import('next').NextConfig} */
import { readFileSync } from 'node:fs'
import { securityHeaders } from './lib/security/csp.mjs'

/**
 * The app's own version, read from package.json at build time.
 *
 * The health report used to fall back to `0.0.0`, because it read
 * `npm_package_version` — a variable npm sets for a script it is *running*, and
 * a production server started by a host is not that. So the readiness probe,
 * whose entire job is to report the truth about the deployment, reported a
 * version that never existed. Baking it in makes it correct by construction.
 */
const packageVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
  .version

/**
 * The policy itself lives in `lib/security/csp.mjs` so it can be imported and
 * asserted by a test. A CSP is product behaviour — it decides whether the Pi SDK
 * loads and whether a translated page keeps its styling — and behaviour that
 * only exists as a string in a config file is behaviour nothing can verify.
 *
 * The toolbar allowance is widened only when the build runs on Vercel, so a
 * Netlify or self-hosted deploy keeps the tighter policy.
 */
const headerSet = securityHeaders({ onVercel: Boolean(process.env.VERCEL) })

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
    /*
      The build time deliberately does *not* live here.

      This file is evaluated once per process, so `new Date()` here runs again
      on `next start` and on every serverless cold start: the browser bundle
      carried the build's time and the server carried its own boot time. That
      made the stamp wrong — it answered "when did this server start", which is
      the opposite of the question — and it made the two sides of every page
      disagree on a piece of text, which is React error #418 on every page
      carrying the footer.

      It is generated into `lib/build-stamp.ts` instead, where the compiler
      inlines the same characters into both bundles.
    */
    NEXT_PUBLIC_APP_VERSION: packageVersion,
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
      { source: '/:path*', headers: headerSet },
      // The readiness probe must never be cached by a CDN or browser.
      { source: '/api/health', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ]
  },
}

export default nextConfig

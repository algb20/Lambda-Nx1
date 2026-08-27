import path from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * The browser suite, kept out of the fast one on purpose.
 *
 * These tests need a production build and a running server — thirty seconds
 * before the first assertion — and they drive a real Chromium. Folding that
 * into `npm test` would make the suite people run constantly into one they run
 * occasionally, which costs far more than it buys.
 *
 * The file extension is the separation: `*.browser.ts` here, `*.test.ts` in the
 * default config, so neither can pick up the other by accident.
 *
 * Run with `npm run test:ui`, which builds, serves, tests and stops the server.
 */
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(process.cwd()) },
  },
  test: {
    environment: 'node',
    include: ['tests/browser/**/*.browser.ts'],
    exclude: ['node_modules', '.next'],
    // One browser, one server, one page at a time: these tests contend for a
    // single Chromium and a single Next server, and running them in parallel
    // makes the timings they assert on meaningless.
    fileParallelism: false,
    testTimeout: 600_000,
    hookTimeout: 60_000,
  },
})

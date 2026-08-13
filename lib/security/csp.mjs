/**
 * Content Security Policy — built as a function so it can be tested.
 *
 * A CSP that blocks something the product needs is not "more secure"; it is a
 * broken feature with a console error attached. The first version of this policy
 * allowed only the Pi SDK, and two real capabilities died silently in the
 * browser: page translation (the browser injects its translate stylesheet and
 * fonts from gstatic) and, on Vercel, the platform's own toolbar. Nothing in the
 * test suite could have caught it, because the policy was a string in a config
 * file that nothing imported.
 *
 * So the policy is derived from what the app actually loads, every entry names
 * why it is there, and `lib/security/csp.test.ts` asserts the ones the product
 * depends on. Everything not listed stays blocked — the point of the header —
 * and no third party may ever frame us.
 *
 * Written as `.mjs` because `next.config.mjs` has to import it directly, before
 * any TypeScript or bundler alias exists.
 */

/** The Pi Network SDK: its script, the frame it opens, and the API it calls. */
export const PI_HOSTS = {
  script: ['https://sdk.minepi.com', 'https://app-cdn.minepi.com'],
  frame: ['https://sdk.minepi.com', 'https://app-cdn.minepi.com'],
  connect: ['https://api.minepi.com'],
}

/**
 * The Google hosts a *translating browser* pulls its own UI assets from. Our
 * translator runs server-side and needs none of these; the reader's browser
 * does, and without them the translated page loses its styling.
 */
export const TRANSLATE_HOSTS = [
  'https://www.gstatic.com',
  'https://fonts.gstatic.com',
  'https://translate.googleapis.com',
]

/** Vercel's collaboration toolbar, which the platform injects into the page. */
export const VERCEL_TOOLBAR = {
  script: ['https://vercel.live'],
  style: ['https://vercel.live'],
  font: ['https://vercel.live', 'https://assets.vercel.com'],
  img: ['https://vercel.live', 'https://vercel.com'],
  connect: ['https://vercel.live', 'https://*.pusher.com', 'wss://*.pusher.com'],
  frame: ['https://vercel.live'],
}

/**
 * @param {{ onVercel?: boolean }} [options]
 *   `onVercel` widens the policy for the platform toolbar only on Vercel, so a
 *   Netlify or self-hosted deploy keeps the tighter policy.
 * @returns {string} the header value
 */
export function buildContentSecurityPolicy(options = {}) {
  const onVercel = Boolean(options.onVercel)
  /** @param {keyof typeof VERCEL_TOOLBAR} key */
  const vercel = (key) => (onVercel ? VERCEL_TOOLBAR[key] : [])

  /** @type {Array<[string, string[]]>} */
  const directives = [
    ['default-src', ["'self'"]],
    // `blob:` covers canvas exports — the globe and watermarked frames.
    ['img-src', ["'self'", 'data:', 'blob:', ...TRANSLATE_HOSTS, ...vercel('img')]],
    [
      'script-src',
      [
        "'self'",
        // Next.js inlines its hydration bootstrap, and the Pi SDK evaluates.
        "'unsafe-inline'",
        "'unsafe-eval'",
        ...PI_HOSTS.script,
        ...vercel('script'),
      ],
    ],
    ['style-src', ["'self'", "'unsafe-inline'", ...TRANSLATE_HOSTS, ...vercel('style')]],
    ['font-src', ["'self'", 'data:', ...TRANSLATE_HOSTS, ...vercel('font')]],
    [
      'connect-src',
      ["'self'", ...PI_HOSTS.connect, ...TRANSLATE_HOSTS, ...vercel('connect')],
    ],
    // The Pi SDK opens its approval flow in a frame; nothing else may.
    ['frame-src', ["'self'", ...PI_HOSTS.frame, ...vercel('frame')]],
    ['worker-src', ["'self'", 'blob:']],
    // We are never framed, and we load no plugins.
    ['frame-ancestors', ["'none'"]],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
  ]

  return directives.map(([name, values]) => `${name} ${values.join(' ')}`).join('; ')
}

/**
 * Every security header we set, on every host — portable defence in depth rather
 * than one platform's config file.
 *
 * @param {{ onVercel?: boolean }} [options]
 * @returns {Array<{ key: string, value: string }>}
 */
export function securityHeaders(options = {}) {
  return [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-DNS-Prefetch-Control', value: 'off' },
    { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=(), payment=()' },
    { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
    { key: 'Content-Security-Policy', value: buildContentSecurityPolicy(options) },
  ]
}

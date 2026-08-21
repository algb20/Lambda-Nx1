/**
 * Measures every page at every width a real person uses, and reports what
 * does not fit. Horizontal overflow is the failure that matters: it is the
 * one a reader cannot work around.
 */
import { chromium } from 'playwright-core'
import { writeFileSync } from 'node:fs'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3000'
const EXEC = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

const WIDTHS = [
  { name: 'phone-small', width: 320, height: 640 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'tablet-land', width: 1024, height: 768 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'desktop', width: 1920, height: 1080 },
]

const PAGES = [
  '/', '/globe', '/markets', '/intelligence', '/monitor', '/account',
  '/pricing', '/privacy', '/terms', '/docs/api',
]

const findings = []

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] })

for (const vp of WIDTHS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    isMobile: vp.width < 768,
    hasTouch: vp.width < 768,
  })
  const page = await ctx.newPage()
  /**
   * A page that threw has no overflow either.
   *
   * The first version of this script reported a crashed globe as "ok" at every
   * width, because it only measured geometry and a blank page is perfectly
   * within its viewport. Anything that fails to render is now the loudest
   * finding here, not the quietest.
   */
  let broke = []
  page.on('pageerror', (err) => broke.push(String(err.message).slice(0, 160)))
  page.on('response', (res) => {
    if (res.status() >= 400 && new URL(res.url()).pathname.startsWith('/_next/')) {
      broke.push(`${res.status()} ${new URL(res.url()).pathname}`)
    }
  })
  for (const path of PAGES) {
    try {
      broke = []
      await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(2500)
      const result = await page.evaluate((viewportWidth) => {
        const doc = document.documentElement
        const overflow = doc.scrollWidth - viewportWidth
        const culprits = []
        if (overflow > 1) {
          for (const el of document.querySelectorAll('body *')) {
            const r = el.getBoundingClientRect()
            if (r.width === 0 || r.height === 0) continue
            const style = getComputedStyle(el)
            if (style.position === 'fixed') continue
            if (r.right > viewportWidth + 1 || r.left < -1) {
              culprits.push({
                tag: el.tagName.toLowerCase(),
                cls: (el.getAttribute('class') ?? '').slice(0, 110),
                left: Math.round(r.left),
                right: Math.round(r.right),
                width: Math.round(r.width),
                text: (el.textContent ?? '').trim().slice(0, 50),
              })
            }
          }
        }
        // Touch targets a finger has to hit.
        const small = []
        for (const el of document.querySelectorAll('button, a[href], [role="button"], input, select')) {
          const r = el.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) continue
          if (r.height < 32 || r.width < 24) {
            small.push({
              tag: el.tagName.toLowerCase(),
              h: Math.round(r.height),
              w: Math.round(r.width),
              text: (el.textContent ?? '').trim().slice(0, 40),
              cls: (el.getAttribute('class') ?? '').slice(0, 80),
            })
          }
        }
        return { overflow, culprits: culprits.slice(-14), small: small.slice(0, 10), smallCount: small.length }
      }, vp.width)
      findings.push({ viewport: vp.name, width: vp.width, path, broke: [...broke], ...result })
      const flag = broke.length
        ? `BROKEN ${broke[0]}`
        : result.overflow > 1
          ? `OVERFLOW +${result.overflow}px`
          : 'ok'
      console.log(`${vp.name.padEnd(12)} ${String(vp.width).padStart(4)}  ${path.padEnd(16)} ${flag}  small-targets:${result.smallCount}`)
    } catch (err) {
      console.log(`${vp.name.padEnd(12)} ${String(vp.width).padStart(4)}  ${path.padEnd(16)} ERROR ${err.message.slice(0, 80)}`)
      findings.push({ viewport: vp.name, width: vp.width, path, error: err.message })
    }
  }
  await ctx.close()
}

await browser.close()
writeFileSync(new URL('./responsive-findings.json', import.meta.url), JSON.stringify(findings, null, 2))
console.log('\n--- pages that overflow ---')
for (const f of findings.filter((f) => (f.overflow ?? 0) > 1)) {
  console.log(`\n${f.viewport} ${f.width}px ${f.path}  +${f.overflow}px`)
  for (const c of f.culprits) console.log(`   <${c.tag}> [${c.left}..${c.right}] w=${c.width} "${c.text}" .${c.cls}`)
}

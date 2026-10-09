import { chromium } from 'playwright-core'
const [,, url, out, w='1536', h='1024'] = process.argv
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: +w, height: +h }, colorScheme: 'dark' })
await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
await p.waitForTimeout(6000)
await p.screenshot({ path: out })
await b.close()

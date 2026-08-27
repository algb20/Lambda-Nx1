/**
 * Build, serve, run the browser suite, stop.
 *
 * The suite asserts on a *production* build, not `next dev`. The two differ in
 * exactly the ways that matter here — bundling, hydration timing, static versus
 * dynamic rendering — and a layout guarantee that only holds in development is
 * not a guarantee.
 *
 * A server already listening on the port is reused and left running, so an
 * iteration loop is one build away rather than one build and one boot.
 */
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const PORT = process.env.PORT ?? '3111'
const BASE = `http://127.0.0.1:${PORT}`

/** Run a command, inheriting stdio, and resolve with its exit code. */
function run(cmd, args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      env: { ...process.env, ...env },
      shell: false,
    })
    child.on('exit', (code) => resolve(code ?? 1))
  })
}

async function isUp() {
  try {
    const res = await fetch(BASE, { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}

/** Poll until the server answers, or give up with a clear message. */
async function waitForServer(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await isUp()) return true
    await sleep(1000)
  }
  return false
}

const alreadyRunning = await isUp()
let server = null

if (alreadyRunning) {
  console.log(`Reusing the server already listening on ${BASE}`)
} else {
  console.log('Building…')
  const built = await run('npx', ['next', 'build'])
  if (built !== 0) {
    console.error('Build failed — not running the browser suite against a stale build.')
    process.exit(built)
  }

  console.log(`Starting the server on ${PORT}…`)
  server = spawn('npx', ['next', 'start', '-p', PORT], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  })
  // Kept, not discarded: when the suite fails because the server did, this is
  // the only place that says why.
  const log = []
  server.stdout.on('data', (d) => log.push(String(d)))
  server.stderr.on('data', (d) => log.push(String(d)))

  if (!(await waitForServer())) {
    console.error(`The server never answered on ${BASE}. Its output:\n${log.join('')}`)
    server.kill('SIGTERM')
    process.exit(1)
  }
}

const code = await run('npx', ['vitest', 'run', '--config', 'vitest.browser.config.ts'], {
  BASE,
})

if (server) {
  server.kill('SIGTERM')
  // A SIGTERM Next does not honour would leave the port held for the next run.
  await sleep(500)
  if (!server.killed) server.kill('SIGKILL')
}

process.exit(code)

/**
 * Our own SMTP client.
 *
 * ## Why write one
 *
 * The product needs to send exactly two kinds of message — a verification code
 * and a password-reset code — and it must be able to send them from any host the
 * project is deployed to, under any mail provider the operator happens to have.
 *
 * Every mail provider in existence speaks SMTP. None of their HTTP APIs are the
 * same shape as another's. So SMTP *is* the portability layer (charter rule #4):
 * one `SMTP_URL` moves the product between Gmail, Amazon SES, Postmark, Brevo,
 * Mailgun, Fastmail or a self-hosted Postfix without touching a line of code.
 * An SDK for one of them would have been faster to write and would have bought
 * us a dependency, a lock-in, and a second thing to keep patched.
 *
 * ## What it implements
 *
 * The submission profile (RFC 6409) and nothing more: EHLO, optional STARTTLS
 * (RFC 3207), AUTH PLAIN / AUTH LOGIN (RFC 4954), MAIL FROM, RCPT TO, DATA,
 * QUIT. That is the whole of what sending an authenticated message requires.
 * It is not a mail *server*, it does not relay, it does not queue, and it
 * deliberately cannot receive.
 *
 * ## Transport is injected
 *
 * The conversation is written against a small duplex interface rather than
 * `node:net` directly, so every branch — a rejected recipient, a server that
 * refuses STARTTLS, a truncated greeting — is exercised by a test against a
 * scripted server instead of being hoped about. `nodeDuplex()` is the real
 * implementation and is the only part that touches a socket.
 */
import { connect as netConnect } from 'node:net'
import { connect as tlsConnect, type TLSSocket } from 'node:tls'
import type { Socket } from 'node:net'
import type { MailMessage, MailProvider, MailResult } from './types'

/** One SMTP reply: a status code and the text that came with it. */
export interface SmtpReply {
  code: number
  lines: string[]
}

/**
 * Split a buffer into the replies it completely contains, leaving any partial
 * reply behind.
 *
 * A reply is one or more lines; every line but the last carries a `-` after the
 * code (`250-SIZE` … `250 HELP`). Reading only the first line is the classic
 * bug: a server's EHLO answer is always multi-line, so a client that stops at
 * the first line reads the *second* line as the answer to its next command and
 * is one reply out of step for the rest of the session.
 */
export function parseReplies(buffer: string): { replies: SmtpReply[]; rest: string } {
  const replies: SmtpReply[] = []
  let lines: string[] = []
  let consumed = 0
  let index: number

  while ((index = buffer.indexOf('\r\n', consumed)) !== -1) {
    const line = buffer.slice(consumed, index)
    consumed = index + 2
    const match = /^(\d{3})([ -]?)(.*)$/.exec(line)
    if (!match) {
      // Not an SMTP status line. Keep it as continuation text rather than
      // discarding it — it is usually the useful half of an error.
      lines.push(line)
      continue
    }
    lines.push(match[3])
    if (match[2] !== '-') {
      replies.push({ code: Number(match[1]), lines })
      lines = []
    }
  }

  // A partial final reply stays in `rest`; so does a multi-line reply whose
  // terminating line has not arrived.
  const pending = lines.length ? lines.map((l) => `000-${l}`).join('\r\n') + '\r\n' : ''
  return { replies, rest: pending + buffer.slice(consumed) }
}

/** The socket surface the conversation needs. Real and fake both satisfy it. */
export interface SmtpDuplex {
  write(data: string): void
  onData(handler: (chunk: string) => void): void
  onError(handler: (error: Error) => void): void
  /** Wrap the live connection in TLS, for STARTTLS. */
  startTls(): Promise<void>
  close(): void
}

export class SmtpError extends Error {
  constructor(
    message: string,
    readonly code: number,
  ) {
    super(message)
    this.name = 'SmtpError'
  }
}

/**
 * A single SMTP session.
 *
 * Commands are strictly serialised: the protocol is a lockstep dialogue and
 * pipelining buys nothing for two messages a minute, while costing the ability
 * to attribute a failure to the command that caused it.
 */
export class SmtpSession {
  private buffer = ''
  private waiting: ((reply: SmtpReply) => void) | null = null
  private queue: SmtpReply[] = []
  private failure: Error | null = null

  constructor(
    private readonly duplex: SmtpDuplex,
    private readonly timeoutMs = 15_000,
  ) {
    duplex.onData((chunk) => {
      const { replies, rest } = parseReplies(this.buffer + chunk)
      this.buffer = rest
      for (const reply of replies) this.deliver(reply)
    })
    duplex.onError((error) => {
      this.failure = error
      // Unblock whoever is waiting, rather than letting them sit until timeout:
      // a connection reset is knowable immediately and should read as one.
      this.waiting?.({ code: 0, lines: [error.message] })
      this.waiting = null
    })
  }

  private deliver(reply: SmtpReply): void {
    if (this.waiting) {
      const resolve = this.waiting
      this.waiting = null
      resolve(reply)
    } else {
      this.queue.push(reply)
    }
  }

  /** Wait for the next reply the server sends. */
  read(): Promise<SmtpReply> {
    if (this.failure) return Promise.reject(this.failure)
    const queued = this.queue.shift()
    if (queued) return Promise.resolve(queued)
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiting = null
        reject(new SmtpError(`SMTP server did not answer within ${this.timeoutMs}ms`, 0))
      }, this.timeoutMs)
      this.waiting = (reply) => {
        clearTimeout(timer)
        if (this.failure) reject(this.failure)
        else resolve(reply)
      }
    })
  }

  /**
   * Send a command and require a status in `expected`.
   *
   * `secret` keeps a credential out of the error text. An SMTP failure is
   * routinely logged, and `AUTH LOGIN` sends the password as bare base64 —
   * echoing the failing command would put it in the log.
   */
  async command(line: string, expected: number[], secret = false): Promise<SmtpReply> {
    this.duplex.write(`${line}\r\n`)
    const reply = await this.read()
    if (!expected.includes(reply.code)) {
      const shown = secret ? '<credential>' : line
      throw new SmtpError(`SMTP ${shown} refused: ${reply.code} ${reply.lines.join(' ')}`, reply.code)
    }
    return reply
  }

  /** Send the message body, dot-stuffed and terminated. */
  async data(body: string): Promise<void> {
    await this.command('DATA', [354])
    this.duplex.write(`${dotStuff(body)}\r\n.\r\n`)
    const reply = await this.read()
    if (reply.code !== 250) {
      throw new SmtpError(`SMTP message rejected: ${reply.code} ${reply.lines.join(' ')}`, reply.code)
    }
  }

  async startTls(): Promise<void> {
    await this.command('STARTTLS', [220])
    await this.duplex.startTls()
  }

  close(): void {
    this.duplex.close()
  }
}

/**
 * A line consisting of a single dot ends the message, so a body line that
 * begins with one has to be escaped or the message is truncated there.
 * (RFC 5321 §4.5.2.) The line that does this in practice is a quoted `.` at the
 * start of a wrapped sentence, which is exactly the kind of thing that would
 * pass every test and then silently cut a real email in half.
 */
export function dotStuff(body: string): string {
  return body.replace(/\r\n\./g, '\r\n..').replace(/^\./, '..')
}

/**
 * Encode a header value that is not plain ASCII (RFC 2047).
 *
 * Needed because our subjects are shown in the reader's language, and an Arabic
 * subject sent raw arrives as mojibake in most clients.
 */
export function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (!/[^\x00-\x7F]/.test(value)) return value
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
}

/** Fold a base64 body to the 76-character limit SMTP lines must respect. */
function foldBase64(input: string): string {
  return (input.match(/.{1,76}/g) ?? []).join('\r\n')
}

/**
 * Build the RFC 5322 message.
 *
 * Base64 for the bodies rather than quoted-printable: our text is largely
 * Arabic, where quoted-printable encodes nearly every character into three
 * bytes and produces something unreadable in a raw log for no size saving.
 */
export function buildMessage(message: MailMessage, from: string, messageId: string): string {
  const boundary = `lambda-${messageId.replace(/[^A-Za-z0-9]/g, '')}`
  const headers = [
    `From: ${from}`,
    `To: ${message.to}`,
    `Subject: ${encodeHeader(message.subject)}`,
    `Message-ID: <${messageId}>`,
    `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
    'MIME-Version: 1.0',
    // Codes are transactional, and being auto-replied to by an out-of-office is
    // noise at best and a loop at worst.
    'Auto-Submitted: auto-generated',
  ]

  /**
   * Caller-supplied headers, refused rather than escaped when they contain a
   * line break.
   *
   * A CRLF inside a header value ends the header and starts another, which is
   * how an injected `Bcc:` gets added to a message somebody else composed. There
   * is no legitimate use for a newline here, so the safe handling is to drop the
   * header entirely rather than to sanitise it and carry on.
   */
  for (const [name, value] of Object.entries(message.headers ?? {})) {
    if (/[\r\n]/.test(name) || /[\r\n]/.test(value)) continue
    headers.push(`${name}: ${value}`)
  }

  if (!message.html) {
    headers.push('Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64')
    return `${headers.join('\r\n')}\r\n\r\n${foldBase64(Buffer.from(message.text, 'utf8').toString('base64'))}`
  }

  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)
  const parts = [
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    foldBase64(Buffer.from(message.text, 'utf8').toString('base64')),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    foldBase64(Buffer.from(message.html, 'utf8').toString('base64')),
    `--${boundary}--`,
  ]
  return `${headers.join('\r\n')}\r\n\r\n${parts.join('\r\n')}`
}

export interface SmtpConfig {
  host: string
  port: number
  user?: string
  pass?: string
  /** True for implicit TLS (port 465). Otherwise STARTTLS is used when offered. */
  implicitTls: boolean
  /** Envelope sender and From header. */
  from: string
}

/**
 * Parse `SMTP_URL`.
 *
 * `smtps://user:pass@smtp.example.com:465` — implicit TLS.
 * `smtp://user:pass@smtp.example.com:587` — STARTTLS.
 *
 * Credentials are percent-decoded, because mail providers issue passwords
 * containing `@` and `/` and a user who pastes one raw would otherwise get an
 * authentication failure with no clue why.
 */
export function parseSmtpUrl(raw: string, fallbackFrom?: string): SmtpConfig {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('SMTP_URL is not a valid URL (expected smtp://user:pass@host:587)')
  }
  const implicitTls = url.protocol === 'smtps:'
  if (!implicitTls && url.protocol !== 'smtp:') {
    throw new Error(`SMTP_URL scheme must be smtp: or smtps:, got ${url.protocol}`)
  }
  if (!url.hostname) throw new Error('SMTP_URL has no host')

  const user = url.username ? decodeURIComponent(url.username) : undefined
  const from = url.searchParams.get('from') ?? fallbackFrom ?? (user?.includes('@') ? user : '')
  if (!from) {
    throw new Error('No sender address: set MAIL_FROM, or add ?from= to SMTP_URL')
  }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : implicitTls ? 465 : 587,
    user,
    pass: url.password ? decodeURIComponent(url.password) : undefined,
    implicitTls,
    from,
  }
}

/** The real socket. The only part of this file that touches the network. */
export function nodeDuplex(config: SmtpConfig): { duplex: SmtpDuplex; ready: Promise<void> } {
  let socket: Socket | TLSSocket = config.implicitTls
    ? tlsConnect({ host: config.host, port: config.port, servername: config.host })
    : netConnect({ host: config.host, port: config.port })

  let dataHandler: (chunk: string) => void = () => {}
  let errorHandler: (error: Error) => void = () => {}

  const attach = (s: Socket | TLSSocket) => {
    s.setEncoding('utf8')
    s.on('data', (chunk: string) => dataHandler(chunk))
    s.on('error', (error: Error) => errorHandler(error))
  }
  attach(socket)

  const ready = new Promise<void>((resolve, reject) => {
    socket.once(config.implicitTls ? 'secureConnect' : 'connect', () => resolve())
    socket.once('error', reject)
  })

  return {
    ready,
    duplex: {
      write: (data) => socket.write(data),
      onData: (handler) => {
        dataHandler = handler
      },
      onError: (handler) => {
        errorHandler = handler
      },
      startTls: () =>
        new Promise((resolve, reject) => {
          const plain = socket
          plain.removeAllListeners('data')
          plain.removeAllListeners('error')
          const secure = tlsConnect({ socket: plain, servername: config.host })
          secure.once('secureConnect', () => {
            socket = secure
            attach(secure)
            resolve()
          })
          secure.once('error', reject)
        }),
      close: () => socket.end(),
    },
  }
}

/**
 * Run one submission from greeting to QUIT.
 *
 * Exported separately from the provider so a test can drive the whole protocol
 * against a scripted server without a socket.
 */
export async function submit(
  session: SmtpSession,
  config: SmtpConfig,
  message: MailMessage,
  messageId: string,
): Promise<void> {
  const greeting = await session.read()
  if (greeting.code !== 220) {
    throw new SmtpError(`SMTP server refused the connection: ${greeting.code} ${greeting.lines.join(' ')}`, greeting.code)
  }

  const ehlo = await session.command(`EHLO ${hostLabel(config.from)}`, [250])
  let capabilities = ehlo.lines.map((l) => l.toUpperCase())

  if (!config.implicitTls && capabilities.some((l) => l.startsWith('STARTTLS'))) {
    await session.startTls()
    // Capabilities before and after TLS are different documents; a server
    // commonly advertises AUTH only once the channel is encrypted, which is the
    // correct behaviour and the reason the EHLO is repeated rather than reused.
    const second = await session.command(`EHLO ${hostLabel(config.from)}`, [250])
    capabilities = second.lines.map((l) => l.toUpperCase())
  }

  if (config.user && config.pass) {
    const authLine = capabilities.find((l) => l.startsWith('AUTH')) ?? 'AUTH PLAIN LOGIN'
    if (authLine.includes('PLAIN')) {
      const token = Buffer.from(`\0${config.user}\0${config.pass}`, 'utf8').toString('base64')
      await session.command(`AUTH PLAIN ${token}`, [235], true)
    } else if (authLine.includes('LOGIN')) {
      await session.command('AUTH LOGIN', [334])
      await session.command(Buffer.from(config.user, 'utf8').toString('base64'), [334], true)
      await session.command(Buffer.from(config.pass, 'utf8').toString('base64'), [235], true)
    } else {
      throw new SmtpError(`SMTP server offers no supported auth mechanism (${authLine})`, 0)
    }
  }

  await session.command(`MAIL FROM:<${addressOnly(config.from)}>`, [250])
  await session.command(`RCPT TO:<${addressOnly(message.to)}>`, [250, 251])
  await session.data(buildMessage(message, config.from, messageId))
  // A server is entitled to close on QUIT before answering; the message is
  // already accepted at this point, so a failure here is not a delivery failure.
  await session.command('QUIT', [221]).catch(() => undefined)
}

/** `Lambda NX <no-reply@example.com>` → `no-reply@example.com`. */
export function addressOnly(value: string): string {
  const match = /<([^>]+)>/.exec(value)
  return (match ? match[1] : value).trim()
}

/** The EHLO argument. Our domain, taken from the sender we are configured with. */
function hostLabel(from: string): string {
  const domain = addressOnly(from).split('@')[1]
  return domain || 'localhost'
}

/**
 * The provider the rest of the app sees.
 *
 * A fresh connection per message. Connection reuse would matter for a newsletter
 * and does not for a verification code, while a pooled connection that has gone
 * stale is one of the more annoying failure modes to diagnose.
 */
export function smtpProvider(config: SmtpConfig): MailProvider {
  return {
    name: `smtp:${config.host}`,
    configured: true,
    async send(message: MailMessage): Promise<MailResult> {
      const messageId = `${Date.now().toString(36)}.${Math.abs(hash(message.to + message.subject)).toString(36)}@${
        addressOnly(config.from).split('@')[1] ?? 'lambda'
      }`
      const { duplex, ready } = nodeDuplex(config)
      const session = new SmtpSession(duplex)
      try {
        await ready
        await submit(session, config, message, messageId)
        return { delivered: true, detail: `accepted by ${config.host}` }
      } catch (error) {
        return { delivered: false, detail: error instanceof Error ? error.message : String(error) }
      } finally {
        session.close()
      }
    },
  }
}

/** Deterministic id component. Not a security value — it only aids log tracing. */
function hash(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) h = (Math.imul(31, h) + input.charCodeAt(i)) | 0
  return h
}

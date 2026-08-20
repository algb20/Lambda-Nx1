import { describe, expect, it } from 'vitest'
import {
  addressOnly,
  buildMessage,
  dotStuff,
  encodeHeader,
  parseReplies,
  parseSmtpUrl,
  SmtpSession,
  submit,
  type SmtpDuplex,
} from './smtp'

describe('reading what an SMTP server says', () => {
  it('reads a single-line reply', () => {
    const { replies, rest } = parseReplies('250 OK\r\n')
    expect(replies).toEqual([{ code: 250, lines: ['OK'] }])
    expect(rest).toBe('')
  })

  /**
   * The bug this exists to prevent: EHLO is answered with several lines, and a
   * client that treats the first as the whole reply reads the second as the
   * answer to its *next* command and is one step out of phase for the rest of
   * the session — which shows up as a message that silently never sends.
   */
  it('treats a multi-line reply as one reply, not several', () => {
    const { replies } = parseReplies('250-mail.example.com\r\n250-SIZE 35882577\r\n250 STARTTLS\r\n')
    expect(replies).toHaveLength(1)
    expect(replies[0].code).toBe(250)
    expect(replies[0].lines).toEqual(['mail.example.com', 'SIZE 35882577', 'STARTTLS'])
  })

  it('holds back a reply that has not finished arriving', () => {
    const first = parseReplies('250-mail.example.com\r\n250-SI')
    expect(first.replies).toHaveLength(0)
    const second = parseReplies(first.rest + 'ZE 100\r\n250 OK\r\n')
    expect(second.replies).toHaveLength(1)
    expect(second.replies[0].lines).toEqual(['mail.example.com', 'SIZE 100', 'OK'])
  })

  it('splits two replies that arrive in one packet', () => {
    const { replies } = parseReplies('220 hello\r\n250 OK\r\n')
    expect(replies.map((r) => r.code)).toEqual([220, 250])
  })
})

describe('composing the message', () => {
  /**
   * A line that is a single dot ends the message. A body line beginning with one
   * therefore truncates the email at that point unless it is escaped — and it
   * would pass every test that never wrote such a line.
   */
  it('escapes a leading dot so the message is not cut in half', () => {
    expect(dotStuff('one\r\n.two\r\nthree')).toBe('one\r\n..two\r\nthree')
    expect(dotStuff('.first line')).toBe('..first line')
  })

  it('leaves an ordinary body untouched', () => {
    expect(dotStuff('hello\r\nworld')).toBe('hello\r\nworld')
  })

  it('leaves an ASCII header alone', () => {
    expect(encodeHeader('Your Lambda verification code')).toBe('Your Lambda verification code')
  })

  it('encodes an Arabic subject, which arrives as mojibake if sent raw', () => {
    const encoded = encodeHeader('رمز التحقق')
    expect(encoded.startsWith('=?UTF-8?B?')).toBe(true)
    const base64 = encoded.slice('=?UTF-8?B?'.length, -2)
    expect(Buffer.from(base64, 'base64').toString('utf8')).toBe('رمز التحقق')
  })

  it('sends both a text and an HTML part when there is HTML', () => {
    const raw = buildMessage(
      { to: 'a@example.com', subject: 'Code', text: 'plain', html: '<b>rich</b>' },
      'Lambda <no-reply@lambda.test>',
      'id1@lambda.test',
    )
    expect(raw).toContain('Content-Type: multipart/alternative')
    expect(raw).toContain('text/plain; charset=UTF-8')
    expect(raw).toContain('text/html; charset=UTF-8')
    expect(raw).toContain(Buffer.from('plain').toString('base64'))
  })

  it('sends a plain message as plain, without an empty multipart wrapper', () => {
    const raw = buildMessage(
      { to: 'a@example.com', subject: 'Code', text: 'plain' },
      'no-reply@lambda.test',
      'id2@lambda.test',
    )
    expect(raw).toContain('Content-Type: text/plain')
    expect(raw).not.toContain('multipart')
  })

  it('folds base64 to the line length SMTP allows', () => {
    const raw = buildMessage(
      { to: 'a@example.com', subject: 'x', text: 'y'.repeat(500) },
      'no-reply@lambda.test',
      'id3@lambda.test',
    )
    const body = raw.split('\r\n\r\n')[1]
    for (const line of body.split('\r\n')) expect(line.length).toBeLessThanOrEqual(76)
  })

  it('takes the bare address out of a display-name sender', () => {
    expect(addressOnly('Lambda <no-reply@lambda.test>')).toBe('no-reply@lambda.test')
    expect(addressOnly('no-reply@lambda.test')).toBe('no-reply@lambda.test')
  })
})

describe('reading SMTP_URL', () => {
  it('defaults port 587 for smtp: and 465 for smtps:', () => {
    expect(parseSmtpUrl('smtp://u%40x.com:p@mail.test?from=a@b.com').port).toBe(587)
    expect(parseSmtpUrl('smtps://u%40x.com:p@mail.test?from=a@b.com').port).toBe(465)
  })

  /**
   * Mail providers issue passwords containing `@` and `/`. A user who pastes one
   * raw gets an authentication failure with no clue why, so the decoding is not
   * a nicety.
   */
  it('percent-decodes credentials', () => {
    const config = parseSmtpUrl('smtp://user%40example.com:p%40ss%2Fword@mail.test?from=a@b.com')
    expect(config.user).toBe('user@example.com')
    expect(config.pass).toBe('p@ss/word')
  })

  it('takes the sender from the username when it is an address', () => {
    expect(parseSmtpUrl('smtp://no-reply%40lambda.test:p@mail.test').from).toBe('no-reply@lambda.test')
  })

  it('refuses a URL with no usable sender, rather than sending from nowhere', () => {
    expect(() => parseSmtpUrl('smtp://apikey:p@mail.test')).toThrow(/sender/i)
  })

  it('refuses a scheme that is not SMTP', () => {
    expect(() => parseSmtpUrl('https://mail.test')).toThrow(/scheme/i)
  })
})

/** A server that answers from a script, so the whole protocol runs offline. */
function scriptedServer(script: string[]): { duplex: SmtpDuplex; sent: string[]; tlsStarted: () => boolean } {
  const sent: string[] = []
  let step = 0
  let tls = false
  let onData: (chunk: string) => void = () => {}

  const answer = () => {
    const line = script[step++]
    if (line !== undefined) queueMicrotask(() => onData(line))
  }

  return {
    sent,
    tlsStarted: () => tls,
    duplex: {
      write(data) {
        sent.push(data)
        answer()
      },
      onData(handler) {
        onData = handler
        // The greeting is unprompted — the server speaks first.
        if (step === 0) answer()
      },
      onError() {},
      async startTls() {
        tls = true
      },
      close() {},
    },
  }
}

describe('a complete submission', () => {
  const config = {
    host: 'mail.test',
    port: 587,
    user: 'sender',
    pass: 'secret',
    implicitTls: false,
    from: 'Lambda <no-reply@lambda.test>',
  }

  it('greets, upgrades to TLS, authenticates and sends', async () => {
    const server = scriptedServer([
      '220 mail.test ESMTP\r\n',
      '250-mail.test\r\n250-STARTTLS\r\n250 AUTH PLAIN LOGIN\r\n', // EHLO
      '220 ready to start TLS\r\n', // STARTTLS
      '250-mail.test\r\n250 AUTH PLAIN LOGIN\r\n', // EHLO again
      '235 authenticated\r\n',
      '250 sender ok\r\n',
      '250 recipient ok\r\n',
      '354 go ahead\r\n',
      '250 queued as ABC\r\n',
      '221 bye\r\n',
    ])
    const session = new SmtpSession(server.duplex, 500)

    await submit(session, config, { to: 'reader@example.com', subject: 'Code', text: '123456' }, 'x@lambda.test')

    expect(server.tlsStarted()).toBe(true)
    const wire = server.sent.join('')
    expect(wire).toContain('EHLO lambda.test')
    expect(wire).toContain('MAIL FROM:<no-reply@lambda.test>')
    expect(wire).toContain('RCPT TO:<reader@example.com>')
    expect(wire).toContain('\r\n.\r\n')
  })

  /**
   * A server that advertises AUTH only after TLS is the correct behaviour, and
   * the reason EHLO is repeated rather than reused. Without the second EHLO this
   * message would be sent unauthenticated and rejected.
   */
  it('re-reads capabilities after TLS instead of reusing the plaintext ones', async () => {
    const server = scriptedServer([
      '220 mail.test\r\n',
      '250-mail.test\r\n250 STARTTLS\r\n', // no AUTH offered yet
      '220 go\r\n',
      '250-mail.test\r\n250 AUTH LOGIN\r\n', // AUTH appears only now
      '334 VXNlcm5hbWU6\r\n',
      '334 UGFzc3dvcmQ6\r\n',
      '235 ok\r\n',
      '250 ok\r\n',
      '250 ok\r\n',
      '354 go\r\n',
      '250 queued\r\n',
      '221 bye\r\n',
    ])
    const session = new SmtpSession(server.duplex, 500)
    await submit(session, config, { to: 'r@example.com', subject: 's', text: 't' }, 'y@lambda.test')
    expect(server.sent.join('')).toContain('AUTH LOGIN')
  })

  it('reports a rejected recipient as a failure instead of claiming delivery', async () => {
    const server = scriptedServer([
      '220 mail.test\r\n',
      '250 mail.test\r\n',
      '235 ok\r\n', // never reached: no AUTH advertised, falls back to PLAIN
      '250 sender ok\r\n',
      '550 no such mailbox\r\n',
    ])
    const session = new SmtpSession(server.duplex, 500)
    await expect(
      submit(session, config, { to: 'nobody@example.com', subject: 's', text: 't' }, 'z@lambda.test'),
    ).rejects.toThrow(/550|no such mailbox/i)
  })

  /**
   * A credential must never reach a log, and an SMTP failure is routinely
   * logged. AUTH LOGIN sends the password as bare base64, so echoing the failing
   * command would put it there in a form anyone can decode.
   */
  it('never puts the credential in the error text', async () => {
    const server = scriptedServer([
      '220 mail.test\r\n',
      '250-mail.test\r\n250 AUTH LOGIN\r\n',
      '334 VXNlcm5hbWU6\r\n',
      '334 UGFzc3dvcmQ6\r\n',
      '535 authentication failed\r\n',
    ])
    const session = new SmtpSession(server.duplex, 500)
    const error = await submit(
      session,
      config,
      { to: 'r@example.com', subject: 's', text: 't' },
      'w@lambda.test',
    ).catch((e: Error) => e)
    expect(error).toBeInstanceOf(Error)
    const text = (error as Error).message
    expect(text).not.toContain(Buffer.from('secret').toString('base64'))
    expect(text).not.toContain('secret')
    expect(text).toContain('<credential>')
  })

  it('fails rather than hanging when the server says nothing', async () => {
    const server = scriptedServer([])
    const session = new SmtpSession(server.duplex, 30)
    await expect(
      submit(session, config, { to: 'r@example.com', subject: 's', text: 't' }, 'v@lambda.test'),
    ).rejects.toThrow(/did not answer/i)
  })

  it('does not attempt STARTTLS on a server that does not offer it', async () => {
    const server = scriptedServer([
      '220 mail.test\r\n',
      '250-mail.test\r\n250 AUTH PLAIN\r\n',
      '235 ok\r\n',
      '250 ok\r\n',
      '250 ok\r\n',
      '354 go\r\n',
      '250 queued\r\n',
      '221 bye\r\n',
    ])
    const session = new SmtpSession(server.duplex, 500)
    await submit(session, config, { to: 'r@example.com', subject: 's', text: 't' }, 'u@lambda.test')
    expect(server.tlsStarted()).toBe(false)
    expect(server.sent.join('')).toContain('AUTH PLAIN')
  })
})

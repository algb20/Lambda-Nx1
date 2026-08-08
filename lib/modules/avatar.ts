/**
 * Profile pictures.
 *
 * The whole risk here is that an upload endpoint accepts whatever a caller
 * sends. So nothing is trusted: not the declared content type, not the file
 * name, not the size header. The bytes themselves are inspected, and only the
 * three image formats every browser renders are allowed through.
 *
 * SVG is deliberately refused. It is an image to a user and a script host to a
 * browser, and serving one uploaded by someone else from our own origin is a
 * cross-site scripting hole with extra steps.
 */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024

export type AvatarFormat = 'png' | 'jpeg' | 'webp'

const SIGNATURES: Array<{ format: AvatarFormat; contentType: string; test: (b: Uint8Array) => boolean }> = [
  {
    format: 'png',
    contentType: 'image/png',
    test: (b) =>
      b.length > 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    format: 'jpeg',
    contentType: 'image/jpeg',
    test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    format: 'webp',
    contentType: 'image/webp',
    // "RIFF" .... "WEBP"
    test: (b) =>
      b.length > 12 &&
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
]

export interface AvatarCheck {
  ok: boolean
  format?: AvatarFormat
  contentType?: string
  error?: string
}

/**
 * Decide whether these bytes are an image we are willing to store and serve
 * back. Reads the magic number rather than believing the upload's own label.
 */
export function inspectAvatar(bytes: Uint8Array): AvatarCheck {
  if (bytes.length === 0) return { ok: false, error: 'The file is empty' }
  if (bytes.length > MAX_AVATAR_BYTES) {
    return { ok: false, error: `Images must be under ${Math.round(MAX_AVATAR_BYTES / 1024 / 1024)} MB` }
  }
  const match = SIGNATURES.find((s) => s.test(bytes))
  if (!match) {
    return { ok: false, error: 'Use a PNG, JPEG or WebP image' }
  }
  return { ok: true, format: match.format, contentType: match.contentType }
}

/**
 * The storage key for a user's avatar. Includes a version segment so a replaced
 * picture gets a new URL — otherwise every cache between us and the reader keeps
 * serving the old one, and the change looks like it silently failed.
 */
export function avatarKey(userId: string, format: AvatarFormat, version = Date.now()): string {
  return `avatars/${userId}/${version}.${format}`
}

/** The public path the app serves an avatar from. */
export function avatarUrl(key: string): string {
  return `/api/avatar/${encodeURI(key.replace(/^avatars\//, ''))}`
}

/**
 * Parse a public avatar path back to a storage key, refusing anything that
 * tries to climb out of the avatars prefix.
 */
export function keyFromAvatarPath(path: string): string | null {
  const cleaned = decodeURIComponent(path).replace(/^\/+/, '')
  if (cleaned.includes('..') || cleaned.includes('\\')) return null
  if (!/^[A-Za-z0-9._/-]+$/.test(cleaned)) return null
  const key = `avatars/${cleaned}`
  if (!/^avatars\/[0-9a-f-]{36}\/\d+\.(png|jpeg|webp)$/i.test(key)) return null
  return key
}

/** Initials to show while there is no picture — never a blank circle. */
export function initialsOf(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return '?'
  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return trimmed.slice(0, 2).toUpperCase()
}

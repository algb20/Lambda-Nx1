/**
 * Browser-only share actions for posts and research. Kept apart from the pure
 * helpers in lib/posts.ts so those stay testable. Every function degrades
 * gracefully: clipboard falls back, native share is optional.
 */

/** Copy text to the clipboard; returns whether it succeeded. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/** Native share sheet where available (mobile / Pi Browser); returns whether it ran. */
export async function nativeShare(data: { title?: string; text?: string; url?: string }): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share(data)
      return true
    }
  } catch {
    /* user cancelled or unsupported */
  }
  return false
}

/** Trigger a client-side download of text content. */
export function downloadText(filename: string, content: string, mime = 'text/markdown'): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoke on the next tick so the download has claimed the URL.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Download a Blob (e.g. a watermarked PNG). */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

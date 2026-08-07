'use client'

import { useState } from 'react'
import { Link2, Share2, Download, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { copyText, nativeShare, downloadText } from '@/lib/share'
import {
  buildShareText,
  postToMarkdown,
  slugifyTitle,
  type PublicPost,
} from '@/lib/posts'

/**
 * The share row for a post: copy its permalink, share outside the app (native
 * sheet where available, clipboard otherwise), and download it as signed
 * Markdown (λ). Used on the permalink page and on feed cards.
 */
export function PostShareBar({
  post,
  permalink,
  className,
}: {
  post: PublicPost
  permalink: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  async function onCopyLink() {
    const ok = await copyText(permalink)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  async function onShare() {
    const shared = await nativeShare({
      title: post.title,
      text: buildShareText(post, permalink),
      url: permalink,
    })
    if (!shared) await onCopyLink() // fall back to copying the link
  }

  function onDownload() {
    downloadText(`${slugifyTitle(post.title)}.md`, postToMarkdown(post, permalink))
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ''}`}>
      <Button variant="outline" size="sm" onClick={onCopyLink} className="gap-1.5">
        {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Link2 className="h-4 w-4" />}
        {copied ? 'Copied' : 'Copy link'}
      </Button>
      <Button variant="outline" size="sm" onClick={onShare} className="gap-1.5">
        <Share2 className="h-4 w-4" />
        Share
      </Button>
      <Button variant="outline" size="sm" onClick={onDownload} className="gap-1.5">
        <Download className="h-4 w-4" />
        Download
      </Button>
    </div>
  )
}

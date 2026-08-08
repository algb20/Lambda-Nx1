'use client'

import { GitCommitHorizontal } from 'lucide-react'
import { buildAgeHours, describeBuild, getBuildInfo } from '@/lib/build-info'

/**
 * Which build you are looking at.
 *
 * Small, but it settles a question that otherwise needs a hosting dashboard and
 * a git log to answer: is this page the latest work, or a stale deploy? The
 * stamp comes from the build itself, so it cannot claim to be newer than it is.
 *
 * `data-no-translate` because a commit hash is an identifier, and translating
 * identifiers turns a working label into a broken one.
 */
export function BuildStamp({ className = '' }: { className?: string }) {
  const info = getBuildInfo()
  const age = buildAgeHours(info)

  // Nothing was stamped (a local run without the env), so say nothing rather
  // than showing an empty badge.
  if (!info.shortCommit && !info.builtAt) return null

  const label = describeBuild(info)
  const freshness =
    age === null ? null : age < 1 ? 'deployed just now' : age < 24 ? `deployed ${age}h ago` : `deployed ${Math.floor(age / 24)}d ago`

  const body = (
    <span
      data-no-translate
      className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground"
    >
      <GitCommitHorizontal className="h-3 w-3" />
      {label}
    </span>
  )

  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 ${className}`}>
      {info.commitUrl ? (
        <a
          href={info.commitUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="hover:text-foreground"
          title="Open this exact commit on GitHub"
        >
          {body}
        </a>
      ) : (
        body
      )}
      {freshness ? <span className="text-[10px] text-muted-foreground">· {freshness}</span> : null}
    </div>
  )
}

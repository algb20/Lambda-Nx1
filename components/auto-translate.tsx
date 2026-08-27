'use client'

import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n'

/**
 * Whole-interface translation.
 *
 * Wiring `t()` through every component means every new screen ships in English
 * only until someone remembers to add its keys — which is exactly what happened,
 * and it also cannot touch text the engine produced at runtime (event titles,
 * agency names, source labels). So this translates the rendered page instead:
 * it walks the visible text nodes, sends them to /api/translate in one batch,
 * and writes the results back.
 *
 * Four things make that safe rather than reckless:
 *
 *  - **Originals are kept.** Every node's English text is remembered, so
 *    switching back to English is a restore, not another round trip.
 *  - **React keeps ownership.** A MutationObserver re-translates whatever React
 *    re-renders, so a re-render can never leave half a page in each language.
 *  - **Nothing untranslatable is sent.** Code, identifiers, URLs, numbers and
 *    anything a caller marks `data-no-translate` are left exactly as they are.
 *  - **A blip is invisible; a refusal is not.** A failed round trip leaves the
 *    page in English and says nothing, which is right for a dropped request.
 *    But when the server reports that *no provider would translate at all*,
 *    the reader is told — because the previous version treated both the same
 *    and the feature was measured broken on the live deployment while every
 *    surface, statistic and test reported it healthy. A reader who selects
 *    Arabic and gets English concludes the product has no Arabic; they must
 *    not have to guess between that and "it is temporarily unavailable".
 */

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'KBD', 'SAMP', 'TEXTAREA', 'NOSCRIPT'])
const DEBOUNCE_MS = 250

/** Attributes whose value is user-visible text and worth translating. */
const TEXT_ATTRIBUTES = ['placeholder', 'title', 'aria-label']

function shouldSkip(node: Node): boolean {
  let el: HTMLElement | null =
    node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement
  while (el) {
    if (SKIP_TAGS.has(el.tagName)) return true
    if (el.hasAttribute('data-no-translate')) return true
    el = el.parentElement
  }
  return false
}

export function AutoTranslate({ children }: { children: React.ReactNode }) {
  const { locale, t } = useI18n()
  /** Set only when the server reports that no provider translated at all. */
  const [unavailable, setUnavailable] = useState(false)
  /** Original English text, per node, so switching back is exact. */
  const originalsRef = useRef(new WeakMap<Node, string>())
  const attrOriginalsRef = useRef(new WeakMap<Element, Map<string, string>>())
  /** Locale-scoped memo, so a re-render costs nothing already paid for. */
  const memoRef = useRef(new Map<string, string>())
  const localeRef = useRef(locale)
  const runningRef = useRef(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    // A different locale invalidates the memo, but never the originals.
    if (localeRef.current !== locale) {
      memoRef.current = new Map()
      localeRef.current = locale
    }

    const collect = () => {
      const nodes: Text[] = []
      const attrs: Array<{ el: Element; name: string; value: string }> = []

      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT
          if (shouldSkip(node)) return NodeFilter.FILTER_REJECT
          return NodeFilter.FILTER_ACCEPT
        },
      })
      let current = walker.nextNode()
      while (current) {
        nodes.push(current as Text)
        current = walker.nextNode()
      }

      for (const el of Array.from(document.body.querySelectorAll('[placeholder],[title],[aria-label]'))) {
        if (shouldSkip(el)) continue
        for (const name of TEXT_ATTRIBUTES) {
          const value = el.getAttribute(name)
          if (value && value.trim()) attrs.push({ el, name, value })
        }
      }
      return { nodes, attrs }
    }

    const restoreEnglish = () => {
      const { nodes, attrs } = collect()
      for (const node of nodes) {
        const original = originalsRef.current.get(node)
        if (original !== undefined && node.nodeValue !== original) node.nodeValue = original
      }
      for (const { el, name } of attrs) {
        const original = attrOriginalsRef.current.get(el)?.get(name)
        if (original !== undefined) el.setAttribute(name, original)
      }
    }

    const translate = async () => {
      if (runningRef.current) return
      runningRef.current = true
      try {
        const { nodes, attrs } = collect()

        // Remember the English exactly once per node, before anything replaces it.
        for (const node of nodes) {
          if (!originalsRef.current.has(node)) {
            originalsRef.current.set(node, node.nodeValue ?? '')
          }
        }
        for (const { el, name, value } of attrs) {
          let map = attrOriginalsRef.current.get(el)
          if (!map) {
            map = new Map()
            attrOriginalsRef.current.set(el, map)
          }
          if (!map.has(name)) map.set(name, value)
        }

        const sources: string[] = []
        const nodeTargets: Text[] = []
        const attrTargets: Array<{ el: Element; name: string }> = []

        for (const node of nodes) {
          const original = originalsRef.current.get(node) ?? node.nodeValue ?? ''
          const memo = memoRef.current.get(original)
          if (memo !== undefined) {
            if (node.nodeValue !== memo) node.nodeValue = memo
            continue
          }
          sources.push(original)
          nodeTargets.push(node)
        }
        for (const { el, name } of attrs) {
          const original = attrOriginalsRef.current.get(el)?.get(name) ?? ''
          if (!original) continue
          const memo = memoRef.current.get(original)
          if (memo !== undefined) {
            if (el.getAttribute(name) !== memo) el.setAttribute(name, memo)
            continue
          }
          sources.push(original)
          attrTargets.push({ el, name })
        }

        if (sources.length === 0) return

        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texts: sources, to: locale }),
        })
        if (!res.ok) return
        const data = (await res.json()) as { translations?: string[]; unavailable?: string }
        const out = data.translations
        if (!Array.isArray(out) || out.length !== sources.length) return

        /**
         * The server translated nothing, and said so.
         *
         * Two things must not happen here. The English must not be memoised —
         * doing so would pin it for the life of the page, so the interface
         * would stay English even after the provider recovered — and the
         * reader must not be left to conclude the product has no Arabic.
         */
        if (data.unavailable) {
          if (localeRef.current === locale) setUnavailable(true)
          return
        }
        setUnavailable(false)

        // The locale may have changed while the request was in flight.
        if (localeRef.current !== locale) return

        out.forEach((value, i) => memoRef.current.set(sources[i], value))
        nodeTargets.forEach((node, i) => {
          const value = out[i]
          if (value && node.nodeValue !== value) node.nodeValue = value
        })
        attrTargets.forEach((target, i) => {
          const value = out[nodeTargets.length + i]
          if (value) target.el.setAttribute(target.name, value)
        })
      } catch {
        /* the page stays in English */
      } finally {
        runningRef.current = false
      }
    }

    const schedule = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        if (localeRef.current === 'en') restoreEnglish()
        else void translate()
      }, DEBOUNCE_MS)
    }

    schedule()

    // React owns the DOM; whatever it re-renders has to be re-translated, or a
    // single state change leaves the page half in each language.
    const observer = new MutationObserver((records) => {
      const meaningful = records.some(
        (r) => r.type === 'childList' || r.type === 'characterData' || r.type === 'attributes',
      )
      if (meaningful) schedule()
    })
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: TEXT_ATTRIBUTES,
    })

    return () => {
      observer.disconnect()
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [locale])

  return (
    <>
      {children}
      {unavailable ? (
        <div
          role="status"
          data-no-translate
          className="fixed inset-x-2 bottom-2 z-[60] mx-auto max-w-md rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 shadow-lg dark:text-amber-300"
        >
          <div className="flex items-start justify-between gap-2">
            <span>{t('lang.unavailable')}</span>
            <button
              type="button"
              onClick={() => setUnavailable(false)}
              aria-label={t('common.dismiss')}
              className="shrink-0 rounded px-1 leading-none opacity-70 transition-opacity hover:opacity-100"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}

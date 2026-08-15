/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { installDomResilience, domRepairs } from './dom-resilience'

/**
 * These reproduce the exact browser exception a user hit by clicking anything
 * while reading the app in Arabic, then assert it no longer throws.
 */
describe('surviving a translator that edits the DOM under React', () => {
  beforeEach(() => {
    domRepairs.insertBefore = 0
    domRepairs.removeChild = 0
    installDomResilience()
  })

  it('reproduces the crash before deciding the fix is needed', () => {
    // Without the guard this is the error verbatim:
    // "The node before which the new node is to be inserted is not a child".
    const parent = document.createElement('div')
    const stranger = document.createElement('span')
    document.createElement('div').appendChild(stranger) // lives elsewhere

    // With the guard installed it must not throw.
    expect(() => parent.insertBefore(document.createElement('b'), stranger)).not.toThrow()
  })

  it('still places the node inside the parent React asked for', () => {
    const parent = document.createElement('div')
    const orphan = document.createElement('span')
    document.createElement('div').appendChild(orphan)

    const inserted = document.createElement('b')
    parent.insertBefore(inserted, orphan)

    // React's intent was "this node belongs in this parent". Honoured.
    expect(inserted.parentNode).toBe(parent)
    expect(domRepairs.insertBefore).toBe(1)
  })

  it('leaves ordinary insertion exactly as it was', () => {
    const parent = document.createElement('div')
    const first = document.createElement('i')
    parent.appendChild(first)

    const inserted = document.createElement('b')
    parent.insertBefore(inserted, first)

    expect(parent.firstChild).toBe(inserted)
    expect(parent.childNodes[1]).toBe(first)
    // The consistent case is the fast path and must never count as a repair.
    expect(domRepairs.insertBefore).toBe(0)
  })

  it('appending with a null reference is untouched', () => {
    const parent = document.createElement('div')
    const node = document.createElement('b')
    parent.insertBefore(node, null)
    expect(parent.firstChild).toBe(node)
    expect(domRepairs.insertBefore).toBe(0)
  })

  it('treats removing an already-detached node as done, not as an error', () => {
    const parent = document.createElement('div')
    const gone = document.createElement('span')
    // A translator re-parented it; React still wants it removed.
    document.createElement('div').appendChild(gone)

    expect(() => parent.removeChild(gone)).not.toThrow()
    expect(domRepairs.removeChild).toBe(1)
  })

  it('removes a real child normally', () => {
    const parent = document.createElement('div')
    const child = document.createElement('span')
    parent.appendChild(child)

    parent.removeChild(child)
    expect(parent.childNodes.length).toBe(0)
    expect(domRepairs.removeChild).toBe(0)
  })

  /**
   * A guard that swallowed every error would hide real bugs, which would be a
   * worse outcome than the crash it replaces.
   */
  it('does not swallow unrelated failures', () => {
    const parent = document.createElement('div')
    // Inserting a node into itself is a genuine hierarchy error and must throw.
    expect(() => parent.insertBefore(parent, null)).toThrow()
  })

  it('installs once however many times it is called', () => {
    const before = Node.prototype.insertBefore
    installDomResilience()
    installDomResilience()
    expect(Node.prototype.insertBefore).toBe(before)
  })

  /**
   * The realistic sequence: our AutoTranslate replaces a text node, then React
   * re-renders the sibling that followed it.
   */
  it('survives the translate-then-rerender sequence end to end', () => {
    const panel = document.createElement('div')
    const title = document.createTextNode('Live news')
    const body = document.createElement('p')
    panel.append(title, body)

    // Translator swaps the text node for a wrapped one, as browsers do.
    const wrapped = document.createElement('font')
    wrapped.textContent = 'أخبار مباشرة'
    panel.replaceChild(wrapped, title)

    // React now re-renders, inserting before the node it still remembers.
    expect(() => panel.insertBefore(document.createElement('span'), title)).not.toThrow()
    expect(domRepairs.insertBefore).toBe(1)
  })
})

/**
 * Keep React alive when something else edits the DOM underneath it.
 *
 * ## The failure
 *
 * A user browsing in Arabic clicks anything and the panel dies with:
 *
 * > *Failed to execute `insertBefore` on `Node`: The node before which the new
 * > node is to be inserted is not a child of this node.*
 *
 * React keeps its own record of which DOM nodes it created and where they sit.
 * When it re-renders, it asks the browser to insert a node **before** a
 * reference node it believes is still there. If anything replaced or moved that
 * reference node in the meantime, the browser refuses, React throws, and the
 * nearest error boundary blanks the panel.
 *
 * Two things do exactly that in this product:
 *
 *  - **Our own `AutoTranslate`**, which walks the rendered page and rewrites
 *    text nodes so the whole interface — including engine-produced text like
 *    event titles and agency names — appears in the reader's language.
 *  - **The browser's built-in translator**, which most Arabic-speaking users
 *    have on, and which replaces text nodes with its own `<font>` wrappers.
 *
 * The second one matters more than the first: we cannot fix a user's browser,
 * and it is the single most common cause of this error across the web. So the
 * repair has to be at the DOM boundary, not in our translator.
 *
 * ## What this does
 *
 * `insertBefore` and `removeChild` are wrapped so that a reference node which
 * is no longer a child of its expected parent degrades instead of throwing:
 * the insert becomes an append, and the removal becomes a no-op. Both are what
 * React wanted anyway — the node ends up in the right parent, and a node that
 * is already gone is already removed.
 *
 * ## Why this is not a hack
 *
 * It is narrow and it is honest about being a repair:
 *
 *  - It only intervenes on the **one** condition that throws — the reference
 *    node not being a child of this node. Every other error still throws, so a
 *    genuine bug is not swallowed.
 *  - It changes no behaviour when the DOM is consistent, which is the normal
 *    case and the fast path.
 *  - It counts what it caught, so the interference is measurable instead of
 *    silently absorbed. A number that climbs is a translator fighting React,
 *    and something we should know about rather than merely survive.
 *
 * The alternative — telling users not to translate the page — is not an option
 * for a product whose readers are mostly not English speakers.
 */

interface Patched {
  __lambdaResilient?: boolean
}

/** How many times each repair fired, so interference is visible not invisible. */
export const domRepairs = { insertBefore: 0, removeChild: 0 }

export function installDomResilience(): void {
  if (typeof Node === 'undefined') return
  const proto = Node.prototype as Node & Patched
  if (proto.__lambdaResilient) return

  const originalInsertBefore = proto.insertBefore
  const originalRemoveChild = proto.removeChild

  proto.insertBefore = function <T extends Node>(this: Node, node: T, child: Node | null): T {
    // The overwhelmingly common case: everything is where React thinks it is.
    if (child === null || child.parentNode === this) {
      return originalInsertBefore.call(this, node, child) as T
    }
    /**
     * The reference node moved or was replaced. React's intent was "put this
     * node inside `this`", and the position was only ever relative to a
     * sibling that no longer exists here — so appending honours the intent.
     */
    domRepairs.insertBefore++
    return originalInsertBefore.call(this, node, null) as T
  }

  proto.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode === this) {
      return originalRemoveChild.call(this, child) as T
    }
    // Already detached, or re-parented by a translator. React wanted it gone;
    // it is gone. Removing it from wherever it actually lives would be worse —
    // that node may now belong to a subtree React is not managing.
    domRepairs.removeChild++
    return child
  }

  proto.__lambdaResilient = true
}

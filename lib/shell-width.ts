/**
 * How wide the shell is, decided once so the header cannot drift from the page.
 *
 * ## The measurement that forced this
 *
 * The header carried `max-w-2xl` — 672px — from when the product was a single
 * reading column. The content stopped being one: it grew a left navigation, a
 * centre column and a right rail, and widened itself to `88rem` on a large
 * screen and `104rem` beyond that. The header did not come with it.
 *
 * Measured in a real browser on 2026-08-27, on the front page:
 *
 * | Viewport | Header | Content | Left edges |
 * |---|---|---|---|
 * | 1440px | 672px at x=384 | 784px at x=304 | **80px apart** |
 * | 1920px | 672px at x=624 | 1040px at x=416 | **208px apart** |
 *
 * So the brand and its controls floated in the middle of a wide bar, lining up
 * with nothing underneath them, while more than a third of a desktop screen sat
 * empty beside the content. That is the "very bad on a computer" the owner
 * reported, and it is not a matter of taste: two elements that are supposed to
 * share an edge did not share one.
 *
 * ## Why a constant rather than repeating the classes
 *
 * The header and the page are separate components and the widths were separate
 * strings, which is exactly how they came to disagree — and how they would
 * disagree again the next time one is changed. One exported string means
 * changing the shell changes both, and a test asserts that both use it.
 */

/**
 * The reading shell: navigation, feed and rail on a wide screen, one column on
 * a phone. `88rem` at `lg` is what the page already chose; `104rem` past `2xl`
 * lets a very wide monitor breathe without the line length becoming unreadable.
 */
export const SHELL_CONTAINER = 'container mx-auto px-4 lg:max-w-[88rem] 2xl:max-w-[104rem]'

/**
 * The workspaces that earn the whole width — markets and the globe.
 *
 * Width is earned by what a screen is *for*: a wall of live tables or a map is
 * worse in a reading column, and better edge to edge. The header still has to
 * follow, or it goes back to floating in the middle of its own bar.
 */
export const SHELL_CONTAINER_WIDE = 'container mx-auto px-4 lg:max-w-none'

/** Which of the two a tab uses. The header asks this, and so does the page. */
export function shellContainerFor(tab: string): string {
  return tab === 'markets' || tab === 'globe' ? SHELL_CONTAINER_WIDE : SHELL_CONTAINER
}

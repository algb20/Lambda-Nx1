/**
 * How wide the shell is, decided once so the header cannot drift from the page.
 *
 * ## The measurement that first forced this (2026-08-27)
 *
 * The header carried `max-w-2xl` — 672px — while the content had grown to
 * `88rem`. Measured in a real browser: at 1440px their left edges were 80px
 * apart, at 1920px 208px apart. Two elements meant to share an edge did not,
 * because their widths were separate strings in separate files.
 *
 * ## The R338 shell
 *
 * The owner's reference design (R338, 2026-10-09) replaced the centred column
 * with a full-width frame: a sidebar down the left, the header across the top,
 * and the brand in the header sitting exactly above the sidebar. The edge the
 * two must share is now the sidebar's right edge, so the sidebar's width is the
 * constant both read. Content padding is decided here too, by what each screen
 * is for.
 */

/** The sidebar's width at `lg` and up. The header's brand block uses the same. */
export const SIDEBAR_WIDTH = 'lg:w-64'

/** Reading and dashboard screens: full width beside the sidebar, padded, capped on very wide monitors. */
export const SHELL_CONTAINER = 'mx-auto w-full max-w-[120rem] px-3 py-4 sm:px-4 lg:px-6 lg:py-5'

/**
 * The map takes the frame edge to edge.
 *
 * Width is earned by what a screen is *for*: a map is a display somebody
 * watches, and padding around it is monitor nobody can use.
 */
export const SHELL_CONTAINER_WIDE = 'w-full p-0'

/** Which of the two a tab uses. */
export function shellContainerFor(tab: string): string {
  return tab === 'globe' ? SHELL_CONTAINER_WIDE : SHELL_CONTAINER
}

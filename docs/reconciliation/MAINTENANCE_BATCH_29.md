# Batch 29 — R338 design: the new frame (D-1) and the Home dashboard (D-2)

| | |
|---|---|
| **Date** | 2026-10-09 |
| **Request** | R338. The owner rejected the current design and layout and supplied two reference images. |
| **Plan** | `BUILD_PLAN_R338.md`, Track D |
| **Status** | REPO-PRESENT + REPO-TESTED. Not deployed: Production is locked (R306). |

## What changed

### D-1 — the frame

- **Tokens.** Dark is now the default theme: deep navy surfaces and a blue primary (`app/globals.css`, `hooks/use-theme.ts`, `app/layout.tsx`). Light mode keeps a blue primary.
- **Sections.** Eleven sections in three sidebar groups, in the order of the reference (`lib/navigation.ts`):
  - **Main:** Home, Global Intelligence, Situations & Alerts, Monitoring & Watchlist, Maps & Geospatial.
  - **Analysis:** Data & Analytics, Research, Forecast & Scenarios, Risks.
  - **Library:** Knowledge Base, Settings.

  Labels exist in all seven curated locales. Old ids still resolve, and `calibration` now leads to Forecast & Scenarios.
- **Sidebar** (`components/side-nav.tsx`):
  - The active section is shown in solid blue.
  - "Situations & Alerts" carries a count of critical events.
  - The foot holds a UTC/local clock and the source-credits link.
  - The count is read passively (`subscribeToWorldPassively`), so the sidebar never starts a sweep of its own.
- **Header** (`components/header.tsx`):
  - The brand block is exactly as wide as the sidebar.
  - One search box opens the command palette.
  - Also in the header: the UTC clock, an alerts bell (with the same count, linking to Situations), the posture badge, language, theme and account.
  - The microphone glyph from the reference was **not** added, because there is no voice search.
- **Phone bar** (`components/bottom-nav.tsx`): Home, Intelligence and Maps, plus "More", which opens every section as a sheet.
- **Page frame** (`app/page.tsx`):
  - The layout is full width beside the sidebar, and every section gets a localized heading and a one-line statement of what it shows.
  - The context rail is removed (`components/context-rail.tsx` deleted). The new frame has no column for it, and its content is on the Home dashboard.
- **Width constants** (`lib/shell-width.ts`):
  - `SIDEBAR_WIDTH` is read by both the header and the sidebar, so their shared edge cannot drift.
  - `shellContainerFor` sets the page padding.
- **Sign-in card** (`components/standalone-auth.tsx`):
  - It is one line at every width.
  - While it shows, it marks `<html data-sign-in-prompt="open">` and the sidebar makes room for it, so the card no longer covers the clock.

### D-2 — Home (`components/home-dashboard.tsx`)

Every slot is real, or it says what is missing.

| Slot | Source |
|---|---|
| Active situations | `fusion.events` and `fusion.corroborated` from the world sweep. The sparkline is reports per UTC day in the sweep, labelled as *not a trend*. |
| Critical alerts | `tierOf` (`lib/world/tiers.ts`). Agency alert level first (red/extreme → critical, orange/severe → significant), then the timeline's severity bands. One definition, shared with the timeline. |
| Watchlist items | `GET /api/monitors`. Signed out, the card shows "—" and asks the reader to sign in; it never shows 0. |
| Countries with elevated signal | `scoreAllCountries`. Counts only countries observed well enough to compare (observability ≥ 34). |
| Layered map | `WorldSurface` with eight layer groups mapped onto the existing categories (`lib/world/dashboard.ts`, `LAYER_GROUPS`), a 2D/3D switch, and a selection card showing tier, type, country, confidence **as a word**, source and time. On a phone the switches become a row above the map so they do not cover it. |
| Latest intelligence | `latestIntelligence` (`rankEvents`), with tier labels and source links. |
| Intelligence health | Measured rates only: source health, reachability, regions observable, events corroborated, events with a source time. `null` shows "—". |
| Active situations | `activeSituations`, ordered by independent origins. |
| Global time | Device clock: UTC and five cities. |
| Key global indicators | `POST /api/intelligence/board`: Brent, WTI, Henry Hub, VIX, BTC, ETH, USD/EUR, as each source publishes them. |
| Top watchlist | The reader's monitors. |
| Global risks | Reported signal among well-observed countries, labelled *not a forecast*. |
| AI analyst | A link to the gateways analyst. "It sorts; it never verifies." |
| Category strip | Links to sections. |

**Deliberately absent:**
- **Opportunities, Decisions and Workspace.** The reference shows them, but this product has no source for them yet. They arrive with their Track M units.
- **The reference's "Confidence 78%" style figures.** A confidence is never a percentage (S invariant 14).

### A defect found and fixed during the walkthrough

The first build put a **"+250% vs prior day"** note on the active-situations card. It came from comparing the last full day with the one before. The sweep's sources keep different look-back windows (a week of earthquakes, a day of airport notices), so older days are under-counted by construction, and the figure described the windows, not the world. The note was removed, along with `dayOverDay` and its test. The sparkline stays, with an explicit label.

The bell and the sidebar counted only placed events (9) while the Home card counted placed and unplaceable (15). All three now count the same population.

## Tests

- New:
  - `lib/world/tiers.test.ts` (4);
  - `lib/world/dashboard.test.ts` (4);
  - passive subscription in `lib/world/report-store.test.ts`.
- Updated for the R338 section list:
  - `lib/navigation.test.ts`: the exact list, sidebar groups, phone-bar slots and `calibration → forecast`;
  - `app/shell-code-splitting.test.ts`: the new panels are on demand and every panel is server-rendered;
  - `lib/platform/responsive.test.ts`: the header and sidebar share `SIDEBAR_WIDTH`.
- `lib/http/discard.test.ts` caught two Home fetches that abandoned response bodies. Both now call `discardBody`.

**Results:**
- `tsc`: clean.
- `vitest`: 217 files passed, 1 skipped; 2,897 tests passed, 10 skipped.
- `next build`: passes.

## Browser check

Production build checked in Chromium (`next start`) at 1600×1000, 1440×900 and 390×844. Every section renders in the frame:
- Home;
- Situations;
- Global Intelligence;
- Monitoring;
- Maps;
- Data & Analytics;
- Research;
- Forecast;
- Risks;
- Knowledge Base;
- Settings.

**Remaining for D-3:**
- Monitoring (signed out) and Forecast are thin pages.
- The inner headings of older panels still duplicate the frame's heading in places.

The Markets correlation panel showed CoinGecko answering 429 during repeated screenshots. The panel already reports this as "provider answered 429" rather than drawing nothing.

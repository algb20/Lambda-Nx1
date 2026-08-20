/**
 * What a company just told its regulator, and which of it matters.
 *
 * ## The capability, and why it is unusual to have it free
 *
 * The SEC's full-text search indexes the **body of every filing** — not titles,
 * not metadata, the text — and answers without a key. Products that sell this
 * capability charge institutional prices for it. It also returns, on every 8-K,
 * the **item codes**: the machine-readable list of *which disclosure
 * obligations the filing was made under*.
 *
 * That is the whole opportunity. An 8-K is not one kind of event; it is
 * twenty-odd kinds sharing a form number, and the item codes say which.
 *
 * ## The insight that makes this analysis rather than a list
 *
 * Measured on a real three-day window of 996 filings: **item 9.01 appeared on
 * 92 of 100** — it is "financial statements and exhibits", an administrative
 * attachment note that means nothing on its own. Item 4.02 appeared on none of
 * them, and it means *the company is telling the market its previously issued
 * financial statements can no longer be relied upon.*
 *
 * A product that lists 8-Ks by date shows the reader ninety-two exhibit notices
 * and buries the restatement. So each item carries a weight for what it
 * **signals**, and the filings are ranked by the most consequential item they
 * contain. The reader is told which item drove the ranking, in words.
 *
 * ## What this is not
 *
 * Not investment advice, not a prediction, and never a claim that a company is
 * in trouble. A filing is a company's own statement to its regulator. This says
 * what kind of statement it is and how unusual that kind is. Everything beyond
 * that is the reader's judgement, and the row gives them the filing itself to
 * form it.
 */

export interface DisclosureItem {
  code: string
  /** What the SEC calls it. */
  label: string
  /** What it actually signals, in a sentence a non-specialist can use. */
  means: string
  /**
   * How much this item says about the company's condition, 0–100.
   *
   * Zero is a real value and belongs to the administrative items: a filing
   * whose only item is 9.01 is telling you an exhibit is attached.
   */
  weight: number
}

/**
 * The 8-K item taxonomy.
 *
 * Ordered by section as the SEC numbers them, not by weight, so it can be
 * checked against the regulation rather than against our opinion of it.
 */
export const DISCLOSURE_ITEMS: DisclosureItem[] = [
  { code: '1.01', label: 'Entry into a material agreement', means: 'The company signed something material — a contract, a credit facility, a merger agreement.', weight: 45 },
  { code: '1.02', label: 'Termination of a material agreement', means: 'A material agreement ended. Often routine expiry, occasionally a deal collapsing.', weight: 50 },
  { code: '1.03', label: 'Bankruptcy or receivership', means: 'The company has entered bankruptcy or receivership. There is no more consequential item in the taxonomy.', weight: 100 },
  { code: '1.05', label: 'Material cybersecurity incident', means: 'A cybersecurity incident the company judged material. This item only exists since 2023 and is filed rarely.', weight: 85 },
  { code: '2.01', label: 'Completion of an acquisition or disposition', means: 'A purchase or sale of assets has closed.', weight: 55 },
  { code: '2.02', label: 'Results of operations', means: 'Earnings. Scheduled, expected, and reported by everyone — informative, rarely surprising in itself.', weight: 30 },
  { code: '2.03', label: 'Creation of a financial obligation', means: 'New debt or an off-balance-sheet obligation.', weight: 40 },
  { code: '2.04', label: 'Triggering event accelerating an obligation', means: 'A covenant or condition has been tripped and debt may now come due early. A distress signal.', weight: 85 },
  { code: '2.05', label: 'Costs of exit or disposal activities', means: 'Restructuring — plant closures, layoffs, discontinued lines — with the cost booked.', weight: 70 },
  { code: '2.06', label: 'Material impairment', means: 'The company has written down the value of assets it holds. It is telling the market something it owns is worth less than it said.', weight: 80 },
  { code: '3.01', label: 'Delisting notice or listing-rule failure', means: 'The exchange has told the company it no longer meets listing requirements.', weight: 90 },
  { code: '3.02', label: 'Unregistered sale of equity', means: 'Shares issued outside a registered offering — a private placement, a conversion, a settlement.', weight: 35 },
  { code: '3.03', label: 'Modification of security holder rights', means: 'The terms attached to a class of securities have changed.', weight: 45 },
  { code: '4.01', label: 'Change of certifying accountant', means: 'The company changed auditors. Sometimes routine, and one of the oldest warning signs in the book when it is not.', weight: 75 },
  { code: '4.02', label: 'Non-reliance on previously issued financials', means: 'The company is telling the market its own past financial statements cannot be relied upon. The most serious accounting disclosure that exists short of bankruptcy.', weight: 95 },
  { code: '5.01', label: 'Change in control', means: 'Control of the company has changed hands.', weight: 80 },
  { code: '5.02', label: 'Departure or election of directors and officers', means: 'An executive or board member arrived or left. An abrupt CEO or CFO departure with no successor named is read very differently from a planned retirement.', weight: 60 },
  { code: '5.03', label: 'Amendment to articles or bylaws', means: 'The company changed its own governing documents.', weight: 30 },
  { code: '5.07', label: 'Submission of matters to a shareholder vote', means: 'Annual meeting results. Scheduled and routine.', weight: 20 },
  { code: '7.01', label: 'Regulation FD disclosure', means: 'Something the company chose to disclose to everyone at once — usually a presentation or a press release.', weight: 25 },
  { code: '8.01', label: 'Other events', means: 'The catch-all. Anything the company judged worth reporting that fits no other item.', weight: 20 },
  // The measured noise floor: on a real window this appeared on 92 of 100 filings.
  { code: '9.01', label: 'Financial statements and exhibits', means: 'An administrative note that documents are attached. It accompanies most filings and signals nothing on its own.', weight: 0 },
]

const BY_CODE = new Map(DISCLOSURE_ITEMS.map((i) => [i.code, i]))

export function describeItem(code: string): DisclosureItem | null {
  return BY_CODE.get(code) ?? null
}

export interface FilingAssessment {
  /** 0–100, from the most consequential item present. */
  weight: number
  /** The item that drove it, or null when the filing carries only noise. */
  leading: DisclosureItem | null
  /** Every recognised item, most consequential first. */
  items: DisclosureItem[]
  /** Codes the taxonomy does not know. Shown, never dropped. */
  unknown: string[]
  /** One sentence a reader can act on. */
  summary: string
}

/**
 * Score a filing by the most consequential thing it discloses.
 *
 * **Maximum, not sum.** A filing carrying a bankruptcy notice and an exhibit
 * list is a bankruptcy notice; adding the exhibit's zero changes nothing, and
 * summing several mild items would let three routine disclosures outrank one
 * restatement. The strongest item is what the filing is *about*.
 */
export function assessFiling(codes: readonly string[]): FilingAssessment {
  const items: DisclosureItem[] = []
  const unknown: string[] = []

  for (const code of codes) {
    const item = BY_CODE.get(code)
    if (item) items.push(item)
    // A code we do not recognise is a fact about our taxonomy, not about the
    // filing. Dropping it would hide a new item the SEC has since introduced.
    else if (code.trim()) unknown.push(code.trim())
  }

  items.sort((a, b) => b.weight - a.weight)
  const leading = items[0] && items[0].weight > 0 ? items[0] : null

  return {
    weight: leading?.weight ?? 0,
    leading,
    items,
    unknown,
    summary: summarise(leading, unknown),
  }
}

function summarise(leading: DisclosureItem | null, unknown: string[]): string {
  if (!leading) {
    const tail = unknown.length ? ` Carries ${unknown.length} item code(s) this taxonomy does not know: ${unknown.join(', ')}.` : ''
    return `Administrative — nothing in this filing's item codes signals a change in the company's condition.${tail}`
  }
  if (leading.weight >= 80) return `Serious: ${leading.means}`
  if (leading.weight >= 55) return `Substantive: ${leading.means}`
  return `Routine: ${leading.means}`
}

/**
 * Which items a reader should be shown first when scanning a day of filings.
 *
 * Not the same question as scoring one filing. Here the answer is the items
 * that are both **consequential and rare** — a heavy item that arrives fifty
 * times a day is a busy season, not an alarm.
 */
export function standoutCodes(
  filings: ReadonlyArray<{ items: readonly string[] }>,
  minWeight = 70,
): Array<{ item: DisclosureItem; count: number }> {
  const counts = new Map<string, number>()
  for (const filing of filings) {
    for (const code of filing.items) {
      const item = BY_CODE.get(code)
      if (item && item.weight >= minWeight) counts.set(code, (counts.get(code) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([code, count]) => ({ item: BY_CODE.get(code) as DisclosureItem, count }))
    .sort((a, b) => b.item.weight - a.item.weight || a.count - b.count)
}

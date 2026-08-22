/**
 * What the platform does on its own, declared once.
 *
 * ## The failure this exists for, measured
 *
 * Four cron jobs existed and the two hosts ran different subsets of them:
 *
 * | Job | Netlify (the charter §4 default) | Vercel |
 * |---|---|---|
 * | `publish` | every 20 minutes | daily at 06:00 |
 * | `radar-watch` | hourly | never |
 * | `radar` | never | daily at 07:30 |
 * | `radar-monitors` | **never** | only via the daily `radar` |
 *
 * Two things are wrong there and the second is serious.
 *
 * The first looks like drift and is not. **Vercel's plan allows two cron jobs,
 * each at most once a day** — a constraint a previous session paid most of a
 * day to discover, because exceeding it fails the whole deployment while the
 * site keeps serving the old code. `vercel-config.test.ts` has asserted it ever
 * since. So the hosts *cannot* run identical schedules, and the honest design
 * is not to pretend otherwise: **Netlify is the scheduler**, ticking every
 * twenty minutes with no cap, and Vercel is a degraded fallback that gets the
 * best two daily jobs its plan permits. That is stated here rather than
 * discovered again.
 *
 * The second is a real bug: **`radar-monitors` was scheduled nowhere at all.**
 * That job runs the monitors
 * users have saved — the feature that watches a query and alerts when it
 * changes. On Vercel the daily `radar` swept them once a day as a side effect
 * of running both halves; **on Netlify, the default host, never**. So the
 * monitoring feature was automatic in the sense the route's own doc comment
 * warns about: *"automatic only in the sense that nobody was doing it."*
 *
 * That is R152 word for word — auto-work must run continuously rather than sit
 * static — and it had been true of the platform's own alerting all along.
 *
 * ## How this file prevents it happening again
 *
 * One declaration, two readers with different budgets. Netlify's scheduled
 * function reads `dueJobs()` to decide what to run on a tick. Vercel's two
 * daily slots come from `VERCEL_FALLBACK`, which names them *and says what each
 * costs in freshness*, so the gap between the hosts is written down instead of
 * being a surprise.
 *
 * The guard is the part that matters: a job in `SCHEDULED_JOBS` with neither a
 * cadence nor a stated reason for having none fails the test. "Exists but never
 * runs" stops being a state this codebase can be in.
 */

/** Every job `/api/cron/[job]` can run. The route's own list is the authority. */
export const SCHEDULED_JOBS = [
  'publish',
  'radar',
  'radar-monitors',
  'radar-watch',
  'sources',
] as const
export type ScheduledJob = (typeof SCHEDULED_JOBS)[number]

export interface JobSchedule {
  job: ScheduledJob
  /**
   * How often, in minutes, on the Netlify clock. Vercel cannot follow these —
   * see `VERCEL_FALLBACK` for what it gets instead and what that costs.
   */
  everyMinutes: number
  /** Why this cadence and not a faster or slower one. */
  why: string
}

/**
 * The cadences, each with the reason it is that number.
 *
 * A cadence with no reason beside it is a number somebody will change on a
 * hunch. These match what `docs/DEPLOY.md` already documented as the suggested
 * cadence — the documentation was right and the schedules did not follow it.
 */
export const SCHEDULE: JobSchedule[] = [
  {
    job: 'publish',
    everyMinutes: 20,
    why:
      "Roughly the interval at which the underlying publishers themselves update. Faster spends their goodwill for nothing new; slower and the front page is a thing a reader learns to stop revisiting.",
  },
  {
    job: 'radar-monitors',
    everyMinutes: 20,
    why:
      "A user's monitor exists to tell them when something changed, so the delay between the change and the telling is the whole product. This was scheduled on neither host, which meant that delay was infinite until somebody pressed a button.",
  },
  {
    job: 'radar-watch',
    everyMinutes: 60,
    why:
      'The curated watchlist changes on the scale of days, so sweeping it three times an hour would be work nobody reads. Hourly keeps it current without pretending it moves faster than it does.',
  },
  {
    job: 'sources',
    everyMinutes: 1440,
    why:
      "Re-asks the quarantined sources whether they work again. Coverage that only heals when somebody remembers is coverage that decays: eight days after the quarantine was written, six of its fifty-one entries were back and nothing in the platform knew. Daily, because a publisher that fixes its feed does not fix it twice in an afternoon, and because these are hosts that have already refused us once.",
  },
  /**
   * `radar` is deliberately absent from the Netlify clock — see `UNSCHEDULED`.
   */
]

/**
 * Jobs with no place on the Netlify clock, and why each is excused.
 *
 * `radar` is not idle work — it is Vercel's second daily slot, where running
 * both halves in one job is the only way to reach the monitors at all inside a
 * two-cron budget. On Netlify the two halves have their own cadences, so
 * scheduling it there as well would sweep the same ground a third time on a
 * third clock.
 */
export const UNSCHEDULED: Partial<Record<ScheduledJob, string>> = {
  radar:
    'runs both halves at once: unnecessary on Netlify where each half has its own cadence, and essential on Vercel where two daily slots is the whole budget',
}

/**
 * Which jobs are due on a tick.
 *
 * Netlify's scheduler fires every `tickMinutes`; a job runs when the ticks
 * elapsed land on its interval. `publish` at 20 runs three times an hour,
 * `radar-watch` at 60 runs once — at the top, which is where a tick and an
 * hourly interval coincide.
 *
 * ## Why the tick counts the day and not the hour
 *
 * It counted the hour, which silently capped every cadence at sixty minutes: a
 * job asking for 1,440 got `everyTicks = 72`, and against a tick that only ever
 * reached 2 the modulo matched at minute 0 of **every hour**. A daily job would
 * have run twenty-four times a day while the number beside it said once — the
 * schedule lying about itself, which is the whole class of fault this file was
 * written to end.
 *
 * Counting ticks since midnight makes the arithmetic mean what it reads as, at
 * every cadence from one tick to one day.
 */
export function dueJobs(now: Date, tickMinutes = 20): ScheduledJob[] {
  const minuteOfDay = now.getUTCHours() * 60 + now.getUTCMinutes()
  // Which tick of the day this is: 0, 1, 2 … 71 for a 20-minute cadence.
  const tick = Math.floor(minuteOfDay / tickMinutes)
  return SCHEDULE.filter((s) => {
    const everyTicks = Math.max(1, Math.round(s.everyMinutes / tickMinutes))
    return tick % everyTicks === 0
  }).map((s) => s.job)
}

/**
 * Vercel's two daily slots, and what each one costs.
 *
 * Not derived from `SCHEDULE` by rounding, because rounding would silently make
 * the fallback look equivalent. Two jobs at once a day is the entire budget, so
 * they are chosen rather than computed: `publish`, because a front page that
 * never renews is the most visible failure; and `radar`, because it runs *both*
 * halves and so covers monitors and the watchlist in the one remaining slot.
 *
 * A deployment that needs the twenty-minute cadence runs on Netlify, or on a
 * Vercel plan without the cap. Which is a real answer, and a better one than a
 * config file that fails the build.
 */
export const VERCEL_FALLBACK: Array<{ path: string; schedule: string; costs: string }> = [
  {
    path: '/api/cron/publish',
    schedule: '0 6 * * *',
    costs: 'the front page renews once a day instead of three times an hour',
  },
  {
    path: '/api/cron/radar',
    schedule: '30 7 * * *',
    costs:
      "a user's monitor is swept once a day, so the delay between a change and the alert can be most of a day",
  },
]

# Why `vercel.json` looks the way it does

Short file, two constraints behind it, both learned the hard way.

## The crons are daily, and there are only two

Vercel's Hobby plan allows **two cron jobs, each at most once per day**. An
expression that fires more often is not throttled or warned about — the whole
**deployment fails**, with this message:

```
Hobby accounts are limited to daily cron jobs. This cron expression
(0 */6 * * *) would run more than once per day.
```

That is worth stating plainly because of how it failed. A six-hourly publish
schedule was committed, and from that moment every Vercel build for this project
failed. Nothing about the app was broken; the site simply stopped receiving new
code, and the symptom the operator saw was "I merged and nothing changed" — a
deployment problem wearing the costume of an application problem. It cost most of
a day to find.

So: two crons, both daily. The Radar's two halves are combined into
`/api/cron/radar` rather than scheduled separately, because two halves would
spend both of the plan's slots and leave none for publishing.

If this project ever moves to a paid Vercel plan, the schedules can go back to
the cadence the jobs actually want — six-hourly publishing, hourly monitors.
Until then the ceiling is the plan's, not the product's.

## Netlify is scheduled separately, and that is not duplication

Netlify does not read this file. `netlify/functions/scheduled-jobs.mts` is the
scheduler there, and it runs every six hours because Netlify imposes no such
limit.

It is a *caller*: it performs an authenticated request to the same
`/api/cron/<job>` routes Vercel Cron calls. Both hosts therefore drive identical
code, and there is no second copy of the publishing logic that could drift out of
step with the first. The schedules differ because the plans differ; the work does
not.

## The function ceilings

Every route listed under `functions` fans out to several public providers. The
platform default (10 s) is below the worst realistic case, and a route killed
mid-request returns an HTML error page where the client expects JSON — which is
how the world map ends up empty. The 60 s ceiling is a safety net, not the normal
path: sources run in parallel and each carries its own deadline.

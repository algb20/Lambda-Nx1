# Maintenance Batch 17 — a dependency vulnerability; AI clauses in source terms (2026-10-08, R325)

| | |
|---|---|
| **Authority** | Owner R312 (standing authorisation); R325 «اكمل دون توقف كل المطلوب» |
| **Production** | Not affected; locked on `9c19303` (R306) |
| **Base** | `1d7fcb4` |

## D1 — Dependency security

`npm audit` reported one high-severity advisory:
- **What:** `source-map-js` 1.2.1, an event-loop denial of service through crafted source-map section offsets.
- **Where:** a transitive build-time dependency (postcss, Tailwind, jsdom).
- **Fix:** `npm audit fix` moved it to the patch release 1.2.2. Only `package-lock.json` changed.
- **After:** `npm audit` reports 0 vulnerabilities. The build and the full suite pass.

## D2 — AI/ML clauses in the terms of running sources (GL-08)

**The scan:**
- The registry's AI/ML-use and training-use fields were NOT_STATED everywhere.
- Every terms page of a running (non-withheld) source was fetched and searched for AI, machine learning, LLM, text-and-data mining and training, in English, French, German, Spanish, Arabic and Japanese. That is 210 pages, plus 23 that matched only on navigation or news text.

**Express clauses found, quoted into the registry:**

| Source | Clause | Lambda |
|---|---|---|
| GitHub (`github`, `github_advisories`, username check) | §D.9 Access Reciprocity: automated access to train a commercial AI system waives your own restrictions on GitHub's access | Trains no model. `training_use` set to CONDITIONAL. |
| Docker Hub (username check) | "Train competing artificial intelligence or machine learning models without our express written consent" (prohibited) | `training_use` set to NO. |
| Nominatim | LLMs may suggest the service only while pointing to the policy, and "you must not implement [auto-complete] on the client side using the API" | Calls it only on an explicit submit in the geo gateway, never per keystroke. Complies. `ai_ml_use` set to CONDITIONAL. |

**No source addresses an analyst summarising its content.** Silence stays NOT_STATED: absence is not permission (R317). The default remains owner decision C2 (Context Firewall, BC-4).

# Gateways — one engine, many families

Lambda NX is a multi-gateway intelligence platform. Every "gateway" is a family of
capabilities built on the **same** engine (`lib/engine`: guardrail + registry +
orchestrator + analysis core). Adding a gateway = adding passive, lawful sources under new
capabilities + a module + a UI mode. Nothing bypasses the passive-only / legal guardrails.

This design is future-proof: the platform grows by *families*, not rewrites.

## Families

### ✅ Shipped — OSINT & analysis (core)
| Module | Capabilities | Sources (keyless) |
|---|---|---|
| Domain / Infrastructure | dns, whois, subdomains, tech, archive, ip_reputation | DoH, RDAP, crt.sh, urlscan, Wayback, Shodan InternetDB |
| Email / Username | username_presence, email_breach | 11-platform check, XposedOrNot, Gravatar |
| Media verification | (local) | exifr EXIF/GPS, reverse-image links |
| Monitoring / Radar | change detection | reuses Domain family |
| Threat (CTI) | is this IP/domain/URL/hash malicious? | Feodo Tracker, URLhaus, ThreatFox (abuse.ch) |
| Financial / Sanctions / Corporate | is this entity/wallet safe to deal with? | OpenSanctions, GLEIF, mempool.space |

### ⏭️ Planned families (all lawful, free-source-first)
| Gateway | What it answers | Candidate free sources | Tier |
|---|---|---|---|
| **Geospatial / Transport** | where/when did this happen? | OpenStreetMap/Overpass, OpenSky (flights), AIS/marine | free + paid |
| **AI-analyst layer** | triage + summarize + suggest next pivot | Claude (Anthropic API) over our own evidence | **paid** |

Each planned gateway follows the shipped pattern: `lib/engine/sources/*`, a
`lib/modules/*` orchestrator returning a documented report, an API route, and a UI mode —
reusing the existing design.

## Guardrails for every family
Passive only · public + lawful sources · respect robots/ToS/rate limits · no
private-individual targeting · findings carry source + timestamp + Admiralty + confidence.
The AI-analyst **sorts evidence, it does not verify on its own** (reference §9).

## Monetization study (future) — free vs paid

Gated via the payments layer (Pi + standard). No feature is faked for any tier.

| | Free | Pro (paid) |
|---|---|---|
| Core OSINT (domain/username/email/media) | ✅ with daily limit | ✅ higher limits |
| Threat + Geospatial gateways | limited | ✅ full |
| Financial / Sanctions gateway | — | ✅ |
| AI-analyst layer | — | ✅ |
| Monitoring (radar) | 1 monitor | many + shorter intervals |
| Saved investigations / export | basic | full history + export |
| Keyed premium sources (opt-in) | — | ✅ |

**Design note:** tiering is a cross-cutting check (`user.plan` + a `requireTier` guard) over
the *same* features — never a separate app. To be implemented when subscriptions ship;
the payments layer already exists.

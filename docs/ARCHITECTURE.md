# Architecture

## Pipeline (target)

```
RSS sources (multi-topic)
    → Filter by enabled sources + user-selected topics
    → Collect (HTTP/RSS)
    → Clean + canonical URL dedupe
    → Persist (Postgres)
    → AI analyze once (structured JSON + Zod)
    → Select top diverse items (scheduled)
    → Deliver digest (Telegram; email later)
    → Dashboard feedback loop
```

## Topics (user-chosen)

Not tech-only. Preferences pick which buckets to follow, e.g.:

`ai-ml` · `web-dev` · `business` · `sports` · `world` · `science` · `health` · `productivity`

Each RSS source maps to one primary topic. Ingest respects `preferences.selectedTopics`.

## Runtime pieces

| Piece | Role | Phase |
|-------|------|-------|
| Next.js | Dashboard + API routes that pipeline/n8n call | 1+ |
| Postgres | Sources, articles, analyses, prefs, ingest runs (`:5433`) | 1–2 |
| n8n (Docker) | Schedules, orchestration, retries, Telegram (`:5679`) | 1 setup, 4 wire-up |
| Groq (or similar) | Structured article analysis | 3 |
| Telegram Bot | Daily digest delivery | 4 |

## Design constraints (learning focus)

- Prefer RSS/HTTP over brittle HTML scraping
- Analyze each article **once** (skip if unchanged)
- Validate all LLM output with Zod before persist
- Idempotent daily digest (no duplicate sends)
- Track cost / quality signals for evaluation later

## UX

Full InsightLoop design (see `docs/UX_REFERENCE.md` + moodboard asset). Dark dashboard, multi-topic prefs, relevance scores, workflow monitor, mobile digest.

## Out of scope (for now)

Autonomous multi-tool agents, RAG/vector DBs, WebSockets, auto-email blasts, login-gated scraping, job-application automation.

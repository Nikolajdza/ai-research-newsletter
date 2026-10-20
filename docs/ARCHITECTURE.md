# Architecture

## Pipeline (target)

```
RSS sources (multi-topic)
    → Filter by enabled sources + user-selected topics
    → Collect (HTTP/RSS)
    → Clean + canonical URL dedupe
    → Persist (Postgres)
    → AI analyze once (structured JSON + Zod; Groq → Gemini → OpenRouter)
    → Select top diverse items (scheduled)
    → Deliver digest (Telegram; email later)
    → Dashboard feedback loop
```

## Topics (user-chosen)

Curated catalog (25 topics in 5 groups) plus custom `c-*` topics from discovery. Each RSS source maps to one primary topic. Collect/analyze cover the **union** of every reader’s followed topics; digests stay personal.

## Runtime pieces

| Piece | Role | Phase |
|-------|------|-------|
| Next.js | Dashboard + API routes that pipeline / Cron / n8n call | 1+ |
| Postgres | Sources, articles, analyses, prefs, users, digests (Docker `:5433` locally; Supabase in prod) | 1–2, 6 |
| n8n (Docker) | Local hourly schedule (`:5679`) | 1 setup, 4 wire-up |
| Vercel Cron | Production daily run (`GET /api/pipeline/daily` at 05:00 UTC) | 8 |
| LLM | Structured analysis + topic discovery (failover chain) | 3, 10 |
| Telegram Bot | Daily digest delivery | 4, 6 |
| Cache Components | Feed / article / personal TTL + tag bust | 9 |

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

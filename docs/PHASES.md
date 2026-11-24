# Build phases

All five phases are complete.

## Phase 1 — Foundation

- Next.js + TypeScript scaffold
- Docker Compose: Postgres + n8n
- Env template, docs, folder conventions
- Minimal status home page

## Phase 2 — Ingest + dedupe

- Drizzle schema (sources, articles, analyses placeholders, preferences, ingest_runs)
- Multi-topic seed feeds (AI, web, sports, world, science, …)
- RSS fetch + normalize
- Canonical URL dedupe into Postgres
- Manual CLI (`npm run ingest:run`) or `POST /api/ingest/collect`

## Phase 3 — AI analyze

- Structured JSON prompt (summary, score, topics, takeaways)
- Zod validation via Groq `json_object`
- Persist analysis; never re-analyze if row already exists
- Token + estimated USD cost logging
- CLI `npm run analyze:run` / `POST /api/analyze`

## Phase 4 — n8n + Telegram digest

- Digest select (diverse top items) + Telegram HTML format
- Idempotent daily send (`digests` unique on date+channel); dry_run without bot
- `workflow_runs` for monitor
- Importable workflow: `n8n/workflows/daily-digest.json`
- APIs: `/api/digest/*`, `/api/pipeline/daily`

## Phase 5 — Dashboard

- InsightLoop shell from the moodboard: sidebar + topbar on desktop, bottom tabs on mobile
- Home: stats, top highlights (one per topic), recent summaries, pipeline + digest cards
- Explore: search, topic / score / sort filters, pagination, analyze-more
- Article detail: summary, why it matters, takeaways, action items, relevance gauge, save, 👍/👎
- Newsletter: today’s digest, Telegram preview, send / rebuild, history
- Saved, Sources (add / toggle / delete, feed health), Preferences, Settings
- Workflow monitor: n8n node diagram with step status, execution log, 7-day chart, AI cost & feedback
- n8n workflow records every execution via `/api/workflow/runs` (start + finish)
- Groq rate-limit (429) waits instead of failing articles

## Phase 6 — Accounts + personalization

- Email/password auth (scrypt), Postgres sessions, `proxy.ts` gate, public `/how-it-works`, `/login`, `/register`
- First account is admin (sources, pipeline, integrations); later accounts are members
- Per-user preferences, saved list, 👍/👎 and digests; articles + analyses stay shared
- Collect/analyze cover the union of all followed topics
- Telegram: per-user chat via deep link `/start <token>` (webhook in prod, `getUpdates` locally), `/stop` to unlink
- Card-style digest: header + one photo card per story with a “Read article ↗” button

## Phase 7 — Topics for anyone + public Discover

- Curated catalog of 25 topics in 5 groups (Tech, Money, Sports, World & Science, Culture & Life), ~55 seed feeds
- “Add any topic”: Groq suggests a Google News search feed, site feeds and subreddits; each one is fetched (SSRF-guarded, size/time limits) and parsed before it is offered
- Custom topics (`c-<Label>` keys in `custom_topics`) are shared: a second reader typing the same topic reuses its feeds
- Following a custom topic collects and analyzes its first stories in the background (`after()`)
- Scoring is relevance to the feed topic first, so general stories in a niche feed stay out of the digest
- Limits: 5 custom topics per reader, 4 feeds per topic, 15 discovery searches per hour
- `/welcome` onboarding after sign-up: pick at least 3 topics (World preselected) or type your own; finishing collects and analyzes those topics in the background. Unfinished accounts are sent there from any app page (`preferences.onboarded_at`)
- Public, read-only `/discover` (curated topics, last 7 days, analyzed stories) and `/discover/[id]`; signed-out `/` lands there

## Phase 8 — Free hosting

- Production: Vercel Hobby + Neon Postgres (was Supabase) + Vercel Cron (Hobby = once per day)
- `GET /api/pipeline/daily` from Cron (`Authorization: Bearer CRON_SECRET`) at 05:00 UTC
- Serverless DB: `max: 1`, `prepare: false`, SSL, `@vercel/functions` `attachDatabasePool`
- Digests opt-in via `DIGESTS_ENABLED` + per-user Settings toggle
- Step-by-step: [HOSTING.md](HOSTING.md) · migrate: [NEON.md](NEON.md)

## Phase 9 — Cache & speed

Custom `cacheLife` profiles in `next.config.ts` + helpers in `src/server/cache.ts`:

| Profile    | stale | revalidate | expire | Used for                         |
|------------|-------|------------|--------|----------------------------------|
| `feed`     | 60s   | 5 min      | 1 h    | Discover, Home, Explore          |
| `article`  | 2 min | 30 min     | 6 h    | Public + personal article detail |
| `personal` | 30s   | 2 min      | 30 min | Saved list, digest history       |

Uncached (always live): Preferences, Settings, Welcome, Workflow, live digest preview when history is empty.

Bust: `bustArticleCaches(userId?)` from pipeline, prefs/follow/onboarding/analyze, save, feedback.

## Phase 10 — Loading shells & LLM failover

- `loading.tsx` for `(app)`, Discover, Welcome
- LLM chain in `src/server/ai/llm.ts`: Groq → Gemini → OpenRouter (`LLM_PROVIDER_ORDER`)
- Optional env: `GEMINI_API_KEY`, `OPENROUTER_API_KEY` (+ model overrides)

## Phase 11 — Portfolio & demo readiness

- README: live URL, stack, demo walkthrough, pipeline table, status through phase 11
- [DEMO.md](DEMO.md): smoke checks (signed-out, member, admin, Cron, LLM failover)
- Open Graph / Twitter metadata on the root layout
- Host empty-state copy aligned with daily (not hourly) prod Cron

## Phase 12 — DB retention (stay on free tier)

- Daily pipeline step `retention`: delete articles older than 30 days (saved kept); also old digests / workflow + ingest logs
- Auto-tighten to **14 days** if DB ≥ ~380 MB or ≥ ~35k articles (free ~500 MB)
- Admin **Settings → Database**: size bar, row counts, retention mode (`ARTICLE_RETENTION_DAYS`)

## Phase 13 — Stability, Neon, digests off

- Fix hangs: sequential DB reads on Settings/Sources; skip n8n probe on Vercel; Neon-ready pool + `attachDatabasePool`
- Docs: production on Neon; [NEON.md](NEON.md) dump/restore from Supabase
- Digests off by default (`DIGESTS_ENABLED`); Settings toggle + admin “disable all”

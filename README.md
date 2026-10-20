# InsightLoop

**Live:** [ai-research-newsletter.vercel.app](https://ai-research-newsletter.vercel.app)

Multi-topic RSS → one structured AI pass per article (Zod-validated) → Postgres → a personal daily Telegram digest. Next.js dashboard with accounts, public Discover, and a free Vercel + Supabase deploy.

**Try it:** open [/discover](https://ai-research-newsletter.vercel.app/discover) → register → pick 3+ topics on `/welcome` (or type your own) → Settings → Connect Telegram → wait for the daily run (or ask an admin to **Workflow → Run now**).

## Why this project

Built as a portfolio piece focused on **pipeline orchestration**, not a chatbot UI:

- Reliable RSS ingest + canonical URL dedupe
- Structured LLM output with Zod validation (analyze once, never re-score)
- Multi-reader personalization (shared articles, per-user prefs / digests / feedback)
- Local n8n workflow + production Vercel Cron
- Cache Components + LLM failover (Groq → Gemini → OpenRouter)

## Stack

| Layer | Choice |
|-------|--------|
| App | Next.js 16 (App Router, Cache Components), TypeScript, Tailwind |
| Data | Postgres (Docker locally, Supabase in prod), Drizzle ORM |
| AI | Groq primary; optional Gemini / OpenRouter failover |
| Automation | n8n (local Docker) · Vercel Cron (prod, once/day) |
| Delivery | Telegram Bot API (card-style digest with photos) |
| Hosting | Vercel Hobby + Supabase Free (~$0) |

## Demo walkthrough

1. **Public** — [/discover](https://ai-research-newsletter.vercel.app/discover) and [/how-it-works](https://ai-research-newsletter.vercel.app/how-it-works) work signed out.
2. **Sign up** — first account is **admin** (sources, pipeline, integrations); later accounts are members.
3. **Onboarding** — `/welcome`: pick ≥3 catalog topics or type a niche (“Elden Ring”, “Partizan”).
4. **Telegram** — Settings → Connect → `/start <token>` in the bot → Check connection.
5. **Digest** — Newsletter shows history + Telegram preview; Cron sends daily at **05:00 UTC**.

Full production checklist: [docs/DEMO.md](docs/DEMO.md).

## Quick start (local)

```bash
npm install
cp .env.example .env      # GROQ_API_KEY_NEWSLETTER, TELEGRAM_BOT_TOKEN

npm run infra:up          # Postgres :5433, n8n :5679
npm run db:push && npm run db:seed
npm run pipeline:run -- --dry-run --analyze=20
npm run dev               # http://localhost:3000
npm run n8n:import        # optional — loads n8n/workflows/daily-digest.json
```

Optional failover keys: `GEMINI_API_KEY`, `OPENROUTER_API_KEY` (see `.env.example`).

Production deploy: [docs/HOSTING.md](docs/HOSTING.md).

## What you get in the app

| Route | Role |
|-------|------|
| `/discover` | Public week’s best analyzed stories |
| `/welcome` | First-run topic picker |
| `/` | Personalized home (stats, highlights, pipeline status) |
| `/articles` | Explore: search, filters, pagination |
| `/articles/[id]` | AI summary, takeaways, save, 👍/👎 |
| `/newsletter` | Digest + Telegram card preview + history |
| `/sources` | Feed health (admin manage) |
| `/workflow` | Pipeline monitor, cost, feedback |
| `/preferences` | Topics, score threshold, digest time, Telegram |
| `/settings` | Profile, Connect Telegram, integration health |

## Pipeline

| Step | CLI | API (`x-ingest-secret`) |
|------|-----|-------------------------|
| Collect + dedupe | `npm run ingest:run` | `POST /api/ingest/collect` |
| Analyze | `npm run analyze:run -- 10` | `POST /api/analyze` |
| Digest (all readers) | `npm run digest:send -- --dry-run` | `POST /api/digest/send` |
| Full day | `npm run pipeline:run -- --dry-run` | `GET/POST /api/pipeline/daily` |

- **Dedupe** — canonical URL unique index (tracking params stripped).
- **Analyze once** — unique `article_analyses.article_id`; 429s retried; Zod rejects bad JSON; failover across providers.
- **Idempotent digest** — one row per `(user, digest_date, channel)`.
- **Prod schedule** — Hobby Cron once/day (not hourly). Local n8n can still run hourly.

## Telegram

Header message + one photo card per story (HTML caption + “Read article ↗”). No image → text + link preview.

1. `@BotFather` → token in `TELEGRAM_BOT_TOKEN`
2. App: **Settings → Connect Telegram** → Start in chat
3. Prod: set webhook once (see [HOSTING.md](docs/HOSTING.md))

## Docs

- [Demo & smoke checks](docs/DEMO.md)
- [Hosting ($0)](docs/HOSTING.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Phases](docs/PHASES.md)
- [n8n](n8n/README.md)

## Status

**Phases 1–12** complete (incl. 30-day DB retention + admin storage meter for Supabase free).

Out of scope for now: email digests, RAG / vector DB, WebSockets, login-walled scraping, autonomous agents.

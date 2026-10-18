# InsightLoop — AI Research & Newsletter

Multi-topic RSS (AI, web, business, world, sports, science, health, productivity) → one structured AI pass per article (Groq + Zod) → Postgres → idempotent daily Telegram digest. Orchestrated by n8n, browsable in a Next.js dashboard.

**Demo flow:** feeds → AI summary & score → n8n run → Telegram message → dashboard history.

## Quick start

```bash
npm install
cp .env.example .env      # set GROQ_API_KEY_NEWSLETTER=...

npm run infra:up          # Postgres :5433, n8n :5679
npm run db:push && npm run db:seed
npm run pipeline:run -- --dry-run --analyze=20
npm run dev               # http://localhost:3000
npm run n8n:import        # loads n8n/workflows/daily-digest.json into the container
```

## Dashboard

| Page | What it shows |
|------|---------------|
| `/` Home | Greeting, stats, top highlights (one per topic), recent AI summaries, pipeline + digest status |
| `/articles` Explore | Search, topic chips, min-score / sort filters, pagination, “Analyze 8 more” |
| `/articles/[id]` | Summary, why it matters, takeaways, action items, relevance gauge, save, 👍/👎 feedback |
| `/newsletter` | Today’s digest, Telegram message preview, send / rebuild, history |
| `/saved` | Reading list |
| `/sources` | Feeds per topic, health, add / toggle / delete (feed URL validated on add) |
| `/workflow` | n8n node diagram with live step status, execution log, 7-day stats, AI tokens & cost, feedback |
| `/preferences` | Followed topics, digest time + timezone, min score, format, Telegram toggle |
| `/settings` | Display name, integration health, Telegram setup |

Mobile layout uses a bottom tab bar (Home, Saved, Digest, Sources, Settings).

## Pipeline

| Step | CLI | API (header `x-ingest-secret`) |
|------|-----|-----|
| Collect + dedupe | `npm run ingest:run` | `POST /api/ingest/collect` |
| Analyze | `npm run analyze:run -- 10` | `POST /api/analyze` |
| Digest | `npm run digest:send -- --dry-run` | `POST /api/digest/send` |
| Full | `npm run pipeline:run -- --dry-run` | `POST /api/pipeline/daily` |

- **Dedupe**: canonical URL (tracking params stripped) with a unique index; re-runs only update metadata.
- **Analyze once**: `article_analyses.article_id` is unique; Groq 429s are waited out, Zod rejects malformed output.
- **Idempotent digest**: one row per `(digest_date, channel)`. Second send the same day → `already_sent`. Without Telegram credentials it stores `dry_run`.
- **Schedule-aware**: the hourly n8n trigger only sends once the preferred digest hour has passed.
- **Diversity**: max 2 stories per topic in the digest; 👎 articles are excluded.

## n8n

`Manual / Schedule (hourly) → Start Run → RSS Read + Dedupe → AI Agent → Telegram Digest → Finish Run`

Every n8n execution creates a `workflow_runs` row, so it appears on `/workflow`. See [n8n/README.md](n8n/README.md).

## Telegram

1. `@BotFather` → `/newbot` → copy the token.
2. Message the bot, then open `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy `message.chat.id`.
3. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `.env`, restart `npm run dev`.
4. Newsletter → “Send today’s digest” (or “Rebuild & resend”).

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Phases](docs/PHASES.md)
- [UX](docs/UX_REFERENCE.md)
- [n8n](n8n/README.md)

## Status

**Phases 1–5 complete.** Out of scope for now: autonomous agents, RAG / vector DB, WebSockets, email blasts, login-walled scraping.

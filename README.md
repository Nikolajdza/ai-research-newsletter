# InsightLoop — AI Research & Newsletter

Multi-topic RSS (AI, web, business, world, sports, science, health, productivity) → one structured AI pass per article (Groq + Zod) → Postgres → a personal, idempotent daily Telegram digest for every reader. Orchestrated by n8n locally, browsable in a Next.js dashboard with accounts.

**Demo flow:** sign up → pick topics → connect Telegram → feeds are scored by AI → one card per story lands in your chat.

## Quick start

```bash
npm install
cp .env.example .env      # set GROQ_API_KEY_NEWSLETTER and TELEGRAM_BOT_TOKEN

npm run infra:up          # Postgres :5433, n8n :5679
npm run db:push && npm run db:seed
npm run pipeline:run -- --dry-run --analyze=20
npm run dev               # http://localhost:3000 → Get started
npm run n8n:import        # loads n8n/workflows/daily-digest.json into the container
```

The first account you register becomes the **admin** (manages sources, runs the pipeline, sees integration health). Everyone after that is a **member** with their own topics, saved list, feedback and digest.

## Accounts & personalization

- **Auth**: email + password (scrypt), sessions stored in Postgres (`sessions`, only a SHA-256 of the cookie token is kept), `il_session` httpOnly cookie for 30 days. `src/proxy.ts` sends signed-out visitors to `/how-it-works` or `/login`.
- **Shared vs. personal data**: articles and AI analyses are shared (each article is analyzed once). `preferences`, `user_articles` (saved + 👍/👎) and `digests` are per user.
- **Collect what readers follow**: collect and analyze run over the union of every reader's topics.
- **Your digest**: your topics, your minimum score, max 2 stories per topic, minus anything you 👎'd.

## Dashboard

| Page | What it shows |
|------|---------------|
| `/how-it-works` | Public explainer and sign-up CTA |
| `/login`, `/register` | Auth |
| `/` Home | Greeting, your stats, top highlights, recent AI summaries in your topics, pipeline + digest status |
| `/articles` Explore | Search, topic chips, min-score / sort filters, pagination, “Analyze 8 more” (admin) |
| `/articles/[id]` | Summary, why it matters, takeaways, action items, relevance gauge, save, 👍/👎 feedback |
| `/newsletter` | Your digest, Telegram card preview, send / rebuild, history |
| `/saved` | Your reading list |
| `/sources` | Feeds per topic and health; add / toggle / delete for the admin |
| `/workflow` | n8n node diagram with live step status, execution log, 7-day stats, AI tokens & cost |
| `/preferences` | Followed topics, digest time + timezone, min score, format, Telegram toggle |
| `/settings` | Display name, Connect Telegram, sign out, integration health (admin) |

Mobile layout uses a bottom tab bar (Home, Saved, Digest, Sources, Settings).

## Pipeline

| Step | CLI | API (header `x-ingest-secret`) |
|------|-----|-----|
| Collect + dedupe | `npm run ingest:run` | `POST /api/ingest/collect` |
| Analyze | `npm run analyze:run -- 10` | `POST /api/analyze` |
| Digest (all readers) | `npm run digest:send -- --dry-run` | `POST /api/digest/send` |
| Full | `npm run pipeline:run -- --dry-run` | `POST /api/pipeline/daily` |

- **Dedupe**: canonical URL (tracking params stripped) with a unique index; re-runs only update metadata.
- **Analyze once**: `article_analyses.article_id` is unique; Groq 429s are waited out, Zod rejects malformed output.
- **Idempotent digest**: one row per `(user, digest_date, channel)`. A second send the same day → `already_sent`. Readers without a connected chat get a `dry_run` row.
- **Schedule-aware**: the hourly trigger only sends to a reader once their preferred hour has passed in their timezone.

## n8n

`Manual / Schedule (hourly) → Start Run → RSS Read + Dedupe → AI Agent → Telegram Digest → Finish Run`

Every n8n execution creates a `workflow_runs` row, so it appears on `/workflow`. See [n8n/README.md](n8n/README.md).

## Telegram

The digest is sent the way channels post: a header message, then one card per story — photo (from the feed) with an HTML caption and a “Read article ↗” button. Stories without an image fall back to a text message with a large link preview.

1. `@BotFather` → `/newbot` → put the token in `TELEGRAM_BOT_TOKEN`, restart `npm run dev`.
2. In the app: **Settings → Connect Telegram**. This opens `t.me/<bot>?start=<one-time token>`.
3. Press **Start** in Telegram, then **Check connection** in the app. The bot replies “✅ Connected”. `/stop` in the chat disconnects.

Locally, “Check connection” polls `getUpdates`. In production, register a webhook once so the bot links chats instantly:

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d url=https://<your-app>/api/telegram/webhook \
  -d secret_token=$TELEGRAM_WEBHOOK_SECRET
```

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Phases](docs/PHASES.md)
- [UX](docs/UX_REFERENCE.md)
- [n8n](n8n/README.md)

## Status

**Phases 1–6 complete** (6 = accounts, personalization, card-style Telegram digest). Next: free hosting on Vercel + Supabase + Vercel Cron. Out of scope for now: autonomous agents, RAG / vector DB, WebSockets, email blasts, login-walled scraping.

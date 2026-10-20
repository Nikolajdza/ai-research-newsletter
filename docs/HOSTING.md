# Hosting (Vercel + Supabase, $0)

Local Docker Postgres + n8n stay for development. Production is:

| Piece | Free service | Role |
|-------|----------------|------|
| Next.js app | [Vercel Hobby](https://vercel.com) | Site, APIs, Telegram webhook |
| Postgres | [Supabase Free](https://supabase.com) | Data |
| Schedule | Vercel Cron | One run per day at **05:00 UTC** (~07:00 Belgrade) |

Hobby Cron cannot run hourly. The daily job collects feeds, analyzes ~20 articles, then sends every reader’s digest (it does **not** wait for each preferred hour). Change the hour in `vercel.json` (`0 5 * * *` is UTC).

Do these steps in order. Never paste tokens or database passwords into chat.

## 1. Supabase

1. Sign up at [supabase.com](https://supabase.com) and **New project**. Region close to you (e.g. Frankfurt). Save the database password.
2. **Project Settings → Database → Connection string**.
3. Copy the **URI** for the **Transaction pooler** (port **6543**). It looks like:

   `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres`

4. Keep it for step 3. Schema is applied from your laptop in step 4.

## 2. Secrets on your machine

Generate two random values (do not reuse the local `dev-insightloop-secret`):

```bash
openssl rand -hex 32   # INGEST_SECRET
openssl rand -hex 32   # CRON_SECRET
openssl rand -hex 32   # TELEGRAM_WEBHOOK_SECRET
```

Keep Groq and Telegram values from local `.env` (`GROQ_API_KEY_NEWSLETTER`, `TELEGRAM_BOT_TOKEN`). Optionally add `GEMINI_API_KEY` and/or `OPENROUTER_API_KEY` for LLM failover.

## 3. Vercel project

1. Sign up at [vercel.com](https://vercel.com) with GitHub.
2. **Add New → Project** → import `Nikolajdza/ai-research-newsletter`.
3. Framework: Next.js. Root: repo root. Do **not** deploy yet — add env vars first.
4. **Settings → Environment Variables** (Production + Preview):

| Name | Value |
|------|--------|
| `DATABASE_URL` | Supabase **transaction pooler** URI from step 1 |
| `NEXT_PUBLIC_APP_URL` | `https://<your-project>.vercel.app` (update after the first deploy if the slug differs) |
| `INGEST_SECRET` | from step 2 |
| `CRON_SECRET` | from step 2 |
| `GROQ_API_KEY_NEWSLETTER` | Groq key (primary LLM) |
| `GROQ_MODEL` | `openai/gpt-oss-120b` (same as local) |
| `GEMINI_API_KEY` | Optional failover |
| `OPENROUTER_API_KEY` | Optional failover |
| `TELEGRAM_BOT_TOKEN` | BotFather token |
| `TELEGRAM_BOT_USERNAME` | bot username without `@` |
| `TELEGRAM_WEBHOOK_SECRET` | from step 2 |

Leave `TELEGRAM_CHAT_ID` empty in production (each reader connects in Settings).

5. **Deploy**.

## 4. Schema + seed (from this laptop)

Point a one-off shell at **production** Supabase, then push schema and seed feeds. Use the **direct** connection (port **5432**, host `db.<ref>.supabase.co`) for `db:push` if the pooler rejects it.

```bash
# in the project root — does not write to .env
export DATABASE_URL='postgresql://…supabase…'
npm run db:push
npm run db:seed
```

`db:seed` is idempotent (skips existing feed URLs).

## 5. Telegram webhook

After the site is live:

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d url=https://<your-app>.vercel.app/api/telegram/webhook \
  -d secret_token=$TELEGRAM_WEBHOOK_SECRET
```

Then in the live app: **Settings → Connect Telegram → Start** in the bot.

## 6. First account

Open `https://<your-app>.vercel.app/register`. The first user is admin. Pick topics on `/welcome`. Dashboard and Discover should show stories after the first pipeline run.

Trigger a run without waiting until 05:00 UTC:

- Signed in as admin → **Workflow → Run now**, or
- Vercel → Project → **Cron Jobs** → Run, or
- `curl -X POST https://<your-app>.vercel.app/api/pipeline/daily -H "x-ingest-secret: $INGEST_SECRET" -H "content-type: application/json" -d '{}'`

## Checks

- `GET /api/health` → `{ ok: true }`
- `/discover` works signed out
- Login, Explore, Preferences
- Telegram cards after Connect + a pipeline run
- Vercel → **Cron Jobs** shows `/api/pipeline/daily` · `0 5 * * *`

## Local vs production

| | Local | Production |
|---|--------|------------|
| Database | Docker Postgres `:5433` | Supabase |
| Schedule | n8n hourly | Vercel Cron daily 05:00 UTC |
| Telegram link | `getUpdates` poll | webhook |
| Pipeline secret | `x-ingest-secret` | same, plus `CRON_SECRET` on GET |

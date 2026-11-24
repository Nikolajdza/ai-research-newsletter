# Hosting (Vercel + Neon, $0)

Local Docker Postgres + n8n stay for development. Production is:

| Piece | Free service | Role |
|-------|----------------|------|
| Next.js app | [Vercel Hobby](https://vercel.com) | Site, APIs, Telegram webhook |
| Postgres | [Neon Free](https://neon.tech) | Data (pooled endpoint) |
| Schedule | Vercel Cron | One run per day at **05:00 UTC** |

Hobby Cron cannot run hourly. The daily job collects feeds, analyzes ~20 articles, optionally sends digests (`DIGESTS_ENABLED`), then runs retention. Change the hour in `vercel.json` (`0 5 * * *` is UTC).

**Migrating from Supabase?** Follow [NEON.md](NEON.md) (dump → restore → swap `DATABASE_URL`).

Never paste tokens or database passwords into chat.

## 1. Neon

1. Sign up at [neon.tech](https://neon.tech) → **New project** (region near you).
2. **Connect** → enable **Connection pooling**.
3. Copy the **pooled** URI (`-pooler` in the hostname) for Vercel.
4. Keep the **direct** URI for `db:push` / migrations from your laptop.

## 2. Secrets on your machine

```bash
openssl rand -hex 32   # INGEST_SECRET
openssl rand -hex 32   # CRON_SECRET
openssl rand -hex 32   # TELEGRAM_WEBHOOK_SECRET
```

Keep Groq and Telegram values from local `.env`. Optionally add `GEMINI_API_KEY` / `OPENROUTER_API_KEY`.

## 3. Vercel env

| Name | Value |
|------|--------|
| `DATABASE_URL` | Neon **pooled** URI (`-pooler`) |
| `NEXT_PUBLIC_APP_URL` | `https://<your-project>.vercel.app` |
| `INGEST_SECRET` | from step 2 |
| `CRON_SECRET` | from step 2 |
| `GROQ_API_KEY_NEWSLETTER` | Groq key |
| `GROQ_MODEL` | `openai/gpt-oss-120b` |
| `GEMINI_API_KEY` / `OPENROUTER_API_KEY` | Optional failover |
| `TELEGRAM_BOT_TOKEN` | BotFather token |
| `TELEGRAM_BOT_USERNAME` | without `@` |
| `TELEGRAM_WEBHOOK_SECRET` | from step 2 |
| `DIGESTS_ENABLED` | `false` until you want Cron to send Telegram digests |
| `ARTICLE_RETENTION_DAYS` | Optional (default `30`) |

## 4. Schema + seed

```bash
export DATABASE_URL='postgresql://…@ep-….neon.tech/neondb?sslmode=require'  # direct
npm run db:push
npm run db:seed
```

Or restore an existing dump — see [NEON.md](NEON.md).

## 5. Telegram webhook

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d url=https://<your-app>.vercel.app/api/telegram/webhook \
  -d secret_token=$TELEGRAM_WEBHOOK_SECRET
```

## 6. Digests

Delivery is **off by default** (`DIGESTS_ENABLED` unset/false). Cron still collects, analyzes, and purges old rows.

To turn sends back on:

1. Vercel env → `DIGESTS_ENABLED=true` → Redeploy
2. Settings → enable **Daily Telegram digest** for your account
3. Connect Telegram if needed

## Checks

Full checklist: [DEMO.md](DEMO.md).

- `GET /api/health` → `{ ok: true }`
- Pages load without infinite skeletons (Neon pooled URL + sequential queries)
- Settings → Database shows size / counts

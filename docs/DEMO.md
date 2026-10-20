# Demo & production smoke checks

Use this before showing the project (interview, portfolio, friends). Never paste secrets into chat or screenshots.

**Live app:** https://ai-research-newsletter.vercel.app

## 5-minute signed-out pass

- [ ] `/discover` loads stories (or a clear empty state)
- [ ] `/discover/[id]` shows summary + takeaways for one story
- [ ] `/how-it-works` explains the pipeline
- [ ] `/login` and `/register` render
- [ ] `GET /api/health` → `{ "ok": true }`

```bash
curl -sS https://ai-research-newsletter.vercel.app/api/health
```

## Signed-in demo (member)

- [ ] Register (or log in) → lands on `/welcome` if not onboarded
- [ ] Pick ≥3 topics → Home shows stats / highlights after data exists
- [ ] Explore search + topic chip filter works
- [ ] Open an article → Save + 👍/👎 stick after refresh
- [ ] Newsletter shows preview or history
- [ ] Settings → Connect Telegram → Start in bot → **Check connection** → ✅

## Admin / pipeline (first account)

- [ ] Workflow page shows last run (or empty log)
- [ ] **Run now** (or Cron / curl) finishes without hanging the UI
- [ ] After a run: new analyses appear; Telegram gets cards if chat is linked
- [ ] Vercel → Cron Jobs lists `/api/pipeline/daily` at `0 5 * * *` (05:00 UTC)

Manual pipeline trigger (replace secret; do not commit it):

```bash
curl -X POST https://ai-research-newsletter.vercel.app/api/pipeline/daily \
  -H "x-ingest-secret: $INGEST_SECRET" \
  -H "content-type: application/json" \
  -d '{}'
```

Cron uses `Authorization: Bearer $CRON_SECRET` on **GET** `/api/pipeline/daily`.

## LLM failover (optional)

If only Groq is set, analysis still works. To survive free-tier 429s:

1. Add `GEMINI_API_KEY` and/or `OPENROUTER_API_KEY` in Vercel env
2. Redeploy
3. Settings (admin) → Integrations → LLM line shows primary + failover

## Common issues

| Symptom | Likely cause |
|---------|----------------|
| Empty skeleton forever | DB pool / `DATABASE_URL` (use Supabase **transaction** pooler `:6543` + `prepare: false`) |
| No Telegram cards | Webhook not set, or chat not linked via `/start <token>` |
| Analyze skipped | No LLM keys in Vercel env |
| Digest `already_sent` | Idempotent — use **Rebuild** / `force` once for demos |
| Cron never fired | Hobby = once/day; use **Run now** for demos |

## Talking points (portfolio)

1. Articles analyzed **once**; Zod gates bad model output.
2. Shared catalog + per-user digests (multi-tenant without duplicating AI cost).
3. Custom topics: SSRF-guarded feed discovery, shared `c-*` keys.
4. Local n8n vs prod Cron — same pipeline steps, different scheduler.
5. Cache profiles (`feed` / `article` / `personal`) + tag bust on write.

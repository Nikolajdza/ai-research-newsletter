# Migrate production DB: Supabase → Neon

Goal: free your Supabase project slot while keeping InsightLoop on Vercel Hobby.

Never paste connection strings or passwords into chat.

## 1. Create Neon project

1. Sign up at [neon.tech](https://neon.tech) → **New project** (region close to Vercel, e.g. Frankfurt / Frankfurt EU).
2. Open **Connect** → enable **Connection pooling**.
3. Copy two URIs:
   - **Pooled** (hostname has `-pooler`) → this becomes Vercel `DATABASE_URL`
   - **Direct** (no `-pooler`) → only for `pg_dump` / `db:push` / restore

Both should look like:

```
postgresql://USER:PASSWORD@ep-….eu-central-1.aws.neon.tech/neondb?sslmode=require
postgresql://USER:PASSWORD@ep-…-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

## 2. Dump from Supabase

Use the **direct** Supabase host (`db.<ref>.supabase.co`, port **5432**), not the pooler.

```bash
# From your laptop — set URLs in the shell only
export SUPABASE_DIRECT='postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres'
pg_dump "$SUPABASE_DIRECT" --no-owner --no-acl -Fc -f insightloop.dump
```

If `pg_dump` is missing: `brew install libpq` and use `/opt/homebrew/opt/libpq/bin/pg_dump`.

## 3. Restore into Neon

```bash
export NEON_DIRECT='postgresql://…@ep-….neon.tech/neondb?sslmode=require'
pg_restore --no-owner --no-acl --clean --if-exists -d "$NEON_DIRECT" insightloop.dump
```

If restore complains about roles, ignore role errors or add `--no-privileges`.

Sanity check:

```bash
psql "$NEON_DIRECT" -c 'select count(*) from articles; select count(*) from users;'
```

## 4. Point Vercel at Neon

1. Vercel → Project → **Settings → Environment Variables**
2. Update **`DATABASE_URL`** to the Neon **pooled** URI (`-pooler` in host)
3. Keep all other secrets the same
4. Set **`DIGESTS_ENABLED`** to `false` (or leave unset — digests stay off until you set `true`)
5. **Redeploy** Production

## 5. Verify

```bash
curl -sS https://ai-research-newsletter.vercel.app/api/health
```

Signed in as admin → **Settings → Database** should show counts. Open Explore / Home — they should load without hanging.

Optional: **Workflow → Run now** (collect + analyze + retention; digest skipped while `DIGESTS_ENABLED` is off).

## 6. Free Supabase

Only after the site works on Neon for a day:

1. Pause or **delete** the Supabase project to free the slot
2. Delete `insightloop.dump` from your laptop

## Local schema push (empty Neon)

If you prefer a clean DB instead of migrating data:

```bash
export DATABASE_URL='postgresql://…@ep-….neon.tech/neondb?sslmode=require'   # direct
npm run db:push
npm run db:seed
```

Then set Vercel `DATABASE_URL` to the **pooled** string and redeploy. You will need to re-register the first admin account.

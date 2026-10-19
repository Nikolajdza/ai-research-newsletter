# n8n — InsightLoop Daily Digest

```
Manual Trigger ─▶ Start Run (manual) ─┐
                                      ├─▶ RSS Read + Dedupe ─▶ AI Agent ─▶ Telegram Digest ─▶ Finish Run
Schedule (hourly) ─▶ Start Run (schedule) ┘
```

n8n is the orchestrator; the work happens in the Next.js API so it stays typed, tested and reusable from the dashboard and CLI.

| Node | Endpoint | Notes |
|------|----------|-------|
| Start Run | `POST /api/workflow/runs` | Creates a `workflow_runs` row; returns `run.id` + `respectSchedule` |
| RSS Read + Dedupe | `POST /api/ingest/collect` | Feeds of followed topics, canonical URL dedupe |
| AI Agent | `POST /api/analyze` | 8 unanalyzed articles, round-robin by topic |
| Telegram Digest | `POST /api/digest/send` | Loops over every reader; idempotent per reader and day; schedule runs wait for each reader's preferred hour |
| Finish Run | `POST /api/workflow/runs/:id/finish` | Final status from the recorded steps |

Each HTTP node retries (2–3 tries) and uses `neverError`, so a failing step is recorded on the run instead of killing the execution.

## Setup

n8n runs on **:5679** (AI Job Radar uses :5678). `docker-compose.yml` gives the container:

- `APP_BASE_URL=http://host.docker.internal:3000` and `INGEST_SECRET` (read in nodes as `$env.*`)
- `./n8n/workflows` mounted read-only at `/workflows`

```bash
npm run infra:up
npm run dev
npm run n8n:import      # import / update the workflow
```

1. Open [http://localhost:5679](http://localhost:5679) and create the owner account (first visit only).
2. Open **InsightLoop — Daily Digest** → **Execute workflow**.
3. Watch the run on [http://localhost:3000/workflow](http://localhost:3000/workflow) (trigger `manual`).
4. Keep the workflow **Active** for the hourly schedule.

Headless run (no UI):

```bash
docker exec -e N8N_RUNNERS_BROKER_PORT=5690 airn-n8n n8n execute --id=insightloopdaily
```

## Expected results

| Run | Digest step |
|-----|-------------|
| First of the day | `sent` (or `dry_run` without Telegram) |
| Again same day | `skipped` · `already_sent` / `already_dry_run` |
| Schedule before digest hour | `waiting` |

## Curl

```bash
curl -s -X POST http://localhost:3000/api/pipeline/daily \
  -H "content-type: application/json" \
  -H "x-ingest-secret: dev-insightloop-secret" \
  -d '{"analyzeLimit":5,"dryRunDigest":true}'
```

`/api/digest/preview` needs a signed-in session (it previews the current reader's digest), so open it in the browser.

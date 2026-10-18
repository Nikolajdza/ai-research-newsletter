# UX reference — InsightLoop

Source of truth for UI: the project moodboard (`assets/InsightLoop_AI_Research_Dashboard-*.jpg`). AI-generated for this product — use the full design language.

## Brand

- **Name:** InsightLoop
- **Subtitle:** AI Research & Newsletter
- **Theme:** Dark charcoal / navy
- **Accents:** Indigo–violet primary, teal/green for high relevance
- **Shape:** Rounded cards, soft borders, clear hierarchy

## Surfaces

1. **Desktop dashboard** — left sidebar (Home, Newsletter, Saved Articles, Sources, Preferences, Settings), search header, stat strip, Top Highlights cards (category + thumbnail + excerpt + relevance pill).
2. **Article detail** — hero, summary, tags, key takeaways; side panel with relevance gauge, Save / Share, source link.
3. **Preferences** — topic chips (multi-topic), source toggles, digest time/timezone, min relevance slider, format, Telegram/Email.
4. **Workflow monitor** — pipeline nodes + execution log + 7-day stats.
5. **Mobile** — Daily Digest list + bottom tabs (Home, Saved, Sources, Settings).

## Data the UI expects

- `relevanceScore` (1–10)
- `summary`, `keyTakeaways[]`, topic/category tags
- Stats: total articles, high relevance, saved, newsletters sent

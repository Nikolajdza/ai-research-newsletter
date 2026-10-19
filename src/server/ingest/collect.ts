import Parser from "rss-parser";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/client";
import {
  articles,
  ingestRuns,
  sources,
  type TopicKey,
} from "../db/schema";
import { getFollowedTopics } from "../followed-topics";
import { normalizeRssItem, type NormalizedArticle, type RawFeedItem } from "./normalize";

const MAX_ITEMS_PER_SOURCE = 30;
const SOURCE_CONCURRENCY = 4;

const parser: Parser<Record<string, unknown>, RawFeedItem> = new Parser({
  timeout: 15_000,
  headers: {
    "User-Agent": "InsightLoop/0.1 (+local-dev RSS reader)",
  },
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail", { keepArray: true }],
      "content:encoded",
    ],
  },
});

export type CollectResult = {
  runId: string;
  sourcesProcessed: number;
  articlesFetched: number;
  articlesInserted: number;
  articlesSkipped: number;
  errors: { source: string; message: string }[];
};

type SourceRow = typeof sources.$inferSelect;

async function collectSource(source: SourceRow) {
  const feed = await parser.parseURL(source.feedUrl);
  const items = (feed.items ?? []).slice(0, MAX_ITEMS_PER_SOURCE);

  // Same story can appear twice in one feed; Postgres rejects a batch that
  // hits the same conflict key twice, so collapse by canonical URL first.
  const byCanonical = new Map<string, NormalizedArticle>();
  let invalid = 0;
  for (const item of items) {
    const normalized = normalizeRssItem(item, {
      sourceId: source.id,
      topic: source.topic,
    });
    if (!normalized) {
      invalid += 1;
      continue;
    }
    if (!byCanonical.has(normalized.canonicalUrl)) {
      byCanonical.set(normalized.canonicalUrl, normalized);
    }
  }

  const rows = [...byCanonical.values()];
  let inserted = 0;
  if (rows.length > 0) {
    const result = await db
      .insert(articles)
      .values(rows)
      .onConflictDoUpdate({
        target: articles.canonicalUrl,
        set: {
          imageUrl: sql`coalesce(${articles.imageUrl}, excluded.image_url)`,
        },
      })
      .returning({ inserted: sql<boolean>`(xmax = 0)` });
    inserted = result.filter((r) => r.inserted).length;
  }

  return {
    fetched: items.length,
    inserted,
    skipped: items.length - inserted,
    invalid,
  };
}

export async function collectFromEnabledSources(options?: {
  /** If true, only sources whose topic at least one user follows */
  respectPreferences?: boolean;
  /** Collect only these topics (e.g. right after a reader adds one) */
  topics?: TopicKey[];
}): Promise<CollectResult> {
  const respectPreferences = options?.respectPreferences ?? true;

  const [run] = await db
    .insert(ingestRuns)
    .values({ status: "running" })
    .returning();

  const errors: CollectResult["errors"] = [];
  let sourcesProcessed = 0;
  let articlesFetched = 0;
  let articlesInserted = 0;
  let articlesSkipped = 0;

  try {
    let topicFilter: TopicKey[] | null = options?.topics ?? null;
    if (!topicFilter && respectPreferences) {
      topicFilter = await getFollowedTopics();
    }

    const enabledSources = await db
      .select()
      .from(sources)
      .where(
        topicFilter
          ? and(eq(sources.enabled, true), inArray(sources.topic, topicFilter))
          : eq(sources.enabled, true),
      );

    for (let i = 0; i < enabledSources.length; i += SOURCE_CONCURRENCY) {
      const batch = enabledSources.slice(i, i + SOURCE_CONCURRENCY);
      const results = await Promise.allSettled(batch.map(collectSource));

      results.forEach((result, index) => {
        sourcesProcessed += 1;
        if (result.status === "fulfilled") {
          articlesFetched += result.value.fetched;
          articlesInserted += result.value.inserted;
          articlesSkipped += result.value.skipped;
        } else {
          const reason = result.reason;
          errors.push({
            source: batch[index].name,
            message: reason instanceof Error ? reason.message : String(reason),
          });
        }
      });
    }

    const status = errors.length ? "completed_with_errors" : "completed";

    await db
      .update(ingestRuns)
      .set({
        status,
        finishedAt: new Date(),
        sourcesProcessed,
        articlesFetched,
        articlesInserted,
        articlesSkipped,
        errorMessage: errors.length
          ? errors.map((e) => `${e.source}: ${e.message}`).join(" | ")
          : null,
      })
      .where(eq(ingestRuns.id, run.id));

    return {
      runId: run.id,
      sourcesProcessed,
      articlesFetched,
      articlesInserted,
      articlesSkipped,
      errors,
    };
  } catch (err) {
    await db
      .update(ingestRuns)
      .set({
        status: "failed",
        finishedAt: new Date(),
        sourcesProcessed,
        articlesFetched,
        articlesInserted,
        articlesSkipped,
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      .where(eq(ingestRuns.id, run.id));

    throw err;
  }
}

import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "../db/client";
import {
  articleAnalyses,
  articles,
  preferences,
  sources,
  type TopicSlug,
} from "../db/schema";

export type DigestCandidate = {
  id: string;
  title: string;
  url: string;
  topic: TopicSlug;
  sourceName: string;
  summary: string | null;
  relevanceScore: number;
  whyItMatters: string | null;
  keyTakeaways: string[];
};

export type DigestSelection = {
  digestDate: string;
  timezone: string;
  format: string;
  minRelevanceScore: number;
  selectedTopics: TopicSlug[];
  items: DigestCandidate[];
};

function localDateString(timezone: string, date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Pick top diverse items: highest scores first, max per topic, total cap.
 */
export function diversifyCandidates(
  candidates: DigestCandidate[],
  options?: { maxItems?: number; maxPerTopic?: number },
): DigestCandidate[] {
  const maxItems = options?.maxItems ?? 6;
  const maxPerTopic = options?.maxPerTopic ?? 2;
  const counts = new Map<string, number>();
  const picked: DigestCandidate[] = [];

  const sorted = [...candidates].sort(
    (a, b) => b.relevanceScore - a.relevanceScore,
  );

  for (const item of sorted) {
    const used = counts.get(item.topic) ?? 0;
    if (used >= maxPerTopic) continue;
    picked.push(item);
    counts.set(item.topic, used + 1);
    if (picked.length >= maxItems) break;
  }

  return picked;
}

export async function selectDigestItems(options?: {
  lookbackHours?: number;
  maxItems?: number;
}): Promise<DigestSelection> {
  const lookbackHours = options?.lookbackHours ?? 48;
  const maxItems = options?.maxItems ?? 6;

  const [prefs] = await db.select().from(preferences).limit(1);
  const timezone = prefs?.timezone ?? "Europe/Belgrade";
  const format = prefs?.digestFormat ?? "detailed";
  const minRelevanceScore = prefs?.minRelevanceScore ?? 6;
  const selectedTopics = (prefs?.selectedTopics?.length
    ? prefs.selectedTopics
    : [
        "ai-ml",
        "web-dev",
        "business",
        "sports",
        "world",
        "science",
      ]) as TopicSlug[];

  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

  let rows = await db
    .select({
      id: articles.id,
      title: articles.title,
      url: articles.url,
      topic: articles.topic,
      sourceName: sources.name,
      summary: articleAnalyses.summary,
      relevanceScore: articleAnalyses.relevanceScore,
      whyItMatters: articleAnalyses.whyItMatters,
      keyTakeaways: articleAnalyses.keyTakeaways,
    })
    .from(articles)
    .innerJoin(sources, eq(articles.sourceId, sources.id))
    .innerJoin(articleAnalyses, eq(articleAnalyses.articleId, articles.id))
    .where(
      and(
        inArray(articles.topic, selectedTopics),
        isNotNull(articleAnalyses.relevanceScore),
        sql`${articles.feedback} is distinct from 'down'`,
        gte(articleAnalyses.relevanceScore, minRelevanceScore),
        gte(articles.fetchedAt, since),
      ),
    )
    .orderBy(desc(articleAnalyses.relevanceScore), desc(articles.publishedAt))
    .limit(40);

  // Demo fallback: if lookback is empty, use any analyzed articles
  if (rows.length === 0) {
    rows = await db
      .select({
        id: articles.id,
        title: articles.title,
        url: articles.url,
        topic: articles.topic,
        sourceName: sources.name,
        summary: articleAnalyses.summary,
        relevanceScore: articleAnalyses.relevanceScore,
        whyItMatters: articleAnalyses.whyItMatters,
        keyTakeaways: articleAnalyses.keyTakeaways,
      })
      .from(articles)
      .innerJoin(sources, eq(articles.sourceId, sources.id))
      .innerJoin(articleAnalyses, eq(articleAnalyses.articleId, articles.id))
      .where(
        and(
          inArray(articles.topic, selectedTopics),
          isNotNull(articleAnalyses.relevanceScore),
        sql`${articles.feedback} is distinct from 'down'`,
          gte(articleAnalyses.relevanceScore, minRelevanceScore),
        ),
      )
      .orderBy(desc(articleAnalyses.relevanceScore), desc(articles.publishedAt))
      .limit(40);
  }

  const candidates: DigestCandidate[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    url: r.url,
    topic: r.topic,
    sourceName: r.sourceName,
    summary: r.summary,
    relevanceScore: r.relevanceScore ?? 0,
    whyItMatters: r.whyItMatters,
    keyTakeaways: r.keyTakeaways ?? [],
  }));

  return {
    digestDate: localDateString(timezone),
    timezone,
    format,
    minRelevanceScore,
    selectedTopics,
    items: diversifyCandidates(candidates, { maxItems, maxPerTopic: 2 }),
  };
}

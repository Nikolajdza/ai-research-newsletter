import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { DEFAULT_TOPICS } from "@/lib/topics";
import { db } from "../db/client";
import {
  articleAnalyses,
  articles,
  sources,
  userArticles,
  type preferences,
  type TopicKey,
} from "../db/schema";

export type PreferencesRow = typeof preferences.$inferSelect;

export type DigestCandidate = {
  id: string;
  title: string;
  url: string;
  imageUrl: string | null;
  topic: TopicKey;
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
  selectedTopics: TopicKey[];
  items: DigestCandidate[];
};

export function localDateString(timezone: string, date = new Date()): string {
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

/** Digest candidates for one user: their topics and minimum score, minus stories they 👎'd. */
export async function selectDigestItems(
  prefs: PreferencesRow,
  options?: { lookbackHours?: number; maxItems?: number },
): Promise<DigestSelection> {
  const lookbackHours = options?.lookbackHours ?? 48;
  const maxItems = options?.maxItems ?? 6;
  const selectedTopics = prefs.selectedTopics.length ? prefs.selectedTopics : [...DEFAULT_TOPICS];
  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

  const query = (recentOnly: boolean) =>
    db
      .select({
        id: articles.id,
        title: articles.title,
        url: articles.url,
        imageUrl: articles.imageUrl,
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
      .leftJoin(userArticles, and(eq(userArticles.articleId, articles.id), eq(userArticles.userId, prefs.userId)))
      .where(
        and(
          inArray(articles.topic, selectedTopics),
          isNotNull(articleAnalyses.relevanceScore),
          sql`${userArticles.feedback} is distinct from 'down'`,
          gte(articleAnalyses.relevanceScore, prefs.minRelevanceScore),
          recentOnly ? gte(articles.fetchedAt, since) : undefined,
        ),
      )
      .orderBy(desc(articleAnalyses.relevanceScore), desc(articles.publishedAt))
      .limit(40);

  let rows = await query(true);
  // Demo fallback: if the lookback window is empty, use any analyzed articles.
  if (rows.length === 0) rows = await query(false);

  const candidates: DigestCandidate[] = rows.map((r) => ({
    ...r,
    relevanceScore: r.relevanceScore ?? 0,
    keyTakeaways: r.keyTakeaways ?? [],
  }));

  return {
    digestDate: localDateString(prefs.timezone),
    timezone: prefs.timezone,
    format: prefs.digestFormat,
    minRelevanceScore: prefs.minRelevanceScore,
    selectedTopics,
    items: diversifyCandidates(candidates, { maxItems, maxPerTopic: 2 }),
  };
}

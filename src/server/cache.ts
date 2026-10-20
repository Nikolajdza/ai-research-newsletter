import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import type { TopicKey } from "@/lib/topics";
import {
  getArticle,
  getArticlesByIds,
  getDashboardStats,
  getHighlights,
  getPreferences,
  getPublicArticle,
  getPublicStats,
  getRelatedArticles,
  listArticles,
  listDigests,
  listPublicArticles,
  listPublicTopics,
  listRecentlyAnalyzed,
  listSavedArticles,
  listWorkflowRuns,
  type ArticleFilters,
} from "./queries";

/**
 * Cache policy (fresh enough for a daily digest product, not real-time):
 *
 * | Profile   | Server refresh | Hard expire | Used for                          |
 * |-----------|----------------|-------------|-----------------------------------|
 * | feed      | 5 min          | 1 h         | Discover list, Home, Explore      |
 * | article   | 30 min         | 6 h         | Public + personal article detail  |
 * | personal  | 2 min          | 30 min      | Saved list, digest history        |
 *
 * Pipeline / topic / save / feedback call bustArticleCaches() so users
 * don't wait for the timer when something actually changed.
 */

/** Shared catalog feed — same for every visitor. */
export async function cachedDiscoverPage(topic: TopicKey | undefined, page: number, pageSize: number) {
  "use cache";
  cacheLife("feed");
  cacheTag("discover", "articles");

  const offset = (page - 1) * pageSize;
  const { items, total } = await listPublicArticles({ topic, limit: pageSize, offset });
  const topics = await listPublicTopics();
  const stats = await getPublicStats();
  return { items, total, topics, stats };
}

export async function cachedPublicArticle(id: string) {
  "use cache";
  cacheLife("article");
  cacheTag("discover", "articles", `article:${id}`);
  return getPublicArticle(id);
}

/** Personalized home payload; keyed by userId. */
export async function cachedUserHome(userId: string) {
  "use cache";
  cacheLife("feed");
  cacheTag("articles", `user:${userId}`);

  const prefs = await getPreferences(userId);
  const stats = await getDashboardStats(userId);
  const highlights = await getHighlights(userId, 4);
  const latest = await listRecentlyAnalyzed(userId, 6);
  const runs = await listWorkflowRuns(1);
  const digests = await listDigests(userId, 1);
  return { prefs, stats, highlights, latest, lastRun: runs[0] ?? null, lastDigest: digests[0] ?? null };
}

/** Explore results — filters are part of the cache key. */
export async function cachedExplore(
  userId: string,
  filters: Required<Pick<ArticleFilters, "limit" | "offset">> &
    Pick<ArticleFilters, "q" | "topic" | "minScore" | "sort">,
) {
  "use cache";
  cacheLife("feed");
  cacheTag("articles", `user:${userId}`);

  const prefs = await getPreferences(userId);
  const result = await listArticles(userId, filters);
  return { prefs, ...result };
}

export async function cachedArticleDetail(userId: string, id: string) {
  "use cache";
  cacheLife("article");
  cacheTag("articles", `user:${userId}`, `article:${id}`);

  const article = await getArticle(userId, id);
  if (!article) return null;
  const related = await getRelatedArticles(userId, article.id, article.topic);
  return { article, related };
}

export async function cachedSavedList(userId: string) {
  "use cache";
  cacheLife("personal");
  cacheTag("articles", `user:${userId}`, "saved");
  return listSavedArticles(userId);
}

/** Digest history + article cards for a chosen digest (or empty ids). */
export async function cachedDigestHistory(userId: string, digestId: string | undefined) {
  "use cache";
  cacheLife("personal");
  cacheTag("articles", `user:${userId}`, "digests");

  const prefs = await getPreferences(userId);
  const history = await listDigests(userId, 14);
  const selected = history.find((d) => d.id === digestId) ?? history[0] ?? null;
  const articleIds = selected?.articleIds ?? [];
  const items = articleIds.length ? await getArticlesByIds(userId, articleIds) : [];
  return { prefs, history, selected, items };
}

/** Call after collect / analyze / digest / topic changes. */
export function bustArticleCaches(userId?: string) {
  revalidateTag("articles", "max");
  revalidateTag("discover", "max");
  revalidateTag("digests", "max");
  revalidateTag("saved", "max");
  if (userId) revalidateTag(`user:${userId}`, "max");
}

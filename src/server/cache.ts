import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import type { TopicKey } from "@/lib/topics";
import {
  getDashboardStats,
  getHighlights,
  getPreferences,
  getPublicArticle,
  getPublicStats,
  listDigests,
  listPublicArticles,
  listPublicTopics,
  listRecentlyAnalyzed,
  listWorkflowRuns,
} from "./queries";

/** Shared catalog feed — same for every visitor. */
export async function cachedDiscoverPage(topic: TopicKey | undefined, page: number, pageSize: number) {
  "use cache";
  cacheLife("minutes");
  cacheTag("discover", "articles");

  const offset = (page - 1) * pageSize;
  const { items, total } = await listPublicArticles({ topic, limit: pageSize, offset });
  const topics = await listPublicTopics();
  const stats = await getPublicStats();
  return { items, total, topics, stats };
}

export async function cachedPublicArticle(id: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("discover", "articles", `article:${id}`);
  return getPublicArticle(id);
}

/** Personalized home payload; keyed by userId. */
export async function cachedUserHome(userId: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("articles", `user:${userId}`);

  const prefs = await getPreferences(userId);
  const stats = await getDashboardStats(userId);
  const highlights = await getHighlights(userId, 4);
  const latest = await listRecentlyAnalyzed(userId, 6);
  const runs = await listWorkflowRuns(1);
  const digests = await listDigests(userId, 1);
  return { prefs, stats, highlights, latest, lastRun: runs[0] ?? null, lastDigest: digests[0] ?? null };
}

/** Call after collect / analyze / digest so pages refresh on the next visit. */
export function bustArticleCaches(userId?: string) {
  revalidateTag("articles", "max");
  revalidateTag("discover", "max");
  if (userId) revalidateTag(`user:${userId}`, "max");
}

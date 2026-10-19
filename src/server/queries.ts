import {
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { CUSTOM_TOPIC_PREFIX, DEFAULT_TOPICS, isCustomTopic } from "@/lib/topics";
import { db } from "./db/client";
import {
  articleAnalyses,
  articles,
  customTopics,
  digests,
  ingestRuns,
  preferences,
  sources,
  userArticles,
  workflowRuns,
  type TopicKey,
} from "./db/schema";
import { getTotalCostUsd } from "./ai/analyze";
import { telegramBotConfigured } from "./digest/telegram";
import { groqConfigured } from "./pipeline/steps";

const DAY_MS = 24 * 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ArticleListItem = {
  id: string;
  title: string;
  url: string;
  excerpt: string | null;
  imageUrl: string | null;
  topic: TopicKey;
  sourceName: string;
  publishedAt: Date | null;
  fetchedAt: Date;
  summary: string | null;
  relevanceScore: number | null;
  tags: string[];
  savedAt: Date | null;
  feedback: "up" | "down" | null;
};

const articleSelect = {
  id: articles.id,
  title: articles.title,
  url: articles.url,
  excerpt: articles.excerpt,
  imageUrl: articles.imageUrl,
  topic: articles.topic,
  sourceName: sources.name,
  publishedAt: articles.publishedAt,
  fetchedAt: articles.fetchedAt,
  summary: articleAnalyses.summary,
  relevanceScore: articleAnalyses.relevanceScore,
  tags: articleAnalyses.topics,
  savedAt: userArticles.savedAt,
  feedback: userArticles.feedback,
};

function toItem(row: Omit<ArticleListItem, "tags"> & { tags: string[] | null }): ArticleListItem {
  return { ...row, tags: row.tags ?? [] };
}

const recency = sql`coalesce(${articles.publishedAt}, ${articles.fetchedAt})`;

/** Shared article + analysis, joined with this user's saved/feedback state. */
function articleQuery(userId: string, where: SQL | undefined) {
  return db
    .select(articleSelect)
    .from(articles)
    .innerJoin(sources, eq(articles.sourceId, sources.id))
    .leftJoin(articleAnalyses, eq(articleAnalyses.articleId, articles.id))
    .leftJoin(userArticles, and(eq(userArticles.articleId, articles.id), eq(userArticles.userId, userId)))
    .where(where);
}

export async function getPreferences(userId: string) {
  const [prefs] = await db.select().from(preferences).where(eq(preferences.userId, userId)).limit(1);
  if (prefs) return prefs;
  const [created] = await db
    .insert(preferences)
    .values({ userId, selectedTopics: [...DEFAULT_TOPICS] })
    .onConflictDoNothing({ target: preferences.userId })
    .returning();
  return created ?? (await db.select().from(preferences).where(eq(preferences.userId, userId)).limit(1))[0];
}

export async function getDashboardStats(userId: string) {
  const since = new Date(Date.now() - DAY_MS);
  const weekAgo = new Date(Date.now() - 7 * DAY_MS);

  // Sequential on purpose: parallel $count fan-out deadlocks on Supabase PgBouncer
  // when the serverless pool is small / partially closed.
  const total = await db.$count(articles);
  const newToday = await db.$count(articles, gte(articles.fetchedAt, since));
  const analyzed = await db.$count(articleAnalyses);
  const high = await db.$count(articleAnalyses, gte(articleAnalyses.relevanceScore, 8));
  const highToday = await db.$count(
    articleAnalyses,
    and(gte(articleAnalyses.relevanceScore, 8), gte(articleAnalyses.analyzedAt, since)),
  );
  const saved = await db.$count(userArticles, and(eq(userArticles.userId, userId), isNotNull(userArticles.savedAt)));
  const newsletters = await db.$count(
    digests,
    and(eq(digests.userId, userId), gte(digests.createdAt, weekAgo), inArray(digests.status, ["sent", "dry_run"])),
  );

  return { total, newToday, analyzed, high, highToday, saved, newsletters };
}

/** Top analyzed picks in the user's topics, at most one per topic first so the grid stays diverse. */
export async function getHighlights(userId: string, limit = 4): Promise<ArticleListItem[]> {
  const prefs = await getPreferences(userId);
  const topics = prefs.selectedTopics.length ? prefs.selectedTopics : undefined;
  const since = new Date(Date.now() - 3 * DAY_MS);

  const baseWhere = and(
    isNotNull(articleAnalyses.relevanceScore),
    topics ? inArray(articles.topic, topics) : undefined,
    sql`${userArticles.feedback} is distinct from 'down'`,
  );

  let rows = await articleQuery(userId, and(baseWhere, gte(articles.fetchedAt, since)))
    .orderBy(desc(articleAnalyses.relevanceScore), desc(recency))
    .limit(40);
  if (rows.length < limit) {
    rows = await articleQuery(userId, baseWhere)
      .orderBy(desc(articleAnalyses.relevanceScore), desc(recency))
      .limit(40);
  }

  const picked: typeof rows = [];
  const usedTopics = new Set<string>();
  for (const row of rows) {
    if (picked.length >= limit) break;
    if (!usedTopics.has(row.topic)) {
      picked.push(row);
      usedTopics.add(row.topic);
    }
  }
  for (const row of rows) {
    if (picked.length >= limit) break;
    if (!picked.includes(row)) picked.push(row);
  }
  return picked.map(toItem);
}

/** Latest AI summaries in the user's topics, interleaved so one busy feed can't fill the list. */
export async function listRecentlyAnalyzed(userId: string, limit = 6): Promise<ArticleListItem[]> {
  const prefs = await getPreferences(userId);
  const rows = await articleQuery(
    userId,
    and(
      isNotNull(articleAnalyses.id),
      prefs.selectedTopics.length ? inArray(articles.topic, prefs.selectedTopics) : undefined,
    ),
  )
    .orderBy(desc(articleAnalyses.analyzedAt))
    .limit(limit * 6);

  const byTopic = new Map<string, typeof rows>();
  for (const row of rows) byTopic.set(row.topic, [...(byTopic.get(row.topic) ?? []), row]);

  const picked: typeof rows = [];
  while (picked.length < limit && byTopic.size) {
    for (const [topic, queue] of byTopic) {
      const next = queue.shift();
      if (next && picked.length < limit) picked.push(next);
      if (!queue.length) byTopic.delete(topic);
    }
  }
  return picked.map(toItem);
}

export type ArticleFilters = {
  q?: string;
  topic?: TopicKey;
  minScore?: number;
  analyzedOnly?: boolean;
  sort?: "score" | "recent";
  limit?: number;
  offset?: number;
};

const curatedOnly = sql`${articles.topic} not like ${`${CUSTOM_TOPIC_PREFIX}%`}`;

/** Curated topics plus the reader's own custom topics; other readers' niche topics stay out of Explore. */
function visibleTo(followed: TopicKey[]) {
  const own = followed.filter(isCustomTopic);
  return own.length ? or(curatedOnly, inArray(articles.topic, own)) : curatedOnly;
}

export async function listArticles(userId: string, filters: ArticleFilters) {
  const q = filters.q?.trim();
  const prefs = await getPreferences(userId);
  const where = and(
    visibleTo(prefs.selectedTopics),
    q
      ? or(
          ilike(articles.title, `%${q}%`),
          ilike(articleAnalyses.summary, `%${q}%`),
          ilike(articles.excerpt, `%${q}%`),
        )
      : undefined,
    filters.topic ? eq(articles.topic, filters.topic) : undefined,
    filters.minScore ? gte(articleAnalyses.relevanceScore, filters.minScore) : undefined,
    filters.analyzedOnly ? isNotNull(articleAnalyses.id) : undefined,
  );

  const order =
    filters.sort === "recent"
      ? [desc(recency)]
      : [sql`${articleAnalyses.relevanceScore} desc nulls last`, desc(recency)];

  const limit = filters.limit ?? 24;
  const rows = await articleQuery(userId, where)
    .orderBy(...order)
    .limit(limit)
    .offset(filters.offset ?? 0);
  const [{ n: total } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(articles)
    .leftJoin(articleAnalyses, eq(articleAnalyses.articleId, articles.id))
    .where(where);

  return { items: rows.map(toItem), total };
}

export async function listSavedArticles(userId: string) {
  const rows = await articleQuery(userId, isNotNull(userArticles.savedAt)).orderBy(desc(userArticles.savedAt));
  return rows.map(toItem);
}

export async function getArticle(userId: string, id: string) {
  if (!UUID_RE.test(id)) return null;
  const [row] = await db
    .select({
      ...articleSelect,
      author: articles.author,
      siteUrl: sources.siteUrl,
      whyItMatters: articleAnalyses.whyItMatters,
      keyTakeaways: articleAnalyses.keyTakeaways,
      actionItems: articleAnalyses.actionItems,
      model: articleAnalyses.model,
      promptTokens: articleAnalyses.promptTokens,
      completionTokens: articleAnalyses.completionTokens,
      analyzedAt: articleAnalyses.analyzedAt,
    })
    .from(articles)
    .innerJoin(sources, eq(articles.sourceId, sources.id))
    .leftJoin(articleAnalyses, eq(articleAnalyses.articleId, articles.id))
    .leftJoin(userArticles, and(eq(userArticles.articleId, articles.id), eq(userArticles.userId, userId)))
    .where(eq(articles.id, id))
    .limit(1);

  if (!row) return null;
  return {
    ...row,
    tags: row.tags ?? [],
    keyTakeaways: row.keyTakeaways ?? [],
    actionItems: row.actionItems ?? [],
  };
}

export async function getRelatedArticles(userId: string, id: string, topic: TopicKey, limit = 3) {
  const rows = await articleQuery(
    userId,
    and(eq(articles.topic, topic), ne(articles.id, id), isNotNull(articleAnalyses.relevanceScore)),
  )
    .orderBy(desc(recency), desc(articleAnalyses.relevanceScore))
    .limit(limit);
  return rows.map(toItem);
}

export async function listDigests(userId: string, limit = 14) {
  return db
    .select()
    .from(digests)
    .where(eq(digests.userId, userId))
    .orderBy(desc(digests.createdAt))
    .limit(limit);
}

export async function getArticlesByIds(userId: string, ids: string[]): Promise<ArticleListItem[]> {
  if (ids.length === 0) return [];
  const rows = await articleQuery(userId, inArray(articles.id, ids));
  const byId = new Map(rows.map((r) => [r.id, toItem(r)]));
  return ids.map((id) => byId.get(id)).filter((a): a is ArticleListItem => Boolean(a));
}

/** All sources for the admin; pass a reader's topics to hide other readers' custom feeds. */
export async function listSourcesWithStats(followed?: TopicKey[]) {
  const own = followed?.filter(isCustomTopic) ?? [];
  const where = followed
    ? own.length
      ? or(sql`${sources.topic} not like ${`${CUSTOM_TOPIC_PREFIX}%`}`, inArray(sources.topic, own))
      : sql`${sources.topic} not like ${`${CUSTOM_TOPIC_PREFIX}%`}`
    : undefined;
  return db
    .select({
      id: sources.id,
      name: sources.name,
      feedUrl: sources.feedUrl,
      siteUrl: sources.siteUrl,
      topic: sources.topic,
      enabled: sources.enabled,
      articleCount: sql<number>`count(${articles.id})::int`,
      lastFetchedAt: sql<Date | null>`max(${articles.fetchedAt})`,
    })
    .from(sources)
    .leftJoin(articles, eq(articles.sourceId, sources.id))
    .where(where)
    .groupBy(sources.id)
    .orderBy(sources.topic, sources.name);
}

export async function listCustomTopics(keys: TopicKey[]) {
  const custom = keys.filter(isCustomTopic);
  if (custom.length === 0) return [];
  return db
    .select({ key: customTopics.key, label: customTopics.label })
    .from(customTopics)
    .where(inArray(customTopics.key, custom))
    .orderBy(customTopics.label);
}

export type PublicArticle = Omit<ArticleListItem, "savedAt" | "feedback">;

const publicSelect = {
  id: articles.id,
  title: articles.title,
  url: articles.url,
  excerpt: articles.excerpt,
  imageUrl: articles.imageUrl,
  topic: articles.topic,
  sourceName: sources.name,
  publishedAt: articles.publishedAt,
  fetchedAt: articles.fetchedAt,
  summary: articleAnalyses.summary,
  relevanceScore: articleAnalyses.relevanceScore,
  tags: articleAnalyses.topics,
};

/** Signed-out feed: analyzed stories from the curated catalog only. */
export async function listPublicArticles(filters: { topic?: TopicKey; limit: number; offset: number }) {
  const where = and(
    curatedOnly,
    isNotNull(articleAnalyses.relevanceScore),
    filters.topic ? eq(articles.topic, filters.topic) : undefined,
    gte(articles.fetchedAt, new Date(Date.now() - 7 * DAY_MS)),
  );
  const rows = await db
    .select(publicSelect)
    .from(articles)
    .innerJoin(sources, eq(articles.sourceId, sources.id))
    .innerJoin(articleAnalyses, eq(articleAnalyses.articleId, articles.id))
    .where(where)
    .orderBy(desc(articleAnalyses.relevanceScore), desc(recency))
    .limit(filters.limit)
    .offset(filters.offset);
  const [{ n: total } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(articles)
    .innerJoin(articleAnalyses, eq(articleAnalyses.articleId, articles.id))
    .where(where);
  return { items: rows.map((r): PublicArticle => ({ ...r, tags: r.tags ?? [] })), total };
}

/** Catalog topics that have analyzed stories this week, busiest first. */
export async function listPublicTopics(): Promise<TopicKey[]> {
  const rows = await db
    .select({ topic: articles.topic, n: sql<number>`count(*)::int` })
    .from(articles)
    .innerJoin(articleAnalyses, eq(articleAnalyses.articleId, articles.id))
    .where(and(curatedOnly, gte(articles.fetchedAt, new Date(Date.now() - 7 * DAY_MS))))
    .groupBy(articles.topic)
    .orderBy(desc(sql`count(*)`));
  return rows.map((r) => r.topic);
}

export async function getPublicArticle(id: string) {
  if (!UUID_RE.test(id)) return null;
  const [row] = await db
    .select({
      ...publicSelect,
      siteUrl: sources.siteUrl,
      whyItMatters: articleAnalyses.whyItMatters,
      keyTakeaways: articleAnalyses.keyTakeaways,
    })
    .from(articles)
    .innerJoin(sources, eq(articles.sourceId, sources.id))
    .innerJoin(articleAnalyses, eq(articleAnalyses.articleId, articles.id))
    .where(and(eq(articles.id, id), curatedOnly))
    .limit(1);
  if (!row) return null;
  return { ...row, tags: row.tags ?? [], keyTakeaways: row.keyTakeaways ?? [] };
}

export async function getPublicStats() {
  const since = new Date(Date.now() - DAY_MS);
  const articlesToday = await db.$count(articles, gte(articles.fetchedAt, since));
  const analyzedToday = await db.$count(articleAnalyses, gte(articleAnalyses.analyzedAt, since));
  const sourceCount = await db.$count(
    sources,
    and(eq(sources.enabled, true), sql`${sources.topic} not like ${`${CUSTOM_TOPIC_PREFIX}%`}`),
  );
  return { articlesToday, analyzedToday, sourceCount };
}

export async function listWorkflowRuns(limit = 12) {
  return db.select().from(workflowRuns).orderBy(desc(workflowRuns.startedAt)).limit(limit);
}

export async function listIngestRuns(limit = 6) {
  return db.select().from(ingestRuns).orderBy(desc(ingestRuns.startedAt)).limit(limit);
}

export type DayActivity = { day: string; fetched: number; analyzed: number; digests: number };

export async function getWeeklyActivity(): Promise<DayActivity[]> {
  const rows = await db.execute<DayActivity>(sql`
    select
      to_char(d, 'YYYY-MM-DD') as day,
      (select count(*)::int from ${articles} a
        where a.fetched_at >= d and a.fetched_at < d + interval '1 day') as fetched,
      (select count(*)::int from ${articleAnalyses} x
        where x.analyzed_at >= d and x.analyzed_at < d + interval '1 day') as analyzed,
      (select count(*)::int from ${digests} g
        where g.created_at >= d and g.created_at < d + interval '1 day'
          and g.status in ('sent', 'dry_run')) as digests
    from generate_series(
      date_trunc('day', now()) - interval '6 days',
      date_trunc('day', now()),
      interval '1 day'
    ) as d
    order by d
  `);
  return [...rows];
}

export async function getAiUsage() {
  const [tokens] = await db
    .select({
      analyzed: sql<number>`count(*)::int`,
      avgScore: sql<number>`coalesce(avg(${articleAnalyses.relevanceScore}), 0)::float`,
      promptTokens: sql<number>`coalesce(sum(${articleAnalyses.promptTokens}), 0)::int`,
      completionTokens: sql<number>`coalesce(sum(${articleAnalyses.completionTokens}), 0)::int`,
    })
    .from(articleAnalyses);
  const [feedback] = await db
    .select({
      upvotes: sql<number>`count(*) filter (where ${userArticles.feedback} = 'up')::int`,
      downvotes: sql<number>`count(*) filter (where ${userArticles.feedback} = 'down')::int`,
    })
    .from(userArticles);
  const costUsd = await getTotalCostUsd();
  return { ...tokens, ...feedback, costUsd };
}

export async function getIntegrationStatus() {
  const n8nUrl = process.env.N8N_HEALTH_URL ?? `${process.env.NEXT_PUBLIC_N8N_URL ?? "http://localhost:5679"}/healthz`;
  let n8nOnline = false;
  try {
    const res = await fetch(n8nUrl, { signal: AbortSignal.timeout(1500), cache: "no-store" });
    n8nOnline = res.ok;
  } catch {
    n8nOnline = false;
  }
  return {
    groq: groqConfigured(),
    groqModel: process.env.GROQ_MODEL ?? "openai/gpt-oss-120b",
    telegramBot: telegramBotConfigured(),
    n8n: n8nOnline,
    pipelineSecret: Boolean(process.env.INGEST_SECRET),
  };
}

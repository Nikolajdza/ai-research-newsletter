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
import { db } from "./db/client";
import {
  articleAnalyses,
  articles,
  digests,
  ingestRuns,
  preferences,
  sources,
  workflowRuns,
  type TopicSlug,
} from "./db/schema";
import { getTotalCostUsd } from "./ai/analyze";
import { telegramConfigured } from "./digest/telegram";
import { groqConfigured } from "./pipeline/steps";

const DAY_MS = 24 * 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ArticleListItem = {
  id: string;
  title: string;
  url: string;
  excerpt: string | null;
  imageUrl: string | null;
  topic: TopicSlug;
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
  savedAt: articles.savedAt,
  feedback: articles.feedback,
};

function toItem(row: Omit<ArticleListItem, "tags"> & { tags: string[] | null }): ArticleListItem {
  return { ...row, tags: row.tags ?? [] };
}

const recency = sql`coalesce(${articles.publishedAt}, ${articles.fetchedAt})`;

function articleQuery(where: SQL | undefined) {
  return db
    .select(articleSelect)
    .from(articles)
    .innerJoin(sources, eq(articles.sourceId, sources.id))
    .leftJoin(articleAnalyses, eq(articleAnalyses.articleId, articles.id))
    .where(where);
}

export async function getPreferences() {
  const [prefs] = await db.select().from(preferences).limit(1);
  if (prefs) return prefs;
  const [created] = await db.insert(preferences).values({}).returning();
  return created;
}

export async function getDashboardStats() {
  const since = new Date(Date.now() - DAY_MS);
  const weekAgo = new Date(Date.now() - 7 * DAY_MS);

  const [total, newToday, analyzed, high, highToday, saved, newsletters] = await Promise.all([
    db.$count(articles),
    db.$count(articles, gte(articles.fetchedAt, since)),
    db.$count(articleAnalyses),
    db.$count(articleAnalyses, gte(articleAnalyses.relevanceScore, 8)),
    db.$count(
      articleAnalyses,
      and(gte(articleAnalyses.relevanceScore, 8), gte(articleAnalyses.analyzedAt, since)),
    ),
    db.$count(articles, isNotNull(articles.savedAt)),
    db.$count(
      digests,
      and(gte(digests.createdAt, weekAgo), inArray(digests.status, ["sent", "dry_run"])),
    ),
  ]);

  return { total, newToday, analyzed, high, highToday, saved, newsletters };
}

/** Top analyzed picks, at most one per topic first so the grid stays diverse. */
export async function getHighlights(limit = 4): Promise<ArticleListItem[]> {
  const prefs = await getPreferences();
  const topics = prefs.selectedTopics.length ? prefs.selectedTopics : undefined;
  const since = new Date(Date.now() - 3 * DAY_MS);

  const baseWhere = and(
    isNotNull(articleAnalyses.relevanceScore),
    topics ? inArray(articles.topic, topics) : undefined,
    sql`${articles.feedback} is distinct from 'down'`,
  );

  let rows = await articleQuery(and(baseWhere, gte(articles.fetchedAt, since)))
    .orderBy(desc(articleAnalyses.relevanceScore), desc(recency))
    .limit(40);
  if (rows.length < limit) {
    rows = await articleQuery(baseWhere)
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

/** Latest AI summaries, interleaved by topic so one busy feed can't fill the list. */
export async function listRecentlyAnalyzed(limit = 6): Promise<ArticleListItem[]> {
  const rows = await articleQuery(isNotNull(articleAnalyses.id))
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
  topic?: TopicSlug;
  minScore?: number;
  analyzedOnly?: boolean;
  savedOnly?: boolean;
  sort?: "score" | "recent";
  limit?: number;
  offset?: number;
};

export async function listArticles(filters: ArticleFilters) {
  const q = filters.q?.trim();
  const where = and(
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
    filters.savedOnly ? isNotNull(articles.savedAt) : undefined,
  );

  const order =
    filters.sort === "recent"
      ? [desc(recency)]
      : [sql`${articleAnalyses.relevanceScore} desc nulls last`, desc(recency)];

  const limit = filters.limit ?? 24;
  const [rows, total] = await Promise.all([
    articleQuery(where)
      .orderBy(...order)
      .limit(limit)
      .offset(filters.offset ?? 0),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(articles)
      .leftJoin(articleAnalyses, eq(articleAnalyses.articleId, articles.id))
      .where(where)
      .then((r) => r[0]?.n ?? 0),
  ]);

  return { items: rows.map(toItem), total };
}

export async function listSavedArticles() {
  const rows = await articleQuery(isNotNull(articles.savedAt)).orderBy(desc(articles.savedAt));
  return rows.map(toItem);
}

export async function getArticle(id: string) {
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

export async function getRelatedArticles(id: string, topic: TopicSlug, limit = 3) {
  const rows = await articleQuery(
    and(eq(articles.topic, topic), ne(articles.id, id), isNotNull(articleAnalyses.relevanceScore)),
  )
    .orderBy(desc(recency), desc(articleAnalyses.relevanceScore))
    .limit(limit);
  return rows.map(toItem);
}

export async function listDigests(limit = 14) {
  return db.select().from(digests).orderBy(desc(digests.createdAt)).limit(limit);
}

export async function getArticlesByIds(ids: string[]): Promise<ArticleListItem[]> {
  if (ids.length === 0) return [];
  const rows = await articleQuery(inArray(articles.id, ids));
  const byId = new Map(rows.map((r) => [r.id, toItem(r)]));
  return ids.map((id) => byId.get(id)).filter((a): a is ArticleListItem => Boolean(a));
}

export async function listSourcesWithStats() {
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
    .groupBy(sources.id)
    .orderBy(sources.topic, sources.name);
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
  const [tokens, costUsd] = await Promise.all([
    db
      .select({
        analyzed: sql<number>`count(*)::int`,
        avgScore: sql<number>`coalesce(avg(${articleAnalyses.relevanceScore}), 0)::float`,
        promptTokens: sql<number>`coalesce(sum(${articleAnalyses.promptTokens}), 0)::int`,
        completionTokens: sql<number>`coalesce(sum(${articleAnalyses.completionTokens}), 0)::int`,
        upvotes: sql<number>`count(*) filter (where ${articles.feedback} = 'up')::int`,
        downvotes: sql<number>`count(*) filter (where ${articles.feedback} = 'down')::int`,
      })
      .from(articleAnalyses)
      .innerJoin(articles, eq(articles.id, articleAnalyses.articleId))
      .then((r) => r[0]),
    getTotalCostUsd(),
  ]);
  return { ...tokens, costUsd };
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
    telegram: telegramConfigured(),
    n8n: n8nOnline,
    pipelineSecret: Boolean(process.env.INGEST_SECRET),
  };
}

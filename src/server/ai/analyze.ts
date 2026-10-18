import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db/client";
import {
  articleAnalyses,
  articles,
  preferences,
  sources,
  type TopicSlug,
} from "../db/schema";
import { analyzeArticleWithGroq, estimateCostUsd } from "./groq";

const ANALYZE_CONCURRENCY = 2;
const RECENT_WINDOW_DAYS = 4;

export type AnalyzeBatchResult = {
  examined: number;
  analyzed: number;
  skipped: number;
  failed: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  estimatedCostUsd: number;
  errors: { articleId: string; title: string; message: string }[];
};

type PendingArticle = {
  id: string;
  title: string;
  url: string;
  topic: TopicSlug;
  excerpt: string | null;
  sourceName: string;
};

const DEFAULT_TOPICS: TopicSlug[] = ["ai-ml", "web-dev", "business", "sports", "world", "science"];

async function getSelectedTopics(): Promise<TopicSlug[]> {
  const [prefs] = await db.select().from(preferences).limit(1);
  return prefs?.selectedTopics?.length ? prefs.selectedTopics : DEFAULT_TOPICS;
}

const pendingSelect = {
  id: articles.id,
  title: articles.title,
  url: articles.url,
  topic: articles.topic,
  excerpt: articles.excerpt,
  sourceName: sources.name,
};

/**
 * Round-robin across followed topics so one busy feed can't eat the whole
 * analysis budget; recent articles first.
 */
async function pickPending(limit: number, topics: TopicSlug[]): Promise<PendingArticle[]> {
  const since = new Date(Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const perTopic = Math.max(1, Math.ceil(limit / Math.max(topics.length, 1)));

  const buckets = await Promise.all(
    topics.map((topic) =>
      db
        .select(pendingSelect)
        .from(articles)
        .innerJoin(sources, eq(articles.sourceId, sources.id))
        .leftJoin(articleAnalyses, eq(articleAnalyses.articleId, articles.id))
        .where(
          and(
            isNull(articleAnalyses.id),
            eq(articles.topic, topic),
            sql`coalesce(${articles.publishedAt}, ${articles.fetchedAt}) >= ${since.toISOString()}::timestamptz`,
          ),
        )
        .orderBy(desc(sql`coalesce(${articles.publishedAt}, ${articles.fetchedAt})`))
        .limit(perTopic * 2),
    ),
  );

  const picked: PendingArticle[] = [];
  for (let round = 0; picked.length < limit; round += 1) {
    let added = false;
    for (const bucket of buckets) {
      const item = bucket[round];
      if (item && picked.length < limit) {
        picked.push(item);
        added = true;
      }
    }
    if (!added) break;
  }

  if (picked.length < limit) {
    const extra = await db
      .select(pendingSelect)
      .from(articles)
      .innerJoin(sources, eq(articles.sourceId, sources.id))
      .leftJoin(articleAnalyses, eq(articleAnalyses.articleId, articles.id))
      .where(and(isNull(articleAnalyses.id), inArray(articles.topic, topics)))
      .orderBy(desc(sql`coalesce(${articles.publishedAt}, ${articles.fetchedAt})`))
      .limit(limit * 2);
    const seen = new Set(picked.map((p) => p.id));
    for (const item of extra) {
      if (picked.length >= limit) break;
      if (!seen.has(item.id)) picked.push(item);
    }
  }

  return picked;
}

async function analyzeAndPersist(article: PendingArticle, selectedTopics: TopicSlug[]) {
  const llm = await analyzeArticleWithGroq({ ...article, selectedTopics });

  const [row] = await db
    .insert(articleAnalyses)
    .values({
      articleId: article.id,
      summary: llm.output.summary,
      relevanceScore: Math.round(llm.output.relevanceScore * 10) / 10,
      whyItMatters: llm.output.whyItMatters,
      topics: [llm.output.category, ...llm.output.topics],
      keyTakeaways: llm.output.keyTakeaways,
      actionItems: llm.output.actionItems ?? [],
      model: llm.model,
      promptTokens: llm.promptTokens,
      completionTokens: llm.completionTokens,
      analyzedAt: new Date(),
    })
    .onConflictDoNothing({ target: articleAnalyses.articleId })
    .returning();

  return { row: row ?? null, llm };
}

/**
 * Analyze articles that have no row in article_analyses yet.
 * Never re-analyzes an existing analysis (idempotent / cost control).
 */
export async function analyzeUnanalyzedArticles(options?: {
  limit?: number;
}): Promise<AnalyzeBatchResult> {
  const limit = options?.limit ?? 10;
  const selectedTopics = await getSelectedTopics();
  const pending = await pickPending(limit, selectedTopics);

  const result: AnalyzeBatchResult = {
    examined: pending.length,
    analyzed: 0,
    skipped: 0,
    failed: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    estimatedCostUsd: 0,
    errors: [],
  };

  for (let i = 0; i < pending.length; i += ANALYZE_CONCURRENCY) {
    const batch = pending.slice(i, i + ANALYZE_CONCURRENCY);
    const outcomes = await Promise.allSettled(
      batch.map((article) => analyzeAndPersist(article, selectedTopics)),
    );

    outcomes.forEach((outcome, index) => {
      const article = batch[index];
      if (outcome.status === "rejected") {
        result.failed += 1;
        result.errors.push({
          articleId: article.id,
          title: article.title,
          message:
            outcome.reason instanceof Error
              ? outcome.reason.message
              : String(outcome.reason),
        });
        return;
      }
      const { row, llm } = outcome.value;
      result.totalPromptTokens += llm.promptTokens;
      result.totalCompletionTokens += llm.completionTokens;
      result.estimatedCostUsd += llm.estimatedCostUsd;
      if (row) result.analyzed += 1;
      else result.skipped += 1;
    });
  }

  result.estimatedCostUsd = Number(result.estimatedCostUsd.toFixed(6));
  return result;
}

export async function getAnalysisStats() {
  const [row] = await db
    .select({
      articles: sql<number>`count(*)::int`,
      analyzed: sql<number>`count(${articleAnalyses.id})::int`,
      avgScore: sql<number>`coalesce(avg(${articleAnalyses.relevanceScore}), 0)::float`,
      promptTokens: sql<number>`coalesce(sum(${articleAnalyses.promptTokens}), 0)::int`,
      completionTokens: sql<number>`coalesce(sum(${articleAnalyses.completionTokens}), 0)::int`,
    })
    .from(articles)
    .leftJoin(articleAnalyses, eq(articleAnalyses.articleId, articles.id));

  return row;
}

export async function getTotalCostUsd(): Promise<number> {
  const rows = await db
    .select({
      model: articleAnalyses.model,
      promptTokens: sql<number>`coalesce(sum(${articleAnalyses.promptTokens}), 0)::int`,
      completionTokens: sql<number>`coalesce(sum(${articleAnalyses.completionTokens}), 0)::int`,
    })
    .from(articleAnalyses)
    .groupBy(articleAnalyses.model);

  return rows.reduce(
    (sum, r) => sum + estimateCostUsd(r.model ?? "", r.promptTokens, r.completionTokens),
    0,
  );
}

/** Analyze a single article by id if not yet analyzed. */
export async function analyzeArticleById(articleId: string) {
  const [existing] = await db
    .select({ id: articleAnalyses.id })
    .from(articleAnalyses)
    .where(eq(articleAnalyses.articleId, articleId))
    .limit(1);

  if (existing) return { skipped: true as const };

  const [article] = await db
    .select(pendingSelect)
    .from(articles)
    .innerJoin(sources, eq(articles.sourceId, sources.id))
    .where(eq(articles.id, articleId))
    .limit(1);

  if (!article) throw new Error(`Article not found: ${articleId}`);

  const selectedTopics = await getSelectedTopics();
  const { llm } = await analyzeAndPersist(article, selectedTopics);

  return {
    skipped: false as const,
    usage: {
      promptTokens: llm.promptTokens,
      completionTokens: llm.completionTokens,
      estimatedCostUsd: llm.estimatedCostUsd,
      model: llm.model,
    },
  };
}

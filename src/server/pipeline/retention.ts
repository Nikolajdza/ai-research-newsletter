import { lt, sql } from "drizzle-orm";
import { db } from "../db/client";
import { digests, ingestRuns, workflowRuns } from "../db/schema";

/** Default keep window. Override with ARTICLE_RETENTION_DAYS. */
export const DEFAULT_RETENTION_DAYS = 30;
/** When the DB is getting full, purge more aggressively. */
export const TIGHT_RETENTION_DAYS = 14;

/** Supabase free plan is ~500 MB — warn / tighten before that. */
const DB_WARN_BYTES = 280 * 1024 * 1024;
const DB_TIGHT_BYTES = 380 * 1024 * 1024;
const ARTICLE_TIGHT_COUNT = 35_000;

const DELETE_CHUNK = 400;

export type RetentionResult = {
  retentionDays: number;
  reason: string;
  articlesDeleted: number;
  digestsDeleted: number;
  workflowRunsDeleted: number;
  ingestRunsDeleted: number;
};

export type DatabaseHealth = {
  sizeBytes: number;
  sizeLabel: string;
  freePlanBytes: number;
  freePlanLabel: string;
  usageRatio: number;
  articles: number;
  analyses: number;
  savedArticles: number;
  digests: number;
  sources: number;
  users: number;
  oldestArticleAt: Date | null;
  retentionDays: number;
  retentionMode: "normal" | "tight";
  /** ok | warn | critical — based on size vs free tier */
  level: "ok" | "warn" | "critical";
};

function envRetentionDays(): number {
  const n = Number(process.env.ARTICLE_RETENTION_DAYS);
  if (Number.isFinite(n) && n >= 7 && n <= 90) return Math.floor(n);
  return DEFAULT_RETENTION_DAYS;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function databaseSizeBytes(): Promise<number> {
  const rows = [...(await db.execute<{ size: string | number }>(sql`select pg_database_size(current_database()) as size`))];
  return Number(rows[0]?.size ?? 0);
}

async function articleCount(): Promise<number> {
  const rows = [...(await db.execute<{ n: string | number }>(sql`select count(*)::int as n from articles`))];
  return Number(rows[0]?.n ?? 0);
}

/** Pick 30d or 14d based on size / row pressure so we stay on Supabase free. */
export async function resolveRetentionDays(): Promise<{ days: number; reason: string; mode: "normal" | "tight" }> {
  const configured = envRetentionDays();
  const [sizeBytes, articles] = await Promise.all([databaseSizeBytes(), articleCount()]);

  if (sizeBytes >= DB_TIGHT_BYTES || articles >= ARTICLE_TIGHT_COUNT) {
    const days = Math.min(configured, TIGHT_RETENTION_DAYS);
    return {
      days,
      mode: "tight",
      reason:
        sizeBytes >= DB_TIGHT_BYTES
          ? `DB ${formatBytes(sizeBytes)} ≥ ${formatBytes(DB_TIGHT_BYTES)} — using ${days}d`
          : `${articles.toLocaleString()} articles — using ${days}d`,
    };
  }

  return { days: configured, mode: "normal", reason: `standard ${configured}d retention` };
}

export async function getDatabaseHealth(): Promise<DatabaseHealth> {
  const freePlanBytes = 500 * 1024 * 1024;
  const [{ days, mode }, sizeBytes] = await Promise.all([resolveRetentionDays(), databaseSizeBytes()]);

  const counts = [
    ...(await db.execute<{
      articles: number;
      analyses: number;
      saved: number;
      digests: number;
      sources: number;
      users: number;
      oldest: Date | string | null;
    }>(sql`
    select
      (select count(*)::int from articles) as articles,
      (select count(*)::int from article_analyses) as analyses,
      (select count(*)::int from user_articles where saved_at is not null) as saved,
      (select count(*)::int from digests) as digests,
      (select count(*)::int from sources) as sources,
      (select count(*)::int from users) as users,
      (select min(coalesce(published_at, fetched_at)) from articles) as oldest
  `)),
  ];

  const row = counts[0];

  const usageRatio = freePlanBytes > 0 ? sizeBytes / freePlanBytes : 0;
  const level: DatabaseHealth["level"] =
    sizeBytes >= DB_TIGHT_BYTES ? "critical" : sizeBytes >= DB_WARN_BYTES ? "warn" : "ok";

  const oldestRaw = row?.oldest ?? null;
  const oldestArticleAt = oldestRaw ? new Date(oldestRaw) : null;

  return {
    sizeBytes,
    sizeLabel: formatBytes(sizeBytes),
    freePlanBytes,
    freePlanLabel: formatBytes(freePlanBytes),
    usageRatio,
    articles: Number(row?.articles ?? 0),
    analyses: Number(row?.analyses ?? 0),
    savedArticles: Number(row?.saved ?? 0),
    digests: Number(row?.digests ?? 0),
    sources: Number(row?.sources ?? 0),
    users: Number(row?.users ?? 0),
    oldestArticleAt,
    retentionDays: days,
    retentionMode: mode,
    level,
  };
}

async function deleteArticleChunk(cutoff: Date): Promise<number> {
  // Saved articles are kept forever. Analyses / user_articles cascade.
  const deleted = [
    ...(await db.execute<{ id: string }>(sql`
    delete from articles
    where id in (
      select a.id
      from articles a
      where coalesce(a.published_at, a.fetched_at) < ${cutoff.toISOString()}::timestamptz
        and not exists (
          select 1 from user_articles ua
          where ua.article_id = a.id and ua.saved_at is not null
        )
      limit ${DELETE_CHUNK}
    )
    returning id
  `)),
  ];
  return deleted.length;
}

/**
 * Purge old articles (except saved), old digests, and old run logs.
 * Safe to call from the daily pipeline.
 */
export async function runRetentionCleanup(): Promise<RetentionResult> {
  const { days, reason } = await resolveRetentionDays();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  let articlesDeleted = 0;
  for (let i = 0; i < 50; i += 1) {
    const n = await deleteArticleChunk(cutoff);
    articlesDeleted += n;
    if (n < DELETE_CHUNK) break;
  }

  const digestDel = await db.delete(digests).where(lt(digests.createdAt, cutoff)).returning({ id: digests.id });
  const workflowDel = await db
    .delete(workflowRuns)
    .where(lt(workflowRuns.startedAt, cutoff))
    .returning({ id: workflowRuns.id });
  const ingestDel = await db
    .delete(ingestRuns)
    .where(lt(ingestRuns.startedAt, cutoff))
    .returning({ id: ingestRuns.id });

  return {
    retentionDays: days,
    reason,
    articlesDeleted,
    digestsDeleted: digestDel.length,
    workflowRunsDeleted: workflowDel.length,
    ingestRunsDeleted: ingestDel.length,
  };
}

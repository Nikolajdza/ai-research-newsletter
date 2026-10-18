"use server";

import Parser from "rss-parser";
import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { TIMEZONES } from "@/lib/format";
import { TOPIC_SLUGS } from "@/lib/topics";
import { analyzeArticleById, analyzeUnanalyzedArticles } from "@/server/ai/analyze";
import { db } from "@/server/db/client";
import { articles, preferences, sources } from "@/server/db/schema";
import { runDailyPipeline } from "@/server/pipeline/daily";
import { groqConfigured, runDigestStep } from "@/server/pipeline/steps";
import { getPreferences } from "@/server/queries";

// Local single-user demo: no auth layer. Add one before exposing beyond localhost.

export type ActionResult = { ok: boolean; message: string };

const idSchema = z.string().uuid();

function fail(err: unknown): ActionResult {
  return { ok: false, message: err instanceof Error ? err.message : String(err) };
}

export async function toggleSaveAction(articleId: string): Promise<ActionResult> {
  const id = idSchema.parse(articleId);
  const [row] = await db.select({ savedAt: articles.savedAt }).from(articles).where(eq(articles.id, id));
  if (!row) return { ok: false, message: "Article not found" };
  const saved = !row.savedAt;
  await db.update(articles).set({ savedAt: saved ? new Date() : null }).where(eq(articles.id, id));
  refresh();
  return { ok: true, message: saved ? "Saved" : "Removed from saved" };
}

export async function setFeedbackAction(
  articleId: string,
  value: "up" | "down" | null,
): Promise<ActionResult> {
  const id = idSchema.parse(articleId);
  const feedback = z.enum(["up", "down"]).nullable().parse(value);
  await db.update(articles).set({ feedback }).where(eq(articles.id, id));
  refresh();
  return { ok: true, message: feedback ? "Thanks for the feedback" : "Feedback cleared" };
}

const preferencesSchema = z.object({
  selectedTopics: z.array(z.enum(TOPIC_SLUGS)).min(1, "Pick at least one topic"),
  minRelevanceScore: z.number().min(1).max(10),
  digestHourLocal: z.number().int().min(0).max(23),
  timezone: z.enum(TIMEZONES),
  digestFormat: z.enum(["detailed", "short"]),
  telegramEnabled: z.boolean(),
  emailEnabled: z.boolean(),
});

export type PreferencesInput = z.infer<typeof preferencesSchema>;

export async function savePreferencesAction(input: PreferencesInput): Promise<ActionResult> {
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid preferences" };
  }
  const prefs = await getPreferences();
  await db
    .update(preferences)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(preferences.id, prefs.id));
  refresh();
  return { ok: true, message: "Preferences saved" };
}

export async function updateDisplayNameAction(name: string): Promise<ActionResult> {
  const displayName = z.string().trim().min(1).max(40).safeParse(name);
  if (!displayName.success) return { ok: false, message: "Name must be 1–40 characters" };
  const prefs = await getPreferences();
  await db.update(preferences).set({ displayName: displayName.data }).where(eq(preferences.id, prefs.id));
  refresh();
  return { ok: true, message: "Profile updated" };
}

export async function toggleSourceAction(sourceId: string, enabled: boolean): Promise<ActionResult> {
  const id = idSchema.parse(sourceId);
  await db.update(sources).set({ enabled, updatedAt: new Date() }).where(eq(sources.id, id));
  refresh();
  return { ok: true, message: enabled ? "Source enabled" : "Source paused" };
}

export async function deleteSourceAction(sourceId: string): Promise<ActionResult> {
  const id = idSchema.parse(sourceId);
  await db.delete(sources).where(eq(sources.id, id));
  refresh();
  return { ok: true, message: "Source removed" };
}

const newSourceSchema = z.object({
  name: z.string().trim().min(2).max(60),
  feedUrl: z.string().trim().url(),
  topic: z.enum(TOPIC_SLUGS),
});

export async function addSourceAction(input: {
  name: string;
  feedUrl: string;
  topic: string;
}): Promise<ActionResult> {
  const parsed = newSourceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid source" };
  }
  try {
    const feed = await new Parser({ timeout: 10_000 }).parseURL(parsed.data.feedUrl);
    const inserted = await db
      .insert(sources)
      .values({ ...parsed.data, siteUrl: feed.link ?? null })
      .onConflictDoNothing({ target: sources.feedUrl })
      .returning({ id: sources.id });
    if (inserted.length === 0) return { ok: false, message: "That feed is already in your sources" };
    refresh();
    return { ok: true, message: `Added ${parsed.data.name} (${feed.items?.length ?? 0} items in feed)` };
  } catch (err) {
    return { ok: false, message: `Could not read feed: ${err instanceof Error ? err.message : err}` };
  }
}

export async function runPipelineAction(): Promise<ActionResult> {
  try {
    const result = await runDailyPipeline({ trigger: "dashboard", analyzeLimit: 8 });
    refresh();
    const summary = result.steps.map((s) => `${s.name}: ${s.detail ?? s.status}`).join(" · ");
    return { ok: result.status !== "failed", message: summary };
  } catch (err) {
    return fail(err);
  }
}

export async function sendDigestAction(options: { force: boolean }): Promise<ActionResult> {
  const outcome = await runDigestStep(undefined, { force: options.force });
  refresh();
  if (!outcome.ok) return { ok: false, message: outcome.error };
  const r = outcome.result;
  if (r.skipped) return { ok: true, message: `Already done today (${r.reason}). Use “Resend” to force.` };
  return {
    ok: true,
    message: r.dryRun
      ? `Digest built with ${r.itemCount} items — dry run (${r.reason})`
      : `Sent ${r.itemCount} items to Telegram`,
  };
}

export async function analyzeArticleAction(articleId: string): Promise<ActionResult> {
  if (!groqConfigured()) return { ok: false, message: "GROQ_API_KEY_NEWSLETTER is not set" };
  try {
    const result = await analyzeArticleById(idSchema.parse(articleId));
    refresh();
    return {
      ok: true,
      message: result.skipped
        ? "Already analyzed"
        : `Analyzed · ${result.usage.promptTokens + result.usage.completionTokens} tokens · $${result.usage.estimatedCostUsd.toFixed(4)}`,
    };
  } catch (err) {
    return fail(err);
  }
}

export async function analyzeBatchAction(limit: number): Promise<ActionResult> {
  if (!groqConfigured()) return { ok: false, message: "GROQ_API_KEY_NEWSLETTER is not set" };
  try {
    const r = await analyzeUnanalyzedArticles({ limit: Math.min(Math.max(limit, 1), 30) });
    refresh();
    return {
      ok: r.failed === 0,
      message: `${r.analyzed} analyzed · ${r.failed} failed · $${r.estimatedCostUsd.toFixed(4)}`,
    };
  } catch (err) {
    return fail(err);
  }
}
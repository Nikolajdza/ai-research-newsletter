"use server";

import Parser from "rss-parser";
import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { TIMEZONES } from "@/lib/format";
import { TOPIC_SLUGS } from "@/lib/topics";
import { analyzeArticleById, analyzeUnanalyzedArticles } from "@/server/ai/analyze";
import { requireAdmin, requireUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { preferences, sources, userArticles, users } from "@/server/db/schema";
import { sendDigestForUser } from "@/server/digest/send";
import { runDailyPipeline } from "@/server/pipeline/daily";
import { groqConfigured } from "@/server/pipeline/steps";
import { getPreferences } from "@/server/queries";
import { createTelegramLink, disconnectTelegram, pollTelegramUpdates } from "@/server/telegram-link";

export type ActionResult = { ok: boolean; message: string; url?: string };

const idSchema = z.string().uuid();

function fail(err: unknown): ActionResult {
  return { ok: false, message: err instanceof Error ? err.message : String(err) };
}

async function upsertUserArticle(
  userId: string,
  articleId: string,
  values: { savedAt?: Date | null; feedback?: "up" | "down" | null },
) {
  await db
    .insert(userArticles)
    .values({ userId, articleId, ...values })
    .onConflictDoUpdate({
      target: [userArticles.userId, userArticles.articleId],
      set: { ...values, updatedAt: new Date() },
    });
}

export async function toggleSaveAction(articleId: string): Promise<ActionResult> {
  const user = await requireUser();
  const id = idSchema.parse(articleId);
  const [row] = await db
    .select({ savedAt: userArticles.savedAt })
    .from(userArticles)
    .where(and(eq(userArticles.articleId, id), eq(userArticles.userId, user.id)));
  const saved = !row?.savedAt;
  await upsertUserArticle(user.id, id, { savedAt: saved ? new Date() : null });
  refresh();
  return { ok: true, message: saved ? "Saved" : "Removed from saved" };
}

export async function setFeedbackAction(articleId: string, value: "up" | "down" | null): Promise<ActionResult> {
  const user = await requireUser();
  const id = idSchema.parse(articleId);
  const feedback = z.enum(["up", "down"]).nullable().parse(value);
  await upsertUserArticle(user.id, id, { feedback });
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
  const user = await requireUser();
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid preferences" };
  }
  await getPreferences(user.id);
  await db
    .update(preferences)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(preferences.userId, user.id));
  refresh();
  return { ok: true, message: "Preferences saved" };
}

export async function updateDisplayNameAction(name: string): Promise<ActionResult> {
  const user = await requireUser();
  const displayName = z.string().trim().min(1).max(40).safeParse(name);
  if (!displayName.success) return { ok: false, message: "Name must be 1–40 characters" };
  await db.update(users).set({ displayName: displayName.data }).where(eq(users.id, user.id));
  refresh();
  return { ok: true, message: "Profile updated" };
}

export async function toggleSourceAction(sourceId: string, enabled: boolean): Promise<ActionResult> {
  await requireAdmin();
  const id = idSchema.parse(sourceId);
  await db.update(sources).set({ enabled, updatedAt: new Date() }).where(eq(sources.id, id));
  refresh();
  return { ok: true, message: enabled ? "Source enabled" : "Source paused" };
}

export async function deleteSourceAction(sourceId: string): Promise<ActionResult> {
  await requireAdmin();
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

export async function addSourceAction(input: { name: string; feedUrl: string; topic: string }): Promise<ActionResult> {
  await requireAdmin();
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
  await requireAdmin();
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
  const user = await requireUser();
  try {
    const r = await sendDigestForUser(await getPreferences(user.id), { force: options.force });
    refresh();
    if (r.skipped) return { ok: true, message: `Already done today (${r.reason}). Use “Rebuild & resend” to force.` };
    return {
      ok: true,
      message: r.dryRun
        ? `Digest built with ${r.itemCount} items — dry run (${r.reason?.replaceAll("_", " ")})`
        : `Sent ${r.itemCount} cards to Telegram`,
    };
  } catch (err) {
    refresh();
    return fail(err);
  }
}

export async function analyzeArticleAction(articleId: string): Promise<ActionResult> {
  await requireUser();
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
  await requireAdmin();
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

export async function connectTelegramAction(): Promise<ActionResult> {
  const user = await requireUser();
  await getPreferences(user.id);
  const link = await createTelegramLink(user.id);
  if ("error" in link) return { ok: false, message: link.error };
  return { ok: true, message: "Press Start in Telegram, then come back and check the connection.", url: link.url };
}

export async function checkTelegramAction(): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await pollTelegramUpdates();
  } catch (err) {
    return fail(err);
  }
  const prefs = await getPreferences(user.id);
  refresh();
  return prefs.telegramChatId
    ? { ok: true, message: "Telegram connected" }
    : { ok: false, message: "Not connected yet — open the link and press Start in Telegram." };
}

export async function disconnectTelegramAction(): Promise<ActionResult> {
  const user = await requireUser();
  await disconnectTelegram(user.id);
  refresh();
  return { ok: true, message: "Telegram disconnected" };
}

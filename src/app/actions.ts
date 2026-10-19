"use server";

import Parser from "rss-parser";
import { and, eq, inArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { TIMEZONES } from "@/lib/format";
import { redirect } from "next/navigation";
import {
  customTopicKey,
  isCustomTopic,
  isTopicSlug,
  MIN_ONBOARDING_TOPICS,
  TOPIC_SLUGS,
  topicMeta,
  type TopicKey,
} from "@/lib/topics";
import { analyzeArticleById, analyzeUnanalyzedArticles } from "@/server/ai/analyze";
import { requireAdmin, requireUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { customTopics, preferences, sources, userArticles, users } from "@/server/db/schema";
import { sendDigestForUser } from "@/server/digest/send";
import { discoverSources, type DiscoveryResult } from "@/server/discovery/discover";
import { previewFeed } from "@/server/discovery/fetch-feed";
import { collectFromEnabledSources } from "@/server/ingest/collect";
import { runDailyPipeline } from "@/server/pipeline/daily";
import { groqConfigured } from "@/server/pipeline/steps";
import { getPreferences } from "@/server/queries";
import { createTelegramLink, disconnectTelegram, pollTelegramUpdates } from "@/server/telegram-link";

export type ActionResult = { ok: boolean; message: string; url?: string };

const MAX_CUSTOM_TOPICS = 5;
const MAX_FEEDS_PER_TOPIC = 4;
const DISCOVER_PER_HOUR = 15;

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
  selectedTopics: z.array(z.string().min(1).max(60)).min(1, "Pick at least one topic").max(40),
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
  const selectedTopics = await knownTopics(parsed.data.selectedTopics);
  if (selectedTopics.length === 0) return { ok: false, message: "Pick at least one topic" };
  await getPreferences(user.id);
  await db
    .update(preferences)
    .set({ ...parsed.data, selectedTopics, updatedAt: new Date() })
    .where(eq(preferences.userId, user.id));
  refresh();
  return { ok: true, message: "Preferences saved" };
}

/** Keeps curated slugs and custom keys that exist in custom_topics; drops anything else. */
async function knownTopics(keys: string[]): Promise<TopicKey[]> {
  const unique = [...new Set(keys)];
  const custom = unique.filter(isCustomTopic);
  const existing = custom.length
    ? new Set((await db.select({ key: customTopics.key }).from(customTopics).where(inArray(customTopics.key, custom))).map((r) => r.key))
    : new Set<string>();
  return unique.filter((k) => isTopicSlug(k) || existing.has(k));
}

async function setFollowed(userId: string, update: (current: TopicKey[]) => TopicKey[]) {
  const prefs = await getPreferences(userId);
  const next = [...new Set(update(prefs.selectedTopics))];
  await db.update(preferences).set({ selectedTopics: next, updatedAt: new Date() }).where(eq(preferences.userId, userId));
  return next;
}

const discoverCalls = new Map<string, number[]>();

export async function discoverTopicAction(
  input: string,
): Promise<{ ok: true; result: DiscoveryResult } | { ok: false; message: string }> {
  const user = await requireUser();
  const text = z.string().trim().min(2, "Type at least 2 characters").max(200).safeParse(input);
  if (!text.success) return { ok: false, message: text.error.issues[0]?.message ?? "Invalid topic" };

  const now = Date.now();
  const recent = (discoverCalls.get(user.id) ?? []).filter((t) => now - t < 60 * 60 * 1000);
  if (recent.length >= DISCOVER_PER_HOUR) return { ok: false, message: "Too many searches — try again in a little while." };
  discoverCalls.set(user.id, [...recent, now]);

  try {
    const result = await discoverSources(text.data);
    if (!result.curatedMatch && result.candidates.length === 0) {
      return { ok: false, message: "No working news feeds found for that. Try a broader or different phrase." };
    }
    return { ok: true, result };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

export async function followTopicAction(key: string): Promise<ActionResult> {
  const user = await requireUser();
  const [known] = await knownTopics([key]);
  if (!known) return { ok: false, message: "Unknown topic" };
  await setFollowed(user.id, (current) => [...current, known]);
  refresh();
  return { ok: true, message: `Following ${topicMeta(known).label}` };
}

export async function unfollowTopicAction(key: string): Promise<ActionResult> {
  const user = await requireUser();
  const next = await setFollowed(user.id, (current) => current.filter((k) => k !== key));
  if (next.length === 0) await setFollowed(user.id, () => [key]);
  refresh();
  return next.length === 0
    ? { ok: false, message: "Keep at least one topic" }
    : { ok: true, message: `Stopped following ${topicMeta(key).label}` };
}

/** Saves the /welcome picks (custom topics already followed there are kept) and builds the first feed. */
export async function finishOnboardingAction(curated: string[]): Promise<ActionResult> {
  const user = await requireUser();
  const prefs = await getPreferences(user.id);
  const picked = (await knownTopics(curated)).filter(isTopicSlug);
  const selectedTopics = [...new Set([...picked, ...prefs.selectedTopics.filter(isCustomTopic)])];
  if (selectedTopics.length < MIN_ONBOARDING_TOPICS) {
    return { ok: false, message: `Pick at least ${MIN_ONBOARDING_TOPICS} topics` };
  }
  await db
    .update(preferences)
    .set({ selectedTopics, onboardedAt: new Date(), updatedAt: new Date() })
    .where(eq(preferences.userId, user.id));

  after(async () => {
    await collectFromEnabledSources({ topics: selectedTopics });
    if (groqConfigured()) await analyzeUnanalyzedArticles({ limit: 12, topics: selectedTopics });
  });
  redirect("/");
}

const followCustomSchema = z.object({
  label: z.string().trim().min(1).max(40),
  query: z.string().trim().min(1).max(80),
  feeds: z.array(z.object({ name: z.string().trim().min(1).max(80), feedUrl: z.string().url() })).min(1).max(MAX_FEEDS_PER_TOPIC),
});

export async function followCustomTopicAction(input: z.input<typeof followCustomSchema>): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = followCustomSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Pick at least one source" };
  const { query, feeds } = parsed.data;
  const stored = await db
    .select({ feedUrl: sources.feedUrl, topic: sources.topic })
    .from(sources)
    .where(inArray(sources.feedUrl, feeds.map((f) => f.feedUrl)));
  const adoptedKey = stored.find((s) => isCustomTopic(s.topic))?.topic;
  const [adopted] = adoptedKey
    ? await db.select({ label: customTopics.label }).from(customTopics).where(eq(customTopics.key, adoptedKey))
    : [];
  const label = adopted?.label ?? parsed.data.label;
  const key = adoptedKey ?? customTopicKey(label);
  const storedTopic = new Map(stored.map((s) => [s.feedUrl, s.topic]));

  const prefs = await getPreferences(user.id);
  const customCount = prefs.selectedTopics.filter(isCustomTopic).length;
  if (!prefs.selectedTopics.includes(key) && customCount >= MAX_CUSTOM_TOPICS) {
    return { ok: false, message: `You can follow up to ${MAX_CUSTOM_TOPICS} custom topics. Remove one first.` };
  }

  const alreadyHere = feeds.filter((f) => storedTopic.get(f.feedUrl) === key);
  const fresh = feeds.filter((f) => !storedTopic.has(f.feedUrl));
  const verified = await Promise.allSettled(fresh.map(async (f) => ({ ...f, preview: await previewFeed(f.feedUrl) })));
  const usable = verified.flatMap((v) => (v.status === "fulfilled" ? [v.value] : []));
  if (usable.length + alreadyHere.length === 0) {
    return { ok: false, message: "None of the selected feeds could be read right now." };
  }

  await db.insert(customTopics).values({ key, label, query, createdByUserId: user.id }).onConflictDoNothing({ target: customTopics.key });
  if (usable.length > 0) {
    await db
      .insert(sources)
      .values(
        usable.map((f) => ({ name: f.name, feedUrl: f.feedUrl, siteUrl: f.preview.siteUrl, topic: key, addedByUserId: user.id })),
      )
      .onConflictDoNothing({ target: sources.feedUrl });
  }
  const sourceCount = usable.length + alreadyHere.length;
  await setFollowed(user.id, (current) => [...current, key]);

  after(async () => {
    await collectFromEnabledSources({ topics: [key] });
    if (groqConfigured()) await analyzeUnanalyzedArticles({ limit: 6, topics: [key] });
  });

  refresh();
  return {
    ok: true,
    message: `Following ${label} with ${sourceCount} source${sourceCount === 1 ? "" : "s"}. First stories appear in about a minute.`,
  };
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

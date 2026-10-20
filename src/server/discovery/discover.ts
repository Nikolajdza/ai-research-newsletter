import { desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { customTopicKey, isTopicSlug, TOPIC_SLUGS, TOPICS, type TopicKey, type TopicSlug } from "@/lib/topics";
import { llmConfigured, llmJson } from "../ai/llm";
import { db } from "../db/client";
import { articles, customTopics, sources } from "../db/schema";
import { previewFeed } from "./fetch-feed";

const MAX_CANDIDATES = 6;
const STALE_AFTER_DAYS = 45;

export type SourceKind = "news-search" | "reddit" | "site";

export type SourceCandidate = {
  name: string;
  feedUrl: string;
  siteUrl: string | null;
  kind: SourceKind;
  itemCount: number;
  sampleTitles: string[];
  /** Already collected for this topic by another reader. */
  existing?: boolean;
};

export type DiscoveryResult = {
  label: string;
  key: TopicKey;
  query: string;
  curatedMatch: TopicSlug | null;
  candidates: SourceCandidate[];
};

const feedSchema = z.object({ name: z.string().trim().max(60).catch(""), url: z.string().trim().url() });

const suggestionSchema = z.object({
  label: z.string().trim().min(1).max(40),
  searchQuery: z.string().trim().min(1).max(80),
  language: z.string().trim().regex(/^[a-z]{2}$/).catch("en"),
  country: z.string().trim().regex(/^[A-Z]{2}$/).catch("US"),
  curatedMatch: z.string().nullable().catch(null),
  feeds: z.array(z.unknown()).catch([]).transform((items) =>
    items
      .flatMap((item) => {
        const f = feedSchema.safeParse(typeof item === "string" ? { url: item } : item);
        return f.success ? [f.data] : [];
      })
      .slice(0, 6),
  ),
  subreddits: z.array(z.unknown()).catch([]).transform((items) =>
    items
      .flatMap((item) => {
        const name = typeof item === "string" ? item.trim().replace(/^\/?r\//i, "") : "";
        return /^[A-Za-z0-9_]{2,21}$/.test(name) ? [name] : [];
      })
      .slice(0, 2),
  ),
});

type Suggestion = z.infer<typeof suggestionSchema>;

function systemPrompt(): string {
  const catalog = TOPIC_SLUGS.map((s) => `${s} (${TOPICS[s].label})`).join(", ");
  return `You help a news reader app find RSS sources for a topic a reader typed.
Return ONLY JSON:
{
  "label": short display name for the topic in the reader's language, Title Case, max 40 chars,
  "searchQuery": Google News search query for this topic (use quotes for exact phrases),
  "language": ISO 639-1 code of the news language the reader most likely wants (default "en"),
  "country": ISO 3166-1 alpha-2 country for that edition (default "US"),
  "curatedMatch": the catalog slug this topic belongs to if it is a clear sub-topic or synonym (e.g. "F1" → motorsport), else null,
  "feeds": up to 5 well-known, real RSS/Atom feed URLs dedicated to this topic (official site feeds you are confident exist),
  "subreddits": up to 2 active subreddit names (without r/) about this topic
}
Catalog: ${catalog}.
Never invent obscure URLs; fewer, real feeds are better than many guesses.`;
}

function googleNewsUrl(query: string, language: string, country: string): string {
  const params = new URLSearchParams({ q: query, hl: `${language}-${country}`, gl: country, ceid: `${country}:${language}` });
  return `https://news.google.com/rss/search?${params}`;
}

async function suggest(input: string): Promise<Suggestion> {
  const fallback: Suggestion = {
    label: input.slice(0, 40),
    searchQuery: input,
    language: "en",
    country: "US",
    curatedMatch: null,
    feeds: [],
    subreddits: [],
  };
  if (!llmConfigured()) return fallback;
  try {
    const parsed = suggestionSchema.safeParse(await llmJson(systemPrompt(), `Topic: ${input}`));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

async function findCustomTopic(names: string[]) {
  const lowered = [...new Set(names.filter(Boolean).map((n) => n.toLowerCase()))];
  const [row] = await db
    .select({ key: customTopics.key, label: customTopics.label, query: customTopics.query })
    .from(customTopics)
    .where(inArray(sql`lower(${customTopics.label})`, lowered))
    .limit(1);
  return row;
}

async function existingCandidates(key: TopicKey): Promise<SourceCandidate[]> {
  const rows = await db.select().from(sources).where(eq(sources.topic, key));
  return Promise.all(
    rows.map(async (row) => {
      const recent = await db
        .select({ title: articles.title })
        .from(articles)
        .where(eq(articles.sourceId, row.id))
        .orderBy(desc(articles.publishedAt))
        .limit(2);
      const kind: SourceKind = row.feedUrl.includes("news.google.com")
        ? "news-search"
        : row.feedUrl.includes("reddit.com")
          ? "reddit"
          : "site";
      return {
        name: row.name,
        feedUrl: row.feedUrl,
        siteUrl: row.siteUrl,
        kind,
        itemCount: 0,
        sampleTitles: recent.map((r) => r.title),
        existing: true,
      };
    }),
  );
}

/**
 * Turns a free-text interest into validated RSS candidates: a Google News search feed
 * (works for any phrase), plus feeds and subreddits suggested by the LLM. Every candidate
 * is fetched and parsed before it is offered.
 */
export async function discoverSources(rawInput: string): Promise<DiscoveryResult> {
  const input = rawInput.trim().replace(/\s+/g, " ");
  const directUrl = /^https?:\/\//i.test(input) ? input : null;
  const s = directUrl
    ? { label: "", searchQuery: "", language: "en", country: "US", curatedMatch: null, feeds: [], subreddits: [] }
    : await suggest(input);

  const known = directUrl ? undefined : await findCustomTopic([input, s.label]);
  const existing = known ? await existingCandidates(known.key) : [];

  const pool: { name: string; feedUrl: string; kind: SourceKind }[] = [];
  if (directUrl) pool.push({ name: "", feedUrl: directUrl, kind: "site" });
  else {
    pool.push({ name: `Google News · ${s.label}`, feedUrl: googleNewsUrl(s.searchQuery, s.language, s.country), kind: "news-search" });
    for (const f of s.feeds) pool.push({ name: f.name, feedUrl: f.url, kind: "site" });
    for (const sub of s.subreddits) pool.push({ name: `r/${sub}`, feedUrl: `https://www.reddit.com/r/${sub}/.rss`, kind: "reddit" });
  }

  const unique = [...new Map(pool.map((p) => [p.feedUrl, p])).values()];
  const taken = new Set([
    ...existing.map((c) => c.feedUrl),
    ...(await db.select({ feedUrl: sources.feedUrl }).from(sources).where(inArray(sources.feedUrl, unique.map((u) => u.feedUrl)))).map(
      (r) => r.feedUrl,
    ),
  ]);
  const staleBefore = Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;

  const checked = await Promise.allSettled(
    unique
      .filter((c) => !taken.has(c.feedUrl))
      .map(async (c): Promise<SourceCandidate> => {
        const preview = await previewFeed(c.feedUrl);
        if (preview.latestAt && preview.latestAt.getTime() < staleBefore) throw new Error("Feed is stale");
        return {
          name: c.name || preview.title || new URL(c.feedUrl).hostname,
          feedUrl: c.feedUrl,
          siteUrl: preview.siteUrl,
          kind: c.kind,
          itemCount: preview.itemCount,
          sampleTitles: preview.sampleTitles,
        };
      }),
  );
  const candidates = [...existing, ...checked.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []))].slice(
    0,
    MAX_CANDIDATES,
  );

  const label = known?.label ?? (directUrl ? (candidates[0]?.name ?? new URL(directUrl).hostname).slice(0, 40) : s.label);
  return {
    label,
    key: known?.key ?? customTopicKey(label),
    query: known?.query ?? (directUrl ? label : s.searchQuery),
    curatedMatch: s.curatedMatch && isTopicSlug(s.curatedMatch) ? s.curatedMatch : null,
    candidates,
  };
}

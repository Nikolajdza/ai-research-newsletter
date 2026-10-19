import { canonicalizeUrl } from "./canonicalize";
import type { TopicKey } from "../db/schema";

export type NormalizedArticle = {
  title: string;
  url: string;
  canonicalUrl: string;
  excerpt: string | null;
  imageUrl: string | null;
  author: string | null;
  publishedAt: Date | null;
  topic: TopicKey;
  sourceId: string;
};

export type RawFeedItem = {
  title?: string;
  link?: string;
  contentSnippet?: string;
  content?: string;
  "content:encoded"?: string;
  summary?: unknown;
  creator?: unknown;
  author?: unknown;
  isoDate?: string;
  pubDate?: string;
  enclosure?: { url?: string; type?: string };
  mediaContent?: unknown;
  mediaThumbnail?: unknown;
};

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

function asText(value: unknown): string | null {
  if (typeof value === "string") {
    const t = value.trim();
    return t || null;
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter(Boolean);
    return parts.length ? parts.join(", ") : null;
  }
  return null;
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** media:content / media:thumbnail arrive as `{ $: { url } }`, arrays of those, or plain strings. */
function mediaUrl(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const url = mediaUrl(entry);
      if (url) return url;
    }
    return null;
  }
  if (typeof value === "object") {
    const attrs = (value as { $?: { url?: string; medium?: string } }).$;
    if (attrs?.url && attrs.medium !== "video") return attrs.url;
  }
  return null;
}

function looksLikeImage(url: string, type?: string): boolean {
  if (type?.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(url);
}

function firstImgSrc(html: string | undefined): string | null {
  if (!html) return null;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

function pickImage(item: RawFeedItem): string | null {
  const candidates = [
    item.enclosure?.url && looksLikeImage(item.enclosure.url, item.enclosure.type)
      ? item.enclosure.url
      : null,
    mediaUrl(item.mediaContent),
    mediaUrl(item.mediaThumbnail),
    firstImgSrc(item["content:encoded"]),
    firstImgSrc(item.content),
  ];
  const found = candidates.find((c): c is string => Boolean(c));
  if (!found || !/^https?:\/\//i.test(found)) return null;
  return found;
}

export function normalizeRssItem(
  item: RawFeedItem,
  ctx: { sourceId: string; topic: TopicKey },
): NormalizedArticle | null {
  const title = item.title?.trim();
  const url = item.link?.trim();
  if (!title || !url) return null;

  const canonicalUrl = canonicalizeUrl(url);
  if (!canonicalUrl) return null;

  const rawExcerpt =
    item.contentSnippet ||
    asText(item.summary) ||
    item.content ||
    item["content:encoded"] ||
    null;
  const excerpt = rawExcerpt ? truncate(stripHtml(rawExcerpt), 480) : null;

  return {
    sourceId: ctx.sourceId,
    topic: ctx.topic,
    title: truncate(stripHtml(title), 300),
    url,
    canonicalUrl,
    excerpt: excerpt || null,
    imageUrl: pickImage(item),
    author: asText(item.creator) || asText(item.author),
    publishedAt: parseDate(item.isoDate) ?? parseDate(item.pubDate),
  };
}

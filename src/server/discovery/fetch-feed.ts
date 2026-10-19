import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import Parser from "rss-parser";

const MAX_BYTES = 3_000_000;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10_000;

const parser = new Parser();

export type FeedPreview = {
  title: string | null;
  siteUrl: string | null;
  itemCount: number;
  sampleTitles: string[];
  latestAt: Date | null;
};

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const a = address.toLowerCase();
    if (a === "::1" || a === "::" || a.startsWith("fc") || a.startsWith("fd") || a.startsWith("fe80")) return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(a);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }
  const [a, b] = address.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

/** Feed URLs come from an LLM or a reader, so only public http(s) hosts may be fetched. */
async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only http(s) feeds are allowed");
  if (url.username || url.password) throw new Error("Credentials in URL are not allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("Private host");
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) throw new Error("Private host");
  return url;
}

async function fetchText(raw: string): Promise<string> {
  let target = raw;
  let retried = false;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const url = await assertPublicUrl(target);
    const request = () =>
      fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "User-Agent": "InsightLoop/0.1 (+RSS reader)",
          Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5",
        },
      });
    let response = await request();
    if (response.status === 429 && !retried) {
      retried = true;
      await new Promise((resolve) => setTimeout(resolve, 1500));
      response = await request();
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error(`Redirect without location (${response.status})`);
      target = new URL(location, url).toString();
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_BYTES) throw new Error("Feed too large");
    const text = await response.text();
    if (text.length > MAX_BYTES) throw new Error("Feed too large");
    return text;
  }
  throw new Error("Too many redirects");
}

/** Fetches and parses a feed with SSRF guards; throws if it is not a usable RSS/Atom feed. */
export async function previewFeed(feedUrl: string): Promise<FeedPreview> {
  const feed = await parser.parseString(await fetchText(feedUrl));
  const items = feed.items ?? [];
  if (items.length === 0) throw new Error("Feed has no items");
  const dates = items
    .map((i) => (i.isoDate ? new Date(i.isoDate) : null))
    .filter((d): d is Date => d !== null && !Number.isNaN(d.getTime()));
  return {
    title: feed.title?.trim() || null,
    siteUrl: feed.link ?? null,
    itemCount: items.length,
    sampleTitles: items
      .slice(0, 3)
      .map((i) => i.title?.trim())
      .filter((t): t is string => Boolean(t)),
    latestAt: dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null,
  };
}

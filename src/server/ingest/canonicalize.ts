/**
 * Normalize article URLs so the same story from tracking redirects / www / query junk
 * collapses to one canonical key for dedupe.
 */
export function canonicalizeUrl(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  parsed.hash = "";
  parsed.hostname = parsed.hostname.replace(/^www\./i, "").toLowerCase();

  const dropParams = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "utm_id",
    "fbclid",
    "gclid",
    "mc_cid",
    "mc_eid",
    "ref",
    "ref_src",
  ];

  for (const key of dropParams) {
    parsed.searchParams.delete(key);
  }

  // Stable param order
  parsed.searchParams.sort();

  let path = parsed.pathname.replace(/\/+$/, "");
  if (path === "") path = "/";

  const query = parsed.searchParams.toString();
  return `${parsed.protocol}//${parsed.hostname}${path}${query ? `?${query}` : ""}`;
}

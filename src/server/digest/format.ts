import type { DigestCandidate } from "./select";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * Telegram HTML message (max ~4096 chars).
 */
export function formatTelegramDigest(input: {
  digestDate: string;
  format: string;
  items: DigestCandidate[];
}): string {
  const header = `<b>InsightLoop Daily Digest</b>\n${escapeHtml(input.digestDate)}\n`;

  if (input.items.length === 0) {
    return `${header}\nNo high-relevance articles today. Check preferences or sources.`;
  }

  const parts = input.items.map((item, index) => {
    const score = item.relevanceScore.toFixed(1);
    const title = escapeHtml(item.title);
    const topic = escapeHtml(item.topic);
    const summary =
      input.format === "short"
        ? escapeHtml((item.summary ?? "").slice(0, 140))
        : escapeHtml(item.summary ?? item.whyItMatters ?? "");

    const takeaway =
      input.format === "detailed" && item.keyTakeaways[0]
        ? `\n• ${escapeHtml(item.keyTakeaways[0])}`
        : "";

    return [
      `<b>${index + 1}. ${title}</b>`,
      `${topic} · score ${score} · ${escapeHtml(item.sourceName)}`,
      summary,
      takeaway,
      `<a href="${escapeHtml(item.url)}">Read</a>`,
    ]
      .filter(Boolean)
      .join("\n");
  });

  let message = `${header}\n${parts.join("\n\n")}`;
  if (message.length > 4000) {
    message = `${message.slice(0, 3990)}…`;
  }
  return message;
}

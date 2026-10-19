import type { DigestCandidate } from "./select";
import { escapeHtml, formatCardCaption } from "./telegram";

/** Whole digest as one HTML text, stored for history and the dashboard preview. */
export function formatTelegramDigest(input: {
  digestDate: string;
  format: string;
  items: DigestCandidate[];
}): string {
  const header = `<b>☀️ InsightLoop · Daily Digest</b>\n${input.digestDate}`;
  if (input.items.length === 0) {
    return `${header}\n\nNo high-relevance stories today. Try lowering the minimum score or following more topics.`;
  }
  const cards = input.items.map(
    (item, index) => `${formatCardCaption(item, index, input.format)}\n<a href="${escapeHtml(item.url)}">Read article ↗</a>`,
  );
  return `${header} · ${input.items.length} stories\n\n${cards.join("\n\n———\n\n")}`;
}

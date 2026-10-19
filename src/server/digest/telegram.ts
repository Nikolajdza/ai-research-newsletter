import { TOPICS } from "@/lib/topics";
import type { DigestCandidate } from "./select";

type TelegramResponse<T> = { ok: boolean; result?: T; description?: string };

export type TelegramSendResult = { ok: true; messageId: string } | { ok: false; error: string };

export type TelegramUpdate = {
  update_id: number;
  message?: { chat: { id: number; first_name?: string }; text?: string };
};

const CAPTION_LIMIT = 1024;
const BETWEEN_MESSAGES_MS = 400;

export function telegramBotConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
}

export async function callTelegram<T>(method: string, payload: Record<string, unknown>): Promise<TelegramResponse<T>> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return { ok: false, description: "TELEGRAM_BOT_TOKEN missing" };
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await response.json()) as TelegramResponse<T>;
  if (!response.ok && data.ok !== false) return { ok: false, description: `Telegram HTTP ${response.status}` };
  return data;
}

let cachedBotUsername: string | null = null;

export async function getBotUsername(): Promise<string | null> {
  if (process.env.TELEGRAM_BOT_USERNAME) return process.env.TELEGRAM_BOT_USERNAME.replace(/^@/, "");
  if (cachedBotUsername) return cachedBotUsername;
  const me = await callTelegram<{ username?: string }>("getMe", {});
  cachedBotUsername = me.ok ? (me.result?.username ?? null) : null;
  return cachedBotUsername;
}

export async function sendTelegramText(
  chatId: string,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<TelegramSendResult> {
  const res = await callTelegram<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...extra,
  });
  return res.ok ? { ok: true, messageId: String(res.result?.message_id ?? "") } : { ok: false, error: res.description ?? "send failed" };
}

export function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/** One article as a Telegram card caption (HTML, fits the 1024-char photo caption limit). */
export function formatCardCaption(item: DigestCandidate, index: number, format: string): string {
  const topic = TOPICS[item.topic];
  const head = [
    `<b>${index + 1}. ${escapeHtml(item.title)}</b>`,
    `${topic.emoji} ${escapeHtml(topic.label)} · ⭐ ${item.relevanceScore.toFixed(1)} · ${escapeHtml(item.sourceName)}`,
  ].join("\n");
  const takeaway = format === "detailed" && item.keyTakeaways[0] ? `💡 ${escapeHtml(item.keyTakeaways[0])}` : "";

  const fixed = [head, takeaway].filter(Boolean).join("\n\n").length + 4;
  const summarySource = item.summary ?? item.whyItMatters ?? "";
  const summary = escapeHtml(truncate(summarySource, format === "short" ? 160 : CAPTION_LIMIT - fixed - 40));
  return [head, summary, takeaway].filter(Boolean).join("\n\n").slice(0, CAPTION_LIMIT);
}

function readButton(url: string) {
  return { inline_keyboard: [[{ text: "Read article ↗", url }]] };
}

const pause = () => new Promise((resolve) => setTimeout(resolve, BETWEEN_MESSAGES_MS));

/**
 * Channel-style digest: a header message, then one card per story (photo + caption when the
 * feed has an image, otherwise text with a large link preview). Returns the header message id.
 */
export async function sendTelegramDigestCards(input: {
  chatId: string;
  digestDate: string;
  format: string;
  items: DigestCandidate[];
}): Promise<TelegramSendResult> {
  const { chatId, items, format } = input;
  const header = await sendTelegramText(
    chatId,
    items.length
      ? `<b>☀️ InsightLoop · Daily Digest</b>\n${escapeHtml(input.digestDate)} · ${items.length} stories picked for you`
      : `<b>☀️ InsightLoop · Daily Digest</b>\n${escapeHtml(input.digestDate)}\n\nNo high-relevance stories today. Try lowering the minimum score or following more topics.`,
  );
  if (!header.ok) return header;

  for (const [index, item] of items.entries()) {
    await pause();
    const caption = formatCardCaption(item, index, format);
    const markup = readButton(item.url);

    if (item.imageUrl) {
      const photo = await callTelegram<{ message_id: number }>("sendPhoto", {
        chat_id: chatId,
        photo: item.imageUrl,
        caption,
        parse_mode: "HTML",
        reply_markup: markup,
      });
      if (photo.ok) continue;
    }

    // No image, or Telegram could not fetch it: text card with the article's own preview image.
    const text = await sendTelegramText(chatId, caption, {
      link_preview_options: { url: item.url, prefer_large_media: true, show_above_text: true },
      reply_markup: markup,
    });
    if (!text.ok) return { ok: false, error: `Card ${index + 1}: ${text.error}` };
  }

  return header;
}

export async function getTelegramUpdates(offset?: number): Promise<TelegramResponse<TelegramUpdate[]>> {
  return callTelegram<TelegramUpdate[]>("getUpdates", { offset, timeout: 0, allowed_updates: ["message"] });
}

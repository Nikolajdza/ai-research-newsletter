import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "./db/client";
import { preferences, users } from "./db/schema";
import { escapeHtml, getBotUsername, getTelegramUpdates, sendTelegramText, type TelegramUpdate } from "./digest/telegram";

/** Creates a one-time token and the t.me deep link that carries it to the bot as /start <token>. */
export async function createTelegramLink(userId: string): Promise<{ url: string } | { error: string }> {
  const username = await getBotUsername();
  if (!username) return { error: "Telegram bot is not configured (TELEGRAM_BOT_TOKEN)" };
  const token = randomBytes(12).toString("hex");
  await db.update(preferences).set({ telegramLinkToken: token, updatedAt: new Date() }).where(eq(preferences.userId, userId));
  return { url: `https://t.me/${username}?start=${token}` };
}

export async function disconnectTelegram(userId: string): Promise<void> {
  await db
    .update(preferences)
    .set({ telegramChatId: null, telegramLinkToken: null, updatedAt: new Date() })
    .where(eq(preferences.userId, userId));
}

/** Handles one bot update. Safe to replay: tokens are single-use. */
export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  const message = update.message;
  const text = message?.text?.trim();
  if (!message || !text) return;
  const chatId = String(message.chat.id);

  if (text.startsWith("/start")) {
    const token = text.split(/\s+/)[1];
    if (!token) {
      await sendTelegramText(chatId, "👋 Open InsightLoop → <b>Settings → Connect Telegram</b> to link this chat to your account.");
      return;
    }
    const [linked] = await db
      .update(preferences)
      .set({ telegramChatId: chatId, telegramLinkToken: null, telegramEnabled: true, updatedAt: new Date() })
      .where(eq(preferences.telegramLinkToken, token))
      .returning({ userId: preferences.userId });
    if (!linked) {
      await sendTelegramText(chatId, "This link has expired. Generate a new one in InsightLoop → Settings.");
      return;
    }
    const [user] = await db.select({ name: users.displayName }).from(users).where(eq(users.id, linked.userId));
    await sendTelegramText(
      chatId,
      `✅ Connected to InsightLoop${user ? ` as <b>${escapeHtml(user.name)}</b>` : ""}.\nYour daily digest will arrive here. Send /stop to disconnect.`,
    );
    return;
  }

  if (text === "/stop") {
    await db
      .update(preferences)
      .set({ telegramChatId: null, updatedAt: new Date() })
      .where(eq(preferences.telegramChatId, chatId));
    await sendTelegramText(chatId, "Disconnected. You won't receive digests here anymore.");
  }
}

/**
 * Local-dev alternative to the webhook: pull pending updates and process them.
 * Telegram refuses getUpdates while a webhook is set; then the webhook already did the work.
 */
export async function pollTelegramUpdates(): Promise<{ processed: number; webhookActive: boolean }> {
  const res = await getTelegramUpdates();
  if (!res.ok) {
    if (res.description?.includes("webhook")) return { processed: 0, webhookActive: true };
    throw new Error(res.description ?? "getUpdates failed");
  }
  const updates = res.result ?? [];
  for (const update of updates) await handleTelegramUpdate(update);
  const last = updates.at(-1);
  if (last) await getTelegramUpdates(last.update_id + 1);
  return { processed: updates.length, webhookActive: false };
}

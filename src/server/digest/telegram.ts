export type TelegramSendResult = {
  ok: true;
  messageId: string;
} | {
  ok: false;
  error: string;
};

export function telegramConfigured(): boolean {
  return Boolean(
    process.env.TELEGRAM_BOT_TOKEN?.trim() &&
      process.env.TELEGRAM_CHAT_ID?.trim(),
  );
}

export async function sendTelegramMessage(
  text: string,
): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!token || !chatId) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing" };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  const data = (await response.json()) as {
    ok: boolean;
    result?: { message_id?: number };
    description?: string;
  };

  if (!response.ok || !data.ok) {
    return {
      ok: false,
      error: data.description ?? `Telegram HTTP ${response.status}`,
    };
  }

  return {
    ok: true,
    messageId: String(data.result?.message_id ?? ""),
  };
}

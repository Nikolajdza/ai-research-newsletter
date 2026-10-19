import { timingSafeEqual } from "node:crypto";
import type { TelegramUpdate } from "@/server/digest/telegram";
import { handleTelegramUpdate } from "@/server/telegram-link";

function secretMatches(received: string | null, expected: string): boolean {
  if (!received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Production bot updates (/start <token>, /stop). Register once with
 * setWebhook?url=<app>/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>.
 */
export async function POST(request: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return Response.json({ ok: false, error: "TELEGRAM_WEBHOOK_SECRET not set" }, { status: 503 });
  if (!secretMatches(request.headers.get("x-telegram-bot-api-secret-token"), expected)) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const update = (await request.json()) as TelegramUpdate;
  await handleTelegramUpdate(update);
  return Response.json({ ok: true });
}

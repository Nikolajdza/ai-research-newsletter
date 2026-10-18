import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { digests, preferences } from "../db/schema";
import { formatTelegramDigest } from "./format";
import { selectDigestItems } from "./select";
import { sendTelegramMessage, telegramConfigured } from "./telegram";

export type DigestSendResult = {
  skipped: boolean;
  reason?: string;
  digestId: string | null;
  digestDate: string;
  status: string;
  itemCount: number;
  dryRun: boolean;
  telegramMessageId?: string | null;
  messagePreview: string;
};

type DigestRow = typeof digests.$inferSelect;
type DigestValues = Partial<typeof digests.$inferInsert>;

function localHour(timezone: string, date = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return Number(hour);
}

async function upsertDigest(
  existing: DigestRow | undefined,
  base: { digestDate: string },
  values: DigestValues,
): Promise<DigestRow> {
  if (existing) {
    const [row] = await db
      .update(digests)
      .set(values)
      .where(eq(digests.id, existing.id))
      .returning();
    return row;
  }
  const [row] = await db
    .insert(digests)
    .values({ digestDate: base.digestDate, channel: "telegram", ...values })
    .returning();
  return row;
}

function toResult(row: DigestRow, extra: Partial<DigestSendResult> = {}): DigestSendResult {
  return {
    skipped: false,
    digestId: row.id,
    digestDate: row.digestDate,
    status: row.status,
    itemCount: row.itemCount,
    dryRun: row.status === "dry_run",
    telegramMessageId: row.telegramMessageId,
    messagePreview: row.messageText ?? "",
    ...extra,
  };
}

/**
 * Idempotent daily digest: at most one real Telegram send per date+channel.
 * A dry_run row can be upgraded to a real send once Telegram is configured.
 */
export async function sendDailyDigest(options?: {
  force?: boolean;
  dryRun?: boolean;
  /** Scheduled callers pass true so the digest waits for the user's preferred hour. */
  respectSchedule?: boolean;
}): Promise<DigestSendResult> {
  const force = options?.force ?? false;

  const [prefs] = await db.select().from(preferences).limit(1);
  const selection = await selectDigestItems();

  if (options?.respectSchedule && prefs) {
    const hour = localHour(selection.timezone);
    if (hour < prefs.digestHourLocal) {
      return {
        skipped: true,
        reason: `scheduled_for_${String(prefs.digestHourLocal).padStart(2, "0")}:00`,
        digestId: null,
        digestDate: selection.digestDate,
        status: "waiting",
        itemCount: 0,
        dryRun: false,
        messagePreview: "",
      };
    }
  }

  const messageText = formatTelegramDigest({
    digestDate: selection.digestDate,
    format: selection.format,
    items: selection.items,
  });

  const [existing] = await db
    .select()
    .from(digests)
    .where(and(eq(digests.digestDate, selection.digestDate), eq(digests.channel, "telegram")))
    .limit(1);

  const channelDisabled = prefs?.telegramEnabled === false;
  const dryRun = Boolean(options?.dryRun) || channelDisabled || !telegramConfigured();

  if (existing && !force) {
    const alreadyDone =
      existing.status === "sent" || (existing.status === "dry_run" && dryRun);
    if (alreadyDone) {
      return toResult(existing, {
        skipped: true,
        reason: `already_${existing.status}`,
      });
    }
  }

  const payload = {
    format: selection.format,
    messageText,
    articleIds: selection.items.map((i) => i.id),
    itemCount: selection.items.length,
  };

  if (dryRun) {
    const reason = options?.dryRun
      ? "dry_run_requested"
      : channelDisabled
        ? "telegram_disabled_in_preferences"
        : "telegram_not_configured";
    const row = await upsertDigest(existing, selection, {
      ...payload,
      status: "dry_run",
      errorMessage: reason,
      sentAt: new Date(),
    });
    return toResult(row, { reason });
  }

  const telegram = await sendTelegramMessage(messageText);

  if (!telegram.ok) {
    await upsertDigest(existing, selection, {
      ...payload,
      status: "failed",
      errorMessage: telegram.error,
    });
    throw new Error(`Telegram send failed: ${telegram.error}`);
  }

  const row = await upsertDigest(existing, selection, {
    ...payload,
    status: "sent",
    telegramMessageId: telegram.messageId,
    errorMessage: null,
    sentAt: new Date(),
  });
  return toResult(row);
}

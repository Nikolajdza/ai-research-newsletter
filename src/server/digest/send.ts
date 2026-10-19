import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { digests, preferences } from "../db/schema";
import { formatTelegramDigest } from "./format";
import { selectDigestItems, type PreferencesRow } from "./select";
import { sendTelegramDigestCards, telegramBotConfigured } from "./telegram";

export type DigestSendResult = {
  userId: string;
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

export type DigestOptions = {
  force?: boolean;
  dryRun?: boolean;
  /** Scheduled callers pass true so each digest waits for that user's preferred hour. */
  respectSchedule?: boolean;
};

export type DigestBatchResult = {
  users: number;
  sent: number;
  dryRun: number;
  skipped: number;
  failed: number;
  results: DigestSendResult[];
  errors: { userId: string; message: string }[];
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
  base: { userId: string; digestDate: string },
  values: DigestValues,
): Promise<DigestRow> {
  if (existing) {
    const [row] = await db.update(digests).set(values).where(eq(digests.id, existing.id)).returning();
    return row;
  }
  const [row] = await db
    .insert(digests)
    .values({ userId: base.userId, digestDate: base.digestDate, channel: "telegram", ...values })
    .returning();
  return row;
}

function toResult(row: DigestRow, extra: Partial<DigestSendResult> = {}): DigestSendResult {
  return {
    userId: row.userId,
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
 * Idempotent daily digest for one user: at most one real Telegram send per date+channel.
 * A dry_run row is upgraded to a real send once the user connects Telegram.
 */
export async function sendDigestForUser(prefs: PreferencesRow, options: DigestOptions = {}): Promise<DigestSendResult> {
  const selection = await selectDigestItems(prefs);

  if (options.respectSchedule && localHour(prefs.timezone) < prefs.digestHourLocal) {
    return {
      userId: prefs.userId,
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

  const messageText = formatTelegramDigest(selection);
  const [existing] = await db
    .select()
    .from(digests)
    .where(
      and(
        eq(digests.userId, prefs.userId),
        eq(digests.digestDate, selection.digestDate),
        eq(digests.channel, "telegram"),
      ),
    )
    .limit(1);

  const dryRunReason = options.dryRun
    ? "dry_run_requested"
    : !prefs.telegramEnabled
      ? "telegram_disabled_in_preferences"
      : !telegramBotConfigured()
        ? "telegram_bot_not_configured"
        : !prefs.telegramChatId
          ? "telegram_not_connected"
          : null;
  const dryRun = dryRunReason !== null;

  if (existing && !options.force) {
    const alreadyDone = existing.status === "sent" || (existing.status === "dry_run" && dryRun);
    if (alreadyDone) return toResult(existing, { skipped: true, reason: `already_${existing.status}` });
  }

  const base = { userId: prefs.userId, digestDate: selection.digestDate };
  const payload = {
    format: selection.format,
    messageText,
    articleIds: selection.items.map((i) => i.id),
    itemCount: selection.items.length,
  };

  if (dryRun) {
    const row = await upsertDigest(existing, base, {
      ...payload,
      status: "dry_run",
      errorMessage: dryRunReason,
      sentAt: new Date(),
    });
    return toResult(row, { reason: dryRunReason });
  }

  const telegram = await sendTelegramDigestCards({ ...selection, chatId: prefs.telegramChatId! });
  if (!telegram.ok) {
    await upsertDigest(existing, base, { ...payload, status: "failed", errorMessage: telegram.error });
    throw new Error(`Telegram send failed: ${telegram.error}`);
  }

  const row = await upsertDigest(existing, base, {
    ...payload,
    status: "sent",
    telegramMessageId: telegram.messageId,
    errorMessage: null,
    sentAt: new Date(),
  });
  return toResult(row);
}

/** Pipeline entry point: one digest per account; one user's failure doesn't stop the rest. */
export async function sendDailyDigests(options: DigestOptions = {}): Promise<DigestBatchResult> {
  const everyone = await db.select().from(preferences);
  const batch: DigestBatchResult = { users: everyone.length, sent: 0, dryRun: 0, skipped: 0, failed: 0, results: [], errors: [] };

  for (const prefs of everyone) {
    try {
      const result = await sendDigestForUser(prefs, options);
      batch.results.push(result);
      if (result.skipped) batch.skipped += 1;
      else if (result.dryRun) batch.dryRun += 1;
      else batch.sent += 1;
    } catch (err) {
      batch.failed += 1;
      batch.errors.push({ userId: prefs.userId, message: err instanceof Error ? err.message : String(err) });
    }
  }
  return batch;
}

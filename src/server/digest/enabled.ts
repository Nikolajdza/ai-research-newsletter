/**
 * Global kill switch for Telegram digest sends.
 * Default OFF — set DIGESTS_ENABLED=true on Vercel when you want Cron to deliver again.
 * Per-user Preferences → Telegram still must be on for a real send.
 */
export function digestsEnabled(): boolean {
  const raw = (process.env.DIGESTS_ENABLED ?? "false").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

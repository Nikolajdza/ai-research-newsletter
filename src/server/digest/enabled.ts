/**
 * Emergency kill switch only. Default ON so per-user `telegram_enabled` controls delivery.
 * Set DIGESTS_ENABLED=false on Vercel to pause all sends without touching user prefs.
 */
export function digestsEnabled(): boolean {
  const raw = process.env.DIGESTS_ENABLED;
  if (raw === undefined || raw.trim() === "") return true;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

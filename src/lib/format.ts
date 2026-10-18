export const TIMEZONES = [
  "Europe/Belgrade",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "UTC",
] as const;

/** Request-time clock for dynamic Server Components (call after `connection()`). */
export function requestNow(): number {
  return Date.now();
}

export function timeAgo(date: Date | string | null, now: number): string {
  if (!date) return "";
  const diff = Math.max(0, now - new Date(date).getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

export function formatDate(date: Date | string | null, timeZone?: string): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(new Date(date));
}

export function formatTime(date: Date | string | null, timeZone?: string): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(new Date(date));
}

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function formatDayLabel(isoDay: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(
    new Date(`${isoDay}T00:00:00Z`),
  );
}

export function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function localHour(timeZone: string, now: number): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone }).format(now),
  );
}

export function scoreLabel(score: number): string {
  if (score >= 9) return "Very high relevance";
  if (score >= 7.5) return "High relevance";
  if (score >= 6) return "Moderate relevance";
  return "Low relevance";
}

export function readMinutes(text: string | null): number {
  if (!text) return 1;
  return Math.max(1, Math.round(text.split(/\s+/).length / 200) + 2);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

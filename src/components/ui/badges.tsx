import { topicMeta, type TopicKey } from "@/lib/topics";

export function ScorePill({
  score,
  size = "md",
}: {
  score: number | null;
  size?: "sm" | "md" | "lg";
}) {
  if (score === null) {
    return (
      <span className="inline-flex items-center rounded-lg bg-white/5 px-2 py-1 text-[11px] font-medium text-muted ring-1 ring-white/10">
        Not scored
      </span>
    );
  }
  const tone =
    score >= 8
      ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/25"
      : score >= 6
        ? "bg-sky-500/15 text-sky-300 ring-sky-400/25"
        : "bg-amber-500/15 text-amber-300 ring-amber-400/25";
  const sizing =
    size === "lg" ? "px-3 py-1.5 text-base" : size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs";
  return (
    <span className={`inline-flex items-center rounded-lg font-semibold tabular-nums ring-1 ${tone} ${sizing}`}>
      {score.toFixed(1)}
    </span>
  );
}

export function TopicChip({ topic, className = "" }: { topic: TopicKey; className?: string }) {
  const meta = topicMeta(topic);
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ${meta.chip} ${className}`}>
      {meta.label}
    </span>
  );
}

export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-lg border border-line bg-white/[0.03] px-2.5 py-1 text-xs text-foreground/90">
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, string> = {
  completed: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/25",
  sent: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/25",
  dry_run: "bg-sky-500/15 text-sky-300 ring-sky-400/25",
  completed_with_errors: "bg-amber-500/15 text-amber-300 ring-amber-400/25",
  skipped: "bg-white/5 text-muted ring-white/10",
  waiting: "bg-white/5 text-muted ring-white/10",
  running: "bg-violet-500/15 text-violet-300 ring-violet-400/25",
  stalled: "bg-amber-500/15 text-amber-300 ring-amber-400/25",
  failed: "bg-rose-500/15 text-rose-300 ring-rose-400/25",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ${
        STATUS_TONES[status] ?? STATUS_TONES.skipped
      }`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

import type { LucideIcon } from "lucide-react";

const TONES = {
  violet: "bg-violet-500/15 text-violet-300",
  emerald: "bg-emerald-500/15 text-emerald-300",
  sky: "bg-sky-500/15 text-sky-300",
  rose: "bg-rose-500/15 text-rose-300",
} as const;

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "violet",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  tone?: keyof typeof TONES;
}) {
  return (
    <div className="card p-4">
      <span className={`grid h-9 w-9 place-items-center rounded-xl ${TONES[tone]}`}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <p className="mt-3 text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-emerald-400">{hint}</p>}
    </div>
  );
}

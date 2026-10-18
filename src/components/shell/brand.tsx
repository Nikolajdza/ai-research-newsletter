import Link from "next/link";
import { appConfig } from "@/lib/config";

export function BrandMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <span
      className={`${className} grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent-2 glow-accent`}
    >
      <span className="h-3 w-3 rounded-full border-[2.5px] border-white" />
    </span>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3">
      <BrandMark />
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold tracking-tight">{appConfig.name}</span>
        {!compact && <span className="block text-[11px] text-muted">{appConfig.tagline}</span>}
      </span>
    </Link>
  );
}

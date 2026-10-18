"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import type { ActionResult } from "@/app/actions";

const VARIANTS = {
  primary: "bg-accent text-white hover:bg-accent/90 glow-accent",
  secondary: "border border-line bg-white/[0.03] text-foreground hover:bg-white/[0.07]",
  ghost: "text-muted hover:bg-white/[0.05] hover:text-foreground",
} as const;

export function ActionButton({
  action,
  children,
  pendingLabel,
  variant = "primary",
  className = "",
  showResult = true,
}: {
  action: () => Promise<ActionResult>;
  children: ReactNode;
  pendingLabel?: string;
  variant?: keyof typeof VARIANTS;
  className?: string;
  showResult?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setResult(null);
            try {
              setResult(await action());
            } catch (err) {
              setResult({ ok: false, message: err instanceof Error ? err.message : "Something went wrong" });
            }
          })
        }
        className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all disabled:cursor-wait disabled:opacity-70 ${VARIANTS[variant]} ${className}`}
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {pending && pendingLabel ? pendingLabel : children}
      </button>
      {showResult && result && (
        <p className={`max-w-md text-xs leading-relaxed ${result.ok ? "text-emerald-300" : "text-rose-300"}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}

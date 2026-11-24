"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { setTelegramDigestsAction, type ActionResult } from "@/app/actions";

export function DigestToggle({
  enabled,
  globalOn,
}: {
  enabled: boolean;
  /** Server DIGESTS_ENABLED env */
  globalOn: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [on, setOn] = useState(enabled);
  const [result, setResult] = useState<ActionResult | null>(null);

  const toggle = () => {
    const next = !on;
    startTransition(async () => {
      setResult(null);
      const r = await setTelegramDigestsAction(next);
      setResult(r);
      if (r.ok) setOn(next);
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Daily Telegram digest</p>
          <p className="text-xs text-muted">
            {globalOn
              ? "Server delivery is on. Toggle below for your account."
              : "Server delivery is off (DIGESTS_ENABLED). Pipeline still collects & analyzes; nothing is sent until you set DIGESTS_ENABLED=true on Vercel."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          disabled={pending}
          onClick={toggle}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
            on ? "bg-accent" : "bg-white/10"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 grid h-6 w-6 place-items-center rounded-full bg-white shadow transition-transform ${
              on ? "translate-x-5" : "translate-x-0"
            }`}
          >
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />}
          </span>
        </button>
      </div>
      {result && (
        <p className={`text-xs ${result.ok ? "text-emerald-300" : "text-rose-300"}`}>{result.message}</p>
      )}
    </div>
  );
}

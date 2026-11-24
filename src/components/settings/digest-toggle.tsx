"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { setTelegramDigestsAction, type ActionResult } from "@/app/actions";

export function DigestToggle({ enabled }: { enabled: boolean }) {
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
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">Daily Telegram digest</p>
            <span
              className={`rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ${
                on
                  ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/25"
                  : "bg-white/[0.04] text-muted ring-line"
              }`}
            >
              {on ? "On" : "Off"}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            {on
              ? "Cron will send your scored stories to Telegram when the chat is connected."
              : "Off for your account. New readers are asked once after signup; you can turn this on anytime."}
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

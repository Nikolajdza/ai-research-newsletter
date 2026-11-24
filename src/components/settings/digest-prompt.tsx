"use client";

import { Loader2, Mail, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { answerDigestPromptAction } from "@/app/actions";

/** Shown once after /welcome for accounts that have not answered yet. */
export function DigestPromptModal() {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const answer = (enable: boolean) => {
    startTransition(async () => {
      setError(null);
      const r = await answerDigestPromptAction(enable);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setOpen(false);
      if (r.url) router.push(r.url);
      else router.refresh();
    });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="digest-prompt-title">
      <div className="relative w-full max-w-md rounded-2xl border border-line bg-panel p-5 shadow-2xl sm:p-6">
        <button
          type="button"
          disabled={pending}
          onClick={() => answer(false)}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-muted hover:bg-white/[0.06] hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-accent/15 text-accent">
          <Mail className="h-6 w-6" />
        </div>
        <h2 id="digest-prompt-title" className="text-lg font-semibold tracking-tight">
          Want a daily digest?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          InsightLoop can send your top scored stories to Telegram once a day. You can change this anytime in Settings — digests stay off until you say yes.
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            disabled={pending}
            onClick={() => answer(true)}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-70"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Yes, enable digests
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => answer(false)}
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-line bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-muted hover:text-foreground disabled:opacity-70"
          >
            Not now
          </button>
        </div>
        {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}
      </div>
    </div>
  );
}

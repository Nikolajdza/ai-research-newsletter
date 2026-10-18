"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { updateDisplayNameAction, type ActionResult } from "@/app/actions";

export function ProfileForm({ displayName }: { displayName: string }) {
  const [name, setName] = useState(displayName);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
      action={() =>
        startTransition(async () => {
          setResult(await updateDisplayNameAction(name));
        })
      }
    >
      <label className="flex-1 text-xs text-muted">
        Display name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          className="mt-1 w-full rounded-lg border border-line bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-accent/50"
        />
      </label>
      <button
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-70"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} Save
      </button>
      {result && <p className={`text-xs ${result.ok ? "text-emerald-300" : "text-rose-300"}`}>{result.message}</p>}
    </form>
  );
}

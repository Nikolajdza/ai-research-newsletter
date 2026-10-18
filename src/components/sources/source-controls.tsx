"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { addSourceAction, deleteSourceAction, toggleSourceAction, type ActionResult } from "@/app/actions";
import { TOPIC_SLUGS, TOPICS } from "@/lib/topics";
import { Switch } from "../ui/switch";

export function SourceToggle({ sourceId, enabled, name }: { sourceId: string; enabled: boolean; name: string }) {
  const [optimistic, setOptimistic] = useOptimistic(enabled);
  const [, startTransition] = useTransition();
  return (
    <Switch
      label={`Toggle ${name}`}
      checked={optimistic}
      onChange={(next) =>
        startTransition(async () => {
          setOptimistic(next);
          await toggleSourceAction(sourceId, next);
        })
      }
    />
  );
}

export function DeleteSourceButton({ sourceId, name }: { sourceId: string; name: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-label={`Remove ${name}`}
      disabled={pending}
      onClick={() => {
        if (!confirm(`Remove ${name} and its collected articles?`)) return;
        startTransition(async () => {
          await deleteSourceAction(sourceId);
        });
      }}
      className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-rose-500/10 hover:text-rose-300"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}

export function AddSourceForm() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <form
      className="grid gap-3 sm:grid-cols-[1fr_1.6fr_auto_auto] sm:items-end"
      action={(formData) =>
        startTransition(async () => {
          const res = await addSourceAction({
            name: String(formData.get("name") ?? ""),
            feedUrl: String(formData.get("feedUrl") ?? ""),
            topic: String(formData.get("topic") ?? ""),
          });
          setResult(res);
        })
      }
    >
      <label className="text-xs text-muted">
        Name
        <input
          name="name"
          required
          placeholder="e.g. The Guardian Football"
          className="mt-1 w-full rounded-lg border border-line bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-accent/50"
        />
      </label>
      <label className="text-xs text-muted">
        RSS / Atom feed URL
        <input
          name="feedUrl"
          type="url"
          required
          placeholder="https://example.com/feed.xml"
          className="mt-1 w-full rounded-lg border border-line bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-accent/50"
        />
      </label>
      <label className="text-xs text-muted">
        Topic
        <select
          name="topic"
          defaultValue="world"
          className="mt-1 w-full rounded-lg border border-line bg-background/60 px-3 py-2 text-sm text-foreground"
        >
          {TOPIC_SLUGS.map((t) => (
            <option key={t} value={t}>
              {TOPICS[t].label}
            </option>
          ))}
        </select>
      </label>
      <button
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-70"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        {pending ? "Checking feed…" : "Add source"}
      </button>
      {result && (
        <p className={`text-xs sm:col-span-4 ${result.ok ? "text-emerald-300" : "text-rose-300"}`}>{result.message}</p>
      )}
    </form>
  );
}

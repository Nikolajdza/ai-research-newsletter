"use client";

import { Bookmark, BookmarkCheck, Check, Share2, ThumbsDown, ThumbsUp } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { setFeedbackAction, toggleSaveAction } from "@/app/actions";

export function SaveButton({ articleId, saved }: { articleId: string; saved: boolean }) {
  const [optimisticSaved, setOptimisticSaved] = useOptimistic(saved);
  const [, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() =>
        startTransition(async () => {
          setOptimisticSaved(!optimisticSaved);
          await toggleSaveAction(articleId);
        })
      }
      className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
        optimisticSaved
          ? "border border-emerald-400/30 bg-emerald-500/15 text-emerald-200"
          : "bg-accent text-white glow-accent hover:bg-accent/90"
      }`}
    >
      {optimisticSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
      {optimisticSaved ? "Saved" : "Save Article"}
    </button>
  );
}

export function ShareButton({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        if (navigator.share) {
          try {
            await navigator.share({ url, title });
            return;
          } catch {
            // user cancelled — fall back to copy
          }
        }
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm text-muted transition-colors hover:bg-white/[0.05] hover:text-foreground"
    >
      {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Share2 className="h-4 w-4" />}
      {copied ? "Link copied" : "Share"}
    </button>
  );
}

export function FeedbackButtons({
  articleId,
  feedback,
}: {
  articleId: string;
  feedback: "up" | "down" | null;
}) {
  const [optimistic, setOptimistic] = useOptimistic(feedback);
  const [, startTransition] = useTransition();

  const vote = (value: "up" | "down") =>
    startTransition(async () => {
      const next = optimistic === value ? null : value;
      setOptimistic(next);
      await setFeedbackAction(articleId, next);
    });

  const base = "inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors";
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => vote("up")}
        className={`${base} ${optimistic === "up" ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200" : "border-line text-muted hover:text-foreground"}`}
      >
        <ThumbsUp className="h-4 w-4" /> Good pick
      </button>
      <button
        type="button"
        onClick={() => vote("down")}
        className={`${base} ${optimistic === "down" ? "border-rose-400/40 bg-rose-500/15 text-rose-200" : "border-line text-muted hover:text-foreground"}`}
      >
        <ThumbsDown className="h-4 w-4" /> Not for me
      </button>
    </div>
  );
}

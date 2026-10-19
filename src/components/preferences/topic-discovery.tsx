"use client";

import { Check, Globe2, Loader2, MessageSquare, Newspaper, Plus, Search, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { discoverTopicAction, followCustomTopicAction, followTopicAction, type ActionResult } from "@/app/actions";
import { TOPICS } from "@/lib/topics";
import type { DiscoveryResult, SourceKind } from "@/server/discovery/discover";

const KIND: Record<SourceKind, { label: string; icon: typeof Globe2 }> = {
  "news-search": { label: "News search", icon: Newspaper },
  reddit: { label: "Community", icon: MessageSquare },
  site: { label: "Site feed", icon: Globe2 },
};

const EXAMPLES = ["Formula 1", "Elden Ring", "Real Madrid", "Electric bikes", "Taylor Swift", "Rust language"];

export function TopicDiscovery({ followed }: { followed: string[] }) {
  const [query, setQuery] = useState("");
  const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null);
  const [label, setLabel] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<ActionResult | null>(null);
  const [searching, startSearch] = useTransition();
  const [following, startFollow] = useTransition();

  const search = (text: string) =>
    startSearch(async () => {
      setResult(null);
      setDiscovery(null);
      const r = await discoverTopicAction(text);
      if (!r.ok) {
        setResult({ ok: false, message: r.message });
        return;
      }
      setDiscovery(r.result);
      setLabel(r.result.label);
      setPicked(new Set(r.result.candidates.slice(0, 3).map((c) => c.feedUrl)));
    });

  const togglePick = (url: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(url)) next.delete(url);
      else if (next.size < 4) next.add(url);
      return next;
    });

  const follow = () =>
    startFollow(async () => {
      if (!discovery) return;
      const feeds = discovery.candidates.filter((c) => picked.has(c.feedUrl)).map(({ name, feedUrl }) => ({ name, feedUrl }));
      const r = await followCustomTopicAction({ label, query: discovery.query, feeds });
      setResult(r);
      if (r.ok) {
        setDiscovery(null);
        setQuery("");
      }
    });

  const followCurated = (slug: string) =>
    startFollow(async () => {
      const r = await followTopicAction(slug);
      setResult(r);
      if (r.ok) setDiscovery(null);
    });

  const match = discovery?.curatedMatch;

  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <Sparkles className="h-4 w-4 text-accent" /> Add any topic
      </h2>
      <p className="mt-1 text-sm text-muted">
        Type anything — a team, a game, a hobby, a company. AI looks for real news feeds, we check each one, and you pick
        what to follow.
      </p>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) search(query);
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={200}
            placeholder="e.g. Formula 1, or paste an RSS link"
            className="w-full rounded-xl border border-line bg-background/60 py-2.5 pr-3 pl-9 text-sm outline-none focus:border-accent/50"
          />
        </div>
        <button
          disabled={searching || !query.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {searching ? "Searching…" : "Find sources"}
        </button>
      </form>

      {!discovery && !searching && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setQuery(ex);
                search(ex);
              }}
              className="rounded-lg px-2.5 py-1 text-xs text-muted ring-1 ring-line hover:text-foreground"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {searching && (
        <p className="mt-4 text-sm text-muted">Asking AI for sources and testing every feed… this takes a few seconds.</p>
      )}

      {match && !followed.includes(match) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-accent/10 px-4 py-3 ring-1 ring-accent/30">
          <p className="text-sm">
            Related topic in our catalog: <span className="font-medium">{TOPICS[match].emoji} {TOPICS[match].label}</span>
          </p>
          <button
            type="button"
            disabled={following}
            onClick={() => followCurated(match)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" /> Follow
          </button>
        </div>
      )}

      {discovery && discovery.candidates.length > 0 && (
        <div className="mt-4 space-y-3">
          <label className="block text-xs text-muted">
            Topic name
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={40}
              className="mt-1 w-full rounded-lg border border-line bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-accent/50"
            />
          </label>
          <p className="text-xs text-muted">Pick up to 4 sources ({picked.size} selected)</p>
          <ul className="space-y-2">
            {discovery.candidates.map((c) => {
              const on = picked.has(c.feedUrl);
              const Kind = KIND[c.kind];
              return (
                <li key={c.feedUrl}>
                  <button
                    type="button"
                    onClick={() => togglePick(c.feedUrl)}
                    className={`flex w-full items-start gap-3 rounded-xl p-3 text-left ring-1 transition-colors ${
                      on ? "bg-accent/10 ring-accent/40" : "ring-line hover:bg-white/[0.03]"
                    }`}
                  >
                    <span
                      className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md ring-1 ${
                        on ? "bg-accent text-white ring-accent" : "ring-line"
                      }`}
                    >
                      {on && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{c.name}</span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-muted">
                          <Kind.icon className="h-3 w-3" /> {Kind.label} · {c.existing ? "already followed by readers" : `${c.itemCount} items`}
                        </span>
                      </span>
                      {c.sampleTitles.slice(0, 2).map((t) => (
                        <span key={t} className="mt-1 block truncate text-xs text-muted">
                          • {t}
                        </span>
                      ))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={follow}
            disabled={following || picked.size === 0 || !label.trim()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white glow-accent disabled:opacity-60"
          >
            {following ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Follow {label.trim() || "topic"}
          </button>
        </div>
      )}

      {result && <p className={`mt-3 text-xs ${result.ok ? "text-emerald-300" : "text-rose-300"}`}>{result.message}</p>}
    </section>
  );
}

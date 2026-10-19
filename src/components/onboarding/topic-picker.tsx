"use client";

import { ArrowRight, Check, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { finishOnboardingAction } from "@/app/actions";
import { MIN_ONBOARDING_TOPICS, TOPIC_GROUPS, TOPIC_SLUGS, TOPICS, topicMeta, type TopicSlug } from "@/lib/topics";
import { TopicDiscovery } from "../preferences/topic-discovery";
import { TopicIcon } from "../ui/topic-icon";

const RECOMMENDED: TopicSlug = "world";

export function TopicPicker({
  name,
  initial,
  customTopics,
}: {
  name: string;
  initial: TopicSlug[];
  customTopics: { key: string; label: string }[];
}) {
  const [selected, setSelected] = useState<Set<TopicSlug>>(new Set(initial));
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const count = selected.size + customTopics.length;
  const missing = Math.max(0, MIN_ONBOARDING_TOPICS - count);

  const toggle = (slug: TopicSlug) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  const finish = () =>
    startSaving(async () => {
      setError(null);
      const r = await finishOnboardingAction([...selected]);
      if (r && !r.ok) setError(r.message);
    });

  return (
    <div className="pb-32">
      <section className="text-center">
        <p className="text-xs font-medium tracking-widest text-accent uppercase">Welcome to InsightLoop</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Hi {name}, what are you into?</h1>
        <p className="mx-auto mt-3 max-w-xl text-muted">
          Pick at least {MIN_ONBOARDING_TOPICS} — 3 to 5 works best. Your dashboard, Explore and daily Telegram digest are
          built from these. Can&apos;t find something? Type it below and we&apos;ll find the sources.
        </p>
      </section>

      {customTopics.length > 0 && (
        <TopicGroupGrid title="Your topics">
          {customTopics.map((t) => (
            <TopicCard key={t.key} topic={t.key} label={t.label} emoji={topicMeta(t.key).emoji} selected locked />
          ))}
        </TopicGroupGrid>
      )}

      {TOPIC_GROUPS.map((group) => (
        <TopicGroupGrid key={group} title={group}>
          {TOPIC_SLUGS.filter((slug) => TOPICS[slug].group === group).map((slug) => (
            <TopicCard
              key={slug}
              topic={slug}
              label={TOPICS[slug].label}
              emoji={TOPICS[slug].emoji}
              selected={selected.has(slug)}
              badge={slug === RECOMMENDED ? "What's happening in the world" : undefined}
              onClick={() => toggle(slug)}
            />
          ))}
        </TopicGroupGrid>
      ))}

      <div className="mx-auto mt-10 max-w-3xl">
        <TopicDiscovery
          title="Something else? Type it"
          followed={[...selected, ...customTopics.map((t) => t.key)]}
          onCuratedMatch={(slug) => setSelected((current) => new Set(current).add(slug))}
        />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {count} selected
              {missing > 0 && <span className="text-muted"> · pick {missing} more</span>}
            </p>
            <p className="truncate text-xs text-muted">
              {[...selected].map((s) => TOPICS[s].label).concat(customTopics.map((t) => t.label)).join(" · ") ||
                "Nothing yet"}
            </p>
            {error && <p className="text-xs text-rose-300">{error}</p>}
          </div>
          <button
            type="button"
            onClick={finish}
            disabled={saving || missing > 0}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-medium text-white glow-accent disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {saving ? "Building your feed…" : "Build my feed"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TopicGroupGrid({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto mt-8 max-w-6xl">
      <h2 className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">{title}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{children}</div>
    </section>
  );
}

function TopicCard({
  topic,
  label,
  emoji,
  selected,
  badge,
  locked = false,
  onClick,
}: {
  topic: string;
  label: string;
  emoji: string;
  selected: boolean;
  badge?: string;
  locked?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locked}
      aria-pressed={selected}
      className={`group relative h-28 overflow-hidden rounded-2xl text-left ring-2 transition-all sm:h-32 ${
        selected ? "ring-accent scale-[0.98]" : "ring-transparent hover:-translate-y-0.5 hover:ring-white/20"
      }`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${topicMeta(topic).thumb} transition-[opacity,filter] ${
          selected ? "" : "opacity-50 saturate-50 group-hover:opacity-75 group-hover:saturate-100"
        }`}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.22),transparent_50%)]" />
      <TopicIcon topic={topic} className="absolute -right-3 -bottom-3 h-20 w-20 text-white/15" />
      <div className="relative flex h-full flex-col justify-between p-3.5">
        <span className="text-2xl drop-shadow">{emoji}</span>
        <span>
          {badge && <span className="mb-1 block text-[10px] font-medium text-white/80">{badge}</span>}
          <span className="block text-sm leading-tight font-semibold text-white drop-shadow">{label}</span>
        </span>
      </div>
      {selected && (
        <span className="absolute top-2.5 right-2.5 grid h-6 w-6 place-items-center rounded-full bg-accent text-white shadow">
          <Check className="h-3.5 w-3.5" />
        </span>
      )}
    </button>
  );
}

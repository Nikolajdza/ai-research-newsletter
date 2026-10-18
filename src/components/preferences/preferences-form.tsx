"use client";

import { Check, Loader2, Mail, Send } from "lucide-react";
import { useState, useTransition } from "react";
import { savePreferencesAction, type ActionResult, type PreferencesInput } from "@/app/actions";
import { formatHour, TIMEZONES } from "@/lib/format";
import { TOPIC_SLUGS, TOPICS, type TopicSlug } from "@/lib/topics";
import { Switch } from "../ui/switch";
import { TopicIcon } from "../ui/topic-icon";
import { SourceToggle } from "../sources/source-controls";

type SourceItem = { id: string; name: string; feedUrl: string; topic: TopicSlug; enabled: boolean };

export function PreferencesForm({
  initial,
  sources,
  telegramConfigured,
}: {
  initial: PreferencesInput;
  sources: SourceItem[];
  telegramConfigured: boolean;
}) {
  const [state, setState] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  const set = <K extends keyof PreferencesInput>(key: K, value: PreferencesInput[K]) => {
    setResult(null);
    setState((s) => ({ ...s, [key]: value }));
  };

  const toggleTopic = (topic: TopicSlug) =>
    set(
      "selectedTopics",
      state.selectedTopics.includes(topic)
        ? state.selectedTopics.filter((t) => t !== topic)
        : [...state.selectedTopics, topic],
    );

  const save = () =>
    startTransition(async () => {
      setResult(await savePreferencesAction(state));
    });

  const visibleSources = sources.filter((s) => state.selectedTopics.includes(s.topic));

  return (
    <div className="grid gap-6 fade-up lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-6">
        <section className="card p-5">
          <h2 className="font-semibold">Topics of Interest</h2>
          <p className="mt-1 text-sm text-muted">Select the topics you want to follow — tech, sports, world news, anything.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {TOPIC_SLUGS.map((topic) => {
              const active = state.selectedTopics.includes(topic);
              return (
                <button
                  key={topic}
                  type="button"
                  onClick={() => toggleTopic(topic)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm ring-1 transition-all ${
                    active
                      ? "bg-accent/20 text-foreground ring-accent/50"
                      : "bg-white/[0.02] text-muted ring-line hover:text-foreground"
                  }`}
                >
                  <TopicIcon topic={topic} className="h-4 w-4" />
                  {TOPICS[topic].label}
                  {active && <Check className="h-3.5 w-3.5 text-accent" />}
                </button>
              );
            })}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold">Sources</h2>
          <p className="mt-1 text-sm text-muted">Feeds for the topics above. Changes apply immediately.</p>
          <div className="mt-4 divide-y divide-line">
            {visibleSources.length === 0 && <p className="py-3 text-sm text-muted">Pick a topic to see its sources.</p>}
            {visibleSources.map((s) => (
              <div key={s.id} className="flex items-center gap-3 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.05]">
                  <TopicIcon topic={s.topic} className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="truncate text-xs text-muted">{s.feedUrl}</p>
                </div>
                <SourceToggle sourceId={s.id} enabled={s.enabled} name={s.name} />
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card h-fit space-y-6 p-5 lg:sticky lg:top-24">
        <h2 className="font-semibold">Newsletter Settings</h2>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-muted">
            Preferred time
            <select
              value={state.digestHourLocal}
              onChange={(e) => set("digestHourLocal", Number(e.target.value))}
              className="mt-1.5 w-full rounded-lg border border-line bg-background/60 px-3 py-2 text-sm text-foreground"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {formatHour(h)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted">
            Timezone
            <select
              value={state.timezone}
              onChange={(e) => set("timezone", e.target.value as PreferencesInput["timezone"])}
              className="mt-1.5 w-full rounded-lg border border-line bg-background/60 px-3 py-2 text-sm text-foreground"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Minimum relevance score</span>
            <span className="font-semibold tabular-nums text-foreground">{state.minRelevanceScore}/10</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={0.5}
            value={state.minRelevanceScore}
            onChange={(e) => set("minRelevanceScore", Number(e.target.value))}
            className="mt-3 w-full accent-[var(--accent)]"
          />
          <p className="mt-1 text-[11px] text-muted">Only stories at or above this score make the digest.</p>
        </div>

        <fieldset>
          <legend className="text-xs text-muted">Newsletter format</legend>
          <div className="mt-2 space-y-2">
            {(
              [
                ["detailed", "Detailed", "Longer summaries + top takeaway"],
                ["short", "Short", "Key points only"],
              ] as const
            ).map(([value, label, hint]) => (
              <label
                key={value}
                className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ${
                  state.digestFormat === value ? "bg-accent/10 ring-accent/40" : "ring-line"
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  checked={state.digestFormat === value}
                  onChange={() => set("digestFormat", value)}
                  className="accent-[var(--accent)]"
                />
                <span className="text-sm">
                  {label} <span className="text-muted">({hint})</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <p className="text-xs text-muted">Notification channels</p>
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ring-line">
              <Send className="h-4 w-4 text-sky-300" />
              <div className="flex-1">
                <p className="text-sm">Telegram (daily digest)</p>
                {!telegramConfigured && <p className="text-[11px] text-amber-300/80">Bot not configured — dry runs only</p>}
              </div>
              <Switch label="Telegram" checked={state.telegramEnabled} onChange={(v) => set("telegramEnabled", v)} />
            </div>
            <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ring-line">
              <Mail className="h-4 w-4 text-muted" />
              <div className="flex-1">
                <p className="text-sm">Email</p>
                <p className="text-[11px] text-muted">Coming later</p>
              </div>
              <Switch label="Email" checked={false} disabled onChange={() => {}} />
            </div>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white glow-accent disabled:opacity-70"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Preferences
          </button>
          {result && (
            <p className={`mt-2 text-center text-xs ${result.ok ? "text-emerald-300" : "text-rose-300"}`}>{result.message}</p>
          )}
        </div>
      </section>
    </div>
  );
}

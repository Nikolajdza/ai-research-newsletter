import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  CircleDashed,
  Clock3,
  ExternalLink,
  GitMerge,
  Play,
  Rss,
  Send,
  Trash2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { runPipelineAction } from "@/app/actions";
import { ActionButton } from "@/components/ui/action-button";
import { StatusBadge } from "@/components/ui/badges";
import { PageSkeleton } from "@/components/ui/layout";
import { appConfig } from "@/lib/config";
import { formatDayLabel, formatTime, requestNow, timeAgo } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import type { RunStep } from "@/server/pipeline/runs";
import {
  getAiUsage,
  getIntegrationStatus,
  getPreferences,
  getWeeklyActivity,
  listSourcesWithStats,
  listWorkflowRuns,
} from "@/server/queries";

export const metadata = { title: "Workflow" };

const STALE_MS = 15 * 60 * 1000;

function displayStatus(run: { status: string; startedAt: Date }, now: number) {
  return run.status === "running" && now - run.startedAt.getTime() > STALE_MS ? "stalled" : run.status;
}

function StepIcon({ status }: { status: string }) {
  if (status === "failed") return <XCircle className="h-4 w-4 text-rose-400" />;
  if (status === "skipped" || status === "waiting") return <CircleDashed className="h-4 w-4 text-muted" />;
  if (status === "completed_with_errors") return <CheckCircle2 className="h-4 w-4 text-amber-300" />;
  return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
}

export default function WorkflowPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <WorkflowMonitor />
    </Suspense>
  );
}

async function WorkflowMonitor() {
  await connection();
  const user = await requireUser();
  const now = requestNow();
  const prefs = await getPreferences(user.id);
  const runs = await listWorkflowRuns(12);
  const status = await getIntegrationStatus();
  const activity = await getWeeklyActivity();
  const usage = await getAiUsage();
  const sources = await listSourcesWithStats();

  const lastRun = runs[0];
  const stepOf = (name: string): RunStep | undefined => lastRun?.steps.find((s) => s.name === name);
  const enabledFeeds = sources.filter((s) => s.enabled && prefs.selectedTopics.includes(s.topic)).length;

  const nodes: { icon: LucideIcon; title: string; subtitle: string; step?: RunStep; tone: string }[] = [
    { icon: Clock3, title: "Schedule Trigger", subtitle: "Hourly · digest at preferred hour", tone: "text-emerald-300 bg-emerald-500/15", step: lastRun ? { name: "trigger", status: "completed", detail: lastRun.trigger, at: lastRun.startedAt.toISOString() } : undefined },
    { icon: Rss, title: "RSS Read", subtitle: `${enabledFeeds} feeds`, tone: "text-sky-300 bg-sky-500/15", step: stepOf("collect") },
    { icon: GitMerge, title: "Merge", subtitle: "Canonical URL dedupe", tone: "text-teal-300 bg-teal-500/15", step: stepOf("collect") },
    { icon: BrainCircuit, title: "AI Agent", subtitle: "Score & summarize", tone: "text-violet-300 bg-violet-500/15", step: stepOf("analyze") },
    { icon: Send, title: "Telegram", subtitle: "Send digest", tone: "text-blue-300 bg-blue-500/15", step: stepOf("digest") },
    { icon: Trash2, title: "Retention", subtitle: "Purge >30d (keep saved)", tone: "text-amber-300 bg-amber-500/15", step: stepOf("retention") },
  ];

  const weekFetched = activity.reduce((s, d) => s + d.fetched, 0);
  const weekAnalyzed = activity.reduce((s, d) => s + d.analyzed, 0);
  const weekDigests = activity.reduce((s, d) => s + d.digests, 0);
  const maxBar = Math.max(1, ...activity.map((d) => d.fetched));

  return (
    <div className="mx-auto max-w-7xl space-y-6 fade-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">
            <span className="text-rose-400">n8n</span> Workflow
          </h1>
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium ring-1 ${
              status.n8n ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/25" : "bg-rose-500/15 text-rose-300 ring-rose-400/25"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${status.n8n ? "bg-emerald-400" : "bg-rose-400"}`} />
            {status.n8n ? "n8n online" : "n8n offline"}
          </span>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <a
            href={appConfig.urls.n8n}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm text-muted hover:text-foreground"
          >
            Open n8n <ExternalLink className="h-4 w-4" />
          </a>
          {user.role === "admin" && (
            <ActionButton action={runPipelineAction} pendingLabel="Running… (~1 min)">
              <Play className="h-4 w-4" /> Run now
            </ActionButton>
          )}
        </div>
      </div>

      <section className="card overflow-x-auto p-5">
          <div className="flex min-w-[920px] items-stretch gap-2">
          {nodes.map((node, i) => (
            <div key={node.title} className="flex flex-1 items-center gap-2">
              <div className="flex flex-1 flex-col items-center rounded-2xl border border-line bg-panel-2 p-4 text-center">
                <span className={`grid h-12 w-12 place-items-center rounded-2xl ${node.tone}`}>
                  <node.icon className="h-6 w-6" />
                </span>
                <p className="mt-3 text-sm font-medium">{node.title}</p>
                <p className="text-[11px] text-muted">{node.subtitle}</p>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
                  {node.step ? (
                    <>
                      <StepIcon status={node.step.status} /> {node.step.status.replaceAll("_", " ")}
                    </>
                  ) : (
                    <>
                      <CircleDashed className="h-4 w-4" /> not run
                    </>
                  )}
                </div>
              </div>
              {i < nodes.length - 1 && <ArrowRight className="h-4 w-4 shrink-0 text-muted" />}
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Execution Log</h2>
            {lastRun && <StatusBadge status={displayStatus(lastRun, now)} />}
          </div>
          {!lastRun ? (
            <p className="mt-4 text-sm text-muted">No executions yet. Press “Run now” or execute the workflow in n8n.</p>
          ) : (
            <>
              <p className="mt-1 text-xs text-muted">
                Latest run {timeAgo(lastRun.startedAt, now)} · trigger: {lastRun.trigger}
              </p>
              <ol className="mt-4 space-y-3">
                {lastRun.steps.map((step, i) => (
                  <li key={`${step.name}-${i}`} className="flex gap-3">
                    <span className="mt-0.5 text-xs tabular-nums text-muted">{formatTime(step.at, prefs.timezone)}</span>
                    <StepIcon status={step.status} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium capitalize">{step.name}</p>
                      <p className="line-clamp-3 break-words text-xs text-muted">{step.detail ?? step.status}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}

          <h3 className="mt-8 text-sm font-semibold">Recent runs</h3>
          <div className="mt-2 divide-y divide-line">
            {runs.map((run) => (
              <details key={run.id} className="group py-2">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2">
                    <StatusBadge status={displayStatus(run, now)} />
                    <span className="text-muted">{run.trigger}</span>
                  </span>
                  <span className="text-xs text-muted">{timeAgo(run.startedAt, now)}</span>
                </summary>
                <ul className="mt-2 space-y-1 pl-2">
                  {run.steps.map((s, i) => (
                    <li key={i} className="flex gap-2 text-xs text-muted">
                      <StepIcon status={s.status} />
                      <span className="font-medium capitalize text-foreground/80">{s.name}</span>
                      <span className="line-clamp-2 break-all">{s.detail}</span>
                    </li>
                  ))}
                  {run.errorMessage && <li className="text-xs text-rose-300">{run.errorMessage}</li>}
                </ul>
              </details>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="card p-5">
            <h2 className="font-semibold">Stats (last 7 days)</h2>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[11px] text-muted">Collected</p>
                <p className="text-xl font-semibold tabular-nums">{weekFetched}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted">Analyzed</p>
                <p className="text-xl font-semibold tabular-nums">{weekAnalyzed}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted">Digests</p>
                <p className="text-xl font-semibold tabular-nums">{weekDigests}</p>
              </div>
            </div>
            <p className="mt-5 text-xs text-muted">Articles collected per day</p>
            <div className="mt-2 flex items-end gap-2">
              {activity.map((d) => (
                <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-28 w-full items-end">
                    <div
                      title={`${d.fetched} collected · ${d.analyzed} analyzed`}
                      className="w-full rounded-t-md bg-gradient-to-t from-accent/60 to-accent"
                      style={{ height: `${Math.max(4, (d.fetched / maxBar) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted">{formatDayLabel(d.day)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="font-semibold">AI quality &amp; cost</h2>
            <dl className="mt-3 grid grid-cols-2 gap-y-3 text-sm">
              <dt className="text-muted">Articles scored</dt>
              <dd className="text-right tabular-nums">{usage.analyzed}</dd>
              <dt className="text-muted">Average score</dt>
              <dd className="text-right tabular-nums">{usage.avgScore.toFixed(1)}</dd>
              <dt className="text-muted">Tokens used</dt>
              <dd className="text-right tabular-nums">{(usage.promptTokens + usage.completionTokens).toLocaleString()}</dd>
              <dt className="text-muted">Estimated cost</dt>
              <dd className="text-right tabular-nums">${usage.costUsd.toFixed(4)}</dd>
              <dt className="text-muted">Cost / article</dt>
              <dd className="text-right tabular-nums">${usage.analyzed ? (usage.costUsd / usage.analyzed).toFixed(5) : "0"}</dd>
              <dt className="text-muted">Reader feedback</dt>
              <dd className="text-right tabular-nums">
                👍 {usage.upvotes} · 👎 {usage.downvotes}
              </dd>
            </dl>
            <p className="mt-3 text-[11px] text-muted">LLM: {status.groqModel}. Each article is analyzed once — never re-scored.</p>
          </section>

          <section className="card p-5 text-sm">
            <h2 className="font-semibold">Run it from n8n</h2>
            <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-muted">
              <li>
                Open <span className="text-foreground">{appConfig.urls.n8n}</span> and create the owner account (first visit only).
              </li>
              <li>
                Workflow <span className="text-foreground">“InsightLoop — Daily Digest”</span> is pre-imported (
                <code className="text-xs">npm run n8n:import</code>).
              </li>
              <li>Click “Execute workflow” — the run appears here with trigger “manual”.</li>
              <li>Toggle it Active for the hourly schedule.</li>
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

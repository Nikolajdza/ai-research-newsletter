import { ExternalLink, Play } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { runPipelineAction } from "@/app/actions";
import { AddSourceForm, DeleteSourceButton, SourceToggle } from "@/components/sources/source-controls";
import { ActionButton } from "@/components/ui/action-button";
import { StatusBadge, TopicChip } from "@/components/ui/badges";
import { PageHeader, Skeleton } from "@/components/ui/layout";
import { TopicIcon } from "@/components/ui/topic-icon";
import { requestNow, timeAgo } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { getPreferences, listIngestRuns, listSourcesWithStats } from "@/server/queries";

export const metadata = { title: "Sources" };

export default function SourcesPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Sources"
        subtitle="RSS feeds InsightLoop collects from. Only topics that at least one reader follows are fetched."
        actions={
          <Suspense fallback={null}>
            <CollectNowButton />
          </Suspense>
        }
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <SourceList />
      </Suspense>
    </div>
  );
}

async function CollectNowButton() {
  const user = await requireUser();
  if (user.role !== "admin") return null;
  return (
    <ActionButton action={runPipelineAction} pendingLabel="Collecting…">
      <Play className="h-4 w-4" /> Collect now
    </ActionButton>
  );
}

async function SourceList() {
  await connection();
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const now = requestNow();
  const prefs = await getPreferences(user.id);
  const [list, runs] = await Promise.all([listSourcesWithStats(isAdmin ? undefined : prefs.selectedTopics), listIngestRuns(1)]);
  const followed = new Set(prefs.selectedTopics);
  const lastRun = runs[0];

  return (
    <div className="space-y-4 fade-up">
      {isAdmin && (
        <div className="card p-5">
          <p className="mb-3 font-medium">Add a feed</p>
          <AddSourceForm />
        </div>
      )}
      {lastRun && (
        <div className="card flex flex-wrap items-center gap-3 p-4 text-sm">
          <StatusBadge status={lastRun.status} />
          <span className="text-muted">
            Last collect {timeAgo(lastRun.startedAt, now)} · {lastRun.sourcesProcessed} feeds · {lastRun.articlesInserted} new ·{" "}
            {lastRun.articlesSkipped} duplicates skipped
          </span>
          {lastRun.errorMessage && <span className="w-full text-xs text-amber-300/90">{lastRun.errorMessage}</span>}
        </div>
      )}
      <div className="card divide-y divide-line">
        {list.map((s) => (
          <div key={s.id} className="flex items-center gap-3 p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.05]">
              <TopicIcon topic={s.topic} className="h-5 w-5 text-foreground/80" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{s.name}</p>
                <TopicChip topic={s.topic} />
                {!followed.has(s.topic) && (
                  <span className="text-[11px] text-amber-300/80">you don&apos;t follow this topic</span>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-muted">
                {s.feedUrl}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {s.articleCount} articles{s.lastFetchedAt ? ` · last new item ${timeAgo(s.lastFetchedAt, now)}` : ""}
              </p>
            </div>
            {s.siteUrl && (
              <a
                href={s.siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${s.name}`}
                className="hidden h-8 w-8 place-items-center rounded-lg text-muted hover:text-foreground sm:grid"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
            {isAdmin ? (
              <>
                <DeleteSourceButton sourceId={s.id} name={s.name} />
                <SourceToggle sourceId={s.id} enabled={s.enabled} name={s.name} />
              </>
            ) : (
              <span className="text-xs text-muted">{s.enabled ? "Active" : "Paused"}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

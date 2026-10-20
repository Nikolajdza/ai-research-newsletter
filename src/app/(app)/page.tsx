import { ArrowRight, Bookmark, FileText, Heart, Mail, Play, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { runPipelineAction, sendDigestAction } from "@/app/actions";
import { ArticleCard, ArticleRow } from "@/components/article/article-card";
import { ActionButton } from "@/components/ui/action-button";
import { StatusBadge } from "@/components/ui/badges";
import { EmptyState, PageSkeleton, SectionHeader } from "@/components/ui/layout";
import { StatCard } from "@/components/ui/stat-card";
import { greeting, localHour, requestNow, timeAgo } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { cachedUserHome } from "@/server/cache";

export default function HomePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  await connection();
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const now = requestNow();
  const { prefs, stats, highlights, latest, lastRun, lastDigest } = await cachedUserHome(user.id);
  const hour = localHour(prefs.timezone, now);

  return (
    <div className="mx-auto max-w-7xl space-y-8 fade-up">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">
          {greeting(hour)}, {user.displayName} 👋
        </h1>
        <p className="mt-1 text-sm text-muted">Here&apos;s your personalized AI newsletter digest for today.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="grid grid-cols-2 gap-4 lg:col-span-8 xl:grid-cols-4">
          <StatCard icon={FileText} label="Total Articles" value={stats.total} hint={`+${stats.newToday} in last 24h`} tone="violet" />
          <StatCard icon={Heart} label="High Relevance" value={stats.high} hint={`+${stats.highToday} today · ${stats.analyzed} scored`} tone="emerald" />
          <StatCard icon={Bookmark} label="Saved" value={stats.saved} hint="Your reading list" tone="sky" />
          <StatCard icon={Mail} label="Newsletters Sent" value={stats.newsletters} hint="Last 7 days" tone="rose" />
        </div>
        <div className="dusk relative overflow-hidden rounded-2xl border border-line p-5 lg:col-span-4">
          <div className="relative flex h-full min-h-40 flex-col justify-end">
            <p className="text-lg font-semibold">Stay informed. Stay ahead.</p>
            <p className="mt-1 max-w-xs text-sm text-white/75">
              AI curates the best content for you, so you can focus on what matters.
            </p>
            <Link
              href="/preferences"
              className="mt-4 inline-flex w-fit items-center gap-2 rounded-xl bg-black/35 px-3.5 py-2 text-sm font-medium backdrop-blur hover:bg-black/50"
            >
              <SlidersHorizontal className="h-4 w-4" /> Edit Preferences
            </Link>
          </div>
        </div>
      </div>

      <section>
        <SectionHeader
          title="Top Highlights"
          subtitle="The most relevant articles for you today"
          action={
            <Link href="/articles" className="inline-flex items-center gap-1 text-sm text-accent hover:text-accent/80">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
        {highlights.length === 0 ? (
          <EmptyState
            title="No scored articles yet"
            description={
              isAdmin
                ? "Run the pipeline to collect RSS feeds and let AI score them. It takes about a minute."
                : "New stories in your topics are scored on the daily pipeline run. Check back soon or follow more topics."
            }
            action={
              isAdmin ? (
                <ActionButton action={runPipelineAction} pendingLabel="Running pipeline…">
                  <Play className="h-4 w-4" /> Run pipeline
                </ActionButton>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="hidden gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-4">
              {highlights.map((a) => (
                <ArticleCard key={a.id} article={a} now={now} />
              ))}
            </div>
            <div className="card divide-y divide-line p-1.5 sm:hidden">
              {highlights.map((a) => (
                <ArticleRow key={a.id} article={a} now={now} />
              ))}
            </div>
          </>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        <section className="lg:col-span-8">
          <SectionHeader title="Recently analyzed" subtitle="Fresh AI summaries across your topics" />
          <div className="card divide-y divide-line p-1.5">
            {latest.length === 0 ? (
              <p className="p-6 text-sm text-muted">Nothing analyzed yet.</p>
            ) : (
              latest.map((a) => <ArticleRow key={a.id} article={a} now={now} />)
            )}
          </div>
        </section>

        <aside className="space-y-4 lg:col-span-4">
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <p className="font-medium">Pipeline</p>
              {lastRun && <StatusBadge status={lastRun.status} />}
            </div>
            <p className="mt-1 text-sm text-muted">
              {lastRun
                ? `Last run ${timeAgo(lastRun.startedAt, now)} via ${lastRun.trigger}`
                : "Collect → analyze → digest has not run yet."}
            </p>
            {isAdmin && (
              <div className="mt-4">
                <ActionButton action={runPipelineAction} pendingLabel="Running… (~1 min)" className="w-full">
                  <Play className="h-4 w-4" /> Run now
                </ActionButton>
              </div>
            )}
            <Link href="/workflow" className="mt-3 inline-flex items-center gap-1 text-xs text-accent">
              Open workflow monitor <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between">
              <p className="font-medium">Today&apos;s digest</p>
              {lastDigest && <StatusBadge status={lastDigest.status} />}
            </div>
            <p className="mt-1 text-sm text-muted">
              {lastDigest
                ? `${lastDigest.itemCount} stories · ${lastDigest.digestDate}`
                : "No digest yet — it is built from your top scored stories."}
            </p>
            <div className="mt-4 flex gap-2">
              <ActionButton action={sendDigestAction.bind(null, { force: false })} variant="secondary" pendingLabel="Sending…">
                <Mail className="h-4 w-4" /> Send digest
              </ActionButton>
              <Link href="/newsletter" className="inline-flex items-center rounded-xl px-3 py-2.5 text-sm text-muted hover:text-foreground">
                Preview
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

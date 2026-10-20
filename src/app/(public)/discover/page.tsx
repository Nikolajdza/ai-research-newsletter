import { ArrowRight, BrainCircuit, Newspaper, Rss } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ArticleCard, ArticleRow } from "@/components/article/article-card";
import { EmptyState, PageSkeleton } from "@/components/ui/layout";
import { requestNow } from "@/lib/format";
import { isTopicSlug, topicMeta, type TopicSlug } from "@/lib/topics";
import { cachedDiscoverPage } from "@/server/cache";

export const metadata = {
  title: "Discover",
  description: "Today's most relevant stories across tech, sports, money, science and culture — summarized and scored by AI.",
};

const PAGE_SIZE = 12;

export default function DiscoverPage(props: PageProps<"/discover">) {
  return (
    <div className="mx-auto max-w-7xl space-y-8 fade-up">
      <section className="pt-4 sm:pt-8">
        <p className="text-xs font-medium tracking-widest text-accent uppercase">Discover</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
          This week&apos;s best stories, read and scored by AI.
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          A public sample of what InsightLoop picks. Sign up to follow your own topics — anything from Formula 1 to a
          single video game — and get them as cards in Telegram.
        </p>
      </section>
      <Suspense fallback={<PageSkeleton />}>
        <Feed searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Feed({ searchParams }: Pick<PageProps<"/discover">, "searchParams">) {
  const sp = await searchParams;
  const get = (key: string) => (Array.isArray(sp[key]) ? sp[key]?.[0] : sp[key]) ?? "";
  const topic: TopicSlug | undefined = isTopicSlug(get("topic")) ? (get("topic") as TopicSlug) : undefined;
  const page = Math.max(1, Number(get("page")) || 1);
  const now = requestNow();

  const { items, total, topics, stats } = await cachedDiscoverPage(topic, page, PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (patch: { topic?: string; page?: number }) => {
    const params = new URLSearchParams();
    const t = "topic" in patch ? patch.topic : topic;
    if (t) params.set("topic", t);
    if (patch.page && patch.page > 1) params.set("page", String(patch.page));
    const qs = params.toString();
    return qs ? `/discover?${qs}` : "/discover";
  };
  const chip = (active: boolean) =>
    `whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ring-1 transition-colors ${
      active ? "bg-accent/20 text-foreground ring-accent/40" : "text-muted ring-line hover:text-foreground"
    }`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Newspaper, label: "Stories collected today", value: stats.articlesToday },
          { icon: BrainCircuit, label: "Analyzed by AI today", value: stats.analyzedToday },
          { icon: Rss, label: "Curated sources", value: stats.sourceCount },
        ].map((s) => (
          <div key={s.label} className="card flex items-center gap-3 p-4">
            <s.icon className="hidden h-5 w-5 shrink-0 text-accent sm:block" />
            <div>
              <p className="text-xl font-semibold tabular-nums">{s.value}</p>
              <p className="text-[11px] text-muted sm:text-xs">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1">
        <Link href={href({ topic: undefined })} className={chip(!topic)}>
          All topics
        </Link>
        {topics.map((t) => (
          <Link key={t} href={href({ topic: t })} className={chip(topic === t)}>
            {topicMeta(t).emoji} {topicMeta(t).label}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState title="Nothing here yet" description="Fresh stories are collected and scored every hour. Check back soon." />
      ) : (
        <>
          <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((a) => (
              <ArticleCard key={a.id} article={a} now={now} href={`/discover/${a.id}`} />
            ))}
          </div>
          <div className="card divide-y divide-line p-1.5 sm:hidden">
            {items.map((a) => (
              <ArticleRow key={a.id} article={a} now={now} href={`/discover/${a.id}`} />
            ))}
          </div>
        </>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link href={href({ page: page - 1 })} className={chip(false)}>
              ← Previous
            </Link>
          )}
          <span className="text-xs text-muted">
            Page {page} of {pages}
          </span>
          {page < pages && (
            <Link href={href({ page: page + 1 })} className={chip(false)}>
              Next →
            </Link>
          )}
        </div>
      )}

      <div className="dusk flex flex-col items-start justify-between gap-4 rounded-2xl border border-line p-6 sm:flex-row sm:items-center">
        <div>
          <p className="text-lg font-semibold">Want this for your own interests?</p>
          <p className="mt-1 text-sm text-white/75">Pick topics or type any interest — we find the sources and send you the best each morning.</p>
        </div>
        <Link href="/register" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-black/40 px-4 py-2.5 text-sm font-medium backdrop-blur hover:bg-black/55">
          Create free account <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

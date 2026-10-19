import { Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { analyzeBatchAction } from "@/app/actions";
import { ArticleCard, ArticleRow } from "@/components/article/article-card";
import { ActionButton } from "@/components/ui/action-button";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/ui/layout";
import { requestNow } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { isTopicSlug, TOPIC_SLUGS, TOPICS, type TopicSlug } from "@/lib/topics";
import { listArticles } from "@/server/queries";

export const metadata = { title: "Explore" };

const PAGE_SIZE = 24;

type Filters = {
  q: string;
  topic?: TopicSlug;
  min: number;
  sort: "score" | "recent";
  page: number;
};

function parseFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const get = (key: string) => (Array.isArray(sp[key]) ? sp[key]?.[0] : sp[key]) ?? "";
  const topic = get("topic");
  return {
    q: get("q").slice(0, 100),
    topic: isTopicSlug(topic) ? topic : undefined,
    min: Math.min(Math.max(Number(get("min")) || 0, 0), 10),
    sort: get("sort") === "recent" ? "recent" : "score",
    page: Math.max(1, Number(get("page")) || 1),
  };
}

function hrefWith(filters: Filters, patch: Partial<Filters>) {
  const next = { ...filters, page: 1, ...patch };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.topic) params.set("topic", next.topic);
  if (next.min) params.set("min", String(next.min));
  if (next.sort !== "score") params.set("sort", next.sort);
  if (next.page > 1) params.set("page", String(next.page));
  const qs = params.toString();
  return qs ? `/articles?${qs}` : "/articles";
}

export default function ArticlesPage(props: PageProps<"/articles">) {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Explore"
        subtitle="Browse every collected article. Scored ones show their AI relevance."
        actions={
          <Suspense fallback={null}>
            <AnalyzeMoreButton />
          </Suspense>
        }
      />
      <Suspense fallback={<PageSkeleton />}>
        <Results searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function AnalyzeMoreButton() {
  const user = await requireUser();
  if (user.role !== "admin") return null;
  return (
    <ActionButton action={analyzeBatchAction.bind(null, 8)} variant="secondary" pendingLabel="Analyzing…">
      <Sparkles className="h-4 w-4" /> Analyze 8 more
    </ActionButton>
  );
}

async function Results({ searchParams }: Pick<PageProps<"/articles">, "searchParams">) {
  await connection();
  const user = await requireUser();
  const filters = parseFilters(await searchParams);
  const now = requestNow();
  const { items, total } = await listArticles(user.id, {
    q: filters.q,
    topic: filters.topic,
    minScore: filters.min || undefined,
    sort: filters.sort,
    limit: PAGE_SIZE,
    offset: (filters.page - 1) * PAGE_SIZE,
  });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const chip = (active: boolean) =>
    `whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ring-1 transition-colors ${
      active ? "bg-accent/20 text-foreground ring-accent/40" : "text-muted ring-line hover:text-foreground"
    }`;

  return (
    <div className="space-y-5 fade-up">
      <form action="/articles" className="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Search titles and AI summaries…"
            className="w-full rounded-lg border border-line bg-background/60 py-2 pl-9 pr-3 text-sm outline-none focus:border-accent/50"
          />
        </div>
        {filters.topic && <input type="hidden" name="topic" value={filters.topic} />}
        <select
          name="min"
          defaultValue={String(filters.min)}
          className="rounded-lg border border-line bg-background/60 px-3 py-2 text-sm"
        >
          <option value="0">Any score</option>
          <option value="6">Score ≥ 6</option>
          <option value="7">Score ≥ 7</option>
          <option value="8">Score ≥ 8</option>
        </select>
        <select
          name="sort"
          defaultValue={filters.sort}
          className="rounded-lg border border-line bg-background/60 px-3 py-2 text-sm"
        >
          <option value="score">Most relevant</option>
          <option value="recent">Most recent</option>
        </select>
        <button className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white">Apply</button>
      </form>

      <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1">
        <Link href={hrefWith(filters, { topic: undefined })} className={chip(!filters.topic)}>
          All topics
        </Link>
        {TOPIC_SLUGS.map((t) => (
          <Link key={t} href={hrefWith(filters, { topic: t })} className={chip(filters.topic === t)}>
            {TOPICS[t].label}
          </Link>
        ))}
      </div>

      <p className="text-xs text-muted">
        {total} articles{filters.q && <> matching “{filters.q}”</>}
      </p>

      {items.length === 0 ? (
        <EmptyState title="No articles found" description="Try another topic, lower the score filter, or clear the search." />
      ) : (
        <>
          <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((a) => (
              <ArticleCard key={a.id} article={a} now={now} />
            ))}
          </div>
          <div className="card divide-y divide-line p-1.5 sm:hidden">
            {items.map((a) => (
              <ArticleRow key={a.id} article={a} now={now} />
            ))}
          </div>
        </>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          {filters.page > 1 && (
            <Link href={hrefWith(filters, { page: filters.page - 1 })} className={chip(false)}>
              ← Previous
            </Link>
          )}
          <span className="text-xs text-muted">
            Page {filters.page} of {pages}
          </span>
          {filters.page < pages && (
            <Link href={hrefWith(filters, { page: filters.page + 1 })} className={chip(false)}>
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

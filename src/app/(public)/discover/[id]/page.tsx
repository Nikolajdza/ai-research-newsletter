import { ArrowLeft, ArrowRight, ExternalLink, Lightbulb, ListChecks } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ScorePill, TopicChip } from "@/components/ui/badges";
import { Skeleton } from "@/components/ui/layout";
import { Thumb } from "@/components/ui/thumb";
import { formatDate } from "@/lib/format";
import { cachedPublicArticle } from "@/server/cache";

export default function PublicArticlePage(props: PageProps<"/discover/[id]">) {
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/discover" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Discover
      </Link>
      <Suspense fallback={<Skeleton className="h-[480px]" />}>
        <PublicArticle params={props.params} />
      </Suspense>
    </div>
  );
}

async function PublicArticle({ params }: Pick<PageProps<"/discover/[id]">, "params">) {
  const { id } = await params;
  const article = await cachedPublicArticle(id);
  if (!article) notFound();

  return (
    <article className="card overflow-hidden fade-up">
      <Thumb imageUrl={article.imageUrl} topic={article.topic} className="aspect-[2/1] w-full" iconClassName="h-14 w-14" />
      <div className="space-y-6 p-5 sm:p-7">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <TopicChip topic={article.topic} />
            <ScorePill score={article.relevanceScore} size="sm" />
          </div>
          <h1 className="mt-3 text-2xl font-semibold leading-snug tracking-tight">{article.title}</h1>
          <p className="mt-2 text-sm text-muted">
            {article.sourceName} · {formatDate(article.publishedAt ?? article.fetchedAt, "Europe/Belgrade")}
          </p>
        </div>

        {article.summary && <p className="leading-relaxed text-foreground/90">{article.summary}</p>}

        {article.whyItMatters && (
          <div className="rounded-xl bg-accent/10 p-4 ring-1 ring-accent/25">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Lightbulb className="h-4 w-4 text-accent" /> Why it matters
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground/85">{article.whyItMatters}</p>
          </div>
        )}

        {article.keyTakeaways.length > 0 && (
          <div>
            <p className="flex items-center gap-2 text-sm font-medium">
              <ListChecks className="h-4 w-4 text-accent" /> Key takeaways
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-foreground/85">
              {article.keyTakeaways.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm hover:bg-white/[0.04]"
          >
            Read on {article.sourceName} <ExternalLink className="h-4 w-4" />
          </a>
          <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white glow-accent">
            Save it & get stories like this <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}

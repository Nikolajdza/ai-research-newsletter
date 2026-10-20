import { ArrowLeft, ExternalLink, Lightbulb, ListChecks, Sparkles } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { analyzeArticleAction } from "@/app/actions";
import { FeedbackButtons, SaveButton, ShareButton } from "@/components/article/article-actions";
import { ArticleRow } from "@/components/article/article-card";
import { ActionButton } from "@/components/ui/action-button";
import { Tag, TopicChip } from "@/components/ui/badges";
import { Skeleton } from "@/components/ui/layout";
import { RelevanceGauge } from "@/components/ui/relevance-gauge";
import { Thumb } from "@/components/ui/thumb";
import { formatDate, readMinutes, requestNow, scoreLabel } from "@/lib/format";
import { estimateCostUsd } from "@/server/ai/groq";
import { requireUser } from "@/server/auth/session";
import { cachedArticleDetail } from "@/server/cache";

export default function ArticlePage(props: PageProps<"/articles/[id]">) {
  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/articles" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <Suspense fallback={<Skeleton className="h-[480px]" />}>
        <ArticleDetail params={props.params} />
      </Suspense>
    </div>
  );
}

async function ArticleDetail({ params }: Pick<PageProps<"/articles/[id]">, "params">) {
  await connection();
  const user = await requireUser();
  const { id } = await params;
  const detail = await cachedArticleDetail(user.id, id);
  if (!detail) notFound();
  const { article, related } = detail;
  const now = requestNow();
  const score = article.relevanceScore;
  const tags = [...new Set(article.tags)].slice(0, 8);
  const cost =
    article.model && article.promptTokens !== null && article.completionTokens !== null
      ? estimateCostUsd(article.model, article.promptTokens, article.completionTokens)
      : null;

  return (
    <div className="grid gap-6 fade-up lg:grid-cols-[minmax(0,1fr)_300px]">
      <article className="space-y-6">
        <Thumb
          imageUrl={article.imageUrl}
          topic={article.topic}
          className="aspect-[21/9] w-full rounded-2xl border border-line"
          iconClassName="h-16 w-16"
        />
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TopicChip topic={article.topic} />
            <span className="text-xs text-muted">
              {formatDate(article.publishedAt ?? article.fetchedAt)} · {readMinutes(article.summary ?? article.excerpt)} min read
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{article.title}</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-foreground/85">
            {article.summary ?? article.excerpt ?? "This article has no excerpt in its feed."}
          </p>
          {tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {tags.map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </div>
          )}
        </div>

        {score === null ? (
          <div className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Not analyzed yet</p>
              <p className="text-sm text-muted">Run a structured AI pass for summary, score and takeaways.</p>
            </div>
            <ActionButton action={analyzeArticleAction.bind(null, article.id)} pendingLabel="Analyzing…">
              <Sparkles className="h-4 w-4" /> Analyze with AI
            </ActionButton>
          </div>
        ) : (
          <>
            {article.whyItMatters && (
              <section className="card p-5">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Lightbulb className="h-4 w-4 text-amber-300" /> Why it matters
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-foreground/85">{article.whyItMatters}</p>
              </section>
            )}
            <section>
              <h2 className="text-lg font-semibold">Key Takeaways</h2>
              <ul className="mt-3 space-y-2">
                {article.keyTakeaways.map((t) => (
                  <li key={t} className="flex gap-3 text-sm leading-relaxed text-foreground/85">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {t}
                  </li>
                ))}
              </ul>
            </section>
            {article.actionItems.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <ListChecks className="h-5 w-5 text-emerald-300" /> Action items
                </h2>
                <ul className="mt-3 space-y-2">
                  {article.actionItems.map((t) => (
                    <li key={t} className="text-sm text-foreground/85">
                      → {t}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {related.length > 0 && (
          <section>
            <h2 className="mb-2 text-lg font-semibold">More in this topic</h2>
            <div className="card divide-y divide-line p-1.5">
              {related.map((a) => (
                <ArticleRow key={a.id} article={a} now={now} />
              ))}
            </div>
          </section>
        )}
      </article>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="card flex flex-col items-center p-5 text-center">
          <p className="self-start text-sm font-medium">Relevance Score</p>
          {score === null ? (
            <p className="py-8 text-sm text-muted">Awaiting analysis</p>
          ) : (
            <>
              <div className="mt-4">
                <RelevanceGauge score={score} />
              </div>
              <p className="mt-3 text-sm font-medium text-emerald-300">{scoreLabel(score)}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Scored against the topics you follow{article.model ? ` by ${article.model}` : ""}.
              </p>
              {cost !== null && (
                <p className="mt-2 text-[11px] text-muted">
                  {(article.promptTokens ?? 0) + (article.completionTokens ?? 0)} tokens · ${cost.toFixed(4)}
                </p>
              )}
            </>
          )}
        </div>

        <div className="card space-y-2 p-5">
          <p className="text-sm font-medium">Save for later</p>
          <SaveButton articleId={article.id} saved={Boolean(article.savedAt)} />
          <ShareButton url={article.url} title={article.title} />
        </div>

        <div className="card space-y-3 p-5">
          <p className="text-sm font-medium">Was this a good pick?</p>
          <FeedbackButtons articleId={article.id} feedback={article.feedback} />
          <p className="text-[11px] text-muted">“Not for me” keeps it out of highlights and digests.</p>
        </div>

        <div className="card p-5">
          <p className="text-sm font-medium">Source</p>
          <p className="mt-2 text-sm">{article.sourceName}</p>
          {article.author && <p className="text-xs text-muted">by {article.author}</p>}
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 break-all text-xs text-accent hover:underline"
          >
            Read original <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        </div>
      </aside>
    </div>
  );
}

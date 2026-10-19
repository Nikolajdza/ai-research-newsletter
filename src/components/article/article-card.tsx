import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { readMinutes, timeAgo } from "@/lib/format";
import type { PublicArticle } from "@/server/queries";
import { ScorePill, TopicChip } from "../ui/badges";
import { Thumb } from "../ui/thumb";

function meta(article: PublicArticle, now: number) {
  const when = timeAgo(article.publishedAt ?? article.fetchedAt, now);
  return `${when} · ${readMinutes(article.summary ?? article.excerpt)} min read`;
}

export function ArticleCard({ article, now, href }: { article: PublicArticle; now: number; href?: string }) {
  return (
    <Link
      href={href ?? `/articles/${article.id}`}
      className="card group flex flex-col overflow-hidden transition-all hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-[0_20px_50px_-20px_rgba(123,92,255,0.45)]"
    >
      <Thumb imageUrl={article.imageUrl} topic={article.topic} className="aspect-[16/9] w-full" />
      <div className="flex flex-1 flex-col p-4">
        <TopicChip topic={article.topic} className="self-start" />
        <h3 className="mt-2.5 line-clamp-3 text-[15px] font-semibold leading-snug group-hover:text-white">
          {article.title}
        </h3>
        <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-muted">
          {article.summary ?? article.excerpt ?? "No summary yet."}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <span className="truncate text-xs text-muted">{meta(article, now)}</span>
          <ScorePill score={article.relevanceScore} />
        </div>
      </div>
    </Link>
  );
}

export function ArticleRow({ article, now, href }: { article: PublicArticle; now: number; href?: string }) {
  return (
    <Link
      href={href ?? `/articles/${article.id}`}
      className="group flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-white/[0.04]"
    >
      <Thumb
        imageUrl={article.imageUrl}
        topic={article.topic}
        className="h-14 w-14 shrink-0 rounded-xl sm:h-16 sm:w-20"
        iconClassName="h-6 w-6"
      />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium leading-snug">{article.title}</p>
        <p className="mt-1 truncate text-xs text-muted">
          <span className="text-foreground/70">{article.sourceName}</span> · {meta(article, now)}
        </p>
      </div>
      <ScorePill score={article.relevanceScore} size="sm" />
      <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted sm:block" />
    </Link>
  );
}

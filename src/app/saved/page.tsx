import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArticleCard, ArticleRow } from "@/components/article/article-card";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/ui/layout";
import { requestNow } from "@/lib/format";
import { listSavedArticles } from "@/server/queries";

export const metadata = { title: "Saved Articles" };

export default function SavedPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Saved Articles" subtitle="Your reading list. Save any article from its detail page." />
      <Suspense fallback={<PageSkeleton />}>
        <SavedList />
      </Suspense>
    </div>
  );
}

async function SavedList() {
  await connection();
  const now = requestNow();
  const items = await listSavedArticles();

  if (items.length === 0) {
    return (
      <EmptyState
        title="Nothing saved yet"
        description="Open an article and press “Save Article” to keep it here."
        action={
          <Link href="/articles" className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white">
            Explore articles
          </Link>
        }
      />
    );
  }

  return (
    <div className="fade-up">
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
    </div>
  );
}

import { ChevronRight, Heart, Mail, RefreshCw, Send } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { sendDigestAction } from "@/app/actions";
import { ArticleRow } from "@/components/article/article-card";
import { ActionButton } from "@/components/ui/action-button";
import { StatusBadge, TopicChip } from "@/components/ui/badges";
import { EmptyState, PageSkeleton } from "@/components/ui/layout";
import { Thumb } from "@/components/ui/thumb";
import { formatDate, formatHour, formatTime, requestNow } from "@/lib/format";
import { formatTelegramDigest } from "@/server/digest/format";
import { selectDigestItems } from "@/server/digest/select";
import { telegramConfigured } from "@/server/digest/telegram";
import { getArticlesByIds, getPreferences, listDigests } from "@/server/queries";

export const metadata = { title: "Newsletter" };

function telegramPlainText(html: string): string {
  return html
    .replace(/<a href="[^"]*">Read<\/a>/g, "🔗 Read")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export default function NewsletterPage(props: PageProps<"/newsletter">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Newsletter searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Newsletter({ searchParams }: Pick<PageProps<"/newsletter">, "searchParams">) {
  await connection();
  const { id } = await searchParams;
  const now = requestNow();
  const [prefs, history] = await Promise.all([getPreferences(), listDigests(14)]);

  const selected = history.find((d) => d.id === id) ?? history[0] ?? null;
  let articleIds = selected?.articleIds ?? [];
  let message = selected?.messageText ?? "";
  let isPreview = false;

  if (!selected) {
    const selection = await selectDigestItems();
    articleIds = selection.items.map((i) => i.id);
    message = formatTelegramDigest({
      digestDate: selection.digestDate,
      format: selection.format,
      items: selection.items,
    });
    isPreview = true;
  }

  const items = await getArticlesByIds(articleIds);
  const [featured, ...rest] = items;
  const telegramReady = telegramConfigured();

  return (
    <div className="mx-auto grid max-w-7xl gap-6 fade-up xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="card overflow-hidden p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Your Daily Digest</h1>
            <p className="mt-1 text-sm text-muted">The most relevant stories, curated by AI</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted">{formatDate(selected?.createdAt ?? now, prefs.timezone)}</p>
            {selected ? <StatusBadge status={selected.status} /> : <StatusBadge status="waiting" />}
          </div>
        </div>

        {!featured ? (
          <div className="mt-6">
            <EmptyState
              title="Nothing to send yet"
              description={`No analyzed stories scored ≥ ${prefs.minRelevanceScore} in your topics. Run the pipeline or lower the minimum score in Preferences.`}
            />
          </div>
        ) : (
          <>
            <Link href={`/articles/${featured.id}`} className="group mt-6 block overflow-hidden rounded-2xl border border-line bg-panel-2">
              <Thumb imageUrl={featured.imageUrl} topic={featured.topic} className="aspect-[2/1] w-full" iconClassName="h-14 w-14" />
              <div className="p-4 sm:p-5">
                <TopicChip topic={featured.topic} />
                <h2 className="mt-2 text-lg font-semibold leading-snug group-hover:text-white">{featured.title}</h2>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{featured.summary}</p>
                <span className="mt-4 inline-flex items-center gap-1 rounded-xl bg-accent px-3.5 py-2 text-sm font-medium text-white">
                  Read more <ChevronRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
            <div className="mt-4 divide-y divide-line">
              {rest.map((a) => (
                <ArticleRow key={a.id} article={a} now={now} />
              ))}
            </div>
          </>
        )}

        <div className="dusk mt-6 rounded-2xl border border-line px-5 py-6 text-center">
          <p className="font-semibold">Stay curious. Stay informed.</p>
          <p className="mt-1 text-xs text-white/75">Powered by AI. Curated for you.</p>
          <Heart className="mx-auto mt-2 h-4 w-4 text-white/80" />
        </div>
      </section>

      <aside className="space-y-4">
        <div className="card p-5">
          <p className="font-medium">Delivery</p>
          <p className="mt-1 text-sm text-muted">
            Daily at {formatHour(prefs.digestHourLocal)} ({prefs.timezone}) · {prefs.digestFormat} format
          </p>
          <div
            className={`mt-3 rounded-xl px-3 py-2 text-xs ring-1 ${
              telegramReady && prefs.telegramEnabled
                ? "bg-emerald-500/10 text-emerald-200 ring-emerald-400/20"
                : "bg-amber-500/10 text-amber-200 ring-amber-400/20"
            }`}
          >
            {telegramReady && prefs.telegramEnabled
              ? "Telegram connected — digests are delivered to your chat."
              : !prefs.telegramEnabled
                ? "Telegram is turned off in Preferences — digests are saved as dry runs."
                : "Telegram not configured — set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env. Digests are saved as dry runs."}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <ActionButton action={sendDigestAction.bind(null, { force: false })} pendingLabel="Sending…">
              <Send className="h-4 w-4" /> Send today&apos;s digest
            </ActionButton>
            <ActionButton action={sendDigestAction.bind(null, { force: true })} variant="secondary" pendingLabel="Rebuilding…">
              <RefreshCw className="h-4 w-4" /> Rebuild &amp; resend
            </ActionButton>
          </div>
          <p className="mt-3 text-[11px] text-muted">
            Idempotent: one Telegram send per day. A second run returns “already sent” unless you force it.
          </p>
        </div>

        <div className="card p-5">
          <p className="flex items-center gap-2 font-medium">
            <Mail className="h-4 w-4 text-accent" /> Telegram message {isPreview && <span className="text-xs text-muted">(preview)</span>}
          </p>
          <div className="mt-3 max-h-80 overflow-y-auto rounded-2xl rounded-tl-sm bg-[#1d2a3a] p-4 text-[13px] leading-relaxed whitespace-pre-wrap text-slate-100">
            {message ? telegramPlainText(message) : "—"}
          </div>
        </div>

        <div className="card p-5">
          <p className="font-medium">Newsletter history</p>
          {history.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No digests yet.</p>
          ) : (
            <ul className="mt-3 space-y-1">
              {history.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/newsletter?id=${d.id}`}
                    className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-white/[0.04] ${
                      d.id === selected?.id ? "bg-white/[0.05]" : ""
                    }`}
                  >
                    <span>
                      {d.digestDate}
                      <span className="ml-2 text-xs text-muted">
                        {d.itemCount} items · {formatTime(d.sentAt ?? d.createdAt, prefs.timezone)}
                      </span>
                    </span>
                    <StatusBadge status={d.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

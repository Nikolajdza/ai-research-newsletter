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
import { topicMeta } from "@/lib/topics";
import { requireUser } from "@/server/auth/session";
import { selectDigestItems } from "@/server/digest/select";
import { telegramBotConfigured } from "@/server/digest/telegram";
import { getArticlesByIds, getPreferences, listDigests, type ArticleListItem } from "@/server/queries";

export const metadata = { title: "Newsletter" };

function TelegramPreview({ digestDate, items }: { digestDate: string; items: ArticleListItem[] }) {
  return (
    <div className="mt-3 max-h-[560px] space-y-2.5 overflow-y-auto rounded-2xl bg-[#0e1621] p-3 text-[13px] leading-relaxed text-slate-100">
      <div className="rounded-2xl rounded-tl-sm bg-[#182533] px-3.5 py-2.5">
        <p className="font-semibold">☀️ InsightLoop · Daily Digest</p>
        <p className="text-slate-300">
          {digestDate} · {items.length} stories picked for you
        </p>
      </div>
      {items.map((item, i) => {
        const topic = topicMeta(item.topic);
        return (
          <div key={item.id} className="overflow-hidden rounded-2xl rounded-tl-sm bg-[#182533]">
            {item.imageUrl && <Thumb imageUrl={item.imageUrl} topic={item.topic} className="aspect-[16/9] w-full" />}
            <div className="space-y-1.5 px-3.5 py-2.5">
              <p className="font-semibold">
                {i + 1}. {item.title}
              </p>
              <p className="text-xs text-slate-300">
                {topic.emoji} {topic.label} · ⭐ {(item.relevanceScore ?? 0).toFixed(1)} · {item.sourceName}
              </p>
              {item.summary && <p className="line-clamp-4 text-slate-200">{item.summary}</p>}
            </div>
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="block border-t border-white/5 py-2 text-center text-xs font-medium text-sky-300 hover:bg-white/[0.03]"
            >
              Read article ↗
            </a>
          </div>
        );
      })}
    </div>
  );
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
  const user = await requireUser();
  const [prefs, history] = await Promise.all([getPreferences(user.id), listDigests(user.id, 14)]);

  const selected = history.find((d) => d.id === id) ?? history[0] ?? null;
  let articleIds = selected?.articleIds ?? [];
  let digestDate = selected?.digestDate ?? "";
  let isPreview = false;

  if (!selected) {
    const selection = await selectDigestItems(prefs);
    articleIds = selection.items.map((i) => i.id);
    digestDate = selection.digestDate;
    isPreview = true;
  }

  const items = await getArticlesByIds(user.id, articleIds);
  const [featured, ...rest] = items;
  const botReady = telegramBotConfigured();
  const connected = botReady && Boolean(prefs.telegramChatId);

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
              connected && prefs.telegramEnabled
                ? "bg-emerald-500/10 text-emerald-200 ring-emerald-400/20"
                : "bg-amber-500/10 text-amber-200 ring-amber-400/20"
            }`}
          >
            {!botReady ? (
              "Telegram bot is not configured on the server — digests are saved as dry runs."
            ) : !prefs.telegramChatId ? (
              <>
                Telegram is not connected yet.{" "}
                <Link href="/settings" className="underline underline-offset-2">
                  Connect it in Settings
                </Link>{" "}
                to get the digest as cards in your chat.
              </>
            ) : !prefs.telegramEnabled ? (
              "Telegram is turned off in Preferences — digests are saved as dry runs."
            ) : (
              "Telegram connected — digests arrive as one card per story in your chat."
            )}
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
            <Mail className="h-4 w-4 text-accent" /> In Telegram {isPreview && <span className="text-xs text-muted">(preview)</span>}
          </p>
          {items.length ? (
            <TelegramPreview digestDate={digestDate} items={items} />
          ) : (
            <p className="mt-2 text-sm text-muted">—</p>
          )}
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

import { CheckCircle2, LogOut, XCircle } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { logoutAction } from "@/app/auth-actions";
import { ProfileForm } from "@/components/settings/profile-form";
import { TelegramConnect } from "@/components/settings/telegram-connect";
import { PageHeader, Skeleton } from "@/components/ui/layout";
import { appConfig } from "@/lib/config";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { getDatabaseHealth } from "@/server/pipeline/retention";
import { getIntegrationStatus, getPreferences } from "@/server/queries";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Settings" subtitle="Your profile, Telegram delivery and integration health." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}

function Row({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 py-3">
      {ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-400" /> : <XCircle className="mt-0.5 h-5 w-5 text-amber-300" />}
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted">{detail}</p>
      </div>
    </div>
  );
}

async function SettingsContent() {
  await connection();
  const user = await requireUser();
  const [prefs, status, dbHealth] = await Promise.all([
    getPreferences(user.id),
    getIntegrationStatus(),
    user.role === "admin" ? getDatabaseHealth() : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6 fade-up">
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Profile</h2>
          <form action={logoutAction}>
            <button className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted hover:bg-white/[0.05] hover:text-foreground">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </form>
        </div>
        <ProfileForm displayName={user.displayName} />
        <p className="mt-3 text-xs text-muted">
          Signed in as <span className="text-foreground">{user.email}</span>
          {user.role === "admin" ? " · admin" : ""}. Topics, digest time and channels live in{" "}
          <Link href="/preferences" className="text-accent">
            Preferences
          </Link>
          .
        </p>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Telegram</h2>
        <TelegramConnect connected={Boolean(prefs.telegramChatId)} botReady={status.telegramBot} />
      </section>

      {user.role === "admin" && dbHealth && (
        <>
          <section className="card p-5">
            <h2 className="font-semibold">Database (Supabase free)</h2>
            <p className="mt-1 text-xs text-muted">
              Free plan ~{dbHealth.freePlanLabel}. Daily pipeline purges articles older than {dbHealth.retentionDays} days
              (saved articles kept). Tightens to 14d if the DB gets large.
            </p>
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted">Storage used</span>
                <span
                  className={
                    dbHealth.level === "critical"
                      ? "text-rose-300"
                      : dbHealth.level === "warn"
                        ? "text-amber-300"
                        : "text-emerald-300"
                  }
                >
                  {dbHealth.sizeLabel} / {dbHealth.freePlanLabel} ({Math.round(dbHealth.usageRatio * 100)}%)
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className={`h-full rounded-full transition-all ${
                    dbHealth.level === "critical"
                      ? "bg-rose-400"
                      : dbHealth.level === "warn"
                        ? "bg-amber-400"
                        : "bg-emerald-400"
                  }`}
                  style={{ width: `${Math.min(100, Math.round(dbHealth.usageRatio * 100))}%` }}
                />
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted">Articles</dt>
                <dd className="tabular-nums">{dbHealth.articles.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Analyses</dt>
                <dd className="tabular-nums">{dbHealth.analyses.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Saved (kept)</dt>
                <dd className="tabular-nums">{dbHealth.savedArticles.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Digests</dt>
                <dd className="tabular-nums">{dbHealth.digests.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Sources</dt>
                <dd className="tabular-nums">{dbHealth.sources.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Users</dt>
                <dd className="tabular-nums">{dbHealth.users.toLocaleString()}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted">
              Retention: {dbHealth.retentionDays}d ({dbHealth.retentionMode})
              {dbHealth.oldestArticleAt
                ? ` · oldest article ${formatDate(dbHealth.oldestArticleAt)}`
                : " · no articles yet"}
              . Override with env <code className="text-foreground">ARTICLE_RETENTION_DAYS</code>.
            </p>
          </section>

          <section className="card p-5">
            <h2 className="font-semibold">Integrations</h2>
            <div className="mt-2 divide-y divide-line">
              <Row
                ok={status.groq}
                label="LLM"
                detail={status.groq ? status.groqModel : "Set GROQ_API_KEY_NEWSLETTER, GEMINI_API_KEY, or OPENROUTER_API_KEY"}
              />
              <Row
                ok={status.telegramBot}
                label="Telegram bot"
                detail={status.telegramBot ? "Bot token configured — readers connect their own chat" : "Set TELEGRAM_BOT_TOKEN (dry runs until then)"}
              />
              <Row ok={status.n8n} label="n8n" detail={status.n8n ? `Reachable at ${appConfig.urls.n8n}` : "Not reachable (local only — production uses Vercel Cron)"} />
              <Row
                ok={status.pipelineSecret}
                label="Pipeline secret"
                detail={status.pipelineSecret ? "Pipeline APIs require x-ingest-secret" : "INGEST_SECRET not set — pipeline APIs are open"}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

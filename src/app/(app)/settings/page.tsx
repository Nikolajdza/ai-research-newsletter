import { CheckCircle2, LogOut, XCircle } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { logoutAction } from "@/app/auth-actions";
import { ProfileForm } from "@/components/settings/profile-form";
import { TelegramConnect } from "@/components/settings/telegram-connect";
import { PageHeader, Skeleton } from "@/components/ui/layout";
import { appConfig } from "@/lib/config";
import { requireUser } from "@/server/auth/session";
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
  const [prefs, status] = await Promise.all([getPreferences(user.id), getIntegrationStatus()]);

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

      {user.role === "admin" && (
        <section className="card p-5">
          <h2 className="font-semibold">Integrations</h2>
          <div className="mt-2 divide-y divide-line">
            <Row ok={status.groq} label="Groq LLM" detail={status.groq ? `Model ${status.groqModel}` : "Set GROQ_API_KEY_NEWSLETTER"} />
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
      )}
    </div>
  );
}

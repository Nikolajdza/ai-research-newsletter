import { CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ProfileForm } from "@/components/settings/profile-form";
import { PageHeader, Skeleton } from "@/components/ui/layout";
import { appConfig } from "@/lib/config";
import { getIntegrationStatus, getPreferences } from "@/server/queries";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Settings" subtitle="Profile and integration health for this local workspace." />
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
  const [prefs, status] = await Promise.all([getPreferences(), getIntegrationStatus()]);

  return (
    <div className="space-y-6 fade-up">
      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Profile</h2>
        <ProfileForm displayName={prefs.displayName} />
        <p className="mt-3 text-xs text-muted">
          Topics, digest time and channels live in{" "}
          <Link href="/preferences" className="text-accent">
            Preferences
          </Link>
          .
        </p>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">Integrations</h2>
        <div className="mt-2 divide-y divide-line">
          <Row ok={status.groq} label="Groq LLM" detail={status.groq ? `Model ${status.groqModel}` : "Set GROQ_API_KEY_NEWSLETTER in .env"} />
          <Row
            ok={status.telegram}
            label="Telegram bot"
            detail={status.telegram ? "Digests are delivered to your chat" : "Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env (dry runs until then)"}
          />
          <Row ok={status.n8n} label="n8n" detail={status.n8n ? `Reachable at ${appConfig.urls.n8n}` : `Not reachable — run npm run infra:up`} />
          <Row
            ok={status.pipelineSecret}
            label="Pipeline secret"
            detail={status.pipelineSecret ? "n8n requests are authenticated with x-ingest-secret" : "INGEST_SECRET not set — pipeline APIs are open"}
          />
        </div>
      </section>

      <section className="card p-5 text-sm">
        <h2 className="font-semibold">Connect Telegram (2 minutes)</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-muted">
          <li>
            In Telegram, message <span className="text-foreground">@BotFather</span> → <code>/newbot</code> → copy the token.
          </li>
          <li>Send any message to your new bot.</li>
          <li>
            Open <code className="break-all">https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code> and copy{" "}
            <code>message.chat.id</code>.
          </li>
          <li>
            Add <code>TELEGRAM_BOT_TOKEN</code> and <code>TELEGRAM_CHAT_ID</code> to <code>.env</code>, restart{" "}
            <code>npm run dev</code>.
          </li>
          <li>Newsletter → “Send today&apos;s digest”.</li>
        </ol>
      </section>
    </div>
  );
}

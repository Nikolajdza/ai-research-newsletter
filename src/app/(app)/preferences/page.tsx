import { connection } from "next/server";
import { Suspense } from "react";
import { PreferencesForm } from "@/components/preferences/preferences-form";
import { PageHeader, Skeleton } from "@/components/ui/layout";
import { TIMEZONES } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { telegramBotConfigured } from "@/server/digest/telegram";
import { getPreferences, listSourcesWithStats } from "@/server/queries";

export const metadata = { title: "Preferences" };

export default function PreferencesPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Preferences" subtitle="Customize your interests and how your newsletter is generated." />
      <Suspense fallback={<Skeleton className="h-[520px]" />}>
        <PreferencesContent />
      </Suspense>
    </div>
  );
}

async function PreferencesContent() {
  await connection();
  const user = await requireUser();
  const [prefs, sources] = await Promise.all([getPreferences(user.id), listSourcesWithStats()]);
  const timezone = (TIMEZONES as readonly string[]).includes(prefs.timezone)
    ? (prefs.timezone as (typeof TIMEZONES)[number])
    : "Europe/Belgrade";

  return (
    <PreferencesForm
      telegramConnected={telegramBotConfigured() && Boolean(prefs.telegramChatId)}
      canManageSources={user.role === "admin"}
      sources={sources.map(({ id, name, feedUrl, topic, enabled }) => ({ id, name, feedUrl, topic, enabled }))}
      initial={{
        selectedTopics: prefs.selectedTopics,
        minRelevanceScore: prefs.minRelevanceScore,
        digestHourLocal: prefs.digestHourLocal,
        timezone,
        digestFormat: prefs.digestFormat === "short" ? "short" : "detailed",
        telegramEnabled: prefs.telegramEnabled,
        emailEnabled: prefs.emailEnabled,
      }}
    />
  );
}

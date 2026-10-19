import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { TopicPicker } from "@/components/onboarding/topic-picker";
import { Brand } from "@/components/shell/brand";
import { isTopicSlug } from "@/lib/topics";
import { requireUser } from "@/server/auth/session";
import { getPreferences, listCustomTopics } from "@/server/queries";

export const metadata = { title: "Pick your topics" };

export default function WelcomePage() {
  return (
    <div className="min-h-screen px-5">
      <header className="mx-auto flex max-w-6xl items-center py-5">
        <Brand />
      </header>
      <main className="fade-up pt-4 sm:pt-8">
        <Suspense fallback={<div className="mx-auto h-[640px] max-w-6xl animate-pulse rounded-3xl bg-panel/60" />}>
          <Welcome />
        </Suspense>
      </main>
    </div>
  );
}

async function Welcome() {
  await connection();
  const user = await requireUser();
  const prefs = await getPreferences(user.id);
  if (prefs.onboardedAt) redirect("/");
  const customTopics = await listCustomTopics(prefs.selectedTopics);

  return (
    <TopicPicker
      name={user.displayName.split(" ")[0] ?? user.displayName}
      initial={prefs.selectedTopics.filter(isTopicSlug)}
      customTopics={customTopics}
    />
  );
}

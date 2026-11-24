import { connection } from "next/server";
import { DigestPromptModal } from "@/components/settings/digest-prompt";
import { getCurrentUser } from "@/server/auth/session";
import { getPreferences } from "@/server/queries";

/** After topic onboarding, ask once whether to enable Telegram digests. */
export async function DigestPromptGate() {
  await connection();
  const user = await getCurrentUser();
  if (!user) return null;
  const prefs = await getPreferences(user.id);
  if (!prefs.onboardedAt || prefs.digestPromptedAt) return null;
  return <DigestPromptModal />;
}

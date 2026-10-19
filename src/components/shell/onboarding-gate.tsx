import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { getPreferences } from "@/server/queries";

export async function OnboardingGate() {
  await connection();
  const user = await getCurrentUser();
  if (!user) return null;
  const prefs = await getPreferences(user.id);
  if (!prefs.onboardedAt) redirect("/welcome");
  return null;
}

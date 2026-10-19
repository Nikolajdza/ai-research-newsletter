import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { formatTelegramDigest } from "@/server/digest/format";
import { selectDigestItems } from "@/server/digest/select";
import { getPreferences } from "@/server/queries";

/** Signed-in user's digest as it would be sent right now. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first" }, { status: 401 });

  try {
    const selection = await selectDigestItems(await getPreferences(user.id));
    return NextResponse.json({ ok: true, ...selection, messagePreview: formatTelegramDigest(selection) });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Preview failed" },
      { status: 500 },
    );
  }
}

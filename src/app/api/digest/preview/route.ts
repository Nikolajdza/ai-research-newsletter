import { NextResponse } from "next/server";
import { formatTelegramDigest } from "@/server/digest/format";
import { selectDigestItems } from "@/server/digest/select";

export async function GET() {
  try {
    const selection = await selectDigestItems();
    const message = formatTelegramDigest({
      digestDate: selection.digestDate,
      format: selection.format,
      items: selection.items,
    });

    return NextResponse.json({
      ok: true,
      ...selection,
      messagePreview: message,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Preview failed",
      },
      { status: 500 },
    );
  }
}

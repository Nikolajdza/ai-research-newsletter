import { NextResponse } from "next/server";
import { assertPipelineSecret } from "@/lib/pipeline-auth";
import { runDailyPipeline } from "@/server/pipeline/daily";

/**
 * n8n entrypoint: collect → analyze → digest (idempotent).
 */
export async function POST(request: Request) {
  const denied = assertPipelineSecret(request);
  if (denied) return denied;

  let analyzeLimit = 10;
  let skipCollect = false;
  let skipAnalyze = false;
  let forceDigest = false;
  let dryRunDigest = false;

  try {
    const body = (await request.json()) as {
      analyzeLimit?: number;
      skipCollect?: boolean;
      skipAnalyze?: boolean;
      forceDigest?: boolean;
      dryRunDigest?: boolean;
    };
    if (typeof body.analyzeLimit === "number") {
      analyzeLimit = Math.min(Math.max(body.analyzeLimit, 1), 50);
    }
    skipCollect = Boolean(body.skipCollect);
    skipAnalyze = Boolean(body.skipAnalyze);
    forceDigest = Boolean(body.forceDigest);
    dryRunDigest = Boolean(body.dryRunDigest);
  } catch {
    // empty body ok
  }

  try {
    const result = await runDailyPipeline({
      trigger: "api",
      analyzeLimit,
      skipCollect,
      skipAnalyze,
      forceDigest,
      dryRunDigest,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("daily pipeline failed", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Pipeline failed",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: "POST to run collect → analyze → digest. Optional x-ingest-secret header.",
  });
}

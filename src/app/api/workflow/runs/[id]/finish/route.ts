import { NextResponse } from "next/server";
import { assertPipelineSecret } from "@/lib/pipeline-auth";
import { finishRun } from "@/server/pipeline/runs";

const UUID_RE = /^[0-9a-f-]{36}$/i;

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/workflow/runs/[id]/finish">,
) {
  const denied = assertPipelineSecret(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ ok: false, error: "Invalid run id" }, { status: 400 });
  }

  const run = await finishRun(id);
  if (!run) {
    return NextResponse.json({ ok: false, error: "Run not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, runId: run.id, status: run.status, steps: run.steps });
}

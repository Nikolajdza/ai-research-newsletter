import { assertPipelineSecret, readPipelineBody, stepResponse } from "@/lib/pipeline-auth";
import { runDigestStep } from "@/server/pipeline/steps";

/** n8n step 3: idempotent daily Telegram digest (dry run without bot credentials). */
export async function POST(request: Request) {
  const denied = assertPipelineSecret(request);
  if (denied) return denied;

  const body = await readPipelineBody(request);
  const outcome = await runDigestStep(body.runId, {
    force: Boolean(body.force),
    dryRun: Boolean(body.dryRun),
    respectSchedule: Boolean(body.respectSchedule),
  });
  return outcome.ok
    ? stepResponse(body, { ok: true, ...outcome.result })
    : stepResponse(body, { ok: false, error: outcome.error });
}

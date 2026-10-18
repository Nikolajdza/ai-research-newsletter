import { assertPipelineSecret, readPipelineBody, stepResponse } from "@/lib/pipeline-auth";
import { runCollectStep } from "@/server/pipeline/steps";

/** n8n step 1: fetch enabled RSS feeds, canonicalize, dedupe, persist. */
export async function POST(request: Request) {
  const denied = assertPipelineSecret(request);
  if (denied) return denied;

  const body = await readPipelineBody(request);
  const outcome = await runCollectStep(body.runId);
  return outcome.ok
    ? stepResponse(body, { ok: true, ...outcome.result })
    : stepResponse(body, { ok: false, error: outcome.error });
}

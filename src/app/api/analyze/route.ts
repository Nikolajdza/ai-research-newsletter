import { assertPipelineSecret, readPipelineBody, stepResponse } from "@/lib/pipeline-auth";
import { runAnalyzeStep } from "@/server/pipeline/steps";

/** n8n step 2: structured LLM analysis (Zod-validated) for unanalyzed articles. */
export async function POST(request: Request) {
  const denied = assertPipelineSecret(request);
  if (denied) return denied;

  const body = await readPipelineBody(request);
  const limit =
    typeof body.limit === "number" && body.limit > 0 ? Math.min(body.limit, 50) : 10;

  const outcome = await runAnalyzeStep(body.runId, limit);
  return outcome.ok
    ? stepResponse(body, { ok: true, ...(outcome.result ?? { skipped: "llm_not_configured" }) })
    : stepResponse(body, { ok: false, error: outcome.error });
}

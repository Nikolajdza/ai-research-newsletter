import { analyzeUnanalyzedArticles, type AnalyzeBatchResult } from "../ai/analyze";
import { sendDailyDigest, type DigestSendResult } from "../digest/send";
import { collectFromEnabledSources, type CollectResult } from "../ingest/collect";
import { appendStep } from "./runs";

export type StepOutcome<T> =
  | { ok: true; result: T }
  | { ok: false; error: string };

function errorMessage(err: unknown): string {
  if (!(err instanceof Error)) return String(err).slice(0, 300);
  // Drizzle wraps driver errors as "Failed query: <full SQL>"; the cause is the useful part.
  const message = err.message.startsWith("Failed query") && err.cause instanceof Error ? err.cause.message : err.message;
  return message.slice(0, 300);
}

export function groqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY_NEWSLETTER || process.env.GROQ_API_KEY);
}

/** Each step never throws: failures are recorded on the run and returned. */
export async function runCollectStep(runId?: string): Promise<StepOutcome<CollectResult>> {
  try {
    const result = await collectFromEnabledSources({ respectPreferences: true });
    if (runId) {
      await appendStep(runId, {
        name: "collect",
        status: result.errors.length ? "completed_with_errors" : "completed",
        detail: `${result.sourcesProcessed} feeds · ${result.articlesInserted} new · ${result.articlesSkipped} duplicates${
          result.errors.length ? ` · ${result.errors.length} feed errors` : ""
        }`,
      });
    }
    return { ok: true, result };
  } catch (err) {
    if (runId) await appendStep(runId, { name: "collect", status: "failed", detail: errorMessage(err) });
    return { ok: false, error: errorMessage(err) };
  }
}

export async function runAnalyzeStep(
  runId: string | undefined,
  limit: number,
): Promise<StepOutcome<AnalyzeBatchResult | null>> {
  if (!groqConfigured()) {
    if (runId) {
      await appendStep(runId, { name: "analyze", status: "skipped", detail: "GROQ_API_KEY_NEWSLETTER missing" });
    }
    return { ok: true, result: null };
  }
  try {
    const result = await analyzeUnanalyzedArticles({ limit });
    if (runId) {
      await appendStep(runId, {
        name: "analyze",
        status: result.failed ? "completed_with_errors" : "completed",
        detail: `${result.analyzed} analyzed · ${result.failed} failed · $${result.estimatedCostUsd.toFixed(4)}`,
      });
    }
    return { ok: true, result };
  } catch (err) {
    if (runId) await appendStep(runId, { name: "analyze", status: "failed", detail: errorMessage(err) });
    return { ok: false, error: errorMessage(err) };
  }
}

export async function runDigestStep(
  runId: string | undefined,
  options: { force?: boolean; dryRun?: boolean; respectSchedule?: boolean },
): Promise<StepOutcome<DigestSendResult>> {
  try {
    const result = await sendDailyDigest(options);
    if (runId) {
      await appendStep(
        runId,
        {
          name: "digest",
          status: result.skipped ? "skipped" : result.status,
          detail: result.skipped
            ? result.reason
            : `${result.itemCount} items · ${result.dryRun ? `dry run (${result.reason})` : "sent to Telegram"}`,
        },
        { digestId: result.digestId },
      );
    }
    return { ok: true, result };
  } catch (err) {
    if (runId) await appendStep(runId, { name: "digest", status: "failed", detail: errorMessage(err) });
    return { ok: false, error: errorMessage(err) };
  }
}

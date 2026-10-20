import { analyzeUnanalyzedArticles, type AnalyzeBatchResult } from "../ai/analyze";
import { llmConfigured } from "../ai/llm";
import { sendDailyDigests, type DigestBatchResult, type DigestOptions } from "../digest/send";
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

/** True if any LLM provider (Groq / Gemini / OpenRouter) has a key. */
export function groqConfigured(): boolean {
  return llmConfigured();
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
      await appendStep(runId, { name: "analyze", status: "skipped", detail: "No LLM provider configured" });
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

function digestStepStatus(batch: DigestBatchResult): string {
  const delivered = batch.sent + batch.dryRun;
  if (batch.failed) return delivered ? "completed_with_errors" : "failed";
  return delivered ? "completed" : "skipped";
}

function digestStepDetail(batch: DigestBatchResult): string {
  if (batch.users === 0) return "no accounts yet";
  const waiting = batch.results.filter((r) => r.status === "waiting").length;
  const parts = [
    `${batch.users} ${batch.users === 1 ? "user" : "users"}`,
    batch.sent && `${batch.sent} sent`,
    batch.dryRun && `${batch.dryRun} dry run`,
    waiting && `${waiting} waiting for their hour`,
    batch.skipped - waiting && `${batch.skipped - waiting} already done`,
    batch.failed && `${batch.failed} failed: ${batch.errors[0]?.message}`,
  ];
  return parts.filter(Boolean).join(" · ");
}

export async function runDigestStep(
  runId: string | undefined,
  options: DigestOptions,
): Promise<StepOutcome<DigestBatchResult>> {
  try {
    const result = await sendDailyDigests(options);
    if (runId) {
      await appendStep(
        runId,
        { name: "digest", status: digestStepStatus(result), detail: digestStepDetail(result) },
        { digestId: result.results.length === 1 ? result.results[0].digestId : null },
      );
    }
    return { ok: true, result };
  } catch (err) {
    if (runId) await appendStep(runId, { name: "digest", status: "failed", detail: errorMessage(err) });
    return { ok: false, error: errorMessage(err) };
  }
}

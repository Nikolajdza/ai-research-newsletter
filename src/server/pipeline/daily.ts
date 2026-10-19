import { finishRun, getRun, respectsSchedule, startRun, type RunTrigger } from "./runs";
import { runAnalyzeStep, runCollectStep, runDigestStep } from "./steps";

export type DailyPipelineResult = {
  workflowRunId: string;
  status: string;
  steps: { name: string; status: string; detail?: string; at: string }[];
};

/**
 * Full pipeline in one process: collect → analyze → digest.
 * n8n calls the steps individually; the dashboard and CLI use this.
 */
export async function runDailyPipeline(options?: {
  trigger?: RunTrigger;
  analyzeLimit?: number;
  skipCollect?: boolean;
  skipAnalyze?: boolean;
  forceDigest?: boolean;
  dryRunDigest?: boolean;
  /** Defaults to true only for trigger "schedule" (hourly n8n). Vercel Hobby cron is once a day. */
  respectSchedule?: boolean;
}): Promise<DailyPipelineResult> {
  const trigger = options?.trigger ?? "api";
  const run = await startRun(trigger);

  if (!options?.skipCollect) await runCollectStep(run.id);
  if (!options?.skipAnalyze) await runAnalyzeStep(run.id, options?.analyzeLimit ?? 10);
  await runDigestStep(run.id, {
    force: options?.forceDigest,
    dryRun: options?.dryRunDigest,
    respectSchedule: options?.respectSchedule ?? respectsSchedule(trigger),
  });

  await finishRun(run.id);
  const finished = await getRun(run.id);

  return {
    workflowRunId: run.id,
    status: finished?.status ?? "unknown",
    steps: finished?.steps ?? [],
  };
}

import { eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { workflowRuns } from "../db/schema";

export type RunStep = {
  name: string;
  status: string;
  detail?: string;
  at: string;
};

export type RunTrigger = "manual" | "schedule" | "dashboard" | "cli" | "api";

/** Scheduled runs wait for the user's preferred digest hour; manual runs send right away. */
export function respectsSchedule(trigger: string): boolean {
  return trigger === "schedule";
}

export async function startRun(trigger: RunTrigger, name = "daily-digest") {
  const [run] = await db
    .insert(workflowRuns)
    .values({ name, trigger, status: "running", steps: [] })
    .returning();
  return run;
}

export async function getRun(runId: string) {
  const [run] = await db
    .select()
    .from(workflowRuns)
    .where(eq(workflowRuns.id, runId))
    .limit(1);
  return run ?? null;
}

export async function appendStep(
  runId: string,
  step: Omit<RunStep, "at">,
  extra?: { digestId?: string | null },
) {
  const entry: RunStep = { ...step, at: new Date().toISOString() };
  await db
    .update(workflowRuns)
    .set({
      steps: sql`${workflowRuns.steps} || ${JSON.stringify([entry])}::jsonb`,
      ...(extra?.digestId ? { digestId: extra.digestId } : {}),
    })
    .where(eq(workflowRuns.id, runId));
}

export function statusFromSteps(steps: RunStep[]): string {
  if (steps.some((s) => s.status === "failed")) return "failed";
  if (steps.some((s) => s.status === "completed_with_errors")) return "completed_with_errors";
  return "completed";
}

export async function finishRun(runId: string, errorMessage?: string) {
  const run = await getRun(runId);
  if (!run) return null;
  const status = errorMessage ? "failed" : statusFromSteps(run.steps);
  const [updated] = await db
    .update(workflowRuns)
    .set({ status, finishedAt: new Date(), errorMessage: errorMessage ?? null })
    .where(eq(workflowRuns.id, runId))
    .returning();
  return updated;
}

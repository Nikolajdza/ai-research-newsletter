import { NextResponse } from "next/server";
import { assertPipelineSecret, readPipelineBody } from "@/lib/pipeline-auth";
import { respectsSchedule, startRun, type RunTrigger } from "@/server/pipeline/runs";

const TRIGGERS: RunTrigger[] = ["manual", "schedule", "dashboard", "cli", "api"];

/** n8n opens a run first so every following step is logged under one id. */
export async function POST(request: Request) {
  const denied = assertPipelineSecret(request);
  if (denied) return denied;

  const body = await readPipelineBody(request);
  const trigger = TRIGGERS.includes(body.trigger as RunTrigger)
    ? (body.trigger as RunTrigger)
    : "api";

  const run = await startRun(trigger);
  return NextResponse.json({
    ok: true,
    run: { id: run.id, respectSchedule: respectsSchedule(trigger), trigger },
  });
}

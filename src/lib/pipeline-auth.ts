import { NextResponse } from "next/server";

/** Shared secret for n8n → Next.js pipeline routes. */
export function assertPipelineSecret(request: Request): NextResponse | null {
  const secret = process.env.INGEST_SECRET;
  if (!secret) return null;

  const header = request.headers.get("x-ingest-secret");
  if (header !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export type PipelineBody = {
  runId?: string;
  respectSchedule?: boolean;
  limit?: number;
  force?: boolean;
  dryRun?: boolean;
  trigger?: string;
};

export async function readPipelineBody(request: Request): Promise<PipelineBody> {
  try {
    const body = (await request.json()) as PipelineBody | null;
    return body ?? {};
  } catch {
    return {};
  }
}

/**
 * Every step response echoes the run context so the next n8n node can read
 * it from `$json.run` without cross-node references.
 */
export function stepResponse(
  body: PipelineBody,
  payload: { ok: boolean } & Record<string, unknown>,
) {
  return NextResponse.json(
    {
      ...payload,
      run: { id: body.runId ?? null, respectSchedule: Boolean(body.respectSchedule) },
    },
    { status: payload.ok ? 200 : 500 },
  );
}

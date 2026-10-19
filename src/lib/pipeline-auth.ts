import { NextResponse } from "next/server";

function bearerToken(request: Request): string | null {
  const value = request.headers.get("authorization");
  if (!value?.toLowerCase().startsWith("bearer ")) return null;
  return value.slice(7).trim() || null;
}

/** Vercel Cron sends GET with `Authorization: Bearer $CRON_SECRET`. */
export function isVercelCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const token = bearerToken(request);
  return Boolean(secret && token && token === secret);
}

/** Shared secret for n8n / curl → Next.js pipeline routes. Vercel Cron is also allowed. */
export function assertPipelineSecret(request: Request): NextResponse | null {
  if (isVercelCron(request)) return null;

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

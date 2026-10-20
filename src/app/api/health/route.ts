import { NextResponse } from "next/server";

/**
 * Lightweight liveness check. Phase 2+ can add DB / n8n probes.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "ai-research-newsletter",
    phase: 12,
    timestamp: new Date().toISOString(),
  });
}

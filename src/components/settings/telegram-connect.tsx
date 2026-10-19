"use client";

import { ExternalLink, Loader2, Send, Unplug } from "lucide-react";
import { useState, useTransition } from "react";
import {
  checkTelegramAction,
  connectTelegramAction,
  disconnectTelegramAction,
  sendDigestAction,
  type ActionResult,
} from "@/app/actions";

export function TelegramConnect({ connected, botReady }: { connected: boolean; botReady: boolean }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [link, setLink] = useState<string | null>(null);

  const run = (action: () => Promise<ActionResult>, after?: (r: ActionResult) => void) =>
    startTransition(async () => {
      setResult(null);
      const r = await action();
      setResult(r);
      after?.(r);
    });

  const button =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all disabled:cursor-wait disabled:opacity-70";

  if (!botReady) {
    return <p className="text-sm text-muted">The Telegram bot is not configured on this server yet.</p>;
  }

  return (
    <div className="space-y-3">
      {connected ? (
        <>
          <p className="text-sm text-emerald-300">Connected — your daily digest arrives as cards in Telegram.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => sendDigestAction({ force: true }))}
              className={`${button} bg-accent text-white hover:bg-accent/90`}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send me today&apos;s digest
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(disconnectTelegramAction)}
              className={`${button} border border-line bg-white/[0.03] text-muted hover:text-foreground`}
            >
              <Unplug className="h-4 w-4" /> Disconnect
            </button>
          </div>
        </>
      ) : (
        <>
          <ol className="list-decimal space-y-1 pl-4 text-sm text-muted">
            <li>Click “Connect Telegram” — the bot opens in a new tab.</li>
            <li>Press <span className="text-foreground">Start</span> in Telegram.</li>
            <li>Come back and click “Check connection”.</li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(connectTelegramAction, (r) => {
                  if (r.url) {
                    setLink(r.url);
                    window.open(r.url, "_blank", "noopener,noreferrer");
                  }
                })
              }
              className={`${button} bg-accent text-white hover:bg-accent/90`}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Connect Telegram
            </button>
            {link && (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(checkTelegramAction)}
                  className={`${button} border border-line bg-white/[0.03] text-foreground hover:bg-white/[0.07]`}
                >
                  Check connection
                </button>
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 self-center text-xs text-accent"
                >
                  Open bot again <ExternalLink className="h-3 w-3" />
                </a>
              </>
            )}
          </div>
        </>
      )}
      {result && (
        <p className={`text-xs leading-relaxed ${result.ok ? "text-emerald-300" : "text-rose-300"}`}>{result.message}</p>
      )}
    </div>
  );
}

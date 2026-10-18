/**
 * Public brand config — matches InsightLoop UI design.
 * Secrets stay in env; never import private keys into client code.
 */
export const appConfig = {
  name: "InsightLoop",
  tagline: "AI Research & Newsletter",
  urls: {
    app: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    n8n: process.env.NEXT_PUBLIC_N8N_URL ?? "http://localhost:5678",
  },
} as const;

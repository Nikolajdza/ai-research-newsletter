import Groq from "groq-sdk";
import {
  articleAnalysisSchema,
  type ArticleAnalysisOutput,
} from "./schema";
import { buildAnalysisSystemPrompt, buildAnalysisUserPrompt } from "./prompt";
import type { TopicKey } from "../db/schema";
import { estimateCostUsd } from "./groq";

export type LlmProvider = "groq" | "gemini" | "openrouter";

export type AnalysisLlmResult = {
  output: ArticleAnalysisOutput;
  model: string;
  provider: LlmProvider;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
  rawText: string;
};

type CompletionResult = {
  provider: LlmProvider;
  model: string;
  rawText: string;
  promptTokens: number;
  completionTokens: number;
};

const RATE_LIMIT_ATTEMPTS = 4;
const MAX_RATE_LIMIT_WAIT_MS = 20_000;

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Model response did not contain JSON object");
    }
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message.slice(0, 200);
  return String(err).slice(0, 200);
}

function groqKey(): string | undefined {
  return process.env.GROQ_API_KEY_NEWSLETTER || process.env.GROQ_API_KEY || undefined;
}

function geminiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || undefined;
}

function openrouterKey(): string | undefined {
  return process.env.OPENROUTER_API_KEY || undefined;
}

/** Providers that have keys, in failover order. */
export function configuredProviders(): LlmProvider[] {
  const order = (process.env.LLM_PROVIDER_ORDER ?? "groq,gemini,openrouter")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is LlmProvider => s === "groq" || s === "gemini" || s === "openrouter");

  return order.filter((p) => {
    if (p === "groq") return Boolean(groqKey());
    if (p === "gemini") return Boolean(geminiKey());
    return Boolean(openrouterKey());
  });
}

export function llmConfigured(): boolean {
  return configuredProviders().length > 0;
}

/** Short status string for Settings / Workflow. */
export function llmStatusLabel(): string {
  const providers = configuredProviders();
  if (!providers.length) return "none";
  const primary = providers[0]!;
  const model =
    primary === "groq"
      ? (process.env.GROQ_MODEL ?? "openai/gpt-oss-120b")
      : primary === "gemini"
        ? (process.env.GEMINI_MODEL ?? "gemini-2.0-flash")
        : (process.env.OPENROUTER_MODEL ?? "google/gemini-2.0-flash-001");
  const failover = providers.length > 1 ? ` · failover: ${providers.slice(1).join("→")}` : "";
  return `${primary}/${model}${failover}`;
}

async function withRateLimitRetry<T>(call: () => Promise<T>, isRateLimit: (err: unknown) => boolean): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await call();
    } catch (err) {
      if (!isRateLimit(err) || attempt >= RATE_LIMIT_ATTEMPTS) throw err;
      const msg = errorMessage(err);
      const hinted = /try again in ([\d.]+)s/i.exec(msg)?.[1];
      const waitMs = Math.min(MAX_RATE_LIMIT_WAIT_MS, hinted ? Number(hinted) * 1000 + 500 : 5000 * attempt);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}

async function completeGroq(system: string, user: string): Promise<CompletionResult> {
  const apiKey = groqKey();
  if (!apiKey) throw new Error("Groq API key missing");
  const model = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
  const client = new Groq({ apiKey, maxRetries: 0 });

  const completion = await withRateLimitRetry(
    () =>
      client.chat.completions.create({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    (err) => err instanceof Groq.APIError && err.status === 429,
  );

  const rawText = completion.choices[0]?.message?.content ?? "";
  if (!rawText) throw new Error("Empty completion from Groq");
  return {
    provider: "groq",
    model,
    rawText,
    promptTokens: completion.usage?.prompt_tokens ?? 0,
    completionTokens: completion.usage?.completion_tokens ?? 0,
  };
}

async function completeGemini(system: string, user: string): Promise<CompletionResult> {
  const apiKey = geminiKey();
  if (!apiKey) throw new Error("Gemini API key missing");
  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await withRateLimitRetry(
    async () => {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      });
      if (response.status === 429) {
        const body = await response.text();
        throw Object.assign(new Error(`Gemini rate limited: ${body.slice(0, 120)}`), { status: 429 });
      }
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Gemini ${response.status}: ${body.slice(0, 200)}`);
      }
      return response.json() as Promise<{
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      }>;
    },
    (err) => typeof err === "object" && err !== null && "status" in err && (err as { status: number }).status === 429,
  );

  const rawText = res.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!rawText) throw new Error("Empty completion from Gemini");
  return {
    provider: "gemini",
    model: `gemini/${model}`,
    rawText,
    promptTokens: res.usageMetadata?.promptTokenCount ?? 0,
    completionTokens: res.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

async function completeOpenRouter(system: string, user: string): Promise<CompletionResult> {
  const apiKey = openrouterKey();
  if (!apiKey) throw new Error("OpenRouter API key missing");
  const model = process.env.OPENROUTER_MODEL ?? "google/gemini-2.0-flash-001";

  const res = await withRateLimitRetry(
    async () => {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://insightloop.app",
          "X-Title": "InsightLoop",
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (response.status === 429) {
        const body = await response.text();
        throw Object.assign(new Error(`OpenRouter rate limited: ${body.slice(0, 120)}`), { status: 429 });
      }
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`OpenRouter ${response.status}: ${body.slice(0, 200)}`);
      }
      return response.json() as Promise<{
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      }>;
    },
    (err) => typeof err === "object" && err !== null && "status" in err && (err as { status: number }).status === 429,
  );

  const rawText = res.choices?.[0]?.message?.content ?? "";
  if (!rawText) throw new Error("Empty completion from OpenRouter");
  return {
    provider: "openrouter",
    model: `openrouter/${model}`,
    rawText,
    promptTokens: res.usage?.prompt_tokens ?? 0,
    completionTokens: res.usage?.completion_tokens ?? 0,
  };
}

async function completeWithFailover(system: string, user: string): Promise<CompletionResult> {
  const providers = configuredProviders();
  if (!providers.length) {
    throw new Error("No LLM provider configured (set GROQ_API_KEY_NEWSLETTER, GEMINI_API_KEY, or OPENROUTER_API_KEY)");
  }

  const errors: string[] = [];
  for (const provider of providers) {
    try {
      if (provider === "groq") return await completeGroq(system, user);
      if (provider === "gemini") return await completeGemini(system, user);
      return await completeOpenRouter(system, user);
    } catch (err) {
      errors.push(`${provider}: ${errorMessage(err)}`);
    }
  }
  throw new Error(`All LLM providers failed — ${errors.join(" · ")}`);
}

/** One JSON-mode completion with provider failover. */
export async function llmJson(system: string, user: string): Promise<unknown> {
  const completion = await completeWithFailover(system, user);
  return extractJson(completion.rawText);
}

export async function analyzeArticleWithLlm(input: {
  title: string;
  url: string;
  topic: TopicKey;
  excerpt: string | null;
  sourceName: string;
  selectedTopics: TopicKey[];
}): Promise<AnalysisLlmResult> {
  const completion = await completeWithFailover(buildAnalysisSystemPrompt(), buildAnalysisUserPrompt(input));
  const output = articleAnalysisSchema.parse(extractJson(completion.rawText));

  return {
    output,
    model: completion.model,
    provider: completion.provider,
    promptTokens: completion.promptTokens,
    completionTokens: completion.completionTokens,
    estimatedCostUsd: estimateCostUsd(completion.model, completion.promptTokens, completion.completionTokens),
    rawText: completion.rawText,
  };
}

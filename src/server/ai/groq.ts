import Groq from "groq-sdk";
import {
  articleAnalysisSchema,
  type ArticleAnalysisOutput,
} from "./schema";
import { buildAnalysisSystemPrompt, buildAnalysisUserPrompt } from "./prompt";
import type { TopicKey } from "../db/schema";

export const DEFAULT_ANALYSIS_MODEL =
  process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";

/** Rough public list prices (USD / 1M tokens) for cost tracking — update as needed. */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "openai/gpt-oss-120b": { input: 0.15, output: 0.6 },
  "openai/gpt-oss-20b": { input: 0.1, output: 0.5 },
};

export type AnalysisLlmResult = {
  output: ArticleAnalysisOutput;
  model: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
  rawText: string;
};

function getGroqApiKey(): string {
  const apiKey =
    process.env.GROQ_API_KEY_NEWSLETTER ?? process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY_NEWSLETTER is not set");
  }
  return apiKey;
}

function getClient(): Groq {
  return new Groq({ apiKey: getGroqApiKey(), maxRetries: 0 });
}

const RATE_LIMIT_ATTEMPTS = 4;
const MAX_RATE_LIMIT_WAIT_MS = 20_000;

/** Free-tier Groq has a low tokens-per-minute cap; wait out 429s instead of failing the article. */
async function withRateLimitRetry<T>(call: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await call();
    } catch (err) {
      if (!(err instanceof Groq.APIError) || err.status !== 429 || attempt >= RATE_LIMIT_ATTEMPTS) throw err;
      const hinted = /try again in ([\d.]+)s/i.exec(err.message)?.[1];
      const waitMs = Math.min(MAX_RATE_LIMIT_WAIT_MS, hinted ? Number(hinted) * 1000 + 500 : 5000 * attempt);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}

export function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const pricing = MODEL_PRICING[model] ?? { input: 0.5, output: 0.5 };
  return (
    (promptTokens / 1_000_000) * pricing.input +
    (completionTokens / 1_000_000) * pricing.output
  );
}

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

/** One JSON-mode completion; the caller validates the shape. */
export async function groqJson(system: string, user: string): Promise<unknown> {
  const completion = await withRateLimitRetry(() =>
    getClient().chat.completions.create({
      model: DEFAULT_ANALYSIS_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  );
  return extractJson(completion.choices[0]?.message?.content ?? "");
}

export async function analyzeArticleWithGroq(input: {
  title: string;
  url: string;
  topic: TopicKey;
  excerpt: string | null;
  sourceName: string;
  selectedTopics: TopicKey[];
  model?: string;
}): Promise<AnalysisLlmResult> {
  const model = input.model ?? DEFAULT_ANALYSIS_MODEL;
  const client = getClient();

  const completion = await withRateLimitRetry(() =>
    client.chat.completions.create({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildAnalysisSystemPrompt() },
        { role: "user", content: buildAnalysisUserPrompt(input) },
      ],
    }),
  );

  const rawText = completion.choices[0]?.message?.content ?? "";
  if (!rawText) {
    throw new Error("Empty completion from Groq");
  }

  const parsed = extractJson(rawText);
  const output = articleAnalysisSchema.parse(parsed);

  const promptTokens = completion.usage?.prompt_tokens ?? 0;
  const completionTokens = completion.usage?.completion_tokens ?? 0;

  return {
    output,
    model,
    promptTokens,
    completionTokens,
    estimatedCostUsd: estimateCostUsd(model, promptTokens, completionTokens),
    rawText,
  };
}

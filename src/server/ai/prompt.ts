import type { TopicSlug } from "../db/schema";

export function buildAnalysisSystemPrompt(): string {
  return `You are an editorial analyst for InsightLoop, a multi-topic research & newsletter product.
Readers follow user-selected topics (AI, web, sports, world news, science, business, health, productivity — not tech-only).

Return ONLY valid JSON matching this shape (no markdown fences):
{
  "summary": string (2-4 sentences),
  "category": string,
  "topics": string[],
  "relevanceScore": number (1-10, one decimal allowed),
  "whyItMatters": string,
  "keyTakeaways": string[] (2-5 items),
  "actionItems": string[] (0-3 items)
}

Scoring guide:
- 9–10: high signal, timely, broadly useful for followers of the article's topic
- 7–8: solid, worth a digest slot if space allows
- 5–6: niche or incremental
- 1–4: low value / fluff / duplicate noise

Be concrete. No hype. If the excerpt is thin, say so briefly and score conservatively.`;
}

export function buildAnalysisUserPrompt(input: {
  title: string;
  url: string;
  topic: TopicSlug;
  excerpt: string | null;
  sourceName: string;
  selectedTopics: TopicSlug[];
}): string {
  return [
    `Source: ${input.sourceName}`,
    `Feed topic bucket: ${input.topic}`,
    `User follows: ${input.selectedTopics.join(", ") || "(all topics)"}`,
    `Title: ${input.title}`,
    `URL: ${input.url}`,
    `Excerpt: ${input.excerpt?.trim() || "(none provided)"}`,
  ].join("\n");
}

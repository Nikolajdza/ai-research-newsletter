import { topicMeta, type TopicKey } from "@/lib/topics";

export function buildAnalysisSystemPrompt(): string {
  return `You are an editorial analyst for InsightLoop, a multi-topic research & newsletter product.
Readers follow any mix of topics — tech, money, sports, world news, science, culture, and niche interests they define themselves.

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

The score is relevance to the "Feed topic" first, quality second. If the article is not actually about the feed topic
(e.g. a general gaming story in a feed for one specific game), score it 3 or lower no matter how good it is.

Scoring guide:
- 9–10: high signal, timely, broadly useful for followers of the article's topic
- 7–8: solid, worth a digest slot if space allows
- 5–6: niche or incremental
- 1–4: low value / fluff / duplicate noise / off-topic for the feed topic

Be concrete. No hype. If the excerpt is thin, say so briefly and score conservatively.`;
}

export function buildAnalysisUserPrompt(input: {
  title: string;
  url: string;
  topic: TopicKey;
  excerpt: string | null;
  sourceName: string;
  selectedTopics: TopicKey[];
}): string {
  return [
    `Source: ${input.sourceName}`,
    `Feed topic: ${topicMeta(input.topic).label}`,
    `Readers follow: ${input.selectedTopics.map((t) => topicMeta(t).label).join(", ") || "(all topics)"}`,
    `Title: ${input.title}`,
    `URL: ${input.url}`,
    `Excerpt: ${input.excerpt?.trim() || "(none provided)"}`,
  ].join("\n");
}

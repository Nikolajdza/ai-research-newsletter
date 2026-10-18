import { z } from "zod";

/** Structured LLM output — validated before persist. */
export const articleAnalysisSchema = z.object({
  summary: z
    .string()
    .min(40)
    .max(800)
    .describe("2–4 sentence neutral summary of the article"),
  category: z
    .string()
    .min(2)
    .max(40)
    .describe("Primary category label, e.g. AI/Tech, Sports, World"),
  topics: z
    .array(z.string().min(1).max(40))
    .min(1)
    .max(8)
    .describe("Short topic tags"),
  relevanceScore: z
    .number()
    .min(1)
    .max(10)
    .describe(
      "1–10 relevance to a curious generalist who follows the selected topics",
    ),
  whyItMatters: z
    .string()
    .min(20)
    .max(400)
    .describe("One short paragraph on why a reader should care"),
  keyTakeaways: z
    .array(z.string().min(8).max(200))
    .min(2)
    .max(5)
    .describe("Concrete takeaways"),
  actionItems: z
    .array(z.string().min(8).max(200))
    .max(3)
    .optional()
    .default([])
    .describe("Optional practical next steps; empty if none"),
});

export type ArticleAnalysisOutput = z.infer<typeof articleAnalysisSchema>;

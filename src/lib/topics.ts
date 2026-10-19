export const TOPIC_SLUGS = [
  "ai-ml",
  "web-dev",
  "business",
  "sports",
  "world",
  "science",
  "health",
  "productivity",
] as const;

export type TopicSlug = (typeof TOPIC_SLUGS)[number];

/** Starting topics for a new account. */
export const DEFAULT_TOPICS: readonly TopicSlug[] = ["ai-ml", "web-dev", "business", "sports", "world", "science"];

type TopicMeta = {
  label: string;
  emoji: string;
  chip: string;
  thumb: string;
};

export const TOPICS: Record<TopicSlug, TopicMeta> = {
  "ai-ml": {
    label: "AI / Tech",
    emoji: "🤖",
    chip: "bg-violet-500/15 text-violet-200 ring-violet-400/25",
    thumb: "from-violet-600 via-indigo-700 to-slate-950",
  },
  "web-dev": {
    label: "Web Development",
    emoji: "💻",
    chip: "bg-sky-500/15 text-sky-200 ring-sky-400/25",
    thumb: "from-sky-600 via-blue-800 to-slate-950",
  },
  business: {
    label: "Business",
    emoji: "💼",
    chip: "bg-amber-500/15 text-amber-200 ring-amber-400/25",
    thumb: "from-amber-500 via-orange-800 to-slate-950",
  },
  sports: {
    label: "Sports",
    emoji: "🏆",
    chip: "bg-orange-500/15 text-orange-200 ring-orange-400/25",
    thumb: "from-orange-500 via-rose-800 to-slate-950",
  },
  world: {
    label: "World",
    emoji: "🌍",
    chip: "bg-teal-500/15 text-teal-200 ring-teal-400/25",
    thumb: "from-teal-500 via-emerald-800 to-slate-950",
  },
  science: {
    label: "Science",
    emoji: "🔭",
    chip: "bg-cyan-500/15 text-cyan-200 ring-cyan-400/25",
    thumb: "from-cyan-500 via-sky-800 to-slate-950",
  },
  health: {
    label: "Health & Fitness",
    emoji: "🩺",
    chip: "bg-rose-500/15 text-rose-200 ring-rose-400/25",
    thumb: "from-rose-500 via-pink-800 to-slate-950",
  },
  productivity: {
    label: "Productivity",
    emoji: "⚡",
    chip: "bg-lime-500/15 text-lime-200 ring-lime-400/25",
    thumb: "from-lime-500 via-green-800 to-slate-950",
  },
};

export function isTopicSlug(value: string): value is TopicSlug {
  return (TOPIC_SLUGS as readonly string[]).includes(value);
}

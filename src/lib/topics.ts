export const TOPIC_SLUGS = [
  "ai-ml",
  "web-dev",
  "cybersecurity",
  "startups",
  "gaming",
  "business",
  "markets",
  "crypto",
  "sports",
  "football",
  "basketball",
  "tennis",
  "motorsport",
  "world",
  "science",
  "space",
  "climate",
  "health",
  "productivity",
  "movies-tv",
  "music",
  "design",
  "cars",
  "food",
  "travel",
] as const;

/** A curated topic from the catalog below. */
export type TopicSlug = (typeof TOPIC_SLUGS)[number];

/** Any topic key stored in the DB: a curated slug or a reader-created `c-…` slug. */
export type TopicKey = string;

export const CUSTOM_TOPIC_PREFIX = "c-";

/** Starting topics for a new account. */
export const DEFAULT_TOPICS: readonly TopicSlug[] = ["ai-ml", "web-dev", "business", "sports", "world", "science"];

export const TOPIC_GROUPS = ["Tech", "Money", "Sports", "World & Science", "Culture & Life"] as const;
export type TopicGroup = (typeof TOPIC_GROUPS)[number] | "Your topics";

export type TopicMeta = {
  label: string;
  emoji: string;
  group: TopicGroup;
  chip: string;
  thumb: string;
};

export const TOPICS: Record<TopicSlug, TopicMeta> = {
  "ai-ml": { label: "AI / Tech", emoji: "🤖", group: "Tech", chip: "bg-violet-500/15 text-violet-200 ring-violet-400/25", thumb: "from-violet-600 via-indigo-700 to-slate-950" },
  "web-dev": { label: "Web Development", emoji: "💻", group: "Tech", chip: "bg-sky-500/15 text-sky-200 ring-sky-400/25", thumb: "from-sky-600 via-blue-800 to-slate-950" },
  cybersecurity: { label: "Cybersecurity", emoji: "🛡️", group: "Tech", chip: "bg-red-500/15 text-red-200 ring-red-400/25", thumb: "from-red-600 via-rose-900 to-slate-950" },
  startups: { label: "Startups", emoji: "🚀", group: "Tech", chip: "bg-fuchsia-500/15 text-fuchsia-200 ring-fuchsia-400/25", thumb: "from-fuchsia-600 via-purple-800 to-slate-950" },
  gaming: { label: "Gaming", emoji: "🎮", group: "Tech", chip: "bg-indigo-500/15 text-indigo-200 ring-indigo-400/25", thumb: "from-indigo-500 via-violet-800 to-slate-950" },
  business: { label: "Business", emoji: "💼", group: "Money", chip: "bg-amber-500/15 text-amber-200 ring-amber-400/25", thumb: "from-amber-500 via-orange-800 to-slate-950" },
  markets: { label: "Markets", emoji: "📈", group: "Money", chip: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/25", thumb: "from-emerald-500 via-green-800 to-slate-950" },
  crypto: { label: "Crypto", emoji: "₿", group: "Money", chip: "bg-yellow-500/15 text-yellow-200 ring-yellow-400/25", thumb: "from-yellow-500 via-amber-800 to-slate-950" },
  sports: { label: "Sports", emoji: "🏆", group: "Sports", chip: "bg-orange-500/15 text-orange-200 ring-orange-400/25", thumb: "from-orange-500 via-rose-800 to-slate-950" },
  football: { label: "Football", emoji: "⚽", group: "Sports", chip: "bg-green-500/15 text-green-200 ring-green-400/25", thumb: "from-green-600 via-emerald-900 to-slate-950" },
  basketball: { label: "Basketball", emoji: "🏀", group: "Sports", chip: "bg-orange-500/15 text-orange-200 ring-orange-400/25", thumb: "from-orange-600 via-amber-900 to-slate-950" },
  tennis: { label: "Tennis", emoji: "🎾", group: "Sports", chip: "bg-lime-500/15 text-lime-200 ring-lime-400/25", thumb: "from-lime-500 via-green-800 to-slate-950" },
  motorsport: { label: "Formula 1 & Motorsport", emoji: "🏎️", group: "Sports", chip: "bg-rose-500/15 text-rose-200 ring-rose-400/25", thumb: "from-rose-600 via-red-900 to-slate-950" },
  world: { label: "World", emoji: "🌍", group: "World & Science", chip: "bg-teal-500/15 text-teal-200 ring-teal-400/25", thumb: "from-teal-500 via-emerald-800 to-slate-950" },
  science: { label: "Science", emoji: "🔭", group: "World & Science", chip: "bg-cyan-500/15 text-cyan-200 ring-cyan-400/25", thumb: "from-cyan-500 via-sky-800 to-slate-950" },
  space: { label: "Space", emoji: "🛰️", group: "World & Science", chip: "bg-blue-500/15 text-blue-200 ring-blue-400/25", thumb: "from-blue-700 via-indigo-950 to-black" },
  climate: { label: "Climate", emoji: "🌱", group: "World & Science", chip: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/25", thumb: "from-emerald-600 via-teal-900 to-slate-950" },
  health: { label: "Health & Fitness", emoji: "🩺", group: "Culture & Life", chip: "bg-rose-500/15 text-rose-200 ring-rose-400/25", thumb: "from-rose-500 via-pink-800 to-slate-950" },
  productivity: { label: "Productivity", emoji: "⚡", group: "Culture & Life", chip: "bg-lime-500/15 text-lime-200 ring-lime-400/25", thumb: "from-lime-500 via-green-800 to-slate-950" },
  "movies-tv": { label: "Movies & TV", emoji: "🎬", group: "Culture & Life", chip: "bg-pink-500/15 text-pink-200 ring-pink-400/25", thumb: "from-pink-600 via-fuchsia-900 to-slate-950" },
  music: { label: "Music", emoji: "🎧", group: "Culture & Life", chip: "bg-purple-500/15 text-purple-200 ring-purple-400/25", thumb: "from-purple-600 via-violet-900 to-slate-950" },
  design: { label: "Design", emoji: "🎨", group: "Culture & Life", chip: "bg-orange-500/15 text-orange-200 ring-orange-400/25", thumb: "from-orange-400 via-pink-800 to-slate-950" },
  cars: { label: "Cars & EVs", emoji: "🚗", group: "Culture & Life", chip: "bg-slate-500/15 text-slate-200 ring-slate-400/25", thumb: "from-slate-500 via-zinc-800 to-black" },
  food: { label: "Food", emoji: "🍜", group: "Culture & Life", chip: "bg-amber-500/15 text-amber-200 ring-amber-400/25", thumb: "from-amber-500 via-red-900 to-slate-950" },
  travel: { label: "Travel", emoji: "✈️", group: "Culture & Life", chip: "bg-sky-500/15 text-sky-200 ring-sky-400/25", thumb: "from-sky-500 via-cyan-800 to-slate-950" },
};

const CUSTOM_PALETTE: Pick<TopicMeta, "chip" | "thumb">[] = [
  { chip: "bg-violet-500/15 text-violet-200 ring-violet-400/25", thumb: "from-violet-500 via-purple-900 to-slate-950" },
  { chip: "bg-teal-500/15 text-teal-200 ring-teal-400/25", thumb: "from-teal-500 via-cyan-900 to-slate-950" },
  { chip: "bg-rose-500/15 text-rose-200 ring-rose-400/25", thumb: "from-rose-500 via-pink-900 to-slate-950" },
  { chip: "bg-amber-500/15 text-amber-200 ring-amber-400/25", thumb: "from-amber-500 via-orange-900 to-slate-950" },
  { chip: "bg-sky-500/15 text-sky-200 ring-sky-400/25", thumb: "from-sky-500 via-blue-900 to-slate-950" },
];

export function isTopicSlug(value: string): value is TopicSlug {
  return (TOPIC_SLUGS as readonly string[]).includes(value);
}

export function isCustomTopic(key: string): boolean {
  return key.startsWith(CUSTOM_TOPIC_PREFIX);
}

/** "Formula 1 Rumors" → "c-Formula-1-Rumors". Case is kept so the label can be read back from the key. */
export function customTopicKey(label: string): TopicKey {
  const body = label
    .normalize("NFC")
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${CUSTOM_TOPIC_PREFIX}${body}`;
}

/** Display metadata for any topic key, curated or reader-created. */
export function topicMeta(key: TopicKey): TopicMeta {
  if (isTopicSlug(key)) return TOPICS[key];
  const label = isCustomTopic(key) ? key.slice(CUSTOM_TOPIC_PREFIX.length).replaceAll("-", " ") : key;
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return { label, emoji: "🔎", group: "Your topics", ...CUSTOM_PALETTE[hash % CUSTOM_PALETTE.length] };
}

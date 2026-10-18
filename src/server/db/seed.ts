import "dotenv/config";
import { inArray, sql } from "drizzle-orm";
import { db } from "./client";
import { preferences, sources, type TopicSlug } from "./schema";

const SEED_SOURCES: {
  name: string;
  feedUrl: string;
  siteUrl: string;
  topic: TopicSlug;
}[] = [
  { name: "Hacker News", feedUrl: "https://hnrss.org/frontpage", siteUrl: "https://news.ycombinator.com", topic: "ai-ml" },
  { name: "OpenAI News", feedUrl: "https://openai.com/news/rss.xml", siteUrl: "https://openai.com/news", topic: "ai-ml" },
  { name: "MIT Tech Review AI", feedUrl: "https://www.technologyreview.com/topic/artificial-intelligence/feed", siteUrl: "https://www.technologyreview.com", topic: "ai-ml" },
  { name: "React Blog", feedUrl: "https://react.dev/rss.xml", siteUrl: "https://react.dev/blog", topic: "web-dev" },
  { name: "Next.js Blog", feedUrl: "https://nextjs.org/feed.xml", siteUrl: "https://nextjs.org/blog", topic: "web-dev" },
  { name: "CSS-Tricks", feedUrl: "https://css-tricks.com/feed/", siteUrl: "https://css-tricks.com", topic: "web-dev" },
  { name: "The Verge", feedUrl: "https://www.theverge.com/rss/index.xml", siteUrl: "https://www.theverge.com", topic: "business" },
  { name: "TechCrunch", feedUrl: "https://techcrunch.com/feed/", siteUrl: "https://techcrunch.com", topic: "business" },
  { name: "BBC World", feedUrl: "https://feeds.bbci.co.uk/news/world/rss.xml", siteUrl: "https://www.bbc.com/news/world", topic: "world" },
  { name: "NPR News", feedUrl: "https://feeds.npr.org/1001/rss.xml", siteUrl: "https://www.npr.org", topic: "world" },
  { name: "Al Jazeera", feedUrl: "https://www.aljazeera.com/xml/rss/all.xml", siteUrl: "https://www.aljazeera.com", topic: "world" },
  { name: "BBC Sport", feedUrl: "https://feeds.bbci.co.uk/sport/rss.xml", siteUrl: "https://www.bbc.com/sport", topic: "sports" },
  { name: "ESPN Top", feedUrl: "https://www.espn.com/espn/rss/news", siteUrl: "https://www.espn.com", topic: "sports" },
  { name: "ScienceDaily", feedUrl: "https://www.sciencedaily.com/rss/top/science.xml", siteUrl: "https://www.sciencedaily.com", topic: "science" },
  { name: "Space.com", feedUrl: "https://www.space.com/feeds.xml", siteUrl: "https://www.space.com", topic: "science" },
  { name: "ScienceDaily Health", feedUrl: "https://www.sciencedaily.com/rss/health_medicine.xml", siteUrl: "https://www.sciencedaily.com", topic: "health" },
  { name: "BBC Health", feedUrl: "https://feeds.bbci.co.uk/news/health/rss.xml", siteUrl: "https://www.bbc.com/news/health", topic: "health" },
  { name: "Lifehacker", feedUrl: "https://lifehacker.com/feed/rss", siteUrl: "https://lifehacker.com", topic: "productivity" },
];

/** Feeds that moved or died — kept in DB for history but disabled. */
const RETIRED_FEED_URLS = [
  "https://openai.com/blog/rss.xml",
  "https://www.nasa.gov/rss/dyn/breaking_news.rss",
  "https://www.nasa.gov/news-release/feed/",
];

async function seed() {
  console.log("Seeding sources…");

  await db
    .insert(sources)
    .values(SEED_SOURCES)
    .onConflictDoUpdate({
      target: sources.feedUrl,
      set: {
        name: sql`excluded.name`,
        siteUrl: sql`excluded.site_url`,
        topic: sql`excluded.topic`,
      },
    });

  await db
    .update(sources)
    .set({ enabled: false })
    .where(inArray(sources.feedUrl, RETIRED_FEED_URLS));

  const existingPrefs = await db.select().from(preferences).limit(1);
  if (existingPrefs.length === 0) {
    await db.insert(preferences).values({
      selectedTopics: ["ai-ml", "web-dev", "sports", "world", "science", "business"],
      minRelevanceScore: 6,
      digestHourLocal: 7,
      timezone: "Europe/Belgrade",
      digestFormat: "detailed",
      telegramEnabled: true,
      emailEnabled: false,
    });
    console.log("Inserted default preferences (multi-topic).");
  } else {
    console.log("Preferences already present — skipped.");
  }

  const allSources = await db.select().from(sources);
  console.log(`Sources in DB: ${allSources.length}`);
  for (const s of allSources) {
    console.log(`  [${s.topic}] ${s.name} — enabled=${s.enabled}`);
  }

  console.log("Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

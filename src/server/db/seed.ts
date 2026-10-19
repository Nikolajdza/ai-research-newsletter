import "dotenv/config";
import { inArray, sql } from "drizzle-orm";
import { db } from "./client";
import { sources, type TopicSlug } from "./schema";

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
  { name: "The Hacker News", feedUrl: "https://feeds.feedburner.com/TheHackersNews", siteUrl: "https://thehackernews.com", topic: "cybersecurity" },
  { name: "Krebs on Security", feedUrl: "https://krebsonsecurity.com/feed/", siteUrl: "https://krebsonsecurity.com", topic: "cybersecurity" },
  { name: "BleepingComputer", feedUrl: "https://www.bleepingcomputer.com/feed/", siteUrl: "https://www.bleepingcomputer.com", topic: "cybersecurity" },
  { name: "TechCrunch Startups", feedUrl: "https://techcrunch.com/category/startups/feed/", siteUrl: "https://techcrunch.com/category/startups", topic: "startups" },
  { name: "Hacker News (YC)", feedUrl: "https://news.ycombinator.com/rss", siteUrl: "https://news.ycombinator.com", topic: "startups" },
  { name: "IGN", feedUrl: "https://feeds.feedburner.com/ign/all", siteUrl: "https://www.ign.com", topic: "gaming" },
  { name: "PC Gamer", feedUrl: "https://www.pcgamer.com/rss/", siteUrl: "https://www.pcgamer.com", topic: "gaming" },
  { name: "Polygon", feedUrl: "https://www.polygon.com/rss/index.xml", siteUrl: "https://www.polygon.com", topic: "gaming" },
  { name: "CNBC Markets", feedUrl: "https://www.cnbc.com/id/100003114/device/rss/rss.html", siteUrl: "https://www.cnbc.com", topic: "markets" },
  { name: "MarketWatch", feedUrl: "https://feeds.marketwatch.com/marketwatch/topstories/", siteUrl: "https://www.marketwatch.com", topic: "markets" },
  { name: "Cointelegraph", feedUrl: "https://cointelegraph.com/rss", siteUrl: "https://cointelegraph.com", topic: "crypto" },
  { name: "Decrypt", feedUrl: "https://decrypt.co/feed", siteUrl: "https://decrypt.co", topic: "crypto" },
  { name: "CoinDesk", feedUrl: "https://www.coindesk.com/arc/outboundfeeds/rss/", siteUrl: "https://www.coindesk.com", topic: "crypto" },
  { name: "BBC Football", feedUrl: "https://feeds.bbci.co.uk/sport/football/rss.xml", siteUrl: "https://www.bbc.com/sport/football", topic: "football" },
  { name: "Guardian Football", feedUrl: "https://www.theguardian.com/football/rss", siteUrl: "https://www.theguardian.com/football", topic: "football" },
  { name: "ESPN NBA", feedUrl: "https://www.espn.com/espn/rss/nba/news", siteUrl: "https://www.espn.com/nba", topic: "basketball" },
  { name: "BBC Basketball", feedUrl: "https://feeds.bbci.co.uk/sport/basketball/rss.xml", siteUrl: "https://www.bbc.com/sport/basketball", topic: "basketball" },
  { name: "BBC Tennis", feedUrl: "https://feeds.bbci.co.uk/sport/tennis/rss.xml", siteUrl: "https://www.bbc.com/sport/tennis", topic: "tennis" },
  { name: "ESPN Tennis", feedUrl: "https://www.espn.com/espn/rss/tennis/news", siteUrl: "https://www.espn.com/tennis", topic: "tennis" },
  { name: "Motorsport.com F1", feedUrl: "https://www.motorsport.com/rss/f1/news/", siteUrl: "https://www.motorsport.com/f1", topic: "motorsport" },
  { name: "Autosport F1", feedUrl: "https://www.autosport.com/rss/f1/news/", siteUrl: "https://www.autosport.com/f1", topic: "motorsport" },
  { name: "The Race", feedUrl: "https://www.the-race.com/feed/", siteUrl: "https://www.the-race.com", topic: "motorsport" },
  { name: "SpaceNews", feedUrl: "https://spacenews.com/feed/", siteUrl: "https://spacenews.com", topic: "space" },
  { name: "Guardian Climate", feedUrl: "https://www.theguardian.com/environment/climate-crisis/rss", siteUrl: "https://www.theguardian.com/environment/climate-crisis", topic: "climate" },
  { name: "Inside Climate News", feedUrl: "https://insideclimatenews.org/feed/", siteUrl: "https://insideclimatenews.org", topic: "climate" },
  { name: "Variety", feedUrl: "https://variety.com/feed/", siteUrl: "https://variety.com", topic: "movies-tv" },
  { name: "Guardian Film", feedUrl: "https://www.theguardian.com/film/rss", siteUrl: "https://www.theguardian.com/film", topic: "movies-tv" },
  { name: "Pitchfork News", feedUrl: "https://pitchfork.com/rss/news/", siteUrl: "https://pitchfork.com", topic: "music" },
  { name: "Rolling Stone Music", feedUrl: "https://www.rollingstone.com/music/feed/", siteUrl: "https://www.rollingstone.com/music", topic: "music" },
  { name: "Dezeen", feedUrl: "https://www.dezeen.com/feed/", siteUrl: "https://www.dezeen.com", topic: "design" },
  { name: "Creative Bloq", feedUrl: "https://www.creativebloq.com/feeds/all", siteUrl: "https://www.creativebloq.com", topic: "design" },
  { name: "Electrek", feedUrl: "https://electrek.co/feed/", siteUrl: "https://electrek.co", topic: "cars" },
  { name: "Motor1", feedUrl: "https://www.motor1.com/rss/news/all/", siteUrl: "https://www.motor1.com", topic: "cars" },
  { name: "Eater", feedUrl: "https://www.eater.com/rss/index.xml", siteUrl: "https://www.eater.com", topic: "food" },
  { name: "Guardian Food", feedUrl: "https://www.theguardian.com/food/rss", siteUrl: "https://www.theguardian.com/food", topic: "food" },
  { name: "Condé Nast Traveler", feedUrl: "https://www.cntraveler.com/feed/rss", siteUrl: "https://www.cntraveler.com", topic: "travel" },
  { name: "Guardian Travel", feedUrl: "https://www.theguardian.com/travel/rss", siteUrl: "https://www.theguardian.com/travel", topic: "travel" },
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

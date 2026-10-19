import { sql } from "drizzle-orm";
import { DEFAULT_TOPICS } from "@/lib/topics";
import { db } from "./db/client";
import { preferences, type TopicKey } from "./db/schema";

/** Topics followed by at least one user; the shared pipeline collects and scores these. */
export async function getFollowedTopics(): Promise<TopicKey[]> {
  const rows = await db.execute<{ topic: TopicKey }>(
    sql`select distinct jsonb_array_elements_text(${preferences.selectedTopics}) as topic from ${preferences}`,
  );
  const topics = [...rows].map((r) => r.topic);
  return topics.length ? topics : [...DEFAULT_TOPICS];
}

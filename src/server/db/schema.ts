import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { TopicSlug } from "../../lib/topics";

export { TOPIC_SLUGS, type TopicSlug } from "../../lib/topics";

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    feedUrl: text("feed_url").notNull().unique(),
    siteUrl: text("site_url"),
    /** Primary topic this feed maps to */
    topic: text("topic").notNull().$type<TopicSlug>(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const articles = pgTable(
  "articles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    url: text("url").notNull(),
    /** Normalized URL used for idempotent inserts */
    canonicalUrl: text("canonical_url").notNull().unique(),
    excerpt: text("excerpt"),
    imageUrl: text("image_url"),
    author: text("author"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    /** Topic inherited from source at ingest time */
    topic: text("topic").notNull().$type<TopicSlug>(),
    savedAt: timestamp("saved_at", { withTimezone: true }),
    /** Reader feedback on the AI pick: up | down */
    feedback: text("feedback").$type<"up" | "down">(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

/** Phase 3 fills this; schema ready so ingest can stay stable. */
export const articleAnalyses = pgTable("article_analyses", {
  id: uuid("id").defaultRandom().primaryKey(),
  articleId: uuid("article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "cascade" })
    .unique(),
  summary: text("summary"),
  relevanceScore: real("relevance_score"),
  whyItMatters: text("why_it_matters"),
  topics: jsonb("topics").$type<string[]>().default([]),
  keyTakeaways: jsonb("key_takeaways").$type<string[]>().default([]),
  actionItems: jsonb("action_items").$type<string[]>().default([]),
  model: text("model"),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  analyzedAt: timestamp("analyzed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Single-row prefs for demo (multi-user auth later if needed). */
export const preferences = pgTable("preferences", {
  id: uuid("id").defaultRandom().primaryKey(),
  displayName: text("display_name").notNull().default("Nikola"),
  selectedTopics: jsonb("selected_topics")
    .$type<TopicSlug[]>()
    .notNull()
    .default([]),
  minRelevanceScore: real("min_relevance_score").notNull().default(6),
  digestHourLocal: integer("digest_hour_local").notNull().default(7),
  timezone: text("timezone").notNull().default("Europe/Belgrade"),
  digestFormat: text("digest_format").notNull().default("detailed"),
  telegramEnabled: boolean("telegram_enabled").notNull().default(true),
  emailEnabled: boolean("email_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const ingestRuns = pgTable("ingest_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status").notNull().default("running"),
  sourcesProcessed: integer("sources_processed").notNull().default(0),
  articlesFetched: integer("articles_fetched").notNull().default(0),
  articlesInserted: integer("articles_inserted").notNull().default(0),
  articlesSkipped: integer("articles_skipped").notNull().default(0),
  errorMessage: text("error_message"),
});

/** One digest per calendar day + channel (idempotent daily send). */
export const digests = pgTable(
  "digests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** YYYY-MM-DD in the user's timezone */
    digestDate: text("digest_date").notNull(),
    channel: text("channel").notNull().default("telegram"),
    /** pending | sent | skipped | failed | dry_run */
    status: text("status").notNull().default("pending"),
    format: text("format").notNull().default("detailed"),
    messageText: text("message_text"),
    telegramMessageId: text("telegram_message_id"),
    articleIds: jsonb("article_ids").$type<string[]>().notNull().default([]),
    itemCount: integer("item_count").notNull().default(0),
    errorMessage: text("error_message"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("digests_date_channel_uidx").on(t.digestDate, t.channel)],
);

export const workflowRuns = pgTable("workflow_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().default("daily-digest"),
  /** manual | schedule | cli | api */
  trigger: text("trigger").notNull().default("manual"),
  /** running | completed | completed_with_errors | failed | skipped */
  status: text("status").notNull().default("running"),
  steps: jsonb("steps")
    .$type<
      {
        name: string;
        status: string;
        detail?: string;
        at: string;
      }[]
    >()
    .notNull()
    .default([]),
  digestId: uuid("digest_id").references(() => digests.id, {
    onDelete: "set null",
  }),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

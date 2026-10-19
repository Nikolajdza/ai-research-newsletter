import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { TopicKey } from "../../lib/topics";

export { TOPIC_SLUGS, type TopicKey, type TopicSlug } from "../../lib/topics";

export type UserRole = "admin" | "member";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** Stored lowercased */
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  /** First account becomes admin: manages sources and runs the pipeline. */
  role: text("role").notNull().default("member").$type<UserRole>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessions = pgTable("sessions", {
  /** sha256 of the cookie token, so a DB leak does not leak live sessions */
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    feedUrl: text("feed_url").notNull().unique(),
    siteUrl: text("site_url"),
    /** Primary topic this feed maps to: a curated slug or a reader-created `c-…` key */
    topic: text("topic").notNull().$type<TopicKey>(),
    enabled: boolean("enabled").notNull().default(true),
    /** Set when a reader added the feed through topic discovery; null for the curated catalog */
    addedByUserId: uuid("added_by_user_id").references(() => users.id, { onDelete: "set null" }),
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
    topic: text("topic").notNull().$type<TopicKey>(),
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

/** Per-user reading state; articles and analyses themselves are shared. */
export const userArticles = pgTable(
  "user_articles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    savedAt: timestamp("saved_at", { withTimezone: true }),
    /** Reader feedback on the AI pick */
    feedback: text("feedback").$type<"up" | "down">(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.articleId] })],
);

/** Reader-created topics, shared by key so two readers typing "Formula 1" share feeds and analyses. */
export const customTopics = pgTable("custom_topics", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  /** Search phrase used for the Google News feed */
  query: text("query").notNull(),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const preferences = pgTable("preferences", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  telegramChatId: text("telegram_chat_id"),
  /** One-time token for the t.me/<bot>?start=<token> connect link */
  telegramLinkToken: text("telegram_link_token").unique(),
  selectedTopics: jsonb("selected_topics")
    .$type<TopicKey[]>()
    .notNull()
    .default([]),
  minRelevanceScore: real("min_relevance_score").notNull().default(6),
  digestHourLocal: integer("digest_hour_local").notNull().default(7),
  timezone: text("timezone").notNull().default("Europe/Belgrade"),
  digestFormat: text("digest_format").notNull().default("detailed"),
  telegramEnabled: boolean("telegram_enabled").notNull().default(true),
  emailEnabled: boolean("email_enabled").notNull().default(false),
  /** Null until the reader finishes /welcome. */
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
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

/** One digest per user + calendar day + channel (idempotent daily send). */
export const digests = pgTable(
  "digests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
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
  (t) => [uniqueIndex("digests_user_date_channel_uidx").on(t.userId, t.digestDate, t.channel)],
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

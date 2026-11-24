import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Sql = ReturnType<typeof postgres>;
type Db = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
  postgresClient?: Sql;
  drizzleDb?: Db;
  poolAttached?: boolean;
};

function connectionUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example → .env");

  // Supabase transaction pooler needs the pgbouncer flag when missing.
  if (url.includes("pooler.supabase.com") && !url.includes("pgbouncer=true")) {
    return url.includes("?") ? `${url}&pgbouncer=true` : `${url}?pgbouncer=true`;
  }
  return url;
}

function needsSsl(url: string): boolean {
  return (
    url.includes("neon.tech") ||
    url.includes("supabase.co") ||
    url.includes("sslmode=require") ||
    Boolean(process.env.VERCEL)
  );
}

function createSql(): Sql {
  const url = connectionUrl();
  const onVercel = Boolean(process.env.VERCEL);
  // Neon / Supabase poolers are transaction-mode PgBouncer: never prepare statements.
  // max:1 avoids deadlocks when a request accidentally fires parallel queries on one isolate.
  const client = postgres(url, {
    max: onVercel ? 1 : 10,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: onVercel ? 20 : 20,
    max_lifetime: onVercel ? 60 * 5 : 60 * 30,
    ssl: needsSsl(url) ? "require" : undefined,
    connection: {
      application_name: "insightloop",
    },
  });

  if (onVercel && !globalForDb.poolAttached) {
    try {
      attachDatabasePool(client);
      globalForDb.poolAttached = true;
    } catch {
      // Older runtimes may not support attach — pool still works with short lifetime.
    }
  }

  return client;
}

function createDb(): Db {
  const client = globalForDb.postgresClient ?? createSql();
  globalForDb.postgresClient = client;
  return drizzle(client, { schema });
}

/** Drop cached client so the next query opens a fresh connection (Vercel warm isolates). */
export async function resetDbClient(): Promise<void> {
  const old = globalForDb.postgresClient;
  globalForDb.postgresClient = undefined;
  globalForDb.drizzleDb = undefined;
  globalForDb.poolAttached = false;
  if (old) {
    try {
      await old.end({ timeout: 1 });
    } catch {
      /* ignore */
    }
  }
}

/** Lazy so Next build can import modules without a live DB. */
export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    if (!globalForDb.drizzleDb) {
      globalForDb.drizzleDb = createDb();
    }
    const value = Reflect.get(globalForDb.drizzleDb, prop, receiver);
    return typeof value === "function" ? value.bind(globalForDb.drizzleDb) : value;
  },
});

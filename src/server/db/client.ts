import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Sql = ReturnType<typeof postgres>;
type Db = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
  postgresClient?: Sql;
  drizzleDb?: Db;
};

function connectionUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example → .env");
  // PgBouncer (Supabase transaction pooler) must not use prepared statements.
  if (url.includes("pooler.supabase.com") && !url.includes("pgbouncer=true")) {
    return url.includes("?") ? `${url}&pgbouncer=true` : `${url}?pgbouncer=true`;
  }
  return url;
}

function createSql(): Sql {
  const url = connectionUrl();
  const onVercel = Boolean(process.env.VERCEL);
  return postgres(url, {
    // On Vercel, keep the pool tiny and short-lived. Stale sockets from a warm
    // isolate were leaving every page stuck on its Suspense skeleton.
    max: onVercel ? 3 : 10,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: onVercel ? 5 : 20,
    max_lifetime: onVercel ? 60 : 60 * 30,
    ssl: url.includes("supabase.co") ? "require" : undefined,
  });
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

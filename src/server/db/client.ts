import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
  postgresClient?: ReturnType<typeof postgres>;
  drizzleDb?: Db;
};

function createDb(): Db {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example → .env");
  }

  const isSupabase = connectionString.includes("supabase.co");
  // Transaction pooler + max:1 deadlocks when pages fire Promise.all of several queries
  // (home dashboard does 7+ counts). Allow a small pool; keep prepare off for PgBouncer.
  const client =
    globalForDb.postgresClient ??
    postgres(connectionString, {
      max: process.env.VERCEL ? 5 : 10,
      prepare: false,
      connect_timeout: 15,
      idle_timeout: 20,
      max_lifetime: 60 * 5,
      ssl: isSupabase ? "require" : undefined,
    });

  // Reuse across warm serverless invocations (and local HMR).
  globalForDb.postgresClient = client;

  return drizzle(client, { schema });
}

/** Lazy so Next build can import modules without a live DB. */
export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    if (!globalForDb.drizzleDb) {
      globalForDb.drizzleDb = createDb();
    }
    return Reflect.get(globalForDb.drizzleDb, prop, receiver);
  },
});

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

  const client =
    globalForDb.postgresClient ??
    postgres(connectionString, {
      max: 10,
      prepare: false,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.postgresClient = client;
  }

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

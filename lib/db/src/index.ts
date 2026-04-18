import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const toSafeNumber = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const useSsl = process.env.DATABASE_SSL === "true" || process.env.NODE_ENV === "production";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  max: toSafeNumber(process.env.PG_POOL_MAX, 10),
  idleTimeoutMillis: toSafeNumber(process.env.PG_IDLE_TIMEOUT_MS, 10000),
  connectionTimeoutMillis: toSafeNumber(process.env.PG_CONNECT_TIMEOUT_MS, 5000),
  allowExitOnIdle: true,
});
export const db = drizzle(pool, { schema });

export * from "./schema";

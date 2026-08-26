import { Pool } from "pg";

import { env } from "../lib/env.js";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // Keep each warm serverless instance from opening a large number of
  // connections. Use Neon's pooled connection string in Vercel.
  max: process.env.VERCEL ? 2 : 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

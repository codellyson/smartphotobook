import type { Config } from "drizzle-kit";

// We commit the generated SQL into `migrations/` so wrangler d1 migrations
// apply can pick them up. drizzle-kit is the source of truth for the schema.
export default {
  schema: "./src/db/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
  driver: "d1-http",
} satisfies Config;

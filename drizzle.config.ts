import type { Config } from "drizzle-kit";

const url = process.env.TURSO_DATABASE_URL || "file:local.db";
const isRemote = !url.startsWith("file:");

export default (
  isRemote
    ? {
        schema: "./src/lib/schema.ts",
        out: "./drizzle",
        dialect: "turso",
        dbCredentials: {
          url,
          authToken: process.env.TURSO_AUTH_TOKEN!,
        },
      }
    : {
        schema: "./src/lib/schema.ts",
        out: "./drizzle",
        dialect: "sqlite",
        dbCredentials: {
          url,
        },
      }
) satisfies Config;

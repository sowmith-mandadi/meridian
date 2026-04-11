import "server-only";
import { drizzle } from "drizzle-orm/libsql/node";
import * as schema from "./schema";

const url = process.env.TURSO_DATABASE_URL || "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

export const db = drizzle({
  connection: { url, authToken },
  schema,
});

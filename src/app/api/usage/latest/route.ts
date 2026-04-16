import { db } from "@/lib/db";
import { usageLog } from "@/lib/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const latest = await db
    .select()
    .from(usageLog)
    .orderBy(desc(usageLog.createdAt))
    .limit(1);

  if (latest.length === 0) {
    return Response.json(null);
  }
  return Response.json(latest[0]);
}

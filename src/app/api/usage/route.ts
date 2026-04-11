import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usageLog } from "@/lib/schema";

export async function GET() {
  const rows = await db
    .select()
    .from(usageLog)
    .orderBy(desc(usageLog.createdAt))
    .limit(100);

  return NextResponse.json(rows);
}

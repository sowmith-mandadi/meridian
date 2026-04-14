import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/schema";

export async function GET() {
  const rows = await db
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.createdAt))
    .limit(100);

  return NextResponse.json(rows);
}

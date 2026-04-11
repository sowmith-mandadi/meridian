import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { feedbackRequests } from "@/lib/schema";

export async function GET() {
  const rows = await db
    .select()
    .from(feedbackRequests)
    .orderBy(desc(feedbackRequests.createdAt));

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("requestText" in body) ||
    !("userRole" in body)
  ) {
    return NextResponse.json(
      { error: "Expected requestText and userRole" },
      { status: 400 },
    );
  }

  const { requestText, userRole } = body as {
    requestText: unknown;
    userRole: unknown;
  };

  if (typeof requestText !== "string" || typeof userRole !== "string") {
    return NextResponse.json(
      { error: "requestText and userRole must be strings" },
      { status: 400 },
    );
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const status = "new";

  await db.insert(feedbackRequests).values({
    id,
    userRole,
    requestText,
    status,
    createdAt,
  });

  return NextResponse.json({
    id,
    userRole,
    requestText,
    status,
    createdAt,
  });
}

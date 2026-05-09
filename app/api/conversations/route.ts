import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db, conversations } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = db
    .select()
    .from(conversations)
    .orderBy(desc(conversations.updatedAt))
    .all();
  return NextResponse.json({ conversations: rows });
}

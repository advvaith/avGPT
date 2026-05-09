import { NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { db, conversations, messages } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const conv = db.select().from(conversations).where(eq(conversations.id, id)).get();
  if (!conv) return NextResponse.json({ error: "not found" }, { status: 404 });

  const msgs = db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt))
    .all();

  return NextResponse.json({
    conversation: conv,
    messages: msgs.map((m) => ({
      ...m,
      citations: m.citations ? JSON.parse(m.citations) : null,
    })),
  });
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  db.delete(conversations).where(eq(conversations.id, id)).run();
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await req.json()) as { title?: string };
  if (!body.title) return NextResponse.json({ error: "title required" }, { status: 400 });
  db.update(conversations)
    .set({ title: body.title.slice(0, 200), updatedAt: new Date() })
    .where(eq(conversations.id, id))
    .run();
  return NextResponse.json({ ok: true });
}

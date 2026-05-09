import { NextResponse } from "next/server";
import { listModels } from "@/lib/nanogpt";
import { requireSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const models = await listModels();
    const sorted = [...models].sort((a, b) => a.id.localeCompare(b.id));
    return NextResponse.json({ models: sorted });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 },
    );
  }
}

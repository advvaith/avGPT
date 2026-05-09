import { NextResponse } from "next/server";
import { getSession, checkPassword } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { password } = (await req.json()) as { password?: string };
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    console.error("[login] APP_PASSWORD env var is not set");
    return NextResponse.json({ error: "server not configured" }, { status: 500 });
  }
  if (!password || !checkPassword(password)) {
    console.warn(
      `[login] password mismatch: typed length=${password?.length ?? 0}, expected length=${expected.length}`,
    );
    return NextResponse.json({ error: "invalid password" }, { status: 401 });
  }
  const s = await getSession();
  s.authed = true;
  await s.save();
  return NextResponse.json({ ok: true });
}

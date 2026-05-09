import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";

export type Session = { authed: true } | Record<string, never>;

export function sessionOptions(): SessionOptions {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error("SESSION_SECRET must be set to a string of at least 32 chars");
  }
  return {
    cookieName: "avgpt_session",
    password,
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      httpOnly: true,
      path: "/",
    },
  };
}

export async function getSession() {
  const c = await cookies();
  return getIronSession<Session>(c, sessionOptions());
}

export async function requireSession(): Promise<Session | null> {
  const s = await getSession();
  if (!("authed" in s) || !s.authed) return null;
  return s;
}

export function checkPassword(input: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return false;
  if (input.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ input.charCodeAt(i);
  }
  return mismatch === 0;
}

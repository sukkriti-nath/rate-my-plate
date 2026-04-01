import { NextResponse } from "next/server";
import { getSession, clearSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null });
  }

  // Look up the user's avatar from their most recent vote
  let avatarUrl: string | null = null;
  try {
    const db = await getDb();
    const result = await db.query(
      "SELECT avatar_url FROM votes WHERE user_email = $1 AND avatar_url IS NOT NULL ORDER BY created_at DESC LIMIT 1",
      [session.email]
    );
    if (result.rows[0]?.avatar_url) {
      avatarUrl = result.rows[0].avatar_url;
    }
  } catch { /* ignore - avatar is optional */ }

  return NextResponse.json({ user: { ...session, avatarUrl } });
}

export async function DELETE() {
  await clearSession();
  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";
import { getSession, clearSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null });
  }

  // Look up the user's avatar: first from votes, then from user_avatars (set at login)
  let avatarUrl: string | null = null;
  try {
    const db = await getDb();
    // Check votes first (most up-to-date from Slack interactions)
    const voteResult = await db.query(
      "SELECT avatar_url FROM votes WHERE user_email = $1 AND avatar_url IS NOT NULL ORDER BY created_at DESC LIMIT 1",
      [session.email]
    );
    if (voteResult.rows[0]?.avatar_url) {
      avatarUrl = voteResult.rows[0].avatar_url;
    } else {
      // Fallback: check user_avatars table (populated at login from Slack)
      const avatarResult = await db.query(
        "SELECT avatar_url FROM user_avatars WHERE email = $1",
        [session.email]
      );
      if (avatarResult.rows[0]?.avatar_url) {
        avatarUrl = avatarResult.rows[0].avatar_url;
      }
    }
  } catch { /* ignore - avatar is optional */ }

  return NextResponse.json({ user: { ...session, avatarUrl } });
}

export async function DELETE() {
  await clearSession();
  return NextResponse.json({ success: true });
}

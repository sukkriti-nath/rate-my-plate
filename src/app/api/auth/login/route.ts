import { NextResponse } from "next/server";
import { createSession, setSessionCookie } from "@/lib/auth";
import { getSlackClient } from "@/lib/slack-bot";
import { getDb } from "@/lib/db";

/**
 * Look up a user's Slack profile picture by their email address.
 * Returns the 72x72 avatar URL, or null if not found.
 */
async function fetchSlackAvatar(email: string): Promise<{ avatarUrl: string | null; realName: string | null }> {
  try {
    const slack = getSlackClient();
    const result = await slack.users.lookupByEmail({ email });
    const avatarUrl = result.user?.profile?.image_72 || null;
    const realName = result.user?.real_name || null;
    return { avatarUrl, realName };
  } catch {
    // User might not be on Slack, or token doesn't have users:read.email scope
    return { avatarUrl: null, realName: null };
  }
}

/**
 * Store the user's avatar in the database so it persists for display
 * even before they vote.
 */
async function storeUserAvatar(email: string, avatarUrl: string): Promise<void> {
  try {
    const db = await getDb();
    await db.query(
      `INSERT INTO user_avatars (email, avatar_url, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (email) DO UPDATE SET avatar_url = $2, updated_at = NOW()`,
      [email, avatarUrl]
    );
  } catch {
    // Table might not exist yet — ignore, avatar will still come from Slack on next login
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const { email } = body;

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Only allow @kikoff.com emails
  if (!normalizedEmail.endsWith("@kikoff.com")) {
    return NextResponse.json(
      { error: "Please use your @kikoff.com email address" },
      { status: 403 }
    );
  }

  // Derive display name from email (e.g., sukkriti@kikoff.com -> Sukkriti)
  const namePart = normalizedEmail.split("@")[0];
  let displayName = namePart.charAt(0).toUpperCase() + namePart.slice(1);

  // Look up profile picture (and real name) from Slack
  const { avatarUrl, realName } = await fetchSlackAvatar(normalizedEmail);

  // Use Slack real name if available (e.g., "Sukkriti Nath" instead of "Sukkriti")
  if (realName) {
    displayName = realName;
  }

  // Store avatar for later retrieval
  if (avatarUrl) {
    storeUserAvatar(normalizedEmail, avatarUrl).catch(() => {});
  }

  const token = await createSession({
    email: normalizedEmail,
    displayName,
  });

  await setSessionCookie(token);
  return NextResponse.json({ success: true, displayName, avatarUrl });
}

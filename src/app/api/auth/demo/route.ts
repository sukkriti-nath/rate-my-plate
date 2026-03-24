import { NextResponse } from "next/server";
import { createSession, setSessionCookie } from "@/lib/auth";

// Demo login for development only
export async function POST() {
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_DEMO_LOGIN) {
    return NextResponse.json({ error: "Demo login disabled" }, { status: 403 });
  }

  const token = await createSession({
    slackId: "DEMO_USER",
    displayName: "Demo Kikster",
    avatarUrl: null,
    teamId: "DEMO_TEAM",
  });

  await setSessionCookie(token);
  return NextResponse.json({ success: true });
}

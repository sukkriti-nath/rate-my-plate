import { NextResponse } from "next/server";
import { createSession, setSessionCookie } from "@/lib/auth";

// Slack OAuth callback handler
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL("/login?error=" + error, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=no_code", request.url));
  }

  try {
    // Exchange code for token
    const tokenResponse = await fetch(
      "https://slack.com/api/openid.connect.token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.SLACK_CLIENT_ID || "",
          client_secret: process.env.SLACK_CLIENT_SECRET || "",
          code,
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/slack`,
        }),
      }
    );

    const tokenData = await tokenResponse.json();
    if (!tokenData.ok) {
      console.error("Slack token exchange failed:", tokenData);
      return NextResponse.redirect(
        new URL("/login?error=token_failed", request.url)
      );
    }

    // Get user info
    const userResponse = await fetch(
      "https://slack.com/api/openid.connect.userInfo",
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }
    );

    const userData = await userResponse.json();
    if (!userData.ok) {
      console.error("Slack userInfo failed:", userData);
      return NextResponse.redirect(
        new URL("/login?error=userinfo_failed", request.url)
      );
    }

    // Optionally restrict to Kikoff workspace
    const requiredTeamId = process.env.SLACK_TEAM_ID;
    if (
      requiredTeamId &&
      userData["https://slack.com/team_id"] !== requiredTeamId
    ) {
      return NextResponse.redirect(
        new URL("/login?error=wrong_workspace", request.url)
      );
    }

    // Create session
    const token = await createSession({
      slackId: userData.sub,
      displayName: userData.name || userData.given_name || "Kikster",
      avatarUrl: userData.picture || null,
      teamId: userData["https://slack.com/team_id"] || "",
    });

    await setSessionCookie(token);
    return NextResponse.redirect(new URL("/", request.url));
  } catch (err) {
    console.error("Slack auth error:", err);
    return NextResponse.redirect(
      new URL("/login?error=server_error", request.url)
    );
  }
}

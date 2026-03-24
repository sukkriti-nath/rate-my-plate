import { NextResponse } from "next/server";
import { createSession, setSessionCookie } from "@/lib/auth";

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
  const displayName = namePart.charAt(0).toUpperCase() + namePart.slice(1);

  const token = await createSession({
    email: normalizedEmail,
    displayName,
  });

  await setSessionCookie(token);
  return NextResponse.json({ success: true, displayName });
}

import { NextResponse } from "next/server";
import { getSession, clearSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({ user: session });
}

export async function DELETE() {
  await clearSession();
  return NextResponse.json({ success: true });
}

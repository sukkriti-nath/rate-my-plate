import { NextResponse } from "next/server";
import {
  upsertVote,
  getVotesForDate,
  getVoteStatsForDate,
  getUserVoteForDate,
  getMenuForDate,
} from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }

  const menu = getMenuForDate(date);
  const stats = getVoteStatsForDate(date);
  const votes = getVotesForDate(date);

  // If user is logged in, include their vote
  const session = await getSession();
  let userVote = null;
  if (session) {
    userVote = getUserVoteForDate(session.email, date);
  }

  return NextResponse.json({ menu, stats, votes, userVote });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const {
    date,
    ratingOverall,
    ratingStarch,
    ratingVeganProtein,
    ratingVeg,
    ratingProtein1,
    ratingProtein2,
    comment,
  } = body;

  if (!date || !ratingOverall || ratingOverall < 1 || ratingOverall > 5) {
    return NextResponse.json(
      { error: "date and ratingOverall (1-5) are required" },
      { status: 400 }
    );
  }

  // Verify menu exists for that date
  const menu = getMenuForDate(date);
  if (!menu) {
    return NextResponse.json(
      { error: "No menu found for this date" },
      { status: 404 }
    );
  }

  upsertVote({
    menuDate: date,
    userName: session.displayName,
    userEmail: session.email,
    ratingOverall,
    ratingStarch: ratingStarch || null,
    ratingVeganProtein: ratingVeganProtein || null,
    ratingVeg: ratingVeg || null,
    ratingProtein1: ratingProtein1 || null,
    ratingProtein2: ratingProtein2 || null,
    comment: comment || null,
  });

  const stats = getVoteStatsForDate(date);
  return NextResponse.json({ success: true, stats });
}

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

  try {
    const menu = await getMenuForDate(date);
    const stats = await getVoteStatsForDate(date);
    const votes = await getVotesForDate(date);

    // If user is logged in, include their vote
    const session = await getSession();
    let userVote = null;
    if (session) {
      userVote = await getUserVoteForDate(session.email, date);
    }

    return NextResponse.json({ menu, stats, votes, userVote });
  } catch (error) {
    console.error("GET /api/votes error:", error);
    return NextResponse.json(
      { error: "Database error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
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
    commentStarch,
    commentVeganProtein,
    commentVeg,
    commentProtein1,
    commentProtein2,
  } = body;

  if (!date) {
    return NextResponse.json(
      { error: "date is required" },
      { status: 400 }
    );
  }

  // Validate ratings are in range if provided (null/undefined = N/A)
  const validateRating = (r: unknown): number | null => {
    if (r === null || r === undefined || r === "na") return null;
    const n = Number(r);
    if (isNaN(n) || n < 1 || n > 5) return null;
    return n;
  };

  const parsedOverall = validateRating(ratingOverall);
  const parsedStarch = validateRating(ratingStarch);
  const parsedVeganProtein = validateRating(ratingVeganProtein);
  const parsedVeg = validateRating(ratingVeg);
  const parsedProtein1 = validateRating(ratingProtein1);
  const parsedProtein2 = validateRating(ratingProtein2);

  // At least one rating must be provided
  if (
    parsedOverall === null &&
    parsedStarch === null &&
    parsedVeganProtein === null &&
    parsedVeg === null &&
    parsedProtein1 === null &&
    parsedProtein2 === null
  ) {
    return NextResponse.json(
      { error: "At least one rating is required" },
      { status: 400 }
    );
  }

  // Verify menu exists for that date
  const menu = await getMenuForDate(date);
  if (!menu) {
    return NextResponse.json(
      { error: "No menu found for this date" },
      { status: 404 }
    );
  }

  await upsertVote({
    menuDate: date,
    userName: session.displayName,
    userEmail: session.email,
    ratingOverall: parsedOverall,
    ratingStarch: parsedStarch,
    ratingVeganProtein: parsedVeganProtein,
    ratingVeg: parsedVeg,
    ratingProtein1: parsedProtein1,
    ratingProtein2: parsedProtein2,
    comment: comment || null,
    commentStarch: commentStarch || null,
    commentVeganProtein: commentVeganProtein || null,
    commentVeg: commentVeg || null,
    commentProtein1: commentProtein1 || null,
    commentProtein2: commentProtein2 || null,
  });

  const stats = await getVoteStatsForDate(date);
  return NextResponse.json({ success: true, stats });
}

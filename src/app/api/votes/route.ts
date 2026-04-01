import { NextResponse } from "next/server";
import {
  upsertVote,
  getVotesForDate,
  getVoteStatsForDate,
  getUserVoteForDate,
  getMenuForDate,
} from "@/lib/db";
import { getSession } from "@/lib/auth";
import { syncVoteToSheet, syncSuperReviewers } from "@/lib/google-sheets-writer";
import { getVotingStreaks } from "@/lib/db";

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

  // Enforce voting window: 12pm–12am PT on the voting day, no back-voting beyond 7 days
  const now = new Date();
  const ptNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const ptHour = ptNow.getHours();
  const ptToday = ptNow.toISOString().split("T")[0];

  // No back-voting beyond 7 days
  const daysDiff = (new Date(ptToday + "T12:00:00").getTime() - new Date(date + "T12:00:00").getTime()) / (1000 * 60 * 60 * 24);
  if (daysDiff < 0 || daysDiff > 7) {
    return NextResponse.json(
      { error: "Cannot vote for dates outside the past 7 days" },
      { status: 400 }
    );
  }

  // Voting opens at 12pm PT for the current day
  if (date === ptToday && ptHour < 12) {
    return NextResponse.json(
      { error: "Voting opens at 12pm PT. Come back after lunch!" },
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
    avatarUrl: null,
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

  // Sync to Google Sheet (fire-and-forget — don't block the response)
  syncVoteToSheet({
    date,
    dayName: (menu.day_name as string) || "",
    userName: session.displayName,
    userEmail: session.email,
    ratingOverall: parsedOverall,
    starch: (menu.starch as string) || null,
    ratingStarch: parsedStarch,
    veganProtein: (menu.vegan_protein as string) || null,
    ratingVeganProtein: parsedVeganProtein,
    veg: (menu.veg as string) || null,
    ratingVeg: parsedVeg,
    protein1: (menu.protein_1 as string) || null,
    ratingProtein1: parsedProtein1,
    protein2: (menu.protein_2 as string) || null,
    ratingProtein2: parsedProtein2,
    comment: comment || null,
    timestamp: new Date().toISOString(),
  }).catch((err) => console.error("Google Sheets sync failed:", err));

  // Sync Super Reviewers leaderboard (fire-and-forget)
  getVotingStreaks().then((streaks) => {
    const reviewers = streaks.map((s, idx) => {
      const engagement = s.currentStreak + s.longestStreak;
      let badge: string;
      if (engagement >= 20) badge = "Super Reviewer";
      else if (engagement >= 10) badge = "Regular";
      else badge = "New";
      return {
        rank: idx + 1,
        userName: s.userName,
        userEmail: s.userEmail,
        currentStreak: s.currentStreak,
        longestStreak: s.longestStreak,
        lastVoteDate: s.lastVoteDate,
        badge,
      };
    });
    return syncSuperReviewers(reviewers);
  }).catch((err) => console.error("Super Reviewers sync failed:", err));

  const stats = await getVoteStatsForDate(date);
  return NextResponse.json({ success: true, stats });
}

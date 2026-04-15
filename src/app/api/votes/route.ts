import { NextResponse } from "next/server";
import {
  upsertVote,
  getVotesForDate,
  getVoteStatsForDate,
  getUserVoteForDate,
  getMenuForDate,
} from "@/lib/db";
import { getSession } from "@/lib/auth";
import { syncVoteToSheet, syncDailySummary, syncFridayCatering, syncSuperReviewers } from "@/lib/google-sheets-writer";
import { getUserBadgeData, computeBadge } from "@/lib/db";

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

    const response = NextResponse.json({ menu, stats, votes, userVote });
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return response;
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
    ratingDish6,
    ratingDish7,
    ratingDish8,
    ratingDish9,
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
  const parsedDish6 = validateRating(ratingDish6);
  const parsedDish7 = validateRating(ratingDish7);
  const parsedDish8 = validateRating(ratingDish8);
  const parsedDish9 = validateRating(ratingDish9);

  // At least one rating must be provided
  if (
    parsedOverall === null &&
    parsedStarch === null &&
    parsedVeganProtein === null &&
    parsedVeg === null &&
    parsedProtein1 === null &&
    parsedProtein2 === null &&
    parsedDish6 === null &&
    parsedDish7 === null &&
    parsedDish8 === null &&
    parsedDish9 === null
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
    ratingDish6: parsedDish6,
    ratingDish7: parsedDish7,
    ratingDish8: parsedDish8,
    ratingDish9: parsedDish9,
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
    dish6: (menu.dish_6 as string) || null,
    ratingDish6: parsedDish6,
    dish7: (menu.dish_7 as string) || null,
    ratingDish7: parsedDish7,
    dish8: (menu.dish_8 as string) || null,
    ratingDish8: parsedDish8,
    dish9: (menu.dish_9 as string) || null,
    ratingDish9: parsedDish9,
    comment: comment || null,
    timestamp: new Date().toISOString(),
  }).catch((err) => console.error("Google Sheets sync failed:", err));

  // Sync Daily Summary to Google Sheet (fire-and-forget)
  getVoteStatsForDate(date).then(async (stats) => {
    const dishAvgs = [
      { name: (menu.starch as string) || "Starch", avg: stats.dishRatings.starch.avg },
      { name: (menu.vegan_protein as string) || "Vegan Protein", avg: stats.dishRatings.veganProtein.avg },
      { name: (menu.veg as string) || "Veg", avg: stats.dishRatings.veg.avg },
      { name: (menu.protein_1 as string) || "Protein 1", avg: stats.dishRatings.protein1.avg },
      { name: (menu.protein_2 as string) || "Protein 2", avg: stats.dishRatings.protein2.avg },
      { name: (menu.dish_6 as string) || "Dish 6", avg: stats.dishRatings.dish6.avg },
      { name: (menu.dish_7 as string) || "Dish 7", avg: stats.dishRatings.dish7.avg },
      { name: (menu.dish_8 as string) || "Dish 8", avg: stats.dishRatings.dish8.avg },
      { name: (menu.dish_9 as string) || "Dish 9", avg: stats.dishRatings.dish9.avg },
    ].filter((d) => d.avg > 0);
    const topDish = dishAvgs.length ? dishAvgs.reduce((a, b) => (a.avg >= b.avg ? a : b)) : { name: "N/A", avg: 0 };
    const bottomDish = dishAvgs.length ? dishAvgs.reduce((a, b) => (a.avg <= b.avg ? a : b)) : { name: "N/A", avg: 0 };
    await syncDailySummary({
      date,
      dayName: (menu.day_name as string) || "",
      totalVotes: stats.totalVotes,
      avgOverall: stats.averageOverall,
      topDish: topDish.name,
      topDishRating: topDish.avg,
      bottomDish: bottomDish.name,
      bottomDishRating: bottomDish.avg,
    });
  }).catch((err) => console.error("Daily Summary sync failed:", err));

  // Sync Friday Catering tab if it's a Friday (fire-and-forget)
  if ((menu.day_name as string)?.toLowerCase() === "friday") {
    getVoteStatsForDate(date).then(async (stats) => {
      const dishes = [
        { name: menu.starch as string | null, rating: stats.dishRatings.starch.avg },
        { name: menu.vegan_protein as string | null, rating: stats.dishRatings.veganProtein.avg },
        { name: menu.veg as string | null, rating: stats.dishRatings.veg.avg },
        { name: menu.protein_1 as string | null, rating: stats.dishRatings.protein1.avg },
        { name: menu.protein_2 as string | null, rating: stats.dishRatings.protein2.avg },
        { name: (menu.dish_6 as string) || null, rating: stats.dishRatings.dish6.avg },
        { name: (menu.dish_7 as string) || null, rating: stats.dishRatings.dish7.avg },
        { name: (menu.dish_8 as string) || null, rating: stats.dishRatings.dish8.avg },
        { name: (menu.dish_9 as string) || null, rating: stats.dishRatings.dish9.avg },
      ].filter((d) => d.name);
      const rated = dishes.filter((d) => d.rating > 0);
      const topDish = rated.length ? rated.reduce((a, b) => (a.rating >= b.rating ? a : b)) : { name: "N/A", rating: 0 };
      const bottomDish = rated.length ? rated.reduce((a, b) => (a.rating <= b.rating ? a : b)) : { name: "N/A", rating: 0 };
      await syncFridayCatering({
        date,
        restaurant: (menu.restaurant as string) || "",
        overallRating: stats.averageOverall,
        totalVotes: stats.totalVotes,
        topDish: topDish.name || "N/A",
        topDishRating: topDish.rating,
        bottomDish: bottomDish.name || "N/A",
        bottomDishRating: bottomDish.rating,
        dishes,
      });
    }).catch((err) => console.error("Friday Catering sync failed:", err));
  }

  // Sync Super Reviewers leaderboard (fire-and-forget)
  getUserBadgeData().then((badgeData) => {
    const reviewers = badgeData.map((s, idx) => ({
      rank: idx + 1,
      userName: s.userName,
      userEmail: s.userEmail,
      currentStreak: s.currentStreak,
      longestStreak: s.longestStreak,
      lastVoteDate: s.lastVoteDate,
      monthlyVotes: s.currentMonthVotes,
      badge: computeBadge(s.allTimeVotes, s.currentMonthVotes),
    }));
    return syncSuperReviewers(reviewers);
  }).catch((err) => console.error("Super Reviewers sync failed:", err));

  const stats = await getVoteStatsForDate(date);
  return NextResponse.json({ success: true, stats });
}

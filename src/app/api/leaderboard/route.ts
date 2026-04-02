import { NextResponse } from "next/server";
import { getUserBadgeData, computeBadge } from "@/lib/db";

export async function GET() {
  try {
    const badgeData = await getUserBadgeData();

    const leaderboard = badgeData.map((s, idx) => {
      const badge = computeBadge(s.allTimeVotes, s.currentMonthVotes);
      return {
        rank: idx + 1,
        userName: s.userName,
        userEmail: s.userEmail,
        currentStreak: s.currentStreak,
        longestStreak: s.longestStreak,
        lastVoteDate: s.lastVoteDate,
        monthlyVotes: s.currentMonthVotes,
        allTimeVotes: s.allTimeVotes,
        badge,
      };
    });

    // All-time top 3 (sorted by allTimeVotes desc)
    const allTimeTop3 = [...leaderboard]
      .sort((a, b) => b.allTimeVotes - a.allTimeVotes)
      .slice(0, 3);

    return NextResponse.json({ leaderboard, allTimeTop3 });
  } catch (error) {
    console.error("GET /api/leaderboard error:", error);
    return NextResponse.json(
      { error: "Database error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

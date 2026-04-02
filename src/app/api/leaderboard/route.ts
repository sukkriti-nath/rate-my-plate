import { NextResponse } from "next/server";
import { getVotingStreaks } from "@/lib/db";

export async function GET() {
  try {
    const streaks = await getVotingStreaks();

    const leaderboard = streaks.map((s, idx) => {
      let badge: "Super Reviewer" | "Regular" | "New";
      const totalDays = s.longestStreak; // approximate total from longest streak
      // Use current streak + longest streak as proxy for engagement
      const totalVotes = s.currentStreak + s.longestStreak;
      if (totalVotes >= 20) badge = "Super Reviewer";
      else if (totalVotes >= 10) badge = "Regular";
      else badge = "New";

      return {
        rank: idx + 1,
        userName: s.userName,
        userEmail: s.userEmail,
        currentStreak: s.currentStreak,
        longestStreak: s.longestStreak,
        monthlyReviews: s.monthlyReviews,
        lastVoteDate: s.lastVoteDate,
        badge,
      };
    });

    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error("GET /api/leaderboard error:", error);
    return NextResponse.json(
      { error: "Database error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

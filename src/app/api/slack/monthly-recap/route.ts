import { NextResponse } from "next/server";
import { getParticipationForRange, getServiceDaysInRange, getVotingStreaks } from "@/lib/db";
import { buildMonthlyRecapBlocks, postToChannel, type MonthlyRecapData } from "@/lib/slack-bot";

function getMonthRange(monthsAgo: number = 0): { startDate: string; endDate: string; label: string } {
  const now = new Date();
  const pt = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));

  const targetMonth = new Date(pt.getFullYear(), pt.getMonth() - monthsAgo, 1);
  const year = targetMonth.getFullYear();
  const month = targetMonth.getMonth();

  const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const label = targetMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return { startDate, endDate, label };
}

async function buildRecapData(startDate: string, endDate: string, label: string): Promise<MonthlyRecapData> {
  const participants = await getParticipationForRange(startDate, endDate);
  const serviceDays = await getServiceDaysInRange(startDate, endDate);
  const streaks = await getVotingStreaks();

  const streakMap = new Map(streaks.map(s => [s.userEmail, s]));
  const totalVotesCast = participants.reduce((sum, p) => sum + p.totalVotes, 0);
  const serviceDaysCount = serviceDays.length;

  // Build leaderboard with rank (ties get same rank)
  const sorted = [...participants].sort((a, b) => b.daysVoted.length - a.daysVoted.length);
  let currentRank = 0;
  let prevDays = -1;
  const leaderboard = sorted.map((p, i) => {
    if (p.daysVoted.length !== prevDays) {
      currentRank = i + 1;
      prevDays = p.daysVoted.length;
    }
    const streak = streakMap.get(p.userEmail)?.currentStreak || 0;
    return {
      rank: currentRank,
      name: p.userName,
      daysVoted: p.daysVoted.length,
      totalDays: serviceDaysCount,
      streak,
    };
  });

  // Perfect attendance
  const perfectAttendance = leaderboard
    .filter(p => p.daysVoted >= serviceDaysCount && serviceDaysCount > 0)
    .map(p => p.name);

  // Fun stats
  const funStats: { label: string; value: string }[] = [];

  if (participants.length > 0) {
    const avgParticipation = (participants.reduce((s, p) => s + p.daysVoted.length, 0) / participants.length).toFixed(1);
    funStats.push({ label: "Avg days voted per person", value: `${avgParticipation}/${serviceDaysCount}` });
  }

  const topStreaker = streaks[0];
  if (topStreaker && topStreaker.longestStreak > topStreaker.currentStreak) {
    funStats.push({ label: "Longest streak this month", value: `${topStreaker.longestStreak} days (${topStreaker.userName})` });
  }

  if (serviceDaysCount > 0) {
    const participationRate = ((participants.filter(p => p.daysVoted.length > 0).length / Math.max(participants.length, 1)) * 100).toFixed(0);
    funStats.push({ label: "Active participants", value: `${participants.length} people` });
  }

  return {
    monthLabel: label,
    totalParticipants: participants.length,
    totalVotesCast,
    serviceDaysCount,
    leaderboard,
    perfectAttendance,
    funStats,
  };
}

// GET: preview the recap data
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const monthsAgo = parseInt(searchParams.get("monthsAgo") || "0", 10);

  const { startDate, endDate, label } = getMonthRange(monthsAgo);
  const data = await buildRecapData(startDate, endDate, label);

  return NextResponse.json({ data });
}

// POST: send the recap to Slack
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET && process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const monthsAgo = (body as { monthsAgo?: number }).monthsAgo ?? 0;

  const { startDate, endDate, label } = getMonthRange(monthsAgo);
  const data = await buildRecapData(startDate, endDate, label);

  if (data.totalParticipants === 0) {
    return NextResponse.json({ message: "No participation data for this month", data });
  }

  const blocks = buildMonthlyRecapBlocks(data);
  const ts = await postToChannel(blocks, `${label} Participation Recap is here! 🏆`);

  return NextResponse.json({ success: true, ts, data });
}

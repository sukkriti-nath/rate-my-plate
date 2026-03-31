import { NextResponse } from "next/server";
import {
  buildPowerRankingsBlocks,
  postToChannel,
} from "@/lib/slack-bot";
import { getWeeklyRankings } from "@/lib/db";

function getWeekDateRange(): { startDate: string; endDate: string } {
  // Get the Monday-Thursday of this week in PT
  const now = new Date();
  const pt = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" })
  );

  // Find Monday of this week
  const day = pt.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(pt);
  monday.setDate(pt.getDate() + diffToMonday);

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const format = (d: Date) => d.toISOString().split("T")[0];
  return { startDate: format(monday), endDate: format(friday) };
}

export async function GET(request: Request) {
  // Verify cron secret
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { startDate, endDate } = getWeekDateRange();
    const rankings = await getWeeklyRankings(startDate, endDate);

    // Post the text-based rankings
    const blocks = buildPowerRankingsBlocks(rankings);
    await postToChannel(blocks, "This week's Power Rankings are here! 🏆");

    return NextResponse.json({
      success: true,
      startDate,
      endDate,
      daysRanked: rankings.length,
    });
  } catch (error) {
    console.error("Failed to post power rankings:", error);
    return NextResponse.json(
      { error: "Failed to post power rankings", details: String(error) },
      { status: 500 }
    );
  }
}

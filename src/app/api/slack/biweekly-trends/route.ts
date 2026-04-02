import { NextResponse } from "next/server";
import { getBiWeeklyTrendsData } from "@/lib/db";
import { syncBiWeeklyTrends } from "@/lib/google-sheets-writer";

function getBiWeeklyDateRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const pt = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" })
  );

  // Find last Thursday (or today if it's Thursday)
  const day = pt.getDay();
  const daysBack = day >= 4 ? day - 4 : day + 3;
  const endThursday = new Date(pt);
  endThursday.setDate(pt.getDate() - daysBack);

  // Go back 2 weeks from that Monday
  const startMonday = new Date(endThursday);
  startMonday.setDate(endThursday.getDate() - 13);

  const format = (d: Date) => d.toISOString().split("T")[0];
  return { startDate: format(startMonday), endDate: format(endThursday) };
}

export async function GET() {
  try {
    const { startDate, endDate } = getBiWeeklyDateRange();
    const trendsData = await getBiWeeklyTrendsData(startDate, endDate);

    // Sync to Google Sheets
    const sortedDays = [...trendsData.dayRankings].sort((a, b) => b.avgOverall - a.avgOverall);
    const bestDay = sortedDays[0];
    const worstDay = sortedDays[sortedDays.length - 1];

    if (bestDay && worstDay) {
      const bestMenu = [bestDay.menu.starch, bestDay.menu.protein_1, bestDay.menu.protein_2]
        .filter(Boolean)
        .join(", ");
      const worstMenu = [worstDay.menu.starch, worstDay.menu.protein_1, worstDay.menu.protein_2]
        .filter(Boolean)
        .join(", ");

      const topFav = trendsData.categoryFavorites.sort((a, b) => b.avgRating - a.avgRating)[0];
      const topWorst = trendsData.categoryWorst.sort((a, b) => a.avgRating - b.avgRating)[0];

      await syncBiWeeklyTrends({
        period: `${startDate} to ${endDate}`,
        dateRange: `${startDate} - ${endDate}`,
        avgOverall: trendsData.avgOverall,
        bestDay: `${bestDay.dayName} (${bestDay.date})`,
        bestDayMenu: bestMenu,
        worstDay: `${worstDay.dayName} (${worstDay.date})`,
        worstDayMenu: worstMenu,
        topDish: topFav ? `${topFav.dishName} (${topFav.category})` : "N/A",
        topDishRating: topFav?.avgRating ?? 0,
        worstDish: topWorst ? `${topWorst.dishName} (${topWorst.category})` : "N/A",
        worstDishRating: topWorst?.avgRating ?? 0,
        recOrderMore: topFav ? `${topFav.dishName} — ${topFav.avgRating.toFixed(1)}/5` : "",
        recPhaseOut: topWorst ? `${topWorst.dishName} — ${topWorst.avgRating.toFixed(1)}/5` : "",
        recReplicate: `${bestDay.dayName} ${bestDay.date} menu (${bestDay.avgOverall.toFixed(1)}/5)`,
        recImprove: `${worstDay.dayName} ${worstDay.date} menu (${worstDay.avgOverall.toFixed(1)}/5)`,
      });
    }

    return NextResponse.json({
      success: true,
      startDate,
      endDate,
      daysRated: trendsData.totalDays,
      totalVotes: trendsData.totalVotes,
      avgOverall: trendsData.avgOverall,
    });
  } catch (error) {
    console.error("Failed to generate bi-weekly trends:", error);
    return NextResponse.json(
      { error: "Failed to generate bi-weekly trends", details: String(error) },
      { status: 500 }
    );
  }
}

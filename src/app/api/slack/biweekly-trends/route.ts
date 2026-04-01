import { NextResponse } from "next/server";
import {
  buildBiWeeklyTrendsBlocks,
  postToChannel,
  sendDirectMessage,
} from "@/lib/slack-bot";
import { getBiWeeklyTrendsData } from "@/lib/db";
import { syncBiWeeklyTrends, exportBiWeeklyTrendsPdf } from "@/lib/google-sheets-writer";

// Workplace Experience team — receive bi-weekly report DMs
const REPORT_RECIPIENTS = [
  { name: "Shivani", userId: "U0AAEM0FA10" },  // shivani@kikoff.com
  { name: "Trevor", userId: "U094LAQU59U" },    // trevor.araujo@kikoff.com
];

function getBiWeeklyDateRange(): { startDate: string; endDate: string } {
  // Get the previous 2 weeks of Mon-Thu
  // endDate = last Thursday, startDate = Monday 2 weeks before that
  const now = new Date();
  const pt = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" })
  );

  // Find last Thursday (or today if it's Thursday)
  const day = pt.getDay();
  const daysBack = day >= 4 ? day - 4 : day + 3; // days since last Thursday
  const endThursday = new Date(pt);
  endThursday.setDate(pt.getDate() - daysBack);

  // Go back 2 weeks from that Monday
  const startMonday = new Date(endThursday);
  startMonday.setDate(endThursday.getDate() - 13); // 2 weeks back + to Monday

  const format = (d: Date) => d.toISOString().split("T")[0];
  return { startDate: format(startMonday), endDate: format(endThursday) };
}

export async function GET(request: Request) {
  // Verify cron secret
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { startDate, endDate } = getBiWeeklyDateRange();
    const trendsData = await getBiWeeklyTrendsData(startDate, endDate);

    // Post to Slack
    const blocks = buildBiWeeklyTrendsBlocks(trendsData);
    await postToChannel(blocks, "📊 Bi-Weekly Trends Report is here!");

    // Sync to Google Sheets (fire-and-forget)
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

    // Generate PDF and upload to Google Drive
    const dateRangeStr = `${startDate} to ${endDate}`;
    let pdfLink = "";
    try {
      const pdf = await exportBiWeeklyTrendsPdf(dateRangeStr);
      pdfLink = pdf.webViewLink;
      console.log(`Bi-weekly PDF uploaded to Drive: ${pdfLink}`);
    } catch (err) {
      console.error("Failed to export/upload bi-weekly PDF:", err);
    }

    // DM the Workplace Experience team
    const dmBlocks = [
      {
        type: "header",
        text: { type: "plain_text", text: "📊 Bi-Weekly Catering Trends Report", emoji: true },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Hey! Here's your bi-weekly catering trends report for *${startDate}* to *${endDate}*.\n\n` +
            `• *Overall avg:* ${trendsData.avgOverall.toFixed(1)}/5\n` +
            `• *Days rated:* ${trendsData.totalDays}\n` +
            `• *Total votes:* ${trendsData.totalVotes}\n\n` +
            (pdfLink
              ? `📄 <${pdfLink}|View full PDF report>\n`
              : "") +
            `📊 <https://docs.google.com/spreadsheets/d/${process.env.VOTES_GOOGLE_SHEET_ID}/edit|View live data>`,
        },
      },
    ];

    for (const recipient of REPORT_RECIPIENTS) {
      try {
        await sendDirectMessage(
          recipient.userId,
          `Bi-Weekly Catering Trends Report: ${dateRangeStr}`,
          dmBlocks
        );
        console.log(`Sent bi-weekly report DM to ${recipient.name}`);
      } catch (err) {
        console.error(`Failed to DM ${recipient.name}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      startDate,
      endDate,
      daysRated: trendsData.totalDays,
      totalVotes: trendsData.totalVotes,
      avgOverall: trendsData.avgOverall,
      pdfLink: pdfLink || null,
      dmsSent: REPORT_RECIPIENTS.map((r) => r.name),
    });
  } catch (error) {
    console.error("Failed to post bi-weekly trends:", error);
    return NextResponse.json(
      { error: "Failed to post bi-weekly trends", details: String(error) },
      { status: 500 }
    );
  }
}

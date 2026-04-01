import { NextResponse } from "next/server";
import { getWeeklyRankings, getCommentsForDateRange, getMenuForWeek, getVoteStatsForDate } from "@/lib/db";
import { getSlackClient } from "@/lib/slack-bot";

const REPORT_RECIPIENTS = [
  { email: "trevor.araujo@kikoff.com", name: "Trevor Araujo" },
  { email: "shivani@kikoff.com", name: "Shivani Krishna" },
  { email: "sukkriti@kikoff.com", name: "Sukkriti" },
];

function getWeeklyRange(weeksAgo: number = 0): { startDate: string; endDate: string; label: string } {
  const now = new Date();
  const pt = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));

  // Find this week's Monday
  const day = pt.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const thisMonday = new Date(pt);
  thisMonday.setDate(pt.getDate() + diffToMonday);

  // Go back weeksAgo * 1 week
  const startMonday = new Date(thisMonday);
  startMonday.setDate(thisMonday.getDate() - (weeksAgo * 7));

  // One week: Monday to Friday of the same week
  const endFriday = new Date(startMonday);
  endFriday.setDate(startMonday.getDate() + 4); // Mon + 4 = Friday

  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const labelFmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return {
    startDate: fmt(startMonday),
    endDate: fmt(endFriday),
    label: `${labelFmt(startMonday)} – ${labelFmt(endFriday)}`,
  };
}

interface ReportData {
  period: string;
  startDate: string;
  endDate: string;
  summary: {
    totalVotes: number;
    avgOverall: number;
    bestDay: { name: string; avg: number; date: string } | null;
    worstDay: { name: string; avg: number; date: string } | null;
    totalDaysWithData: number;
  };
  dayByDay: Array<{
    date: string;
    dayName: string;
    restaurant: string | null;
    avgOverall: number;
    totalVotes: number;
    topDish: { name: string; avg: number; category: string } | null;
    worstDish: { name: string; avg: number; category: string } | null;
  }>;
  topDishes: Array<{ name: string; category: string; dayName: string; avg: number; votes: number }>;
  bottomDishes: Array<{ name: string; category: string; dayName: string; avg: number; votes: number }>;
  fridaySpotlight: Array<{
    date: string;
    restaurant: string | null;
    avgOverall: number;
    totalVotes: number;
    dishes: Array<{ name: string; category: string; avg: number }>;
  }>;
  comments: Array<{ date: string; comment: string; userName: string }>;
}

async function generateReport(startDate: string, endDate: string, label: string): Promise<ReportData> {
  const rankings = await getWeeklyRankings(startDate, endDate);
  const comments = await getCommentsForDateRange(startDate, endDate);
  const menus = await getMenuForWeek(startDate, endDate);

  // Summary stats
  const totalVotes = rankings.reduce((sum, d) => sum + d.totalVotes, 0);
  const daysWithVotes = rankings.filter(d => d.totalVotes > 0);
  const avgOverall = daysWithVotes.length > 0
    ? daysWithVotes.reduce((sum, d) => sum + d.avgOverall * d.totalVotes, 0) / totalVotes
    : 0;

  const sortedDays = [...daysWithVotes].sort((a, b) => b.avgOverall - a.avgOverall);
  const bestDay = sortedDays[0] ? { name: sortedDays[0].dayName, avg: sortedDays[0].avgOverall, date: sortedDays[0].date } : null;
  const worstDay = sortedDays.length > 1
    ? { name: sortedDays[sortedDays.length - 1].dayName, avg: sortedDays[sortedDays.length - 1].avgOverall, date: sortedDays[sortedDays.length - 1].date }
    : null;

  // Day-by-day
  const dayByDay = rankings.map(day => {
    const sortedDishes = [...day.dishRankings].sort((a, b) => b.avg - a.avg);
    const menuDay = menus.find(m => m.date === day.date);
    return {
      date: day.date,
      dayName: day.dayName,
      restaurant: (menuDay?.restaurant as string) || null,
      avgOverall: day.avgOverall,
      totalVotes: day.totalVotes,
      topDish: sortedDishes[0] ? { name: sortedDishes[0].name, avg: sortedDishes[0].avg, category: sortedDishes[0].category } : null,
      worstDish: sortedDishes.length > 1
        ? { name: sortedDishes[sortedDishes.length - 1].name, avg: sortedDishes[sortedDishes.length - 1].avg, category: sortedDishes[sortedDishes.length - 1].category }
        : null,
    };
  });

  // All dishes ranked
  const allDishes = rankings.flatMap(d =>
    d.dishRankings.map(dish => ({ ...dish, dayName: d.dayName }))
  ).sort((a, b) => b.avg - a.avg);

  const topDishes = allDishes.slice(0, 5);
  const bottomDishes = [...allDishes].sort((a, b) => a.avg - b.avg).slice(0, 3);

  // Friday spotlight
  const fridayDays = dayByDay.filter(d => d.dayName === "Friday");
  const fridaySpotlight = fridayDays.map(fri => {
    const ranking = rankings.find(r => r.date === fri.date);
    return {
      date: fri.date,
      restaurant: fri.restaurant,
      avgOverall: fri.avgOverall,
      totalVotes: fri.totalVotes,
      dishes: ranking?.dishRankings.map(d => ({ name: d.name, category: d.category, avg: d.avg })) || [],
    };
  });

  return {
    period: label,
    startDate,
    endDate,
    summary: {
      totalVotes,
      avgOverall,
      bestDay,
      worstDay,
      totalDaysWithData: daysWithVotes.length,
    },
    dayByDay,
    topDishes,
    bottomDishes,
    fridaySpotlight,
    comments,
  };
}

function formatReportForSlack(report: ReportData): string {
  const lines: string[] = [];

  lines.push(`🏆 *Weekly Power Rankings: ${report.period}*`);
  lines.push("");

  // Executive Summary
  lines.push("*📊 Executive Summary*");
  lines.push(`• Overall satisfaction: *${report.summary.avgOverall.toFixed(1)}/5.0*`);
  lines.push(`• Total votes collected: *${report.summary.totalVotes}* across *${report.summary.totalDaysWithData}* days`);
  if (report.summary.bestDay) {
    lines.push(`• Best day: *${report.summary.bestDay.name}* (${report.summary.bestDay.avg.toFixed(1)}/5)`);
  }
  if (report.summary.worstDay) {
    lines.push(`• Needs improvement: *${report.summary.worstDay.name}* (${report.summary.worstDay.avg.toFixed(1)}/5)`);
  }
  lines.push("");

  // Day-by-Day
  lines.push("*📅 Day-by-Day Breakdown*");
  for (const day of report.dayByDay) {
    const restaurant = day.restaurant ? ` _(${day.restaurant})_` : "";
    const top = day.topDish ? ` | Top: ${day.topDish.name} (${day.topDish.avg.toFixed(1)})` : "";
    lines.push(`• *${day.dayName}*${restaurant}: ${day.avgOverall.toFixed(1)}/5 (${day.totalVotes} votes)${top}`);
  }
  lines.push("");

  // Hall of Fame
  if (report.topDishes.length > 0) {
    lines.push("*🏛️ Hall of Fame (Top Dishes)*");
    for (const dish of report.topDishes.slice(0, 3)) {
      lines.push(`• ${dish.name} _(${dish.category}, ${dish.dayName})_ — ${dish.avg.toFixed(1)}/5`);
    }
    lines.push("");
  }

  // Hall of Shame
  if (report.bottomDishes.length > 0) {
    lines.push("*💀 Hall of Shame*");
    for (const dish of report.bottomDishes.slice(0, 3)) {
      lines.push(`• ${dish.name} _(${dish.category}, ${dish.dayName})_ — ${dish.avg.toFixed(1)}/5`);
    }
    lines.push("");
  }

  // Friday Spotlight
  if (report.fridaySpotlight.length > 0) {
    lines.push("*🍴 Friday Catering Spotlight*");
    for (const fri of report.fridaySpotlight) {
      const rest = fri.restaurant ? `*${fri.restaurant}*` : "Friday lunch";
      lines.push(`• ${rest}: ${fri.avgOverall.toFixed(1)}/5 (${fri.totalVotes} votes)`);
      for (const dish of fri.dishes) {
        lines.push(`  · ${dish.name} (${dish.category}): ${dish.avg.toFixed(1)}/5`);
      }
    }
    lines.push("");
  }

  // Comments
  if (report.comments.length > 0) {
    lines.push("*💬 Feedback Highlights*");
    for (const c of report.comments.slice(0, 10)) {
      lines.push(`• "${c.comment}" — _${c.userName}_`);
    }
  }

  return lines.join("\n");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const weeksAgo = parseInt(searchParams.get("weeksAgo") || "0", 10);

  const { startDate, endDate, label } = getWeeklyRange(weeksAgo);
  const report = await generateReport(startDate, endDate, label);

  return NextResponse.json({ report });
}

export async function POST(request: Request) {
  const body = await request.json();
  const weeksAgo = body.weeksAgo ?? 0;
  const slackHandles: string[] = body.slackHandles || []; // e.g. ["@sukkriti", "@trevor"]
  const emails: string[] = body.emails || []; // e.g. ["sukkriti@kikoff.com"]

  const { startDate, endDate, label } = getWeeklyRange(weeksAgo);
  const report = await generateReport(startDate, endDate, label);
  const reportText = formatReportForSlack(report);
  const results: { recipient: string; method: string; success: boolean; error?: string }[] = [];

  // Send via Slack DM
  if (slackHandles.length > 0 || emails.length > 0) {
    try {
      const slack = getSlackClient();

      // Send to Slack handles (look up by display name or email)
      for (const handle of slackHandles) {
        const cleanHandle = handle.replace(/^@/, "").trim();
        if (!cleanHandle) continue;

        try {
          // Try looking up by email first (handle@kikoff.com)
          let slackUserId: string | undefined;
          try {
            const emailGuess = cleanHandle.includes("@") ? cleanHandle : `${cleanHandle}@kikoff.com`;
            const userResult = await slack.users.lookupByEmail({ email: emailGuess });
            slackUserId = userResult.user?.id;
          } catch {
            // If email lookup fails, search by name
            const listResult = await slack.users.list({ limit: 200 });
            const found = listResult.members?.find(
              m => m.name === cleanHandle || m.real_name?.toLowerCase().includes(cleanHandle.toLowerCase())
            );
            slackUserId = found?.id;
          }

          if (slackUserId) {
            await slack.chat.postMessage({ channel: slackUserId, text: reportText, mrkdwn: true });
            results.push({ recipient: handle, method: "slack", success: true });
          } else {
            results.push({ recipient: handle, method: "slack", success: false, error: "User not found" });
          }
        } catch (err) {
          results.push({ recipient: handle, method: "slack", success: false, error: String(err) });
        }
      }

      // Send to emails via Slack (look up user by email, DM them)
      for (const email of emails) {
        const cleanEmail = email.trim();
        if (!cleanEmail) continue;

        try {
          const userResult = await slack.users.lookupByEmail({ email: cleanEmail });
          const slackUserId = userResult.user?.id;
          if (slackUserId) {
            await slack.chat.postMessage({ channel: slackUserId, text: reportText, mrkdwn: true });
            results.push({ recipient: cleanEmail, method: "slack-dm", success: true });
          } else {
            results.push({ recipient: cleanEmail, method: "slack-dm", success: false, error: "User not found" });
          }
        } catch (err) {
          results.push({ recipient: cleanEmail, method: "slack-dm", success: false, error: String(err) });
        }
      }
    } catch (err) {
      console.error("Failed to send Slack reports:", err);
    }
  }

  return NextResponse.json({ report, results });
}

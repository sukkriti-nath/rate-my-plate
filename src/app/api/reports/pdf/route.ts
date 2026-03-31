import { NextResponse } from "next/server";
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, HeadingLevel, ShadingType,
  Header, Footer, PageNumber, NumberFormat,
} from "docx";
import { getWeeklyRankings, getCommentsForDateRange, getMenuForWeek } from "@/lib/db";

const GREEN = "94cf40";
const DARK = "131413";
const RED = "ef4444";
const GRAY = "666666";
const LIGHT_BG = "f8f9fa";

function getBiWeeklyRange(weeksAgo: number = 0) {
  const now = new Date();
  const pt = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const day = pt.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const thisMonday = new Date(pt);
  thisMonday.setDate(pt.getDate() + diffToMonday);
  const startMonday = new Date(thisMonday);
  startMonday.setDate(thisMonday.getDate() - weeksAgo * 14);
  const endFriday = new Date(startMonday);
  endFriday.setDate(startMonday.getDate() + 11);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const labelFmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return { startDate: fmt(startMonday), endDate: fmt(endFriday), label: `${labelFmt(startMonday)} – ${labelFmt(endFriday)}` };
}

function ratingColor(avg: number): string {
  if (avg >= 4) return GREEN;
  if (avg >= 3) return "eab308";
  return RED;
}

function noBorder() {
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return { top: none, bottom: none, left: none, right: none };
}

function statCell(value: string, label: string, color: string = DARK): TableCell {
  return new TableCell({
    width: { size: 25, type: WidthType.PERCENTAGE },
    borders: noBorder(),
    shading: { type: ShadingType.SOLID, color: LIGHT_BG },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 0 }, children: [
        new TextRun({ text: value, bold: true, size: 36, color }),
      ]}),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40, after: 80 }, children: [
        new TextRun({ text: label, size: 14, color: GRAY }),
      ]}),
    ],
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const weeksAgo = parseInt(searchParams.get("weeksAgo") || "0", 10);

  const { startDate, endDate, label } = getBiWeeklyRange(weeksAgo);
  const rankings = getWeeklyRankings(startDate, endDate);
  const comments = getCommentsForDateRange(startDate, endDate);
  const menus = getMenuForWeek(startDate, endDate);

  const daysWithVotes = rankings.filter(d => d.totalVotes > 0);
  const totalVotes = rankings.reduce((sum, d) => sum + d.totalVotes, 0);
  const avgOverall = daysWithVotes.length > 0
    ? daysWithVotes.reduce((sum, d) => sum + d.avgOverall * d.totalVotes, 0) / Math.max(totalVotes, 1)
    : 0;

  const sortedDays = [...daysWithVotes].sort((a, b) => b.avgOverall - a.avgOverall);
  const allDishes = rankings.flatMap(d => d.dishRankings.map(dish => ({ ...dish, dayName: d.dayName })));
  const sortedDishes = [...allDishes].sort((a, b) => b.avg - a.avg);

  // Week 1 vs Week 2 trend
  const midDate = new Date(startDate + "T12:00:00");
  midDate.setDate(midDate.getDate() + 7);
  const midStr = midDate.toISOString().split("T")[0];
  const week1Days = daysWithVotes.filter(d => d.date < midStr);
  const week2Days = daysWithVotes.filter(d => d.date >= midStr);
  const week1Avg = week1Days.length > 0 ? week1Days.reduce((s, d) => s + d.avgOverall, 0) / week1Days.length : 0;
  const week2Avg = week2Days.length > 0 ? week2Days.reduce((s, d) => s + d.avgOverall, 0) / week2Days.length : 0;
  const trend = week2Avg - week1Avg;

  const sections: (Paragraph | Table)[] = [];

  // ─── Title ────────────────────────────────────────────────────────────────
  sections.push(new Paragraph({
    spacing: { after: 40 },
    children: [
      new TextRun({ text: "RateMyPlate", bold: true, size: 40, color: DARK }),
      new TextRun({ text: "  Bi-Weekly Food Report", size: 24, color: GREEN }),
    ],
  }));
  sections.push(new Paragraph({
    spacing: { after: 300 },
    children: [new TextRun({ text: label, size: 20, color: GRAY })],
  }));

  // ─── Executive Summary ────────────────────────────────────────────────────
  sections.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 200, after: 200 },
    children: [new TextRun({ text: "Executive Summary", bold: true, size: 28, color: DARK })],
  }));

  // Stat boxes as table
  sections.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      children: [
        statCell(`${avgOverall.toFixed(1)}/5`, "Overall Avg", ratingColor(avgOverall)),
        statCell(String(totalVotes), "Total Votes"),
        statCell(`${daysWithVotes.length}/${rankings.length}`, "Days Rated"),
        statCell(
          trend > 0 ? `+${trend.toFixed(1)}` : trend.toFixed(1),
          "Wk1 → Wk2 Trend",
          trend >= 0 ? GREEN : RED,
        ),
      ],
    })],
  }));

  // Best / Worst day
  if (sortedDays.length > 0) {
    const best = sortedDays[0];
    const worst = sortedDays.length > 1 ? sortedDays[sortedDays.length - 1] : null;
    sections.push(new Paragraph({ spacing: { before: 200, after: 100 }, children: [
      new TextRun({ text: "Best Day: ", bold: true, size: 20, color: GREEN }),
      new TextRun({ text: `${best.dayName} — ${best.avgOverall.toFixed(1)}/5`, size: 20, color: DARK }),
      ...(worst ? [
        new TextRun({ text: "     Needs Improvement: ", bold: true, size: 20, color: RED }),
        new TextRun({ text: `${worst.dayName} — ${worst.avgOverall.toFixed(1)}/5`, size: 20, color: DARK }),
      ] : []),
    ]}));
  }

  // ─── Day-by-Day Breakdown ─────────────────────────────────────────────────
  sections.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 300, after: 150 },
    children: [new TextRun({ text: "Day-by-Day Breakdown", bold: true, size: 28, color: DARK })],
  }));

  // Table header
  const headerRow = new TableRow({
    children: ["Day", "Date", "Restaurant", "Rating", "Votes", "Top Dish"].map(h =>
      new TableCell({
        shading: { type: ShadingType.SOLID, color: DARK },
        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 16, color: "FFFFFF" })] })],
      })
    ),
  });

  const dataRows = rankings.map(day => {
    const menu = menus.find(m => m.date === day.date);
    const topDish = [...day.dishRankings].sort((a, b) => b.avg - a.avg)[0];
    const dateStr = new Date(day.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const rc = day.totalVotes > 0 ? ratingColor(day.avgOverall) : GRAY;

    return new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: day.dayName, bold: true, size: 18, color: DARK })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: dateStr, size: 16, color: GRAY })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: (menu?.restaurant as string) || "—", size: 16, color: GRAY })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: day.totalVotes > 0 ? `${day.avgOverall.toFixed(1)}/5` : "—", bold: true, size: 18, color: rc })] })] }),
        new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(day.totalVotes), size: 16, color: GRAY })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: topDish ? `${topDish.name.substring(0, 25)} (${topDish.avg.toFixed(1)})` : "—", size: 14, color: GRAY })] })] }),
      ],
    });
  });

  sections.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  }));

  // ─── Hall of Fame ─────────────────────────────────────────────────────────
  if (sortedDishes.length > 0) {
    sections.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 150 },
      children: [new TextRun({ text: "Hall of Fame — Top Dishes", bold: true, size: 28, color: DARK })],
    }));

    const medals = ["🥇", "🥈", "🥉", "#4", "#5"];
    for (let i = 0; i < Math.min(sortedDishes.length, 5); i++) {
      const d = sortedDishes[i];
      sections.push(new Paragraph({
        spacing: { after: 60 },
        shading: { type: ShadingType.SOLID, color: i < 3 ? "f0fdf4" : LIGHT_BG },
        children: [
          new TextRun({ text: `${medals[i]}  `, size: 20 }),
          new TextRun({ text: d.name, bold: true, size: 20, color: DARK }),
          new TextRun({ text: `  (${d.category} · ${d.dayName})`, size: 16, color: GRAY }),
          new TextRun({ text: `  ${d.avg.toFixed(1)}/5`, bold: true, size: 20, color: GREEN }),
        ],
      }));
    }
  }

  // ─── Hall of Shame ────────────────────────────────────────────────────────
  if (sortedDishes.length > 1) {
    sections.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 150 },
      children: [new TextRun({ text: "Hall of Shame — Lowest Rated", bold: true, size: 28, color: DARK })],
    }));

    const bottomDishes = [...sortedDishes].reverse().slice(0, 3);
    for (const d of bottomDishes) {
      sections.push(new Paragraph({
        spacing: { after: 60 },
        shading: { type: ShadingType.SOLID, color: "fef2f2" },
        children: [
          new TextRun({ text: d.name, bold: true, size: 20, color: DARK }),
          new TextRun({ text: `  (${d.category} · ${d.dayName})`, size: 16, color: GRAY }),
          new TextRun({ text: `  ${d.avg.toFixed(1)}/5`, bold: true, size: 20, color: RED }),
        ],
      }));
    }
  }

  // ─── Friday Catering Spotlight ────────────────────────────────────────────
  const fridayMenus = menus.filter(m => (m.day_name as string) === "Friday");
  if (fridayMenus.length > 0) {
    sections.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 100 },
      children: [new TextRun({ text: "Friday Catering Spotlight", bold: true, size: 28, color: DARK })],
    }));
    sections.push(new Paragraph({
      spacing: { after: 150 },
      children: [new TextRun({ text: "Granular feedback for vendor optimization and waste reduction.", size: 16, color: GRAY, italics: true })],
    }));

    for (const fri of fridayMenus) {
      const friRanking = rankings.find(r => r.date === fri.date);
      const restaurant = (fri.restaurant as string) || "Friday Lunch";
      const dateStr = new Date((fri.date as string) + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

      sections.push(new Paragraph({
        spacing: { before: 100, after: 60 },
        shading: { type: ShadingType.SOLID, color: "fffbeb" },
        children: [
          new TextRun({ text: `${restaurant}`, bold: true, size: 22, color: DARK }),
          new TextRun({ text: `  ${dateStr}`, size: 16, color: GRAY }),
          ...(friRanking && friRanking.totalVotes > 0 ? [
            new TextRun({ text: `  ${friRanking.avgOverall.toFixed(1)}/5 (${friRanking.totalVotes} votes)`, bold: true, size: 20, color: ratingColor(friRanking.avgOverall) }),
          ] : []),
        ],
      }));

      if (friRanking) {
        for (const dish of friRanking.dishRankings.sort((a, b) => b.avg - a.avg)) {
          sections.push(new Paragraph({
            spacing: { after: 30 },
            indent: { left: 400 },
            children: [
              new TextRun({ text: `${dish.name}`, size: 18, color: DARK }),
              new TextRun({ text: ` (${dish.category})`, size: 14, color: GRAY }),
              new TextRun({ text: `  ${dish.avg.toFixed(1)}/5`, bold: true, size: 18, color: ratingColor(dish.avg) }),
            ],
          }));
        }
      }
    }
  }

  // ─── Trend Analysis ───────────────────────────────────────────────────────
  if (week1Days.length > 0 && week2Days.length > 0) {
    sections.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 150 },
      children: [new TextRun({ text: "Trend Analysis", bold: true, size: 28, color: DARK })],
    }));

    const trendIcon = trend > 0 ? "↑" : trend < 0 ? "↓" : "→";
    const trendMsg = trend > 0 ? "Satisfaction trending upward" : trend < 0 ? "Satisfaction trending downward — consider menu adjustments" : "Satisfaction stable";

    sections.push(new Paragraph({
      spacing: { after: 60 },
      shading: { type: ShadingType.SOLID, color: LIGHT_BG },
      children: [
        new TextRun({ text: `${trendIcon} ${Math.abs(trend).toFixed(1)}  `, bold: true, size: 32, color: trend >= 0 ? GREEN : RED }),
        new TextRun({ text: `Week 1: ${week1Avg.toFixed(1)} → Week 2: ${week2Avg.toFixed(1)}`, size: 18, color: GRAY }),
      ],
    }));
    sections.push(new Paragraph({
      spacing: { after: 100 },
      children: [new TextRun({ text: trendMsg, italics: true, size: 18, color: GRAY })],
    }));
  }

  // ─── Comments ─────────────────────────────────────────────────────────────
  if (comments.length > 0) {
    sections.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 150 },
      children: [new TextRun({ text: "Feedback Highlights", bold: true, size: 28, color: DARK })],
    }));

    for (const c of comments.slice(0, 8)) {
      sections.push(new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({ text: `"${c.comment}"`, italics: true, size: 18, color: DARK }),
          new TextRun({ text: `  — ${c.userName}`, size: 14, color: GRAY }),
        ],
      }));
    }
  }

  // ─── Build Document ───────────────────────────────────────────────────────
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 720, right: 720 },
          size: { width: 12240, height: 15840 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "RateMyPlate Report", size: 14, color: GRAY, italics: true })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "Generated by RateMyPlate • Built at Kikoff  |  Page ", size: 14, color: GRAY }),
              new TextRun({ children: [PageNumber.CURRENT], size: 14, color: GRAY }),
            ],
          })],
        }),
      },
      children: sections,
    }],
  });

  const buffer = await Packer.toBuffer(doc);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="RateMyPlate-Report-${startDate}.docx"`,
    },
  });
}

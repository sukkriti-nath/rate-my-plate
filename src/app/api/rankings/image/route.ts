import { NextResponse } from "next/server";
import satori from "satori";
import sharp from "sharp";
import { getWeeklyRankings, type WeeklyDayRanking } from "@/lib/db";
import { readFileSync } from "fs";
import { join } from "path";

// Kikoff brand colors
const KIKOFF_GREEN = "#b5fc4f";
const DARK_BG = "#131413";
const DARK_CARD = "#1e1f1e";
const TEXT_WHITE = "#f5f5f5";
const TEXT_GRAY = "#a0a0a0";
const GOLD = "#ffd700";
const SILVER = "#c0c0c0";
const BRONZE = "#cd7f32";

function starStr(n: number): string {
  const full = Math.round(n);
  return "\u2605".repeat(full) + "\u2606".repeat(5 - full);
}

function buildRankingsJsx(rankings: WeeklyDayRanking[], startDate: string, endDate: string) {
  const sortedDays = [...rankings]
    .filter((d) => d.totalVotes > 0)
    .sort((a, b) => b.avgOverall - a.avgOverall);

  const allDishes = rankings.flatMap((d) =>
    d.dishRankings.map((dish) => ({
      ...dish,
      dayName: d.dayName,
    }))
  );
  const sortedDishes = [...allDishes].sort((a, b) => b.avg - a.avg);
  const topDishes = sortedDishes.slice(0, 3);
  const worstDish = sortedDishes.length > 0 ? sortedDishes[sortedDishes.length - 1] : null;

  const medalColors = [GOLD, SILVER, BRONZE];
  const bestDay = sortedDays[0];

  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: 1200,
        height: 675,
        backgroundColor: DARK_BG,
        padding: 48,
        fontFamily: "Geist, sans-serif",
        color: TEXT_WHITE,
      },
      children: [
        // Header
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 32,
            },
            children: [
              {
                type: "div",
                props: {
                  style: { display: "flex", flexDirection: "column" },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          fontSize: 40,
                          fontWeight: 800,
                          color: KIKOFF_GREEN,
                          letterSpacing: -1,
                        },
                        children: "POWER RANKINGS",
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: { fontSize: 18, color: TEXT_GRAY, marginTop: 4 },
                        children: `Week of ${startDate} to ${endDate}`,
                      },
                    },
                  ],
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontSize: 16,
                    color: TEXT_GRAY,
                    backgroundColor: DARK_CARD,
                    padding: "8px 16px",
                    borderRadius: 8,
                  },
                  children: "RateMyPlate",
                },
              },
            ],
          },
        },
        // Body: two columns
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flex: 1,
              gap: 32,
            },
            children: [
              // Left column: Best Day + Day Rankings
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    gap: 16,
                  },
                  children: [
                    // Best Day card
                    bestDay
                      ? {
                          type: "div",
                          props: {
                            style: {
                              display: "flex",
                              flexDirection: "column",
                              backgroundColor: DARK_CARD,
                              borderRadius: 16,
                              padding: 24,
                              border: `2px solid ${KIKOFF_GREEN}`,
                            },
                            children: [
                              {
                                type: "div",
                                props: {
                                  style: { fontSize: 14, color: KIKOFF_GREEN, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 },
                                  children: "BEST DAY OF THE WEEK",
                                },
                              },
                              {
                                type: "div",
                                props: {
                                  style: { fontSize: 32, fontWeight: 800, marginTop: 8 },
                                  children: bestDay.dayName,
                                },
                              },
                              {
                                type: "div",
                                props: {
                                  style: { display: "flex", alignItems: "center", gap: 8, marginTop: 4 },
                                  children: [
                                    {
                                      type: "div",
                                      props: {
                                        style: { fontSize: 20, color: GOLD },
                                        children: starStr(bestDay.avgOverall),
                                      },
                                    },
                                    {
                                      type: "div",
                                      props: {
                                        style: { fontSize: 20, fontWeight: 700, color: KIKOFF_GREEN },
                                        children: `${bestDay.avgOverall.toFixed(1)}/5.0`,
                                      },
                                    },
                                  ],
                                },
                              },
                              {
                                type: "div",
                                props: {
                                  style: { fontSize: 14, color: TEXT_GRAY, marginTop: 4 },
                                  children: `${bestDay.totalVotes} votes`,
                                },
                              },
                            ],
                          },
                        }
                      : {
                          type: "div",
                          props: {
                            style: { backgroundColor: DARK_CARD, borderRadius: 16, padding: 24 },
                            children: "No votes this week",
                          },
                        },
                    // All day rankings
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          flexDirection: "column",
                          backgroundColor: DARK_CARD,
                          borderRadius: 16,
                          padding: 20,
                          gap: 8,
                          flex: 1,
                        },
                        children: [
                          {
                            type: "div",
                            props: {
                              style: { fontSize: 14, color: TEXT_GRAY, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
                              children: "DAY RANKINGS",
                            },
                          },
                          ...sortedDays.map((day, i) => ({
                            type: "div",
                            props: {
                              style: {
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "6px 0",
                                borderBottom: i < sortedDays.length - 1 ? `1px solid #333` : "none",
                              },
                              children: [
                                {
                                  type: "div",
                                  props: {
                                    style: { display: "flex", alignItems: "center", gap: 8 },
                                    children: [
                                      {
                                        type: "div",
                                        props: {
                                          style: {
                                            width: 24,
                                            height: 24,
                                            borderRadius: 12,
                                            backgroundColor: i < 3 ? medalColors[i] : "#555",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: 12,
                                            fontWeight: 700,
                                            color: DARK_BG,
                                          },
                                          children: `${i + 1}`,
                                        },
                                      },
                                      {
                                        type: "div",
                                        props: {
                                          style: { fontSize: 16, fontWeight: 600 },
                                          children: day.dayName,
                                        },
                                      },
                                    ],
                                  },
                                },
                                {
                                  type: "div",
                                  props: {
                                    style: { fontSize: 16, fontWeight: 700, color: KIKOFF_GREEN },
                                    children: `${day.avgOverall.toFixed(1)}`,
                                  },
                                },
                              ],
                            },
                          })),
                        ],
                      },
                    },
                  ],
                },
              },
              // Right column: Fan Favorites + Needs Work
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    gap: 16,
                  },
                  children: [
                    // Fan Favorites
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          flexDirection: "column",
                          backgroundColor: DARK_CARD,
                          borderRadius: 16,
                          padding: 20,
                          gap: 12,
                          flex: 1,
                        },
                        children: [
                          {
                            type: "div",
                            props: {
                              style: { fontSize: 14, color: GOLD, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 },
                              children: "HALL OF FAME",
                            },
                          },
                          ...topDishes.map((dish, i) => ({
                            type: "div",
                            props: {
                              style: {
                                display: "flex",
                                flexDirection: "column",
                                padding: "8px 12px",
                                backgroundColor: i === 0 ? "#2a2b1a" : "transparent",
                                borderRadius: 8,
                                borderLeft: `3px solid ${medalColors[i] || "#555"}`,
                              },
                              children: [
                                {
                                  type: "div",
                                  props: {
                                    style: { display: "flex", justifyContent: "space-between", alignItems: "center" },
                                    children: [
                                      {
                                        type: "div",
                                        props: {
                                          style: { fontSize: 16, fontWeight: 700 },
                                          children: dish.name,
                                        },
                                      },
                                      {
                                        type: "div",
                                        props: {
                                          style: { fontSize: 16, fontWeight: 700, color: KIKOFF_GREEN },
                                          children: `${dish.avg.toFixed(1)}`,
                                        },
                                      },
                                    ],
                                  },
                                },
                                {
                                  type: "div",
                                  props: {
                                    style: { fontSize: 12, color: TEXT_GRAY, marginTop: 2 },
                                    children: `${dish.category} - ${dish.dayName}`,
                                  },
                                },
                              ],
                            },
                          })),
                        ],
                      },
                    },
                    // Needs work
                    worstDish && sortedDishes.length > 1
                      ? {
                          type: "div",
                          props: {
                            style: {
                              display: "flex",
                              flexDirection: "column",
                              backgroundColor: DARK_CARD,
                              borderRadius: 16,
                              padding: 20,
                              border: "1px solid #3a2020",
                            },
                            children: [
                              {
                                type: "div",
                                props: {
                                  style: { fontSize: 14, color: "#ff6b6b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
                                  children: "HALL OF SHAME",
                                },
                              },
                              {
                                type: "div",
                                props: {
                                  style: { display: "flex", justifyContent: "space-between", alignItems: "center" },
                                  children: [
                                    {
                                      type: "div",
                                      props: {
                                        style: { display: "flex", flexDirection: "column" },
                                        children: [
                                          {
                                            type: "div",
                                            props: {
                                              style: { fontSize: 16, fontWeight: 700 },
                                              children: worstDish.name,
                                            },
                                          },
                                          {
                                            type: "div",
                                            props: {
                                              style: { fontSize: 12, color: TEXT_GRAY, marginTop: 2 },
                                              children: `${worstDish.category} - ${worstDish.dayName}`,
                                            },
                                          },
                                        ],
                                      },
                                    },
                                    {
                                      type: "div",
                                      props: {
                                        style: { fontSize: 20, fontWeight: 700, color: "#ff6b6b" },
                                        children: `${worstDish.avg.toFixed(1)}`,
                                      },
                                    },
                                  ],
                                },
                              },
                            ],
                          },
                        }
                      : { type: "div", props: { children: "" } },
                  ],
                },
              },
            ],
          },
        },
        // Footer
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              justifyContent: "space-between",
              marginTop: 16,
              paddingTop: 12,
              borderTop: "1px solid #333",
            },
            children: [
              {
                type: "div",
                props: {
                  style: { fontSize: 12, color: TEXT_GRAY },
                  children: "Powered by RateMyPlate @ Kikoff",
                },
              },
              {
                type: "div",
                props: {
                  style: { fontSize: 12, color: TEXT_GRAY },
                  children: `Generated ${new Date().toLocaleDateString("en-US", { timeZone: "America/Los_Angeles" })}`,
                },
              },
            ],
          },
        },
      ],
    },
  };
}

// Satori needs a React-like element tree. We build it as plain objects with
// { type, props: { style, children } } which satori accepts directly.

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const startDate = searchParams.get("start");
    const endDate = searchParams.get("end");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "start and end date params required" },
        { status: 400 }
      );
    }

    const rankings = await getWeeklyRankings(startDate, endDate);
    const element = buildRankingsJsx(rankings, startDate, endDate);

    // Load font from local file system
    const fontPath = join(process.cwd(), "public", "fonts", "Geist-Regular.ttf");
    const fontBuffer = readFileSync(fontPath);
    const fontData = fontBuffer.buffer.slice(fontBuffer.byteOffset, fontBuffer.byteOffset + fontBuffer.byteLength);

    const svg = await satori(element as React.ReactNode, {
      width: 1200,
      height: 675,
      fonts: [
        {
          name: "Geist",
          data: fontData,
          weight: 400,
          style: "normal",
        },
        {
          name: "Geist",
          data: fontData,
          weight: 700,
          style: "normal",
        },
      ],
    });

    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

    return new Response(new Uint8Array(pngBuffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Failed to generate rankings image:", error);
    return NextResponse.json(
      { error: "Failed to generate image", details: String(error) },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { buildDailyMenuBlocks, postToChannel, buildPowerRankingsBlocks, sendDirectMessage } from "@/lib/slack-bot";
import { fetchMenuFromSheet } from "@/lib/google-sheets";
import { upsertMenuDay, getMenuForDate, getWeeklyRankings } from "@/lib/db";

// Test endpoint to manually trigger Slack bot actions
// Usage:
//   GET /api/slack/test?action=sync         → sync menu from Google Sheets
//   GET /api/slack/test?action=post         → post today's menu to channel
//   GET /api/slack/test?action=post&date=2026-03-25 → post specific date's menu
//   GET /api/slack/test?action=rankings     → post power rankings
//   GET /api/slack/test?action=preview      → preview the message blocks (no posting)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "preview";
  const dateParam = searchParams.get("date");

  // Only allow in development or with cron secret
  const secret = searchParams.get("secret");
  const isDev = process.env.NODE_ENV === "development";
  const cronSecret = process.env.CRON_SECRET || "CobY2GYySAz309EXEQG6UB8ZL8YoBVUvfRjC3VtluwM";
  if (!isDev && secret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // ─── Sync menu from Google Sheets ─────────────────────────────────
    if (action === "sync") {
      const menuItems = await fetchMenuFromSheet();
      for (const item of menuItems) {
        await upsertMenuDay(item);
      }
      return NextResponse.json({
        success: true,
        action: "sync",
        synced: menuItems.length,
        items: menuItems.map((m) => ({
          date: m.date,
          dayName: m.dayName,
          starch: m.starch,
          veganProtein: m.veganProtein,
          veg: m.veg,
          protein1: m.protein1,
          protein2: m.protein2,
          noService: m.noService,
        })),
      });
    }

    // ─── Post daily menu ─────────────────────────────────────────────
    if (action === "post") {
      const now = new Date();
      const ptDate = new Date(
        now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" })
      );
      const today = dateParam || ptDate.toISOString().split("T")[0];

      // Ensure menu is synced
      let menu = await getMenuForDate(today);
      if (!menu) {
        const menuItems = await fetchMenuFromSheet();
        for (const item of menuItems) {
          await upsertMenuDay(item);
        }
        menu = await getMenuForDate(today);
      }

      if (!menu || menu.no_service) {
        return NextResponse.json({
          success: false,
          message: `No lunch service for ${today}`,
          menu,
        });
      }

      const blocks = await buildDailyMenuBlocks(today);
      if (!blocks) {
        return NextResponse.json({
          success: false,
          message: "Could not build menu blocks",
        });
      }

      const ts = await postToChannel(blocks, `Today's lunch is ready! Rate it now 🍽️`);

      return NextResponse.json({
        success: true,
        action: "post",
        date: today,
        messageTs: ts,
      });
    }

    // ─── Post power rankings ─────────────────────────────────────────
    if (action === "rankings") {
      const now = new Date();
      const pt = new Date(
        now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" })
      );
      const day = pt.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(pt);
      monday.setDate(pt.getDate() + diffToMonday);
      const thursday = new Date(monday);
      thursday.setDate(monday.getDate() + 3);

      const startDate = monday.toISOString().split("T")[0];
      const endDate = thursday.toISOString().split("T")[0];

      const rankings = await getWeeklyRankings(startDate, endDate);
      const blocks = buildPowerRankingsBlocks(rankings);
      const ts = await postToChannel(blocks, "This week's Power Rankings are here! 🏆");

      return NextResponse.json({
        success: true,
        action: "rankings",
        startDate,
        endDate,
        daysRanked: rankings.length,
        messageTs: ts,
      });
    }

    // ─── DM preview to a specific user ────────────────────────────────
    if (action === "dm") {
      const userId = searchParams.get("user") || "U09L4ET6KUH"; // default: Sukkriti
      const now = new Date();
      const ptDate = new Date(
        now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" })
      );
      const today = dateParam || ptDate.toISOString().split("T")[0];

      let menu = await getMenuForDate(today);
      if (!menu) {
        const menuItems = await fetchMenuFromSheet();
        for (const item of menuItems) {
          await upsertMenuDay(item);
        }
        menu = await getMenuForDate(today);
      }

      if (!menu || menu.no_service) {
        return NextResponse.json({ success: false, message: `No lunch service for ${today}` });
      }

      const blocks = await buildDailyMenuBlocks(today);
      if (!blocks) {
        return NextResponse.json({ success: false, message: "Could not build menu blocks" });
      }

      await sendDirectMessage(userId, `Today's lunch is ready! Rate it now 🍽️`, blocks);

      return NextResponse.json({ success: true, action: "dm", date: today, userId });
    }

    // ─── Preview (default) — shows blocks without posting ────────────
    const now = new Date();
    const ptDate = new Date(
      now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" })
    );
    const today = dateParam || ptDate.toISOString().split("T")[0];

    let menu = await getMenuForDate(today);
    if (!menu) {
      const menuItems = await fetchMenuFromSheet();
      for (const item of menuItems) {
        await upsertMenuDay(item);
      }
      menu = await getMenuForDate(today);
    }

    const blocks = menu && !menu.no_service ? await buildDailyMenuBlocks(today) : null;

    return NextResponse.json({
      action: "preview",
      date: today,
      menu: menu || null,
      blocks: blocks || "No menu / no service for this date",
      hint: "Use ?action=post to actually send to Slack, ?action=sync to sync menu, ?action=rankings for power rankings",
    });
  } catch (error) {
    console.error("Slack test error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

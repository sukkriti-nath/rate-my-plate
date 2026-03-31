import { NextResponse } from "next/server";
import { buildDailyMenuBlocks, postToChannel } from "@/lib/slack-bot";
import { fetchAllMenus } from "@/lib/google-sheets";
import { upsertMenuDay, getMenuForDate } from "@/lib/db";

export async function GET(request: Request) {
  // Verify cron secret
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get today's date in PT (Pacific Time)
    const now = new Date();
    const ptDate = new Date(
      now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" })
    );
    const today = ptDate.toISOString().split("T")[0];
    const dayOfWeek = ptDate.getDay(); // 0=Sun, 1=Mon, ..., 4=Thu

    // Only post Mon-Fri (1-5)
    if (dayOfWeek < 1 || dayOfWeek > 5) {
      return NextResponse.json({
        message: "Not a posting day (Mon-Fri only)",
        dayOfWeek,
      });
    }

    // Make sure we have today's menu synced
    let menu = getMenuForDate(today);
    if (!menu) {
      // Try to sync from sheet
      try {
        const menuItems = await fetchAllMenus();
        for (const item of menuItems) {
          upsertMenuDay(item);
        }
        menu = getMenuForDate(today);
      } catch (err) {
        console.error("Failed to sync menu:", err);
      }
    }

    if (!menu || menu.no_service) {
      return NextResponse.json({
        message: "No lunch service today",
        date: today,
      });
    }

    // Build and post the message
    const blocks = buildDailyMenuBlocks(today);
    if (!blocks) {
      return NextResponse.json({
        message: "Could not build menu blocks",
        date: today,
      });
    }

    const ts = await postToChannel(
      blocks,
      `Today's lunch is ready! Rate it now 🍽️`
    );

    return NextResponse.json({
      success: true,
      date: today,
      messageTs: ts,
    });
  } catch (error) {
    console.error("Failed to post daily menu:", error);
    return NextResponse.json(
      { error: "Failed to post daily menu", details: String(error) },
      { status: 500 }
    );
  }
}

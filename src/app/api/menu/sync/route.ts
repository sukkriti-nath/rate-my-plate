import { NextResponse } from "next/server";
import { fetchAllMenus } from "@/lib/google-sheets";
import { upsertMenuDay } from "@/lib/db";

export async function GET(request: Request) {
  // Optional: verify cron secret for production
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const menuItems = await fetchAllMenus();

    for (const item of menuItems) {
      upsertMenuDay(item);
    }

    return NextResponse.json({
      success: true,
      synced: menuItems.length,
      dates: menuItems.map((m) => m.date),
    });
  } catch (error) {
    console.error("Menu sync failed:", error);
    return NextResponse.json(
      { error: "Failed to sync menu", details: String(error) },
      { status: 500 }
    );
  }
}

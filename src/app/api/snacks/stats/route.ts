import { NextResponse } from "next/server";
import {
  getSnackStats,
  getLeaderboard,
  getCategoryDemand,
  getMostWantedItems,
  getOutOfStockReports,
  getPublicProfiles,
} from "@/lib/snack-db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [stats, leaderboard, categoryDemand, mostWanted, outOfStock, profiles] =
      await Promise.all([
        getSnackStats(),
        getLeaderboard(10),
        getCategoryDemand(),
        getMostWantedItems(10),
        getOutOfStockReports(),
        getPublicProfiles(),
      ]);

    return NextResponse.json({
      stats,
      leaderboard,
      categoryDemand,
      mostWanted,
      outOfStock,
      profileCount: profiles.length,
    });
  } catch (error) {
    console.error("Error fetching snack stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}

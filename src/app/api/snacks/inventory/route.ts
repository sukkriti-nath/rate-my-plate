import { NextResponse } from "next/server";
import { getInventoryStructuredRows } from "@/lib/snack-sheet";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "1";
    const items = await getInventoryStructuredRows(forceRefresh);
    return NextResponse.json({
      items,
      _debug: {
        beverageCount: items.filter((i) => i.tab === "beverages").length,
        snackCount: items.filter((i) => i.tab === "snacks").length,
        forceRefresh,
      },
    });
  } catch (error) {
    console.error("Error fetching snack sheet inventory:", error);
    return NextResponse.json(
      { error: "Failed to fetch inventory" },
      { status: 500 }
    );
  }
}

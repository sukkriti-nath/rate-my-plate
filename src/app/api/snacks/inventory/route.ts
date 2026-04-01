import { NextResponse } from "next/server";
import { getInventoryStructuredRows } from "@/lib/snack-sheet";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await getInventoryStructuredRows();
    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error fetching snack sheet inventory:", error);
    return NextResponse.json(
      { error: "Failed to fetch inventory" },
      { status: 500 }
    );
  }
}

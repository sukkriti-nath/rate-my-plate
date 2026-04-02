import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  awardPoints,
  getProfile,
  getWebSnackProfileUserId,
  upsertProfile,
} from "@/lib/snack-sheets-sync";

export const dynamic = "force-dynamic";

const BUDGET_TOTAL = 100;
const STEP = 10;

function sumAlloc(m: Record<string, number>): number {
  return Object.values(m).reduce((a, b) => a + (Number(b) || 0), 0);
}

function validateAllocations(
  drinks: Record<string, number>,
  snacks: Record<string, number>
): string | null {
  const all = [...Object.values(drinks), ...Object.values(snacks)];
  for (const v of all) {
    const n = Number(v) || 0;
    if (n < 0 || n > BUDGET_TOTAL || n % STEP !== 0) {
      return "Each category must use 0–100 in steps of 10.";
    }
  }
  const total = sumAlloc(drinks) + sumAlloc(snacks);
  if (total !== BUDGET_TOTAL) {
    return `All categories must add up to exactly ${BUDGET_TOTAL} points (currently ${total}).`;
  }
  return null;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const profile = await getProfile(session.email);
    return NextResponse.json({
      profile: profile
        ? {
            email: profile.email,
            displayName: profile.displayName,
            drinksAllocation: profile.drinksAllocation,
            snacksAllocation: profile.snacksAllocation,
            favoriteDrinks: profile.favoriteDrinks,
            favoriteSnacks: profile.favoriteSnacks,
          }
        : null,
    });
  } catch (e) {
    console.error("GET /api/snacks/web-profile:", e);
    return NextResponse.json(
      { error: "Failed to load profile" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = (await req.json()) as {
      drinksAllocation?: Record<string, number>;
      snacksAllocation?: Record<string, number>;
      favoriteDrinks?: string[];
      favoriteSnacks?: string[];
    };

    const drinksAllocation = body.drinksAllocation ?? {};
    const snacksAllocation = body.snacksAllocation ?? {};
    const favoriteDrinks = Array.isArray(body.favoriteDrinks)
      ? body.favoriteDrinks
      : [];
    const favoriteSnacks = Array.isArray(body.favoriteSnacks)
      ? body.favoriteSnacks
      : [];

    const err = validateAllocations(drinksAllocation, snacksAllocation);
    if (err) {
      return NextResponse.json({ error: err }, { status: 400 });
    }

    const existing = await getProfile(session.email);
    const isNew = !existing;
    const now = new Date().toISOString();

    await upsertProfile({
      email: session.email,
      displayName: session.displayName,
      drinksAllocation,
      snacksAllocation,
      favoriteDrinks,
      favoriteSnacks,
      isPublic: true,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    });

    const userId = getWebSnackProfileUserId(session.email);
    await awardPoints(
      userId,
      isNew ? "profile_create" : "profile_update",
      session.displayName
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/snacks/web-profile:", e);
    return NextResponse.json(
      { error: "Failed to save profile" },
      { status: 500 }
    );
  }
}

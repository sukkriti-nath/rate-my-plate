import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  addSuggestion,
  awardPoints,
  deleteSuggestion,
  getSuggestions,
  getWebSnackProfileUserId,
  voteSuggestion,
} from "@/lib/snack-sheets-sync";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    const userId = session ? getWebSnackProfileUserId(session.email) : undefined;
    const suggestions = await getSuggestions(userId);
    return NextResponse.json({ suggestions });
  } catch (e) {
    console.error("GET /api/snacks/suggestions:", e);
    return NextResponse.json(
      { error: "Failed to load suggestions" },
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
      action: "add" | "vote" | "delete";
      snackName?: string;
      suggestionId?: string;
      vote?: "up" | "down";
    };

    const userId = getWebSnackProfileUserId(session.email);

    if (body.action === "add") {
      if (!body.snackName?.trim()) {
        return NextResponse.json(
          { error: "Snack name is required" },
          { status: 400 }
        );
      }
      const suggestion = await addSuggestion(
        body.snackName.trim(),
        userId,
        session.displayName
      );
      await awardPoints(userId, "suggestion", session.displayName);
      return NextResponse.json({ ok: true, suggestion });
    }

    if (body.action === "vote") {
      if (!body.suggestionId || !body.vote) {
        return NextResponse.json(
          { error: "suggestionId and vote are required" },
          { status: 400 }
        );
      }
      if (body.vote !== "up" && body.vote !== "down") {
        return NextResponse.json(
          { error: "vote must be 'up' or 'down'" },
          { status: 400 }
        );
      }
      await voteSuggestion(body.suggestionId, userId, body.vote);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "delete") {
      if (!body.suggestionId) {
        return NextResponse.json(
          { error: "suggestionId is required" },
          { status: 400 }
        );
      }
      try {
        await deleteSuggestion(body.suggestionId, userId);
        return NextResponse.json({ ok: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg === "Forbidden") {
          return NextResponse.json(
            { error: "You can only delete suggestions you created" },
            { status: 403 }
          );
        }
        if (msg === "Not found") {
          return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
        }
        throw err;
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e) {
    console.error("POST /api/snacks/suggestions:", e);
    return NextResponse.json(
      { error: "Failed to process suggestion" },
      { status: 500 }
    );
  }
}

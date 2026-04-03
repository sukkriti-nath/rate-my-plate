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
import { searchDuckDuckGoImage } from "@/lib/duckduckgo-images";

// Blocklist of obviously non-food items
const NON_FOOD_TERMS = [
  // Vehicles & brands
  "car", "truck", "suv", "sedan", "coupe", "van", "bus", "motorcycle", "bike",
  "toyota", "honda", "ford", "chevy", "chevrolet", "bmw", "mercedes", "audi",
  "tesla", "prius", "camry", "civic", "mustang", "corvette", "ferrari", "porsche",
  "lamborghini", "bentley", "rolls royce", "lexus", "nissan", "hyundai", "kia",
  "volvo", "subaru", "mazda", "jeep", "dodge", "chrysler", "cadillac", "buick",
  "volkswagen", "vw", "jaguar", "land rover", "maserati", "bugatti", "mclaren",
  // Car/vehicle parts
  "tire", "tires", "wheel", "engine", "transmission", "brake", "exhaust", "bumper",
  "windshield", "headlight", "taillight", "muffler", "carburetor", "radiator",
  // Heavy machinery & construction
  "excavator", "bulldozer", "crane", "forklift", "tractor", "backhoe", "loader",
  "dump truck", "cement mixer", "steamroller", "hydraulic", "caterpillar", "komatsu",
  "john deere", "bobcat", "jcb", "hitachi", "kubota",
  // Electronics
  "iphone", "macbook", "laptop", "computer", "monitor", "keyboard", "mouse",
  "television", "tv", "playstation", "xbox", "nintendo", "airpods", "ipad",
  "samsung", "pixel", "android", "tablet", "smartphone", "printer", "router",
  // Furniture
  "couch", "sofa", "table", "chair", "desk", "bed", "mattress", "dresser",
  "bookshelf", "cabinet", "wardrobe", "nightstand", "ottoman", "recliner",
  // Landmarks & buildings
  "bridge", "tower", "statue", "monument", "building", "skyscraper", "castle",
  "golden gate", "eiffel", "big ben", "colosseum", "taj mahal", "great wall",
  "empire state", "burj", "sydney opera", "stonehenge", "pyramid",
  // Books, movies, media
  "treasure island", "harry potter", "lord of the rings", "game of thrones",
  "star wars", "marvel", "dc comics", "batman", "superman", "spiderman",
  "netflix", "disney", "pixar", "dreamworks", "novel", "textbook",
  // Other nonsense
  "house", "apartment", "money", "cash", "bitcoin", "crypto", "stock", "nft",
  "cocaine", "weed", "drugs", "gun", "weapon", "knife", "sword",
  "human", "person", "people", "employee", "coworker", "manager", "ceo",
  "planet", "moon", "sun", "star", "galaxy", "universe", "earth", "mars",
  "country", "city", "state", "nation", "continent", "ocean", "river", "mountain",
];

function isObviouslyNotFood(name: string): boolean {
  const lower = name.toLowerCase().trim();
  return NON_FOOD_TERMS.some(term => {
    // Match whole words or the entire input
    const regex = new RegExp(`\\b${term}s?\\b`, "i");
    return regex.test(lower);
  });
}

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

      // Block obviously non-food items
      if (isObviouslyNotFood(body.snackName)) {
        return NextResponse.json(
          { error: "Nice try, but that doesn't look like a snack 🙄" },
          { status: 400 }
        );
      }

      // Scrape image from DuckDuckGo
      const imageUrl = await searchDuckDuckGoImage(body.snackName.trim());

      const suggestion = await addSuggestion(
        body.snackName.trim(),
        userId,
        session.displayName,
        imageUrl
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
      try {
        await voteSuggestion(body.suggestionId, userId, body.vote);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg === "UPVOTE_LIMIT") {
          return NextResponse.json(
            {
              error:
                "You can upvote at most 3 suggestions from other people (your own suggestions don’t count toward that limit).",
            },
            { status: 400 }
          );
        }
        throw err;
      }
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
        if (msg === "TooManyUpvotes") {
          return NextResponse.json(
            { error: "Cannot delete suggestions with 2 or more upvotes" },
            { status: 400 }
          );
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

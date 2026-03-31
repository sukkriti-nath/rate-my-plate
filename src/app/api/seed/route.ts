import { NextResponse } from "next/server";
import { upsertMenuDay, upsertVote } from "@/lib/db";

// Fake Kikoff users for generating realistic vote distributions
const FAKE_USERS = [
  { name: "Alex Chen", email: "alex@kikoff.com" },
  { name: "Jordan Lee", email: "jordan@kikoff.com" },
  { name: "Sam Patel", email: "sam@kikoff.com" },
  { name: "Morgan Kim", email: "morgan@kikoff.com" },
  { name: "Taylor Nguyen", email: "taylor@kikoff.com" },
  { name: "Casey Johnson", email: "casey@kikoff.com" },
  { name: "Riley Davis", email: "riley@kikoff.com" },
  { name: "Jamie Garcia", email: "jamie@kikoff.com" },
];

// Generate votes that average to a target rating
function generateVotes(target: number, count: number): number[] {
  const votes: number[] = [];
  const base = Math.round(target);
  for (let i = 0; i < count; i++) {
    // Vary +/- 1 from base, clamped to 1-5
    const offset = (Math.random() - 0.5) * 2;
    const vote = Math.min(5, Math.max(1, Math.round(base + offset)));
    votes.push(vote);
  }
  return votes;
}

interface SeedRow {
  date: string;
  day_of_week: string;
  meal_type: string;
  restaurant: string | null;
  overall_rating: number;
  starch: string;
  starch_rating: number;
  vegan_protein: string;
  vegan_protein_rating: number;
  vegetable: string;
  vegetable_rating: number;
  protein_1: string;
  protein_1_rating: number;
  protein_2: string;
  protein_2_rating: number;
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { rows } = (await request.json()) as { rows: SeedRow[] };
    let menusInserted = 0;
    let votesInserted = 0;

    for (const row of rows) {
      // Insert menu
      const isFriday = row.day_of_week === "Friday";
      await upsertMenuDay({
        date: row.date,
        dayName: row.day_of_week,
        breakfast: null,
        starch: row.starch,
        veganProtein: row.vegan_protein,
        veg: row.vegetable,
        protein1: row.protein_1,
        protein2: row.protein_2,
        sauceSides: null,
        restaurant: row.restaurant || (isFriday ? row.meal_type : null),
        noService: false,
      });
      menusInserted++;

      // Generate votes from fake users (5-8 voters per day)
      const voterCount = 5 + Math.floor(Math.random() * 4);
      const overallVotes = generateVotes(row.overall_rating, voterCount);
      const starchVotes = generateVotes(row.starch_rating, voterCount);
      const veganVotes = generateVotes(row.vegan_protein_rating, voterCount);
      const vegVotes = generateVotes(row.vegetable_rating, voterCount);
      const p1Votes = generateVotes(row.protein_1_rating, voterCount);
      const p2Votes = generateVotes(row.protein_2_rating, voterCount);

      for (let i = 0; i < voterCount; i++) {
        const user = FAKE_USERS[i % FAKE_USERS.length];
        await upsertVote({
          menuDate: row.date,
          userName: user.name,
          userEmail: user.email,
          ratingOverall: overallVotes[i],
          ratingStarch: starchVotes[i],
          ratingVeganProtein: veganVotes[i],
          ratingVeg: vegVotes[i],
          ratingProtein1: p1Votes[i],
          ratingProtein2: p2Votes[i],
          comment: null,
          commentStarch: null,
          commentVeganProtein: null,
          commentVeg: null,
          commentProtein1: null,
          commentProtein2: null,
        });
        votesInserted++;
      }
    }

    return NextResponse.json({
      success: true,
      menusInserted,
      votesInserted,
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Seed failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

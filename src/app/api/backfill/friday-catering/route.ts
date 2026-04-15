import { NextResponse } from "next/server";
import { getDb, getVoteStatsForDate } from "@/lib/db";
import { syncFridayCatering } from "@/lib/google-sheets-writer";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const result = await db.query(
    "SELECT * FROM menu_days WHERE LOWER(day_name) = 'friday' AND no_service = 0 ORDER BY date"
  );
  const fridays = result.rows as Record<string, unknown>[];

  const synced: string[] = [];
  for (const menu of fridays) {
    const date = menu.date as string;
    const stats = await getVoteStatsForDate(date);
    if (stats.totalVotes === 0) continue;

    const dishes = [
      { name: menu.starch as string | null, rating: stats.dishRatings.starch.avg },
      { name: menu.vegan_protein as string | null, rating: stats.dishRatings.veganProtein.avg },
      { name: menu.veg as string | null, rating: stats.dishRatings.veg.avg },
      { name: menu.protein_1 as string | null, rating: stats.dishRatings.protein1.avg },
      { name: menu.protein_2 as string | null, rating: stats.dishRatings.protein2.avg },
      { name: (menu.dish_6 as string) || null, rating: stats.dishRatings.dish6.avg },
      { name: (menu.dish_7 as string) || null, rating: stats.dishRatings.dish7.avg },
      { name: (menu.dish_8 as string) || null, rating: stats.dishRatings.dish8.avg },
      { name: (menu.dish_9 as string) || null, rating: stats.dishRatings.dish9.avg },
    ].filter((d) => d.name);
    const rated = dishes.filter((d) => d.rating > 0);
    const topDish = rated.length ? rated.reduce((a, b) => (a.rating >= b.rating ? a : b)) : { name: "N/A", rating: 0 };
    const bottomDish = rated.length ? rated.reduce((a, b) => (a.rating <= b.rating ? a : b)) : { name: "N/A", rating: 0 };

    await syncFridayCatering({
      date,
      restaurant: (menu.restaurant as string) || "",
      overallRating: stats.averageOverall,
      totalVotes: stats.totalVotes,
      topDish: topDish.name || "N/A",
      topDishRating: topDish.rating,
      bottomDish: bottomDish.name || "N/A",
      bottomDishRating: bottomDish.rating,
      dishes,
    });
    synced.push(date);
  }

  return NextResponse.json({ success: true, synced });
}

import { getMenuForDate } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getUserVoteForDate } from "@/lib/db";
import MenuCard from "@/components/MenuCard";
import RatingForm from "@/components/RatingForm";
import LiveResults from "@/components/LiveResults";
import Link from "next/link";

export const dynamic = "force-dynamic";

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

export default async function Home() {
  const today = getTodayDate();
  const menu = getMenuForDate(today) as Record<string, unknown> | undefined;
  const session = await getSession();

  if (!menu) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          No menu for today
        </h1>
        <p className="text-gray-500 mb-6">
          The menu hasn&apos;t been synced yet, or there&apos;s no lunch today.
        </p>
        <a
          href="/api/menu/sync"
          className="inline-block px-6 py-3 bg-kikoff text-kikoff-dark font-semibold rounded-xl hover:bg-kikoff-hover transition-colors"
        >
          Sync Menu from Sheet
        </a>
        <p className="text-xs text-gray-400 mt-3">
          This fetches the latest menu from the Google Sheet
        </p>
      </div>
    );
  }

  const dishes = [
    { key: "starch", label: "Starch", name: menu.starch as string | null },
    { key: "vegan_protein", label: "Vegan Protein", name: menu.vegan_protein as string | null },
    { key: "veg", label: "Veg", name: menu.veg as string | null },
    { key: "protein_1", label: "Protein 1", name: menu.protein_1 as string | null },
    { key: "protein_2", label: "Protein 2", name: menu.protein_2 as string | null },
  ];

  let existingVote = null;
  if (session) {
    existingVote = getUserVoteForDate(session.email, today) as Record<string, unknown> | null;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      {/* Today's Menu */}
      <section>
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
          Today&apos;s Menu
        </h2>
        <MenuCard
          menu={{
            date: menu.date as string,
            day_name: menu.day_name as string,
            breakfast: menu.breakfast as string,
            starch: menu.starch as string,
            vegan_protein: menu.vegan_protein as string,
            veg: menu.veg as string,
            protein_1: menu.protein_1 as string,
            protein_2: menu.protein_2 as string,
            sauce_sides: menu.sauce_sides as string,
            no_service: menu.no_service as number,
          }}
        />
      </section>

      {/* Rating Section */}
      {!(menu.no_service as number) && (
        <section>
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
            Rate It
          </h2>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            {session ? (
              <RatingForm
                date={today}
                dishes={dishes}
                existingVote={existingVote}
              />
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-500 mb-3">
                  Sign in to rate today&apos;s lunch
                </p>
                <Link
                  href="/login"
                  className="inline-block px-6 py-3 bg-kikoff text-kikoff-dark font-semibold rounded-xl hover:bg-kikoff-hover transition-all"
                >
                  Sign in with Kikoff Email
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Live Results */}
      <section>
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
          Live Results
        </h2>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <LiveResults date={today} />
        </div>
      </section>
    </div>
  );
}

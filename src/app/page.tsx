import { getMenuForDate } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getUserVoteForDate } from "@/lib/db";
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
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="text-6xl mb-4">🍽️</div>
        <h1 className="font-display text-3xl text-gray-900 mb-3">
          No menu for today
        </h1>
        <p className="text-gray-400 mb-8 max-w-sm mx-auto">
          The menu hasn&apos;t been synced yet, or there&apos;s no lunch service today.
        </p>
        <a
          href="/api/menu/sync"
          className="inline-block px-8 py-3.5 bg-kikoff text-kikoff-dark font-bold rounded-2xl hover:bg-kikoff-hover hover:shadow-lg hover:shadow-kikoff/20 transition-all active:scale-[0.98]"
        >
          Sync Menu from Sheet ↗
        </a>
        <p className="text-xs text-gray-300 mt-3">
          Pulls the latest menu from the Google Sheet
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

  const dayName = menu.day_name as string;
  const greeting = getTimeGreeting();

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Greeting */}
      {session && (
        <div className="animate-slide-up">
          <span className="text-sm text-gray-400">{greeting}</span>
          <h1 className="font-display text-2xl text-gray-900">
            {dayName}&apos;s Lineup
          </h1>
        </div>
      )}

      {/* Rating Section */}
      {!(menu.no_service as number) && (
        <section className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-xl">✍️</span>
              <h2 className="font-display text-xl text-gray-900">Rate It</h2>
            </div>
            {session ? (
              <RatingForm
                date={today}
                dishes={dishes}
                existingVote={existingVote}
              />
            ) : (
              <div className="text-center py-6">
                <div className="text-3xl mb-3">🔒</div>
                <p className="text-gray-500 mb-4">
                  Sign in to rate today&apos;s lunch
                </p>
                <Link
                  href="/login"
                  className="inline-block px-8 py-3 bg-kikoff text-kikoff-dark font-bold rounded-2xl hover:bg-kikoff-hover transition-all"
                >
                  Sign in with Kikoff Email
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Live Results */}
      <section className="animate-slide-up" style={{ animationDelay: "0.15s" }}>
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">📊</span>
              <h2 className="font-display text-xl text-gray-900">Live Results</h2>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-kikoff animate-pulse-glow" />
              live
            </div>
          </div>
          <LiveResults date={today} />
        </div>
      </section>
    </div>
  );
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning! ☀️";
  if (hour < 17) return "Good afternoon! 🌤️";
  return "Good evening! 🌙";
}

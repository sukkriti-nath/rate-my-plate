import { getMenuForDate, getRecentServiceDates } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getUserVoteForDate } from "@/lib/db";
import RatingForm from "@/components/RatingForm";
import LiveResults from "@/components/LiveResults";
import DatePicker from "@/components/DatePicker";
import Link from "next/link";

export const dynamic = "force-dynamic";

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

interface PageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const today = getTodayDate();

  // Validate the requested date: must be within 7 days of today
  let selectedDate = today;
  if (params.date) {
    const requested = params.date;
    const diff = (new Date(today + "T12:00:00").getTime() - new Date(requested + "T12:00:00").getTime()) / (1000 * 60 * 60 * 24);
    if (diff >= 0 && diff <= 7) {
      selectedDate = requested;
    }
  }

  const menu = await getMenuForDate(selectedDate) as Record<string, unknown> | undefined;
  const session = await getSession();
  const availableDates = await getRecentServiceDates(today, 7);

  const noService = !menu || (menu.no_service as number);
  const isToday = selectedDate === today;

  if (noService) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {availableDates.length > 1 && (
          <DatePicker currentDate={selectedDate} todayDate={today} availableDates={availableDates} />
        )}
        <div className="text-center py-8">
          <div className="text-6xl mb-4">🍽️</div>
          <h1 className="font-display text-3xl text-gray-900 mb-3">
            {isToday ? "No menu for today" : "No menu for this day"}
          </h1>
          <p className="text-gray-400 mb-8 max-w-sm mx-auto">
            The menu hasn&apos;t been synced yet, or there&apos;s no lunch service {isToday ? "today" : "on this day"}.
          </p>
          {isToday && (
            <>
              <a
                href="/api/menu/sync"
                className="inline-block px-8 py-3.5 bg-kikoff text-kikoff-dark font-bold rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
              >
                Sync Menu from Sheet ↗
              </a>
              <p className="text-xs text-gray-300 mt-3">
                Pulls the latest menu from the Google Sheet
              </p>
            </>
          )}
        </div>
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
    existingVote = await getUserVoteForDate(session.email, selectedDate) as Record<string, unknown> | null;
  }

  const dayName = menu.day_name as string;
  const restaurant = menu.restaurant as string | null;
  const greeting = getTimeGreeting();
  const dateLabel = new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Date Navigation */}
      {availableDates.length > 1 && (
        <div className="animate-slide-up">
          <DatePicker currentDate={selectedDate} todayDate={today} availableDates={availableDates} />
        </div>
      )}

      {/* Greeting */}
      {session && (
        <div className="animate-slide-up">
          {isToday ? (
            <span className="text-sm text-gray-400">{greeting}</span>
          ) : (
            <span className="text-sm text-amber-500 font-medium">Voting for a past day</span>
          )}
          <h1 className="font-display text-2xl text-gray-900">
            {isToday ? `${dayName}'s Lineup` : dateLabel}
          </h1>
          {restaurant && (
            <p className="text-sm text-kikoff-hover font-medium mt-0.5">
              🍴 Catered by {restaurant}
            </p>
          )}
        </div>
      )}

      {/* Rating Section */}
      <section className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
        <div className="bg-white rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_#000] p-6">
          <div className="flex items-center gap-2 mb-5">
            <span className="text-xl">✍️</span>
            <h2 className="font-display text-xl text-gray-900 font-bold">Rate It</h2>
          </div>
          {session ? (
            <RatingForm
              date={selectedDate}
              dishes={dishes}
              existingVote={existingVote}
            />
          ) : (
            <div className="text-center py-6">
              <div className="text-3xl mb-3">🔒</div>
              <p className="text-gray-500 mb-4">
                Sign in to rate {isToday ? "today's" : "this"} lunch
              </p>
              <Link
                href="/login"
                className="inline-block px-8 py-3 bg-kikoff text-kikoff-dark font-bold rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
              >
                Sign in with Kikoff Email
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Live Results */}
      <section className="animate-slide-up" style={{ animationDelay: "0.15s" }}>
        <div className="bg-white rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_#000] p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">📊</span>
              <h2 className="font-display text-xl text-gray-900 font-bold">{isToday ? "Live Results" : "Results"}</h2>
            </div>
            {isToday && (
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className="w-1.5 h-1.5 rounded-full bg-kikoff animate-pulse-glow" />
                live
              </div>
            )}
          </div>
          <LiveResults date={selectedDate} />
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

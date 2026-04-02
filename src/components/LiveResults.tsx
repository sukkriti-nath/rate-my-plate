"use client";

import { useEffect, useState, useCallback } from "react";

interface DishRating {
  avg: number;
  votes: number;
}

interface Stats {
  totalVotes: number;
  averageOverall: number;
  dishRatings: {
    starch: DishRating;
    veganProtein: DishRating;
    veg: DishRating;
    protein1: DishRating;
    protein2: DishRating;
  };
  distribution: Record<number, number>;
}

interface Vote {
  user_name: string;
  avatar_url: string | null;
  rating_overall: number;
  comment: string | null;
  created_at: string;
}

interface MenuData {
  starch?: string;
  vegan_protein?: string;
  veg?: string;
  protein_1?: string;
  protein_2?: string;
}

function ratingEmoji(avg: number): string {
  if (avg >= 4.5) return "🔥";
  if (avg >= 3.5) return "😋";
  if (avg >= 2.5) return "🙂";
  if (avg >= 1.5) return "😐";
  return "😬";
}

export default function LiveResults({
  date,
  isToday = false,
  hasVoted: initialHasVoted = false,
  pollInterval = 5000,
}: {
  date: string;
  isToday?: boolean;
  hasVoted?: boolean;
  pollInterval?: number;
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [menu, setMenu] = useState<MenuData | null>(null);
  const [hasVoted, setHasVoted] = useState(initialHasVoted);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/votes?date=${date}&_t=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      setStats(data.stats);
      setVotes(data.votes);
      setMenu(data.menu);
      // Derive hasVoted from the live API response so it stays accurate for
      // past days and updates instantly after the user submits a new vote.
      if (data.userVote != null) {
        setHasVoted(true);
      }
    } catch {
      // Silently retry next interval
    }
  }, [date]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, pollInterval);
    return () => clearInterval(interval);
  }, [fetchData, pollInterval]);

  const headerBlock = (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <span className="text-xl">📊</span>
        <h2 className="font-display text-xl text-gray-900 font-bold">
          {isToday ? "Live Results from All Kiksters" : "Results from All Kiksters"}
        </h2>
      </div>
      {isToday && (
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="w-1.5 h-1.5 rounded-full bg-kikoff animate-pulse-glow" />
          live
        </div>
      )}
    </div>
  );

  if (!stats) {
    return (
      <div>
        {headerBlock}
        <div className="text-gray-400 text-center py-8">Loading results...</div>
      </div>
    );
  }

  if (stats.totalVotes === 0) {
    const ptHour = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })).getHours();
    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })).toISOString().split("T")[0];
    const isBeforeNoon = date === today && ptHour < 12;

    return (
      <div>
        {headerBlock}
        <div className="text-center py-8">
          <div className="text-4xl mb-3">{isBeforeNoon ? "⏰" : "🍽️"}</div>
          <p className="text-gray-400 text-lg">{isBeforeNoon ? "Voting hasn\u2019t opened yet" : "No votes yet"}</p>
          <p className="text-gray-300 text-sm mt-1">
            {isBeforeNoon
              ? "Come back after lunch to cast your vote!"
              : "Be the first to rate today\u2019s lunch!"}
          </p>
        </div>
      </div>
    );
  }

  const dishEntries = ([
    { key: "starch" as const, label: "Starch", name: menu?.starch?.replace(/\(V\)/g, "").replace(/\(Gf\)/g, "").trim() },
    { key: "veganProtein" as const, label: "Vegan Protein", name: menu?.vegan_protein?.replace(/\(V\)/g, "").replace(/\(Gf\)/g, "").trim() },
    { key: "veg" as const, label: "Veg", name: menu?.veg?.replace(/\(V\)/g, "").replace(/\(Gf\)/g, "").trim() },
    { key: "protein1" as const, label: "Protein 1", name: menu?.protein_1?.replace(/\(V\)/g, "").replace(/\(Gf\)/g, "").trim() },
    { key: "protein2" as const, label: "Protein 2", name: menu?.protein_2?.replace(/\(V\)/g, "").replace(/\(Gf\)/g, "").trim() },
  ] as const).filter((d) => d.name);

  const rankedDishes = dishEntries
    .filter((d) => stats.dishRatings[d.key] && stats.dishRatings[d.key].votes > 0)
    .sort((a, b) => (stats.dishRatings[b.key]?.avg || 0) - (stats.dishRatings[a.key]?.avg || 0));

  return (
    <div className="relative">
      {/* Lock overlay — shown until the user has voted for this day */}
      {!hasVoted && (
        <div className="absolute inset-0 z-10 rounded-xl overflow-hidden flex flex-col items-start justify-start gap-3 px-6 pt-10 text-center"
          style={{ backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", background: "rgba(255,255,255,0.55)" }}
        >
          <div className="bg-white rounded-2xl border-2 border-black shadow-[4px_4px_0px_0px_#000] px-6 py-5 flex flex-col items-center gap-2 w-full">
            <span className="text-3xl">🔒</span>
            <p className="text-base font-semibold text-gray-800 leading-snug">
              Submit your rating above to see company wide results.
            </p>
          </div>
        </div>
      )}

    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">📊</span>
          <h2 className="font-display text-xl text-gray-900 font-bold">
            {isToday ? "Live Results from All Kiksters" : "Results from All Kiksters"}
          </h2>
        </div>
        {isToday && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full bg-kikoff animate-pulse-glow" />
            live
          </div>
        )}
      </div>

      {/* Overall Summary */}
      <div className="flex items-center justify-center gap-4">
        <div className="bg-kikoff-lavender rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000] px-6 py-4 text-center">
          <div className="text-4xl font-bold text-kikoff-dark">
            {stats.averageOverall.toFixed(1)}
          </div>
          <div className="text-xs text-kikoff-dark/60 mt-1 font-medium">average overall score</div>
        </div>
        <div className="bg-kikoff-lavender rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000] px-6 py-4 text-center">
          <div className="text-4xl font-bold text-kikoff-dark">
            {stats.totalVotes}
          </div>
          <div className="text-xs text-kikoff-dark/60 mt-1 font-medium">total votes</div>
        </div>
      </div>

      {/* Dish Leaderboard */}
      {rankedDishes.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-gray-500">Dish Leaderboard</h4>
          {rankedDishes.map((dish, i) => {
            const rating = stats.dishRatings[dish.key];
            const pct = (rating.avg / 5) * 100;
            return (
              <div
                key={dish.key}
                className="bg-kikoff-lavender rounded-xl px-4 py-3 animate-slide-up border-2 border-black shadow-[4px_4px_0px_0px_#000]"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs text-gray-400 uppercase tracking-wider">
                        {dish.label}
                      </div>
                      <div className="text-sm text-gray-700 truncate">
                        {dish.name}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-lg font-bold text-kikoff-dark">
                      {rating.avg.toFixed(1)}
                    </span>
                    <span className="text-xs text-gray-400">
                      ({rating.votes})
                    </span>
                  </div>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden border border-black">
                  <div
                    className="h-full bg-kikoff rounded-full transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Distribution */}
      <div className="space-y-1.5">
        <h4 className="text-sm font-bold text-gray-500">Overall Rating Distribution</h4>
        {[5, 4, 3, 2, 1].map((star) => {
          const count = stats.distribution[star] || 0;
          const pct = stats.totalVotes > 0 ? (count / stats.totalVotes) * 100 : 0;
          const emoji = ["", "😬", "😐", "🙂", "😋", "🤤"][star];
          return (
            <div key={star} className="flex items-center gap-2 text-sm">
              <span className="w-3 text-gray-500 text-right">{star}</span>
              <span className="w-5 text-center text-xs">{emoji}</span>
              <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden border border-black">
                <div
                  className="h-full bg-kikoff rounded-full transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-6 text-right text-gray-400">{count}</span>
            </div>
          );
        })}
      </div>

      {/* Recent Votes */}
      {votes.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-gray-500 mb-2">
            Latest Ratings
          </h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {votes.slice(0, 10).map((vote, i) => (
              <div
                key={i}
                className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0 animate-slide-up"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                {vote.avatar_url ? (
                  <img
                    src={vote.avatar_url}
                    alt={vote.user_name}
                    className="w-8 h-8 rounded-xl border-2 border-black shrink-0 object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-kikoff-dark flex items-center justify-center text-kikoff text-xs font-bold shrink-0 border-2 border-black">
                    {vote.user_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">
                      {vote.user_name}
                    </span>
                    <span className="text-sm font-bold text-kikoff-dark">
                      {vote.rating_overall}/5
                    </span>
                    <span>{ratingEmoji(vote.rating_overall)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    </div>
  );
}

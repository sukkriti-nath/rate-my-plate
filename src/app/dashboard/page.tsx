"use client";

import { useEffect, useState, useCallback } from "react";

interface DishRating {
  avg: number;
  votes: number;
}

interface DayData {
  menu: Record<string, string | null> | null;
  stats: {
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
  };
}

function getWeekDates(): string[] {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  const dates: string[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

function cleanDishName(name: string | null | undefined): string {
  if (!name) return "";
  return name.replace(/\(V\)/g, "").replace(/\(Gf\)/g, "").trim();
}

function ratingEmoji(avg: number): string {
  if (avg >= 4.5) return "🔥";
  if (avg >= 3.5) return "😋";
  if (avg >= 2.5) return "🙂";
  if (avg >= 1.5) return "😐";
  return "😬";
}

function RatingBar({ value, max = 5 }: { value: number; max?: number }) {
  const pct = (value / max) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-kikoff to-kikoff-hover rounded-full transition-all duration-1000"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-kikoff font-bold text-sm w-8 text-right">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const [days, setDays] = useState<Record<string, DayData>>({});
  const [today] = useState(() => new Date().toISOString().split("T")[0]);
  const [lastVoteCount, setLastVoteCount] = useState(0);
  const [voteFlash, setVoteFlash] = useState(false);
  const weekDates = getWeekDates();

  const fetchAll = useCallback(async () => {
    const results: Record<string, DayData> = {};
    await Promise.all(
      weekDates.map(async (date) => {
        try {
          const res = await fetch(`/api/votes?date=${date}`);
          const data = await res.json();
          if (data.stats) {
            results[date] = {
              menu: data.menu || null,
              stats: data.stats,
            };
          }
        } catch {
          // skip
        }
      })
    );
    setDays(results);
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Flash animation when new vote comes in
  useEffect(() => {
    const todayVotes = days[today]?.stats.totalVotes || 0;
    if (todayVotes > lastVoteCount && lastVoteCount > 0) {
      setVoteFlash(true);
      setTimeout(() => setVoteFlash(false), 600);
    }
    setLastVoteCount(todayVotes);
  }, [days, today, lastVoteCount]);

  const todayData = days[today];

  // Find best day of the week
  const bestDay = Object.entries(days)
    .filter(([, d]) => d.stats.totalVotes > 0)
    .sort((a, b) => b[1].stats.averageOverall - a[1].stats.averageOverall)[0];

  // Find best and worst dish today
  const todayDishes = todayData?.menu
    ? [
        { key: "starch" as const, label: "Starch", name: cleanDishName(todayData.menu.starch) },
        { key: "veganProtein" as const, label: "Vegan Protein", name: cleanDishName(todayData.menu.vegan_protein) },
        { key: "veg" as const, label: "Veg", name: cleanDishName(todayData.menu.veg) },
        { key: "protein1" as const, label: "Protein 1", name: cleanDishName(todayData.menu.protein_1) },
        { key: "protein2" as const, label: "Protein 2", name: cleanDishName(todayData.menu.protein_2) },
      ].filter((d) => d.name)
    : [];

  const rankedDishes = todayDishes
    .map((d) => ({ ...d, rating: todayData?.stats.dishRatings[d.key] }))
    .filter((d) => d.rating && d.rating.votes > 0)
    .sort((a, b) => (b.rating?.avg || 0) - (a.rating?.avg || 0));

  const topDish = rankedDishes[0];
  const bottomDish = rankedDishes.length > 1 ? rankedDishes[rankedDishes.length - 1] : null;

  return (
    <div className="min-h-screen bg-kikoff-dark text-white p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-1">
            Rate<span className="text-kikoff">My</span>Plate
          </h1>
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <span className="inline-block w-2 h-2 rounded-full bg-kikoff animate-pulse-glow" />
            <span className="text-sm">Live Dashboard</span>
          </div>
        </div>

        {/* Quick Stats Row */}
        {todayData && todayData.stats.totalVotes > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {/* Overall Score */}
            <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 text-center">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Overall</div>
              <div className={`text-5xl font-bold text-kikoff ${voteFlash ? "animate-count-pop" : ""}`}>
                {todayData.stats.averageOverall.toFixed(1)}
              </div>
              <div className="text-xl mt-1">{ratingEmoji(todayData.stats.averageOverall)}</div>
            </div>

            {/* Vote Count */}
            <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 text-center">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Votes In</div>
              <div className={`text-5xl font-bold text-white ${voteFlash ? "animate-count-pop" : ""}`}>
                {todayData.stats.totalVotes}
              </div>
              <div className="text-xs text-gray-500 mt-2">Kiksters voted</div>
            </div>

            {/* Top Dish */}
            {topDish && (
              <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 text-center">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Fan Favorite</div>
                <div className="text-2xl mb-1">👑</div>
                <div className="text-sm text-white font-medium truncate">{topDish.name}</div>
                <div className="text-kikoff font-bold text-lg">{topDish.rating?.avg.toFixed(1)}</div>
              </div>
            )}

            {/* Bottom Dish */}
            {bottomDish && bottomDish.key !== topDish?.key && (
              <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 text-center">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Needs Work</div>
                <div className="text-2xl mb-1">🫣</div>
                <div className="text-sm text-white font-medium truncate">{bottomDish.name}</div>
                <div className="text-amber-400 font-bold text-lg">{bottomDish.rating?.avg.toFixed(1)}</div>
              </div>
            )}
          </div>
        )}

        {/* Best Day Banner */}
        {bestDay && bestDay[1].stats.totalVotes >= 1 && (
          <div className="bg-kikoff/10 border border-kikoff/30 rounded-2xl px-6 py-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏆</span>
              <div>
                <div className="text-sm text-kikoff font-medium">Best Day This Week</div>
                <div className="text-white font-semibold">
                  {new Date(bestDay[0] + "T12:00:00").toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-3xl font-bold text-kikoff">
                {bestDay[1].stats.averageOverall.toFixed(1)}
              </span>
              <span className="text-gray-500 text-sm ml-1">/ 5</span>
            </div>
          </div>
        )}

        {/* Dish Leaderboard */}
        {rankedDishes.length > 0 && (
          <div className="bg-gray-900 rounded-3xl p-6 mb-6 border border-gray-800">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
              Today&apos;s Dish Leaderboard
            </h2>
            <div className="space-y-3">
              {rankedDishes.map((dish, i) => (
                <div
                  key={dish.key}
                  className="bg-gray-800/50 rounded-xl px-5 py-3 flex items-center gap-4 animate-slide-up"
                  style={{ animationDelay: `${i * 0.08}s` }}
                >
                  <span className="text-2xl w-8 text-center">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                        {dish.label}
                      </span>
                      <span className="text-xs text-gray-600">
                        {dish.rating?.votes} vote{dish.rating?.votes !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="text-sm text-white font-medium mb-1">{dish.name}</div>
                    <RatingBar value={dish.rating?.avg || 0} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Distribution */}
        {todayData && todayData.stats.totalVotes > 0 && (
          <div className="bg-gray-900 rounded-3xl p-6 mb-6 border border-gray-800">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
              Overall Rating Breakdown
            </h2>
            <div className="max-w-lg mx-auto space-y-2.5">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = todayData.stats.distribution[star] || 0;
                const pct =
                  todayData.stats.totalVotes > 0
                    ? (count / todayData.stats.totalVotes) * 100
                    : 0;
                const emoji = ["", "😬", "😐", "🙂", "😋", "🤤"][star];
                return (
                  <div key={star} className="flex items-center gap-3 text-sm">
                    <span className="w-4 text-gray-400 text-right">{star}</span>
                    <span className="w-6 text-center">{emoji}</span>
                    <div className="flex-1 h-6 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-kikoff to-kikoff-hover rounded-full transition-all duration-1000 flex items-center justify-end pr-2"
                        style={{ width: `${Math.max(pct, count > 0 ? 8 : 0)}%` }}
                      >
                        {count > 0 && (
                          <span className="text-xs font-bold text-kikoff-dark">{count}</span>
                        )}
                      </div>
                    </div>
                    <span className="w-10 text-right text-gray-500 text-xs">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Week Overview */}
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
          This Week at a Glance
        </h2>
        <div className="grid grid-cols-5 gap-3">
          {weekDates.map((date) => {
            const data = days[date];
            const isToday = date === today;
            const isBest = bestDay && bestDay[0] === date;
            const dayName = new Date(date + "T12:00:00").toLocaleDateString(
              "en-US",
              { weekday: "short" }
            );
            const avg = data?.stats.averageOverall || 0;

            return (
              <div
                key={date}
                className={`rounded-2xl p-4 border overflow-hidden ${
                  isToday
                    ? "bg-gray-900 border-kikoff/50"
                    : "bg-gray-900/50 border-gray-800"
                } ${isBest ? "ring-2 ring-kikoff/30" : ""}`}
              >
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="text-xs text-gray-500">{dayName}</span>
                  {isBest && <span className="text-xs">🏆</span>}
                </div>
                <div className="text-[11px] text-gray-600 mb-2">
                  {new Date(date + "T12:00:00").toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
                {data && data.stats.totalVotes > 0 ? (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-white">
                        {avg.toFixed(1)}
                      </span>
                      <span className="text-sm">{ratingEmoji(avg)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-kikoff rounded-full transition-all duration-700"
                        style={{ width: `${(avg / 5) * 100}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1.5">
                      {data.stats.totalVotes} vote{data.stats.totalVotes !== 1 ? "s" : ""}
                    </div>
                  </>
                ) : (
                  <div className="text-gray-600 text-sm mt-2">
                    {new Date(date + "T12:00:00") > new Date() ? "Upcoming" : "No votes"}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-xs text-gray-600">
          Auto-refreshes every 5 seconds • Built with 💚 at Kikoff
        </div>
      </div>
    </div>
  );
}

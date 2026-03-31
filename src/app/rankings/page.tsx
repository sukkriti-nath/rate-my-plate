"use client";

import { useEffect, useState } from "react";

interface DayStats {
  date: string;
  dayName: string;
  totalVotes: number;
  averageOverall: number;
  dishes: { label: string; name: string; avg: number; votes: number }[];
}

function getWeekDates(): string[] {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  const dates: string[] = [];
  for (let i = 0; i < 4; i++) {
    // Mon-Thu only
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

function cleanName(name: string): string {
  return name.replace(/\(V\)/g, "").replace(/\(Gf\)/g, "").trim();
}

export default function RankingsPage() {
  const [days, setDays] = useState<DayStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      const weekDates = getWeekDates();
      const results: DayStats[] = [];

      for (const date of weekDates) {
        try {
          const res = await fetch(`/api/votes?date=${date}`);
          const data = await res.json();
          if (data.stats && data.stats.totalVotes > 0 && data.menu) {
            const dishKeys = [
              { key: "starch", label: "Starch", menuKey: "starch" },
              { key: "veganProtein", label: "Vegan Protein", menuKey: "vegan_protein" },
              { key: "veg", label: "Veg", menuKey: "veg" },
              { key: "protein1", label: "Protein 1", menuKey: "protein_1" },
              { key: "protein2", label: "Protein 2", menuKey: "protein_2" },
            ];

            const dishes = dishKeys
              .filter(
                (dk) =>
                  data.menu[dk.menuKey] &&
                  data.stats.dishRatings[dk.key]?.votes > 0
              )
              .map((dk) => ({
                label: dk.label,
                name: cleanName(data.menu[dk.menuKey]),
                avg: data.stats.dishRatings[dk.key].avg,
                votes: data.stats.dishRatings[dk.key].votes,
              }));

            results.push({
              date,
              dayName: new Date(date + "T12:00:00").toLocaleDateString(
                "en-US",
                { weekday: "long" }
              ),
              totalVotes: data.stats.totalVotes,
              averageOverall: data.stats.averageOverall,
              dishes,
            });
          }
        } catch {
          // skip
        }
      }

      setDays(results.sort((a, b) => b.averageOverall - a.averageOverall));
      setLoading(false);
    }

    fetchAll();
  }, []);

  // Get all dishes ranked across the week
  const allDishes = days
    .flatMap((d) => d.dishes.map((dish) => ({ ...dish, day: d.dayName })))
    .sort((a, b) => b.avg - a.avg);

  const topDishes = allDishes.slice(0, 3);
  const bottomDish = allDishes.length > 3 ? allDishes[allDishes.length - 1] : null;

  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);

    try {
      const dates = getWeekDates();
      const start = dates[0];
      const end = dates[dates.length - 1];
      const res = await fetch(`/api/rankings/image?start=${start}&end=${end}`);
      if (!res.ok) throw new Error("Server image generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ratemyplate-power-rankings.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PNG download failed:", err);
    }
    setDownloading(false);
  }

  const weekLabel = days.length > 0
    ? `${new Date(getWeekDates()[0] + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(getWeekDates()[3] + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    : "This Week";

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-4xl animate-pulse">🏆</div>
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">🏆</div>
        <h1 className="font-display text-3xl text-gray-900 mb-3">
          Power Rankings
        </h1>
        <p className="text-gray-400">No ratings yet this week. Check back later!</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="text-center mb-6">
        <h1 className="font-display text-3xl text-gray-900 mb-1 font-extrabold">
          🏆 Power Rankings
        </h1>
        <p className="text-gray-400">Week of {weekLabel}</p>
      </div>

      {/* Downloadable Card */}
      <div
        className="bg-kikoff-dark rounded-xl p-8 text-white mb-6 overflow-hidden border-2 border-black shadow-[8px_8px_0px_0px_#000]"
      >
        {/* Card Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-kikoff px-4 py-1.5 rounded-xl text-sm text-kikoff-dark font-bold mb-3 border-2 border-black">
            🍽️ RateMyPlate
          </div>
          <h2 className="font-display text-3xl font-extrabold">Weekly Power Rankings</h2>
          <p className="text-gray-500 text-sm mt-1">{weekLabel}</p>
        </div>

        {/* Meal Rankings */}
        <div className="mb-8">
          <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">
            Meals Ranked by Overall Score
          </h3>
          <div className="space-y-3">
            {days.map((day, i) => (
              <div
                key={day.date}
                className={`rounded-xl px-5 py-4 flex items-center justify-between ${
                  i === 0
                    ? "bg-kikoff/15 border border-kikoff/30"
                    : "bg-gray-800/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                  </span>
                  <div>
                    <div className="font-semibold">{day.dayName}</div>
                    <div className="text-xs text-gray-500">
                      {day.totalVotes} vote{day.totalVotes !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${i === 0 ? "text-kikoff" : "text-white"}`}>
                    {day.averageOverall.toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-500">/ 5</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top 3 Dishes */}
        {topDishes.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1">
              🏛️ Hall of Fame
            </h3>
            <div className="space-y-2">
              {topDishes.map((dish, i) => (
                <div
                  key={`${dish.name}-${i}`}
                  className="bg-gray-800/50 rounded-xl px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span>{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</span>
                    <div>
                      <div className="text-sm font-medium">{dish.name}</div>
                      <div className="text-[10px] text-gray-500">{dish.day} • {dish.label}</div>
                    </div>
                  </div>
                  <span className="text-kikoff font-bold">{dish.avg.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Needs Work */}
        {bottomDish && (
          <div>
            <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1">
              💀 Hall of Shame
            </h3>
            <div className="bg-gray-800/50 rounded-xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>📉</span>
                <div>
                  <div className="text-sm font-medium">{bottomDish.name}</div>
                  <div className="text-[10px] text-gray-500">{bottomDish.day} • {bottomDish.label}</div>
                </div>
              </div>
              <span className="text-amber-400 font-bold">{bottomDish.avg.toFixed(1)}</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8 pt-4 border-t border-gray-800">
          <div className="text-xs text-gray-600">
            Powered by RateMyPlate • Built with 💚 at Kikoff
          </div>
        </div>
      </div>

      {/* Share Button */}
      <div className="text-center">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="px-8 py-3.5 bg-kikoff text-kikoff-dark font-bold rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all text-lg disabled:opacity-60 disabled:cursor-wait"
        >
          {downloading ? "Generating..." : "Share It 🔗"}
        </button>
      </div>
    </div>
  );
}

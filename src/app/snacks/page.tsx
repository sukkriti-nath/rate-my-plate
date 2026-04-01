"use client";

import { useEffect, useState, useCallback } from "react";

interface LeaderboardEntry {
  userId: string;
  displayName: string;
  points: number;
  actions: Record<string, number>;
}

interface CategoryDemand {
  category: string;
  emoji: string;
  tokens: number;
  percent: number;
}

interface MostWantedItem {
  item: string;
  score: number;
}

interface OutOfStockReport {
  snackName: string;
  category: string | null;
  count: number;
  lastReported: string;
}

interface SnackStats {
  profileCount: number;
  publicProfiles: number;
  outOfStockCount: number;
  totalPoints: number;
}

interface DashboardData {
  stats: SnackStats;
  leaderboard: LeaderboardEntry[];
  categoryDemand: CategoryDemand[];
  mostWanted: MostWantedItem[];
  outOfStock: OutOfStockReport[];
}

function RatingBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = (value / max) * 100;
  return (
    <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden border border-black">
      <div
        className="h-full bg-amber-400 rounded-full transition-all duration-1000"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function SnacksPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/api/snacks/stats`
        : "/api/snacks/stats";

    const attempt = async (): Promise<void> => {
      const res = await fetch(url, {
        signal,
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `snack stats ${res.status}${text ? `: ${text.slice(0, 120)}` : ""}`
        );
      }
      const json = (await res.json()) as DashboardData;
      setData(json);
    };

    try {
      await attempt();
    } catch (first) {
      if (signal?.aborted) return;
      if (first instanceof DOMException && first.name === "AbortError") return;
      await new Promise((r) => setTimeout(r, 400));
      if (signal?.aborted) return;
      try {
        await attempt();
      } catch (err) {
        if (signal?.aborted) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Failed to fetch snack stats:", err);
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void fetchData(ac.signal);
    const interval = setInterval(() => {
      void fetchData(ac.signal);
    }, 10000);
    return () => {
      ac.abort();
      clearInterval(interval);
    };
  }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">🍿</div>
          <p className="text-gray-500">Loading snack data...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">😢</div>
          <p className="text-gray-500">Failed to load data</p>
        </div>
      </div>
    );
  }

  const maxDemand = data.categoryDemand[0]?.tokens || 1;

  return (
    <div className="min-h-screen bg-white text-gray-900 p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 pb-6 border-b-2 border-black">
          <h1 className="font-display text-5xl mb-1 font-extrabold">
            🍿 Snack<span className="text-amber-500">Overflow</span>
          </h1>
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-sm">Live Dashboard — auto-refreshes every 10s</span>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl p-4 border-2 border-black shadow-[4px_4px_0px_0px_#000] text-center">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Profiles</div>
            <div className="text-4xl font-bold text-amber-600">{data.stats.profileCount}</div>
            <div className="text-xs text-gray-500 mt-1">created</div>
          </div>
          <div className="bg-white rounded-xl p-4 border-2 border-black shadow-[4px_4px_0px_0px_#000] text-center">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Out of Stock</div>
            <div className="text-4xl font-bold text-red-500">{data.stats.outOfStockCount}</div>
            <div className="text-xs text-gray-500 mt-1">items reported</div>
          </div>
          <div className="bg-white rounded-xl p-4 border-2 border-black shadow-[4px_4px_0px_0px_#000] text-center">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Points</div>
            <div className="text-4xl font-bold text-amber-600">{data.stats.totalPoints}</div>
            <div className="text-xs text-gray-500 mt-1">earned</div>
          </div>
          <div className="bg-white rounded-xl p-4 border-2 border-black shadow-[4px_4px_0px_0px_#000] text-center">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Champions</div>
            <div className="text-4xl font-bold text-amber-600">{data.leaderboard.length}</div>
            <div className="text-xs text-gray-500 mt-1">on leaderboard</div>
          </div>
        </div>

        {/* Category Demand Section */}
        {data.categoryDemand.length > 0 && (
          <div className="bg-white rounded-xl p-6 mb-6 border-2 border-black shadow-[8px_8px_0px_0px_#000]">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 pb-3 border-b-2 border-black">
              📊 Category Demand (from Token Allocations)
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {data.categoryDemand.slice(0, 10).map((cat, i) => (
                <div
                  key={cat.category}
                  className="text-center animate-slide-up"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div className="text-3xl mb-2">{cat.emoji}</div>
                  <div className="relative h-20 bg-gray-100 rounded-lg overflow-hidden border border-black mb-2">
                    <div
                      className="absolute bottom-0 w-full bg-gradient-to-t from-amber-500 to-amber-300 transition-all duration-1000 rounded-t"
                      style={{ height: `${cat.percent}%` }}
                    />
                  </div>
                  <div className="text-xs font-medium text-gray-700 truncate">{cat.category}</div>
                  <div className="text-lg font-bold text-amber-600">{cat.percent}%</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Leaderboard */}
          <div className="bg-white rounded-xl p-6 border-2 border-black shadow-[8px_8px_0px_0px_#000]">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 pb-3 border-b-2 border-black">
              🏆 Snack Champions
            </h2>
            {data.leaderboard.length > 0 ? (
              <div className="space-y-3">
                {data.leaderboard.map((user, i) => (
                  <div
                    key={user.userId}
                    className="flex items-center justify-between bg-amber-50 rounded-xl px-4 py-3 border-2 border-black shadow-[2px_2px_0px_0px_#000] animate-slide-up"
                    style={{ animationDelay: `${i * 0.08}s` }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl w-8 text-center">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                      </span>
                      <span className="font-medium text-gray-900">{user.displayName}</span>
                    </div>
                    <span className="bg-amber-400 text-black text-sm px-3 py-1 rounded-full font-bold border border-black">
                      {user.points} pts
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                No activity yet. Use <code className="bg-gray-100 px-2 py-1 rounded">/snack-profile</code> to earn points!
              </p>
            )}
          </div>

          {/* Most Wanted Items */}
          <div className="bg-white rounded-xl p-6 border-2 border-black shadow-[8px_8px_0px_0px_#000]">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 pb-3 border-b-2 border-black">
              ⭐ Most Wanted Items
            </h2>
            {data.mostWanted.length > 0 ? (
              <div className="space-y-3">
                {data.mostWanted.map((item, i) => (
                  <div
                    key={item.item}
                    className="flex items-center gap-3 animate-slide-up"
                    style={{ animationDelay: `${i * 0.08}s` }}
                  >
                    <span className="text-lg w-8 text-center">
                      {i === 0 ? "🔥" : i === 1 ? "💫" : i === 2 ? "✨" : `${i + 1}.`}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{item.item}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <RatingBar value={item.score} max={data.mostWanted[0]?.score || 1} />
                        <span className="text-xs text-gray-500 w-8 text-right">{item.score}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                No favorites yet. Create profiles to see popular items!
              </p>
            )}
          </div>
        </div>

        {/* Out of Stock Reports */}
        {data.outOfStock.length > 0 && (
          <div className="bg-white rounded-xl p-6 border-2 border-black shadow-[8px_8px_0px_0px_#000]">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 pb-3 border-b-2 border-black">
              🚨 Out of Stock Reports
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-black">
                    <th className="text-left py-3 px-4 text-xs uppercase text-gray-500">Snack</th>
                    <th className="text-left py-3 px-4 text-xs uppercase text-gray-500">Category</th>
                    <th className="text-right py-3 px-4 text-xs uppercase text-gray-500">Reports</th>
                    <th className="text-right py-3 px-4 text-xs uppercase text-gray-500">Last Reported</th>
                  </tr>
                </thead>
                <tbody>
                  {data.outOfStock.slice(0, 10).map((report, i) => (
                    <tr
                      key={report.snackName}
                      className="border-b border-gray-200 hover:bg-amber-50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <span className="font-medium">{report.snackName}</span>
                        {i < 3 && (
                          <span className="ml-2 bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded border border-red-200">
                            High Priority
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-500">{report.category || "Unknown"}</td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold border border-black ${
                            report.count >= 3
                              ? "bg-red-100 text-red-800"
                              : report.count >= 2
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {report.count}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-500 text-sm">
                        {new Date(report.lastReported).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-xs text-gray-400">
          Auto-refreshes every 10 seconds • Built with 💚 at Kikoff Hackweek
        </div>
      </div>
    </div>
  );
}

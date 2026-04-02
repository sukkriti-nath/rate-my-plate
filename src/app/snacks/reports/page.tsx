"use client";

import { useEffect, useState } from "react";

interface CategoryStat {
  category: string;
  tokens: number;
  percent: number;
}

interface FavoriteItem {
  item: string;
  score: number;
}

interface Suggestion {
  name: string;
  submittedBy: string;
  upvotes: number;
  downvotes: number;
  net: number;
}

interface ReportData {
  engagement: {
    profileCount: number;
    suggestionCount: number;
    totalUpvotes: number;
    profilesByMonth: Record<string, number>;
    suggestionsByMonth: Record<string, number>;
  };
  allocation: {
    totalDrinkTokens: number;
    totalSnackTokens: number;
    drinkCategories: CategoryStat[];
    snackCategories: CategoryStat[];
    combined: { category: string; emoji: string; tokens: number; percent: number }[];
  };
  favorites: {
    topDrinks: FavoriteItem[];
    topSnacks: FavoriteItem[];
    topOverall: FavoriteItem[];
  };
  inventory: {
    totalBeverages: number;
    totalSnacks: number;
    byCategory: Record<string, number>;
  };
  topSuggestions: Suggestion[];
}

const CATEGORY_EMOJIS: Record<string, string> = {
  "Teas": "🍵",
  "Cold Brew Latte": "☕",
  "Milk Tea": "🥛",
  "Yerba Mate": "🧉",
  "Juice": "🧃",
  "Energy Drink": "⚡",
  "Enhanced Water": "💧",
  "Protein Drinks": "💪",
  "Probiotic Sodas": "🥤",
  "Coconut Water": "🥥",
  "Kombucha": "🍶",
  "Chips": "🥜",
  "Popcorn & Crackers": "🍿",
  "Protein Bars & Cookies": "💪",
  "Snack Bars": "🍫",
  "Dried Fruit": "🍎",
  "Gummies & Candy": "🍬",
  "Mints & Gum": "🌿",
  "Meat Jerky & Sticks": "🥩",
  "Trail Mix & Nuts": "🥾",
  "Seaweed": "🌊",
};

function getEmoji(category: string): string {
  return CATEGORY_EMOJIS[category] || "🍿";
}

function formatMonth(key: string): string {
  const [year, month] = key.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function BarChart({ items, maxValue, color }: { items: { label: string; value: number; sub?: string }[]; maxValue: number; color: string }) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-40 sm:w-48 text-sm font-medium text-kikoff-dark truncate shrink-0" title={item.label}>
            {item.label}
          </div>
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
              <div
                className={`h-full rounded-full ${color} transition-all duration-500`}
                style={{ width: `${Math.max((item.value / maxValue) * 100, 2)}%` }}
              />
            </div>
            <span className="text-xs font-bold text-kikoff-dark/60 w-10 text-right shrink-0">{item.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, emoji }: { label: string; value: string | number; emoji: string }) {
  return (
    <div className="bg-white rounded-2xl border-2 border-kikoff-dark/10 p-5 text-center">
      <div className="text-3xl mb-2">{emoji}</div>
      <div className="text-2xl sm:text-3xl font-extrabold text-kikoff-dark">{value}</div>
      <div className="text-sm text-kikoff-dark/60 font-medium mt-1">{label}</div>
    </div>
  );
}

function Section({ title, emoji, children }: { title: string; emoji: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border-2 border-kikoff-dark/10 overflow-hidden">
      <div className="px-6 py-4 border-b border-kikoff-dark/10 bg-kikoff/30">
        <h2 className="text-lg font-extrabold text-kikoff-dark flex items-center gap-2">
          <span>{emoji}</span> {title}
        </h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

export default function SnackReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/snacks/report")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load report");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-kikoff flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl animate-bounce mb-4">📊</div>
          <p className="text-kikoff-dark/60 font-semibold">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-kikoff flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">😕</div>
          <p className="text-kikoff-dark/60 font-semibold">{error || "No data available"}</p>
        </div>
      </div>
    );
  }

  const { engagement, allocation, favorites, inventory, topSuggestions } = data;

  // Sort months chronologically
  const profileMonths = Object.entries(engagement.profilesByMonth)
    .sort(([a], [b]) => a.localeCompare(b));
  const suggestionMonths = Object.entries(engagement.suggestionsByMonth)
    .sort(([a], [b]) => a.localeCompare(b));

  const drinkMax = allocation.drinkCategories[0]?.tokens || 1;
  const snackMax = allocation.snackCategories[0]?.tokens || 1;
  const topDrinkMax = favorites.topDrinks[0]?.score || 1;
  const topSnackMax = favorites.topSnacks[0]?.score || 1;

  return (
    <div className="min-h-screen bg-kikoff">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-kikoff-dark">
            📊 Workplace Coordinator Report
          </h1>
          <p className="text-kikoff-dark/60 font-medium mt-2">
            Snack & beverage allocation insights for the team
          </p>
        </div>

        {/* Engagement Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard emoji="👤" label="Profiles Created" value={engagement.profileCount} />
          <StatCard emoji="💡" label="Suggestions Made" value={engagement.suggestionCount} />
          <StatCard emoji="👍" label="Total Upvotes" value={engagement.totalUpvotes} />
          <StatCard emoji="🍿" label="Inventory Items" value={inventory.totalBeverages + inventory.totalSnacks} />
        </div>

        {/* Monthly Activity */}
        <Section title="Monthly Engagement" emoji="📈">
          <div className="grid sm:grid-cols-2 gap-8">
            <div>
              <h3 className="text-sm font-bold text-kikoff-dark/80 mb-3 uppercase tracking-wide">Profiles Created</h3>
              {profileMonths.length > 0 ? (
                <div className="space-y-2">
                  {profileMonths.map(([month, count]) => (
                    <div key={month} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-kikoff-dark">{formatMonth(month)}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-100 rounded-full h-4 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-amber-400"
                            style={{ width: `${(count / Math.max(...profileMonths.map(([,c]) => c))) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-kikoff-dark/60 w-8 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-kikoff-dark/40">No data yet</p>
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-kikoff-dark/80 mb-3 uppercase tracking-wide">Suggestions Submitted</h3>
              {suggestionMonths.length > 0 ? (
                <div className="space-y-2">
                  {suggestionMonths.map(([month, count]) => (
                    <div key={month} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-kikoff-dark">{formatMonth(month)}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-100 rounded-full h-4 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-400"
                            style={{ width: `${(count / Math.max(...suggestionMonths.map(([,c]) => c))) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-kikoff-dark/60 w-8 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-kikoff-dark/40">No data yet</p>
              )}
            </div>
          </div>
        </Section>

        {/* Allocation Overview */}
        <Section title="Token Allocation Overview" emoji="🪙">
          <div className="flex items-center justify-center gap-8 mb-6">
            <div className="text-center">
              <div className="text-2xl font-extrabold text-blue-600">{allocation.totalDrinkTokens}</div>
              <div className="text-xs font-semibold text-kikoff-dark/60">Beverage Tokens</div>
            </div>
            <div className="text-3xl text-kikoff-dark/20">|</div>
            <div className="text-center">
              <div className="text-2xl font-extrabold text-orange-500">{allocation.totalSnackTokens}</div>
              <div className="text-xs font-semibold text-kikoff-dark/60">Snack Tokens</div>
            </div>
            <div className="text-3xl text-kikoff-dark/20">|</div>
            <div className="text-center">
              <div className="text-2xl font-extrabold text-kikoff-dark">{allocation.totalDrinkTokens + allocation.totalSnackTokens}</div>
              <div className="text-xs font-semibold text-kikoff-dark/60">Total Tokens</div>
            </div>
          </div>

          {/* Split bar */}
          <div className="mb-8">
            <div className="flex rounded-full overflow-hidden h-6 border-2 border-kikoff-dark/10">
              <div
                className="bg-blue-400 flex items-center justify-center text-xs font-bold text-white"
                style={{ width: `${(allocation.totalDrinkTokens / (allocation.totalDrinkTokens + allocation.totalSnackTokens || 1)) * 100}%` }}
              >
                {Math.round((allocation.totalDrinkTokens / (allocation.totalDrinkTokens + allocation.totalSnackTokens || 1)) * 100)}% Beverages
              </div>
              <div
                className="bg-orange-400 flex items-center justify-center text-xs font-bold text-white"
                style={{ width: `${(allocation.totalSnackTokens / (allocation.totalDrinkTokens + allocation.totalSnackTokens || 1)) * 100}%` }}
              >
                {Math.round((allocation.totalSnackTokens / (allocation.totalDrinkTokens + allocation.totalSnackTokens || 1)) * 100)}% Snacks
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-8">
            <div>
              <h3 className="text-sm font-bold text-kikoff-dark/80 mb-4 uppercase tracking-wide">🥤 Beverage Categories</h3>
              <BarChart
                items={allocation.drinkCategories.map((c) => ({
                  label: `${getEmoji(c.category)} ${c.category}`,
                  value: c.tokens,
                  sub: `${c.percent}%`,
                }))}
                maxValue={drinkMax}
                color="bg-blue-400"
              />
            </div>
            <div>
              <h3 className="text-sm font-bold text-kikoff-dark/80 mb-4 uppercase tracking-wide">🍿 Snack Categories</h3>
              <BarChart
                items={allocation.snackCategories.map((c) => ({
                  label: `${getEmoji(c.category)} ${c.category}`,
                  value: c.tokens,
                  sub: `${c.percent}%`,
                }))}
                maxValue={snackMax}
                color="bg-orange-400"
              />
            </div>
          </div>
        </Section>

        {/* Most Wanted Items */}
        <Section title="Most Wanted Items" emoji="🔥">
          <div className="grid sm:grid-cols-2 gap-8">
            <div>
              <h3 className="text-sm font-bold text-kikoff-dark/80 mb-4 uppercase tracking-wide">🥤 Top Beverages</h3>
              <div className="space-y-2">
                {favorites.topDrinks.slice(0, 10).map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm font-extrabold text-kikoff-dark/40 w-6 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-400"
                            style={{ width: `${(item.score / topDrinkMax) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-kikoff-dark/60 w-8 text-right shrink-0">{item.score}</span>
                      </div>
                      <span className="text-xs font-medium text-kikoff-dark/70 truncate block">{item.item}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold text-kikoff-dark/80 mb-4 uppercase tracking-wide">🍿 Top Snacks</h3>
              <div className="space-y-2">
                {favorites.topSnacks.slice(0, 10).map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm font-extrabold text-kikoff-dark/40 w-6 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-orange-400"
                            style={{ width: `${(item.score / topSnackMax) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-kikoff-dark/60 w-8 text-right shrink-0">{item.score}</span>
                      </div>
                      <span className="text-xs font-medium text-kikoff-dark/70 truncate block">{item.item}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* Top Suggestions */}
        {topSuggestions.length > 0 && (
          <Section title="Top Suggestions from Employees" emoji="💡">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-kikoff-dark/10">
                    <th className="text-left py-2 px-3 font-bold text-kikoff-dark/60 text-xs uppercase">#</th>
                    <th className="text-left py-2 px-3 font-bold text-kikoff-dark/60 text-xs uppercase">Item</th>
                    <th className="text-left py-2 px-3 font-bold text-kikoff-dark/60 text-xs uppercase">Submitted By</th>
                    <th className="text-center py-2 px-3 font-bold text-kikoff-dark/60 text-xs uppercase">👍</th>
                    <th className="text-center py-2 px-3 font-bold text-kikoff-dark/60 text-xs uppercase">👎</th>
                    <th className="text-center py-2 px-3 font-bold text-kikoff-dark/60 text-xs uppercase">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {topSuggestions.map((s, i) => (
                    <tr key={i} className="border-b border-kikoff-dark/5 hover:bg-kikoff/30 transition-colors">
                      <td className="py-2.5 px-3 font-extrabold text-kikoff-dark/40">{i + 1}</td>
                      <td className="py-2.5 px-3 font-semibold text-kikoff-dark">{s.name}</td>
                      <td className="py-2.5 px-3 text-kikoff-dark/60">{s.submittedBy}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-emerald-600">{s.upvotes}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-red-400">{s.downvotes}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`font-extrabold ${s.net > 0 ? "text-emerald-600" : s.net < 0 ? "text-red-500" : "text-kikoff-dark/40"}`}>
                          {s.net > 0 ? "+" : ""}{s.net}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-kikoff-dark/40 font-medium pb-8">
          Report generated {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </div>
      </div>
    </div>
  );
}

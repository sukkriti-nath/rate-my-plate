"use client";

import { useState, useEffect } from "react";

interface DishInfo {
  name: string;
  category: string;
  dayName?: string;
  avg: number;
  votes?: number;
}

interface DayData {
  date: string;
  dayName: string;
  restaurant: string | null;
  avgOverall: number;
  totalVotes: number;
  topDish: DishInfo | null;
  worstDish: DishInfo | null;
}

interface FridayData {
  date: string;
  restaurant: string | null;
  avgOverall: number;
  totalVotes: number;
  dishes: DishInfo[];
}

interface ReportData {
  period: string;
  startDate: string;
  endDate: string;
  summary: {
    totalVotes: number;
    avgOverall: number;
    bestDay: { name: string; avg: number; date: string } | null;
    worstDay: { name: string; avg: number; date: string } | null;
    totalDaysWithData: number;
  };
  dayByDay: DayData[];
  topDishes: DishInfo[];
  bottomDishes: DishInfo[];
  fridaySpotlight: FridayData[];
  comments: { date: string; comment: string; userName: string }[];
}

const EMOJIS: Record<number, string> = { 1: "🙁", 2: "😕", 3: "😐", 4: "😋", 5: "🤩" };

function ratingEmoji(avg: number): string {
  return EMOJIS[Math.round(avg)] || "😐";
}

function ratingColor(avg: number): string {
  if (avg >= 4) return "text-green-500";
  if (avg >= 3) return "text-yellow-500";
  return "text-red-500";
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function ReportsPage() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [weeksAgo, setWeeksAgo] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/generate?weeksAgo=${weeksAgo}`)
      .then((r) => r.json())
      .then((data) => {
        setReport(data.report);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [weeksAgo]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-4 animate-bounce">📋</div>
        <p className="text-gray-400">Generating report...</p>
      </div>
    );
  }

  if (!report || report.summary.totalVotes === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-4">📋</div>
        <h1 className="font-display text-2xl text-gray-900 mb-2">No data yet</h1>
        <p className="text-gray-400 mb-6">No votes have been collected for this period.</p>
        <div className="flex justify-center gap-3">
          <button onClick={() => setWeeksAgo((w) => w + 1)} className="px-4 py-2 bg-white rounded-xl text-sm font-bold border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all">
            ← Previous week
          </button>
          {weeksAgo > 0 && (
            <button onClick={() => setWeeksAgo((w) => w - 1)} className="px-4 py-2 bg-white rounded-xl text-sm font-bold border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all">
              Next week →
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="font-display text-3xl text-gray-900">🏆 Weekly Power Rankings 🏆</h1>
        <p className="text-gray-400 mt-1">{report.period}</p>
        <div className="flex justify-center gap-3 mt-4">
          <button onClick={() => setWeeksAgo((w) => w + 1)} className="px-4 py-2 bg-white rounded-xl text-sm font-bold border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all">
            ← Previous
          </button>
          {weeksAgo > 0 && (
            <button onClick={() => setWeeksAgo((w) => w - 1)} className="px-4 py-2 bg-white rounded-xl text-sm font-bold border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all">
              Next →
            </button>
          )}
        </div>
      </div>

      {/* Executive Summary */}
      <section className="bg-white rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_#000] p-6">
        <h2 className="font-display text-xl text-gray-900 mb-4">📊 Executive Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-kikoff-lavender rounded-xl border-2 border-black">
            <div className={`text-3xl font-bold ${ratingColor(report.summary.avgOverall)}`}>
              {report.summary.avgOverall.toFixed(1)}
            </div>
            <div className="text-lg">{ratingEmoji(report.summary.avgOverall)}</div>
            <div className="text-xs text-gray-400 mt-1">This week&apos;s overall average</div>
          </div>
          <div className="text-center p-4 bg-kikoff-lavender rounded-xl border-2 border-black">
            <div className="text-3xl font-bold text-gray-900">
              {report.summary.totalDaysWithData > 0 ? Math.round(report.summary.totalVotes / report.summary.totalDaysWithData) : 0}
            </div>
            <div className="text-xs text-gray-400 mt-1">Avg Votes / Day</div>
          </div>
          {(() => {
            const mostActive = [...report.dayByDay].filter((d) => d.totalVotes > 0).sort((a, b) => b.totalVotes - a.totalVotes)[0];
            return (
              <div className="text-center p-4 bg-kikoff-lavender rounded-xl border-2 border-black">
                <div className="text-sm text-gray-900 mb-1 font-bold">Most Active Day</div>
                <div className="text-3xl font-bold text-gray-900">
                  {mostActive?.dayName || "—"}
                </div>
                {mostActive && (
                  <div className="text-sm font-bold text-gray-500 mt-0.5">
                    {mostActive.totalVotes} votes
                  </div>
                )}
              </div>
            );
          })()}
          <div className="text-center p-4 bg-kikoff-lavender rounded-xl border-2 border-black">
            <div className="text-sm text-gray-900 mb-1 font-bold">Best Day of the Week</div>
            <div className="text-3xl font-bold text-green-500">
              {report.summary.bestDay?.name || "—"}
            </div>
            {report.summary.bestDay && (
              <div className="text-lg font-bold text-green-500 mt-0.5">
                {Math.round(report.summary.bestDay.avg)}/5
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Hall of Fame & Shame */}
      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-white rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_#000] p-6">
          <h2 className="font-display text-xl text-gray-900 mb-4">🏛️ Hall of Fame</h2>
          <div className="space-y-2">
            {report.topDishes.slice(0, 5).map((dish, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-kikoff-lavender rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                <div>
                  <span className="text-sm mr-2">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</span>
                  <span className="font-medium text-sm">{dish.name}</span>
                  <span className="text-xs text-gray-400 ml-1">({dish.category}, {dish.dayName})</span>
                </div>
                <span className="font-bold text-green-600">{dish.avg.toFixed(1)}</span>
              </div>
            ))}
            {report.topDishes.length === 0 && <p className="text-gray-400 text-sm">No dish data yet</p>}
          </div>
        </section>

        <section className="bg-white rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_#000] p-6">
          <h2 className="font-display text-xl text-gray-900 mb-4">💀 Hall of Shame</h2>
          <div className="space-y-2">
            {report.bottomDishes.slice(0, 3).map((dish, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-red-50 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                <div>
                  <span className="font-medium text-sm">{dish.name}</span>
                  <span className="text-xs text-gray-400 ml-1">({dish.category}, {dish.dayName})</span>
                </div>
                <span className="font-bold text-red-500">{dish.avg.toFixed(1)}</span>
              </div>
            ))}
            {report.bottomDishes.length === 0 && <p className="text-gray-400 text-sm">No dish data yet</p>}
          </div>
        </section>
      </div>

      {/* Day-by-Day */}
      <section className="bg-white rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_#000] p-6">
        <h2 className="font-display text-xl text-gray-900 mb-4">📅 Day-by-Day Breakdown</h2>
        <div className="space-y-3">
          {report.dayByDay.map((day) => {
            const today = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })).toISOString().split("T")[0];
            const isFuture = day.date > today;
            const isToday = day.date === today;

            return (
              <div key={day.date} className={`p-4 rounded-xl border-2 border-black ${isFuture ? "bg-gray-50 opacity-60" : "bg-kikoff-lavender"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{day.dayName}</span>
                      <span className="text-xs text-gray-400">{formatDate(day.date)}</span>
                    </div>
                    {day.restaurant && !isFuture && (
                      <span className="text-xs bg-kikoff/20 text-kikoff-dark px-2 py-0.5 rounded-full inline-block mt-1">
                        🍴 {day.restaurant}
                      </span>
                    )}
                  </div>
                  {!isFuture && (
                    <div className="text-right shrink-0 ml-3">
                      <span className={`text-2xl font-bold ${ratingColor(day.avgOverall)}`}>
                        {day.avgOverall.toFixed(1)}
                      </span>
                      <span className="text-sm text-gray-400">/5</span>
                    </div>
                  )}
                </div>
                {isFuture ? (
                  <p className="text-xs text-gray-400 mt-2">⏳ Check back on {day.dayName}!</p>
                ) : isToday && day.totalVotes === 0 ? (
                  <p className="text-xs text-gray-400 mt-2">🗳️ No votes yet — voting is open!</p>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:gap-4 gap-0.5 mt-2 text-xs text-gray-400">
                    <span>{day.totalVotes} votes</span>
                    {day.topDish && <span>Top: {day.topDish.name} ({day.topDish.avg.toFixed(1)})</span>}
                    {day.worstDish && <span>Low: {day.worstDish.name} ({day.worstDish.avg.toFixed(1)})</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Friday Catering Spotlight */}
      {report.fridaySpotlight.length > 0 && (
        <section className="bg-white rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_#000] p-6">
          <h2 className="font-display text-xl text-gray-900 mb-4">🍴 Friday Catering Spotlight</h2>
          {report.fridaySpotlight.map((fri) => (
            <div key={fri.date} className="p-4 bg-kikoff/20 rounded-xl border-2 border-black mb-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-semibold">{fri.restaurant || "Friday Lunch"}</span>
                  <span className="text-xs text-gray-400 ml-2">{formatDate(fri.date)}</span>
                </div>
                <div>
                  {fri.totalVotes > 0 ? (
                    <>
                      <span className={`text-xl font-bold ${ratingColor(fri.avgOverall)}`}>{fri.avgOverall.toFixed(1)}</span>
                      <span className="text-sm text-gray-400">/5 ({fri.totalVotes} votes)</span>
                    </>
                  ) : (
                    <span className="text-xl font-bold text-gray-400">N/A</span>
                  )}
                </div>
              </div>
              {fri.totalVotes > 0 && fri.dishes.length > 0 && (
                <div className="space-y-1 mt-2">
                  {fri.dishes.sort((a, b) => b.avg - a.avg).map((dish, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span>{dish.name} <span className="text-gray-400">({dish.category})</span></span>
                      <span className={`font-semibold ${ratingColor(dish.avg)}`}>{dish.avg.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Comments */}
      {report.comments.length > 0 && (
        <section className="bg-white rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_#000] p-6">
          <h2 className="font-display text-xl text-gray-900 mb-4">💬 Feedback Highlights</h2>
          <div className="space-y-2">
            {report.comments.slice(0, 5).map((c, i) => (
              <div key={i} className="p-3 bg-white rounded-xl border-2 border-black">
                <p className="text-sm text-gray-700">&ldquo;{c.comment}&rdquo;</p>
                <p className="text-xs text-gray-400 mt-1">— {formatDate(c.date)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}

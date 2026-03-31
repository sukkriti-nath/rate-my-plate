"use client";

import { useEffect, useState } from "react";
import StarRating from "@/components/StarRating";

interface DayStats {
  date: string;
  totalVotes: number;
  averageOverall: number;
}

export default function HistoryPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [stats, setStats] = useState<Record<string, DayStats>>({});

  const weekDates = getWeekDates(weekOffset);

  useEffect(() => {
    async function fetchStats() {
      const results: Record<string, DayStats> = {};
      await Promise.all(
        weekDates.map(async (date) => {
          try {
            const res = await fetch(`/api/votes?date=${date}`);
            const data = await res.json();
            if (data.stats) {
              results[date] = {
                date,
                totalVotes: data.stats.totalVotes,
                averageOverall: data.stats.averageOverall,
              };
            }
          } catch {
            // skip
          }
        })
      );
      setStats(results);
    }
    fetchStats();
  }, [weekOffset]);

  const weekStart = new Date(weekDates[0] + "T12:00:00").toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric" }
  );
  const weekEnd = new Date(weekDates[weekDates.length - 1] + "T12:00:00").toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric" }
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setWeekOffset((o) => o - 1)}
          className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          &larr; Previous
        </button>
        <h2 className="text-lg font-semibold text-gray-900">
          {weekStart} - {weekEnd}
        </h2>
        <button
          onClick={() => setWeekOffset((o) => Math.min(o + 1, 0))}
          disabled={weekOffset >= 0}
          className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-30"
        >
          Next &rarr;
        </button>
      </div>

      <div className="space-y-4">
        {weekDates.map((date) => {
          const day = stats[date];
          const dayName = new Date(date + "T12:00:00").toLocaleDateString(
            "en-US",
            { weekday: "long", month: "short", day: "numeric" }
          );

          return (
            <div
              key={date}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">{dayName}</h3>
                {day && day.totalVotes > 0 ? (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-kikoff-dark">
                        {day.averageOverall.toFixed(1)}
                      </span>
                      <StarRating
                        value={Math.round(day.averageOverall)}
                        readonly
                        size="sm"
                      />
                    </div>
                    <span className="text-sm text-gray-400">
                      {day.totalVotes} vote{day.totalVotes !== 1 ? "s" : ""}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">No votes</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getWeekDates(offset: number): string[] {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + offset * 7);

  const dates: string[] = [];
  for (let i = 0; i < 4; i++) { // Mon-Thu only (no Friday catering)
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

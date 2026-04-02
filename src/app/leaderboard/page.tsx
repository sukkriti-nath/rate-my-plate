"use client";

import { useEffect, useState } from "react";

interface LeaderboardEntry {
  rank: number;
  userName: string;
  userEmail: string;
  currentStreak: number;
  longestStreak: number;
  monthlyReviews: number;
  lastVoteDate: string;
  badge: "Super Reviewer" | "Regular" | "New";
}

const BADGE_STYLES = {
  "Super Reviewer": {
    bg: "bg-kikoff",
    text: "text-kikoff-dark",
    border: "border-black",
    label: "Super Reviewer",
  },
  Regular: {
    bg: "bg-kikoff-lavender",
    text: "text-gray-800",
    border: "border-black",
    label: "Regular",
  },
  New: {
    bg: "bg-blue-50",
    text: "text-blue-800",
    border: "border-blue-200",
    label: "New",
  },
};

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.leaderboard || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-4xl animate-pulse">⭐</div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">⭐</div>
        <h1 className="font-display text-3xl text-gray-900 mb-3">
          Super Reviewers
        </h1>
        <p className="text-gray-400">
          No votes yet. Be the first to rate and claim the top spot!
        </p>
      </div>
    );
  }

  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="text-center mb-6">
        <h1 className="font-display text-3xl text-gray-900 mb-1 font-extrabold">
          ⭐ Super Reviewers ⭐
        </h1>
        <p className="text-gray-400">
          The most dedicated food critics at Kikoff
        </p>
      </div>

      {/* Podium - Top 3 */}
      <div className="bg-white rounded-xl p-6 mb-6 border-2 border-black shadow-[8px_8px_0px_0px_#000]">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 pb-3 border-b-2 border-black">
          Leaderboard
        </h2>
        <div className="space-y-3">
          {podium.map((entry, i) => {
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
            const badgeStyle = BADGE_STYLES[entry.badge];
            return (
              <div
                key={entry.userEmail}
                className={`rounded-xl px-5 py-4 flex items-center justify-between border-2 border-black shadow-[4px_4px_0px_0px_#000] animate-slide-up ${
                  i === 0 ? "bg-kikoff" : "bg-kikoff-lavender"
                }`}
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{medal}</span>
                  <div>
                    <div className="font-semibold text-gray-900">
                      {entry.userName}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}
                      >
                        {badgeStyle.label}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-kikoff-dark">
                    {entry.monthlyReviews}
                  </div>
                  <div className="text-xs text-gray-500">this month</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl p-4 border-2 border-black shadow-[4px_4px_0px_0px_#000] text-center">
          <div className="text-2xl font-bold text-kikoff-dark">
            {entries.length}
          </div>
          <div className="text-xs text-gray-500 mt-1">Total Reviewers</div>
        </div>
        <div className="bg-white rounded-xl p-4 border-2 border-black shadow-[4px_4px_0px_0px_#000] text-center">
          <div className="text-2xl font-bold text-kikoff-dark">
            {entries.filter((e) => e.badge === "Super Reviewer").length}
          </div>
          <div className="text-xs text-gray-500 mt-1">Super Reviewers</div>
        </div>
        <div className="bg-white rounded-xl p-4 border-2 border-black shadow-[4px_4px_0px_0px_#000] text-center">
          <div className="text-2xl font-bold text-kikoff-dark">
            {Math.max(...entries.map((e) => e.monthlyReviews), 0)}
          </div>
          <div className="text-xs text-gray-500 mt-1">Most Reviews</div>
        </div>
      </div>

      {/* Full list */}
      {rest.length > 0 && (
        <div className="bg-white rounded-xl p-6 mb-6 border-2 border-black shadow-[4px_4px_0px_0px_#000]">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 pb-3 border-b-2 border-black">
            All Reviewers
          </h2>
          <div className="space-y-2">
            {rest.map((entry) => {
              const badgeStyle = BADGE_STYLES[entry.badge];
              return (
                <div
                  key={entry.userEmail}
                  className="bg-gray-50 rounded-xl px-5 py-3 flex items-center justify-between border-2 border-black shadow-[2px_2px_0px_0px_#000]"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-400 w-6 text-center">
                      #{entry.rank}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-gray-800">
                        {entry.userName}
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}
                      >
                        {badgeStyle.label}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-kikoff-dark">
                      {entry.monthlyReviews}
                    </div>
                    <div className="text-[10px] text-gray-500">this month</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Badge Legend */}
      <div className="text-center text-xs text-gray-400 space-y-1">
        <p>
          <strong>Super Reviewer</strong> = 20+ engagement score &nbsp;|&nbsp;
          <strong>Regular</strong> = 10-19 &nbsp;|&nbsp;
          <strong>New</strong> = under 10
        </p>
        <p>Powered by RateMyPlate • Built with 💚 at Kikoff</p>
      </div>
    </div>
  );
}

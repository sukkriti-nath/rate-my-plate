"use client";

import { useEffect, useState } from "react";

interface LeaderboardEntry {
  rank: number;
  userName: string;
  userEmail: string;
  currentStreak: number;
  longestStreak: number;
  lastVoteDate: string;
  monthlyVotes: number;
  allTimeVotes: number;
  badge: "Super Prime" | "Prime" | "Subprime" | "New";
}

const BADGE_STYLES = {
  "Super Prime": {
    bg: "bg-kikoff",
    text: "text-kikoff-dark",
    border: "border-black",
    emoji: "\u{1F3C6}",
    label: "Super Prime",
  },
  Prime: {
    bg: "bg-kikoff-lavender",
    text: "text-gray-800",
    border: "border-black",
    emoji: "\u2B50",
    label: "Prime",
  },
  Subprime: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-300",
    emoji: "\u{1F4C8}",
    label: "Subprime",
  },
  New: {
    bg: "bg-blue-50",
    text: "text-blue-800",
    border: "border-blue-200",
    emoji: "\u{1F476}",
    label: "New",
  },
};

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [allTimeTop3, setAllTimeTop3] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.leaderboard || []);
        setAllTimeTop3(data.allTimeTop3 || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-4xl animate-pulse">{"\u2B50"}</div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">{"\u2B50"}</div>
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
          {"\u2B50"} Super Reviewers {"\u2B50"}
        </h1>
        <p className="text-gray-400">
          The most dedicated food critics at Kikoff
        </p>
      </div>

      {/* Podium - Top 3 This Month */}
      <div className="bg-white rounded-xl p-6 mb-6 border-2 border-black shadow-[8px_8px_0px_0px_#000]">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider pb-3 border-b-2 border-black">
          Leaderboard — This Month
        </h2>
        <p className="text-xs text-gray-400 mt-2 mb-4">Ranked by total reviews submitted this month</p>
        <div className="space-y-3">
          {podium.map((entry, i) => {
            const medal = i === 0 ? "\u{1F947}" : i === 1 ? "\u{1F948}" : "\u{1F949}";
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
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-xs font-bold px-3 py-1 rounded-full border-2 ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}
                      >
                        {badgeStyle.emoji} {badgeStyle.label}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-kikoff-dark">
                    {entry.monthlyVotes}
                  </div>
                  <div className="text-xs text-gray-500">reviews this month</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* All Time Top 3 */}
      {allTimeTop3.length > 0 && (
        <div className="bg-white rounded-xl p-6 mb-6 border-2 border-black shadow-[8px_8px_0px_0px_#000]">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 pb-3 border-b-2 border-black">
            {"\u{1F451}"} All Time Leaderboard
          </h2>
          <div className="space-y-3">
            {allTimeTop3.map((entry, i) => {
              const medal = i === 0 ? "\u{1F947}" : i === 1 ? "\u{1F948}" : "\u{1F949}";
              const badgeStyle = BADGE_STYLES[entry.badge];
              return (
                <div
                  key={entry.userEmail}
                  className={`rounded-xl px-5 py-4 flex items-center justify-between border-2 border-black shadow-[4px_4px_0px_0px_#000] ${
                    i === 0 ? "bg-gradient-to-r from-amber-50 to-yellow-100" : "bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{medal}</span>
                    <div>
                      <div className="font-semibold text-gray-900">
                        {entry.userName}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`text-xs font-bold px-3 py-1 rounded-full border-2 ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}
                        >
                          {badgeStyle.emoji} {badgeStyle.label}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-kikoff-dark">
                      {entry.allTimeVotes}
                    </div>
                    <div className="text-xs text-gray-500">all time</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
            {entries.filter((e) => e.badge === "Super Prime").length}
          </div>
          <div className="text-xs text-gray-500 mt-1">Super Prime</div>
        </div>
        <div className="bg-white rounded-xl p-4 border-2 border-black shadow-[4px_4px_0px_0px_#000] text-center">
          <div className="text-2xl font-bold text-kikoff-dark">
            {Math.max(...entries.map((e) => e.monthlyVotes), 0)}
          </div>
          <div className="text-xs text-gray-500 mt-1">Most Reviews</div>
        </div>
      </div>

      {/* Badge Tiers — moved above All Reviewers */}
      <div className="bg-white rounded-xl p-5 mb-6 border-2 border-black shadow-[4px_4px_0px_0px_#000]">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 pb-2 border-b-2 border-black">
          Badge Tiers
        </h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full border-2 bg-kikoff text-kikoff-dark border-black">{"\u{1F3C6}"} Super Prime</span>
            <span className="text-gray-500">20+ / month</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full border-2 bg-kikoff-lavender text-gray-800 border-black">{"\u2B50"} Prime</span>
            <span className="text-gray-500">10-19 / month</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full border-2 bg-amber-50 text-amber-800 border-amber-300">{"\u{1F4C8}"} Subprime</span>
            <span className="text-gray-500">&lt;10 / month</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full border-2 bg-blue-50 text-blue-800 border-blue-200">{"\u{1F476}"} New</span>
            <span className="text-gray-500">First 3 reviews</span>
          </div>
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
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border-2 ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}
                      >
                        {badgeStyle.emoji} {badgeStyle.label}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-kikoff-dark">
                      {entry.monthlyVotes}
                    </div>
                    <div className="text-[10px] text-gray-500">this month</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="text-center text-xs text-gray-400">
        <p>Powered by RateMyPlate &bull; Built with {"\u{1F49A}"} at Kikoff</p>
      </div>
    </div>
  );
}

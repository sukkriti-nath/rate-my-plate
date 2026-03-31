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
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [weeksAgo, setWeeksAgo] = useState(0);
  const [slackHandle, setSlackHandle] = useState("");
  const [email, setEmail] = useState("");
  const [sendResults, setSendResults] = useState<{ recipient: string; method: string; success: boolean; error?: string }[]>([]);

  useEffect(() => {
    setLoading(true);
    setSent(false);
    fetch(`/api/reports/generate?weeksAgo=${weeksAgo}`)
      .then((r) => r.json())
      .then((data) => {
        setReport(data.report);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [weeksAgo]);

  async function handleSendSlack() {
    if (!report) return;
    const handle = slackHandle.trim();
    if (!handle) { alert("Please enter a Slack handle"); return; }
    setSending(true);
    setSent(false);
    setSendResults([]);
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeksAgo, slackHandles: [handle], emails: [] }),
      });
      const data = await res.json();
      setSendResults(data.results || []);
      setSent(true);
    } catch { alert("Failed to send report"); }
    setSending(false);
  }

  async function handleSendEmail() {
    if (!report) return;
    const addr = email.trim();
    if (!addr) { alert("Please enter an email address"); return; }
    setSending(true);
    setSent(false);
    setSendResults([]);
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeksAgo, slackHandles: [], emails: [addr] }),
      });
      const data = await res.json();
      setSendResults(data.results || []);
      setSent(true);
    } catch { alert("Failed to send report"); }
    setSending(false);
  }

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
            ← Previous 2 weeks
          </button>
          {weeksAgo > 0 && (
            <button onClick={() => setWeeksAgo((w) => w - 1)} className="px-4 py-2 bg-white rounded-xl text-sm font-bold border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all">
              Next 2 weeks →
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
        <h1 className="font-display text-3xl text-gray-900">📋 Bi-Weekly Report</h1>
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
            <div className="text-xs text-gray-400 mt-1">Overall Avg</div>
          </div>
          <div className="text-center p-4 bg-kikoff-lavender rounded-xl border-2 border-black">
            <div className="text-3xl font-bold text-gray-900">{report.summary.totalVotes}</div>
            <div className="text-xs text-gray-400 mt-1">Total Votes</div>
          </div>
          <div className="text-center p-4 bg-kikoff-lavender rounded-xl border-2 border-black">
            <div className="text-3xl font-bold text-gray-900">{report.summary.totalDaysWithData}</div>
            <div className="text-xs text-gray-400 mt-1">Days Rated</div>
          </div>
          <div className="text-center p-4 bg-kikoff-lavender rounded-xl border-2 border-black">
            <div className="text-3xl font-bold text-green-500">
              {report.summary.bestDay?.name || "—"}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Best Day {report.summary.bestDay ? `(${report.summary.bestDay.avg.toFixed(1)})` : ""}
            </div>
          </div>
        </div>
      </section>

      {/* Day-by-Day */}
      <section className="bg-white rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_#000] p-6">
        <h2 className="font-display text-xl text-gray-900 mb-4">📅 Day-by-Day Breakdown</h2>
        <div className="space-y-3">
          {report.dayByDay.map((day) => (
            <div key={day.date} className="flex items-center justify-between p-4 bg-kikoff-lavender rounded-xl border-2 border-black">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{day.dayName}</span>
                  <span className="text-xs text-gray-400">{formatDate(day.date)}</span>
                  {day.restaurant && (
                    <span className="text-xs bg-kikoff/20 text-kikoff-dark px-2 py-0.5 rounded-full">
                      🍴 {day.restaurant}
                    </span>
                  )}
                </div>
                <div className="flex gap-4 mt-1 text-xs text-gray-400">
                  <span>{day.totalVotes} votes</span>
                  {day.topDish && <span>Top: {day.topDish.name} ({day.topDish.avg.toFixed(1)})</span>}
                  {day.worstDish && <span>Low: {day.worstDish.name} ({day.worstDish.avg.toFixed(1)})</span>}
                </div>
              </div>
              <div className="text-right">
                <span className={`text-2xl font-bold ${ratingColor(day.avgOverall)}`}>
                  {day.avgOverall.toFixed(1)}
                </span>
                <span className="text-sm text-gray-400">/5</span>
                <div className="text-lg">{ratingEmoji(day.avgOverall)}</div>
              </div>
            </div>
          ))}
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

      {/* Friday Catering Spotlight */}
      {report.fridaySpotlight.length > 0 && (
        <section className="bg-white rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_#000] p-6">
          <h2 className="font-display text-xl text-gray-900 mb-4">🍴 Friday Catering Spotlight</h2>
          <p className="text-sm text-gray-400 mb-4">Granular feedback for Friday catering — use this to optimize vendor selection and reduce waste.</p>
          {report.fridaySpotlight.map((fri) => (
            <div key={fri.date} className="p-4 bg-kikoff/20 rounded-xl border-2 border-black mb-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-semibold">{fri.restaurant || "Friday Lunch"}</span>
                  <span className="text-xs text-gray-400 ml-2">{formatDate(fri.date)}</span>
                </div>
                <div>
                  <span className={`text-xl font-bold ${ratingColor(fri.avgOverall)}`}>{fri.avgOverall.toFixed(1)}</span>
                  <span className="text-sm text-gray-400">/5 ({fri.totalVotes} votes)</span>
                </div>
              </div>
              {fri.dishes.length > 0 && (
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
            {report.comments.slice(0, 15).map((c, i) => (
              <div key={i} className="p-3 bg-white rounded-xl border-2 border-black">
                <p className="text-sm text-gray-700">&ldquo;{c.comment}&rdquo;</p>
                <p className="text-xs text-gray-400 mt-1">— {c.userName} • {formatDate(c.date)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Download & Send Report */}
      <section className="bg-kikoff-dark rounded-xl border-2 border-black shadow-[8px_8px_0px_0px_#000] p-6">
        <h2 className="font-display text-xl text-white mb-2 text-center">Export & Share Report</h2>

        {/* PDF Download */}
        <div className="text-center mb-6">
          <a
            href={`/api/reports/pdf?weeksAgo=${weeksAgo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-8 py-3 rounded-xl font-bold text-kikoff-dark bg-kikoff border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
          >
            📄 Download Report (.docx)
          </a>
        </div>

        {/* Send via Slack */}
        <div className="bg-white/10 rounded-xl border-2 border-white/20 p-5 mb-3">
          <p className="text-gray-300 text-sm mb-3 font-medium">Send via Slack DM</p>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Slack handle (e.g. @sukkriti)"
              value={slackHandle}
              onChange={(e) => setSlackHandle(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white/10 text-white placeholder-gray-500 border-2 border-white/20 focus:border-kikoff focus:outline-none text-sm"
            />
            <button
              onClick={handleSendSlack}
              disabled={sending}
              className={`px-6 py-2.5 rounded-xl font-bold text-kikoff-dark transition-all shrink-0 border-2 border-black shadow-[2px_2px_0px_0px_#000] ${
                sending ? "bg-gray-400 cursor-wait" : "bg-kikoff hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
              }`}
            >
              {sending ? "..." : "📤 Send"}
            </button>
          </div>
        </div>

        {/* Send via Email */}
        <div className="bg-white/10 rounded-xl border-2 border-white/20 p-5">
          <p className="text-gray-300 text-sm mb-3 font-medium">Send via Email</p>
          <div className="flex gap-3">
            <input
              type="email"
              placeholder="Email (e.g. sukkriti@kikoff.com)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white/10 text-white placeholder-gray-500 border-2 border-white/20 focus:border-kikoff focus:outline-none text-sm"
            />
            <button
              onClick={handleSendEmail}
              disabled={sending}
              className={`px-6 py-2.5 rounded-xl font-bold text-kikoff-dark transition-all shrink-0 border-2 border-black shadow-[2px_2px_0px_0px_#000] ${
                sending ? "bg-gray-400 cursor-wait" : "bg-kikoff hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
              }`}
            >
              {sending ? "..." : "📧 Send"}
            </button>
          </div>
        </div>

        {/* Results */}
        {sent && sendResults.length > 0 && (
          <div className="mt-4 space-y-1">
            {sendResults.map((r, i) => (
              <p key={i} className={`text-sm ${r.success ? "text-green-400" : "text-red-400"}`}>
                {r.success ? "✅" : "❌"} {r.recipient} — {r.success ? "Sent!" : r.error}
              </p>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

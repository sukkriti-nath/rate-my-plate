"use client";

import { useState, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

const FOOD_EMOJIS = ["🍕", "🍜", "🥗", "🌮", "🍱", "🥘", "🍲", "🧆", "🥙", "🍛"];

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: number; emoji: string; x: number; delay: number }[]>([]);

  useEffect(() => {
    const emojis = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      emoji: FOOD_EMOJIS[Math.floor(Math.random() * FOOD_EMOJIS.length)],
      x: 10 + Math.random() * 80,
      delay: Math.random() * 3,
    }));
    setFloatingEmojis(emojis);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");

    if (!email.endsWith("@kikoff.com")) {
      setLoginError("Please use your @kikoff.com email address");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        window.location.href = "/";
      } else {
        setLoginError(data.error || "Login failed");
      }
    } catch {
      setLoginError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Floating food emojis in background */}
      <div className="absolute inset-0 pointer-events-none">
        {floatingEmojis.map((e) => (
          <div
            key={e.id}
            className="absolute text-4xl opacity-10"
            style={{
              left: `${e.x}%`,
              top: `${20 + e.id * 10}%`,
              animationDelay: `${e.delay}s`,
            }}
          >
            {e.emoji}
          </div>
        ))}
      </div>

      <div className="max-w-sm w-full relative z-10">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🍽️</div>
          <h1 className="text-3xl font-bold mb-2 text-kikoff-dark">
            Rate<span className="bg-kikoff px-1.5 py-0.5 rounded-lg">My</span>Plate
          </h1>
          <p className="text-gray-500">Your voice shapes tomorrow&apos;s menu</p>
        </div>

        {(error || loginError) && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">
            {loginError || `Authentication failed: ${error}`}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="yourname@kikoff.com"
              required
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-center text-gray-700 focus:outline-none focus:ring-2 focus:ring-kikoff focus:border-transparent text-lg"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 px-4 rounded-xl font-semibold transition-all text-lg
              bg-kikoff text-kikoff-dark hover:bg-kikoff-hover
              disabled:opacity-40 disabled:cursor-not-allowed
              active:scale-[0.98]"
          >
            {submitting ? "Signing in..." : "Let's Eat! 🍴"}
          </button>
        </form>

        <p className="text-xs text-gray-400 mt-6 text-center">
          Just use your @kikoff.com email. No password needed.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[85vh] flex items-center justify-center">
          <div className="text-4xl animate-pulse">🍽️</div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

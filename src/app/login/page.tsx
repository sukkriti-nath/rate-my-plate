"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState("");

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
      {/* Background pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23131413' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }} />

      <div className="max-w-sm w-full relative z-10">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-kikoff/20 text-kikoff-dark px-4 py-1.5 rounded-full text-sm font-medium mb-5">
            <span>🔥</span> New at Kikoff
          </div>
          <h1 className="font-display text-5xl text-kikoff-dark mb-3 leading-tight">
            Rate<span className="bg-kikoff px-2 py-0.5 rounded-xl mx-1">My</span>Plate
          </h1>
          <p className="text-gray-500 text-lg">
            Your voice shapes tomorrow&apos;s menu
          </p>
        </div>

        {(error || loginError) && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-2xl border border-red-100">
            {loginError || `Oops! ${error}`}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="yourname@kikoff.com"
              required
              className="w-full px-5 py-4 rounded-2xl border-2 border-gray-200 text-center text-gray-700 text-lg
                focus:outline-none focus:ring-0 focus:border-kikoff
                transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 px-4 rounded-2xl font-bold transition-all text-lg
              bg-kikoff text-kikoff-dark hover:bg-kikoff-hover hover:shadow-lg hover:shadow-kikoff/20
              disabled:opacity-40 disabled:cursor-not-allowed
              active:scale-[0.98]"
          >
            {submitting ? "Signing in..." : "Let's Eat! 🍴"}
          </button>
        </form>

        <p className="text-xs text-gray-400 mt-6 text-center">
          Just your @kikoff.com email. No password needed. <span className="text-gray-300">Easy peasy.</span>
        </p>

        {/* Fun stats teaser */}
        <div className="mt-10 flex items-center justify-center gap-6 text-center">
          <div>
            <div className="text-2xl">🥇</div>
            <div className="text-[10px] text-gray-400 mt-1">Power<br/>Rankings</div>
          </div>
          <div>
            <div className="text-2xl">📊</div>
            <div className="text-[10px] text-gray-400 mt-1">Live<br/>Results</div>
          </div>
          <div>
            <div className="text-2xl">🌶️</div>
            <div className="text-[10px] text-gray-400 mt-1">Hot<br/>Takes</div>
          </div>
        </div>
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

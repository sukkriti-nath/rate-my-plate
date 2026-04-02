"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useRef } from "react";

interface SearchProduct {
  id: string;
  name: string;
  brand: string;
  category: string;
  imageUrl: string | null;
}

interface UserSession {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
}

interface UserProfile {
  drinksAllocation: Record<string, number>;
  snacksAllocation: Record<string, number>;
  favoriteDrinks: string[];
  favoriteSnacks: string[];
}

interface Suggestion {
  id: string;
  snackName: string;
  submittedBy: string;
  submittedByName: string;
  upvotes: number;
  downvotes: number;
  userVote: "up" | "down" | null;
  createdAt: string;
}

export default function SnacksPage() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestionText, setSuggestionText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchProduct[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    try {
      // Fetch user
      const userRes = await fetch("/api/auth/me", { credentials: "same-origin" });
      const userData = await userRes.json();
      setUser(userData.user || null);

      // Fetch profile if logged in
      if (userData.user) {
        const profileRes = await fetch("/api/snacks/web-profile", { credentials: "same-origin" });
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          setProfile(profileData.profile || null);
        }
      }

      // Fetch suggestions
      const suggestionsRes = await fetch("/api/snacks/suggestions", { credentials: "same-origin" });
      if (suggestionsRes.ok) {
        const suggestionsData = await suggestionsRes.json();
        setSuggestions(suggestionsData.suggestions || []);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search
  const handleSuggestionInputChange = (value: string) => {
    setSuggestionText(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (value.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/snacks/search?q=${encodeURIComponent(value)}&category=all`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.products || []);
          setShowDropdown(true);
        }
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const handleSelectProduct = (product: SearchProduct) => {
    setSuggestionText(product.name);
    setShowDropdown(false);
    setSearchResults([]);
  };

  const handleSubmitSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestionText.trim() || !user) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/snacks/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "add", snackName: suggestionText.trim() }),
      });
      if (res.ok) {
        setSuggestionText("");
        await fetchData();
      }
    } catch (err) {
      console.error("Failed to submit suggestion:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (suggestionId: string, vote: "up" | "down") => {
    if (!user) return;

    try {
      const res = await fetch("/api/snacks/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "vote", suggestionId, vote }),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error("Failed to vote:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">🍿</div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  const totalAllocated = profile
    ? Object.values(profile.drinksAllocation).reduce((a, b) => a + b, 0) +
      Object.values(profile.snacksAllocation).reduce((a, b) => a + b, 0)
    : 0;

  const topCategories = profile
    ? [...Object.entries(profile.drinksAllocation), ...Object.entries(profile.snacksAllocation)]
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
    : [];

  const sortedSuggestions = [...suggestions].sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-1 space-y-6">
            {/* Profile Card */}
            <div className="bg-white rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_#000] overflow-hidden">
              <div className="p-5 border-b-2 border-black bg-amber-50">
                <h2 className="font-bold text-gray-900 flex items-center gap-2">
                  <span>👤</span> Your Snack Profile
                </h2>
              </div>
              <div className="p-5">
                {!user ? (
                  <div className="text-center py-4">
                    <p className="text-gray-600 text-sm mb-4">Sign in to create your snack profile</p>
                    <Link
                      href="/login?next=/snacks"
                      className="inline-block bg-amber-400 text-black font-bold px-5 py-2 rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
                    >
                      Sign in
                    </Link>
                  </div>
                ) : !profile || totalAllocated === 0 ? (
                  <div className="text-center py-4">
                    <div className="text-4xl mb-3">🎯</div>
                    <p className="text-gray-600 text-sm mb-4">
                      Allocate <strong>100 points</strong> across snack categories to help us stock what you love!
                    </p>
                    <Link
                      href="/snacks/profile"
                      className="inline-block bg-amber-400 text-black font-bold px-5 py-2 rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
                    >
                      Create Profile
                    </Link>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt="" className="w-10 h-10 rounded-full border-2 border-black" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-amber-400 border-2 border-black flex items-center justify-center font-bold">
                          {user.displayName.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-gray-900">{user.displayName}</div>
                        <div className="text-xs text-gray-500">{totalAllocated} points allocated</div>
                      </div>
                    </div>
                    {topCategories.length > 0 && (
                      <div className="mb-4">
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Top Categories</div>
                        <div className="space-y-1.5">
                          {topCategories.map(([cat, pts]) => (
                            <div key={cat} className="flex items-center justify-between text-sm">
                              <span className="text-gray-700">{cat}</span>
                              <span className="font-semibold text-amber-700">{pts} pts</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <Link
                      href="/snacks/profile"
                      className="block text-center text-sm font-semibold text-amber-700 hover:text-amber-900"
                    >
                      Edit Profile →
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Suggestion Form */}
            <div className="bg-white rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_#000] overflow-visible">
              <div className="p-5 border-b-2 border-black bg-cyan-50 rounded-t-xl">
                <h2 className="font-bold text-gray-900 flex items-center gap-2">
                  <span>💡</span> Suggest a Snack
                </h2>
              </div>
              <div className="p-5 relative">
                {!user ? (
                  <p className="text-gray-500 text-sm text-center py-2">Sign in to suggest snacks</p>
                ) : (
                  <form onSubmit={handleSubmitSuggestion}>
                    <div className="relative" ref={dropdownRef}>
                      <input
                        type="text"
                        value={suggestionText}
                        onChange={(e) => handleSuggestionInputChange(e.target.value)}
                        onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                        placeholder="Search snacks & drinks..."
                        className="w-full px-4 py-2.5 rounded-lg border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      {searching && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                      {showDropdown && searchResults.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border-2 border-black rounded-lg shadow-[4px_4px_0px_0px_#000] max-h-60 overflow-y-auto">
                          {searchResults.map((product) => (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => handleSelectProduct(product)}
                              className="w-full px-3 py-2 text-left hover:bg-amber-50 flex items-center gap-3 border-b border-black/10 last:border-b-0"
                            >
                              {product.imageUrl ? (
                                <img
                                  src={product.imageUrl}
                                  alt=""
                                  className="w-10 h-10 object-contain rounded border border-black/10"
                                />
                              ) : (
                                <div className="w-10 h-10 bg-gray-100 rounded border border-black/10 flex items-center justify-center text-lg">
                                  🍿
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                  {product.name}
                                </div>
                                {product.category && (
                                  <div className="text-xs text-gray-500 truncate">
                                    {product.category.replace(/-/g, " ")}
                                  </div>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">
                      Type to search or enter any snack name
                    </p>
                    <button
                      type="submit"
                      disabled={!suggestionText.trim() || submitting}
                      className="mt-3 w-full bg-cyan-400 text-black font-bold py-2.5 rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? "Submitting..." : "Submit Suggestion"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Suggestions Leaderboard */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_#000] overflow-hidden">
              <div className="p-5 border-b-2 border-black bg-gradient-to-r from-amber-50 to-orange-50">
                <h2 className="font-bold text-gray-900 flex items-center gap-2">
                  <span>🏆</span> Snack Suggestions Leaderboard
                </h2>
                <p className="text-xs text-gray-500 mt-1">Vote for snacks you want to see in the kitchen!</p>
              </div>
              <div className="p-5">
                {sortedSuggestions.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-3">🍿</div>
                    <p className="text-gray-500">No suggestions yet. Be the first!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sortedSuggestions.map((suggestion, i) => {
                      const netVotes = suggestion.upvotes - suggestion.downvotes;
                      return (
                        <div
                          key={suggestion.id}
                          className="flex items-center gap-4 p-4 rounded-xl border-2 border-black/10 bg-gray-50 hover:bg-amber-50/50 transition-colors"
                        >
                          {/* Rank */}
                          <div className="text-xl w-8 text-center shrink-0">
                            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                          </div>

                          {/* Snack Info */}
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900 truncate">{suggestion.snackName || "(unnamed)"}</div>
                            <div className="text-xs text-gray-500">
                              by {suggestion.submittedByName}
                            </div>
                          </div>

                          {/* Vote Buttons */}
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleVote(suggestion.id, "up")}
                              disabled={!user}
                              className={`p-2 rounded-lg border-2 transition-all ${
                                suggestion.userVote === "up"
                                  ? "bg-green-400 border-black"
                                  : "bg-white border-black/20 hover:border-black hover:bg-green-50"
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                              title="Upvote"
                            >
                              <span className="text-lg">👍</span>
                            </button>
                            <div className={`font-bold text-lg w-10 text-center ${netVotes > 0 ? "text-green-600" : netVotes < 0 ? "text-red-500" : "text-gray-500"}`}>
                              {netVotes > 0 ? `+${netVotes}` : netVotes}
                            </div>
                            <button
                              onClick={() => handleVote(suggestion.id, "down")}
                              disabled={!user}
                              className={`p-2 rounded-lg border-2 transition-all ${
                                suggestion.userVote === "down"
                                  ? "bg-red-400 border-black"
                                  : "bg-white border-black/20 hover:border-black hover:bg-red-50"
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                              title="Downvote"
                            >
                              <span className="text-lg">👎</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

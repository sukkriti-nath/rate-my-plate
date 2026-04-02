"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useMemo } from "react";
import { MAX_UPVOTES_ON_OTHERS_SUGGESTIONS } from "@/lib/snack-suggestion-limits";

interface UserSession {
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

type InventoryRow = {
  category: string;
  brand: string;
  flavor: string;
  packSize: string;
  displayName: string;
  latestStock: string | null;
  tab: "beverages" | "snacks";
};

/** Strip serving size after middle dot (matches profile page) */
function stripServingSize(name: string): string {
  const dotIndex = name.indexOf("·");
  if (dotIndex === -1) return name;
  return name.slice(0, dotIndex).trim();
}

function displayNameToCategoryMap(
  items: InventoryRow[],
  tab: "beverages" | "snacks"
): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of items) {
    if (r.tab !== tab) continue;
    const cat = (r.category || "").trim() || "Other";
    m.set(r.displayName, cat);
  }
  return m;
}

/** Matches `getWebSnackProfileUserId` in snack-sheets-sync (web profile id). */
function webSnackProfileUserId(email: string): string {
  return `web:${email.trim().toLowerCase()}`;
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
  upvoterNames?: string[];
  imageUrl?: string | null;
}

function upvoteHoverText(names: string[] | undefined): string {
  const list = names ?? [];
  if (list.length === 0) return "No upvotes yet";
  const max = 35;
  if (list.length <= max) {
    return `Upvoted by: ${list.join(", ")}`;
  }
  return `Upvoted by: ${list.slice(0, max).join(", ")} (+${list.length - max} more)`;
}

/** Mirror server vote rules so the UI can update before the API returns. */
function optimisticSuggestionAfterVote(
  s: Suggestion,
  vote: "up" | "down",
  userDisplayName: string
): Suggestion {
  const prev = s.userVote;
  let up = s.upvotes;
  let down = s.downvotes;
  let names = [...(s.upvoterNames ?? [])];
  let nextVote: "up" | "down" | null = prev;

  if (prev === vote) {
    nextVote = null;
    if (vote === "up") {
      up = Math.max(0, up - 1);
      names = names.filter((n) => n !== userDisplayName);
    } else {
      down = Math.max(0, down - 1);
    }
  } else if (prev) {
    nextVote = vote;
    if (vote === "up") {
      up += 1;
      down = Math.max(0, down - 1);
      if (!names.includes(userDisplayName)) {
        names.push(userDisplayName);
        names.sort((a, b) => a.localeCompare(b));
      }
    } else {
      up = Math.max(0, up - 1);
      down += 1;
      names = names.filter((n) => n !== userDisplayName);
    }
  } else {
    nextVote = vote;
    if (vote === "up") {
      up += 1;
      if (!names.includes(userDisplayName)) {
        names.push(userDisplayName);
        names.sort((a, b) => a.localeCompare(b));
      }
    } else {
      down += 1;
    }
  }

  return {
    ...s,
    upvotes: up,
    downvotes: down,
    userVote: nextVote,
    upvoterNames: names,
  };
}

export default function SnacksPage() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestionText, setSuggestionText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async () => {
    try {
      const suggestionsRes = await fetch("/api/snacks/suggestions", {
        credentials: "same-origin",
      });
      if (suggestionsRes.ok) {
        const suggestionsData = await suggestionsRes.json();
        setSuggestions(suggestionsData.suggestions || []);
      }
    } catch (err) {
      console.error("Failed to fetch suggestions:", err);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      // Fetch user
      const userRes = await fetch("/api/auth/me", { credentials: "same-origin" });
      const userData = await userRes.json();
      setUser(userData.user || null);

      if (!userData.user) {
        setProfile(null);
        setInventory([]);
      } else {
        const [profileRes, invRes] = await Promise.all([
          fetch("/api/snacks/web-profile", { credentials: "same-origin" }),
          fetch("/api/snacks/inventory", {
            cache: "no-store",
            credentials: "same-origin",
          }),
        ]);
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          setProfile(profileData.profile || null);
        }
        if (invRes.ok) {
          const invData = (await invRes.json()) as { items?: InventoryRow[] };
          setInventory(invData.items ?? []);
        } else {
          setInventory([]);
        }
      }

      await fetchSuggestions();
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  }, [fetchSuggestions]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

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

  const othersUpvotesUsed = useMemo(() => {
    if (!user) return 0;
    const uid = webSnackProfileUserId(user.email);
    return suggestions.filter(
      (s) => s.userVote === "up" && s.submittedBy !== uid
    ).length;
  }, [user, suggestions]);

  const handleVote = async (suggestionId: string, vote: "up" | "down") => {
    if (!user) return;

    const target = suggestions.find((s) => s.id === suggestionId);
    if (!target) return;

    const uid = webSnackProfileUserId(user.email);
    const isOwn = target.submittedBy === uid;

    if (
      vote === "up" &&
      !isOwn &&
      target.userVote !== "up" &&
      othersUpvotesUsed >= MAX_UPVOTES_ON_OTHERS_SUGGESTIONS
    ) {
      return;
    }

    let rollback: Suggestion[] | null = null;
    setSuggestions((prev) => {
      rollback = prev.map((s) => ({
        ...s,
        upvoterNames: s.upvoterNames ? [...s.upvoterNames] : [],
      }));
      return prev.map((s) =>
        s.id === suggestionId
          ? optimisticSuggestionAfterVote(s, vote, user.displayName)
          : s
      );
    });

    try {
      const res = await fetch("/api/snacks/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "vote", suggestionId, vote }),
      });
      if (res.ok) {
        await fetchSuggestions();
      } else if (rollback) {
        setSuggestions(rollback);
        if (res.status === 400) {
          try {
            const data = (await res.json()) as { error?: string };
            if (data?.error) window.alert(data.error);
          } catch {
            /* ignore */
          }
        }
      }
    } catch (err) {
      console.error("Failed to vote:", err);
      if (rollback) setSuggestions(rollback);
    }
  };

  const handleDeleteSuggestion = async (suggestionId: string) => {
    if (!user) return;
    if (!window.confirm("Remove this suggestion from the leaderboard?")) return;

    setDeletingId(suggestionId);
    try {
      const res = await fetch("/api/snacks/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "delete", suggestionId }),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error("Failed to delete suggestion:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const bevDisplayToCategory = useMemo(
    () => displayNameToCategoryMap(inventory, "beverages"),
    [inventory]
  );
  const snkDisplayToCategory = useMemo(
    () => displayNameToCategoryMap(inventory, "snacks"),
    [inventory]
  );

  const drinkPointsRows = useMemo(
    () =>
      profile
        ? Object.entries(profile.drinksAllocation).filter(([, pts]) => pts > 0)
        : [],
    [profile]
  );
  const snackPointsRows = useMemo(
    () =>
      profile
        ? Object.entries(profile.snacksAllocation).filter(([, pts]) => pts > 0)
        : [],
    [profile]
  );

  const bevFavoritesOrphans = useMemo(() => {
    if (!profile) return [];
    const catsWithPoints = new Set(drinkPointsRows.map(([c]) => c));
    return profile.favoriteDrinks.filter((f) => {
      const c = bevDisplayToCategory.get(f);
      if (!c) return true;
      return !catsWithPoints.has(c);
    });
  }, [profile, bevDisplayToCategory, drinkPointsRows]);

  const snkFavoritesOrphans = useMemo(() => {
    if (!profile) return [];
    const catsWithPoints = new Set(snackPointsRows.map(([c]) => c));
    return profile.favoriteSnacks.filter((f) => {
      const c = snkDisplayToCategory.get(f);
      if (!c) return true;
      return !catsWithPoints.has(c);
    });
  }, [profile, snkDisplayToCategory, snackPointsRows]);

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
                ) : !profile ? (
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
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt="" className="w-10 h-10 rounded-full border-2 border-black" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-amber-400 border-2 border-black flex items-center justify-center font-bold">
                          {user.displayName.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900">{user.displayName}</div>
                        <div className="text-xs text-gray-500">
                          {totalAllocated} / 100 points ·{" "}
                          <span className="text-cyan-800">
                            🥤 {Object.values(profile.drinksAllocation).reduce((a, b) => a + b, 0)} bev
                          </span>
                          {" · "}
                          <span className="text-amber-800">
                            🍿 {Object.values(profile.snacksAllocation).reduce((a, b) => a + b, 0)} snack
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="max-h-[min(70vh,520px)] overflow-y-auto pr-1 space-y-4 text-sm border-t border-black/10 pt-4">
                      {inventory.length === 0 &&
                      (profile.favoriteDrinks.length > 0 || profile.favoriteSnacks.length > 0) ? (
                        <p className="text-xs text-amber-900/90 mb-2">
                          Inventory isn’t loaded yet — categories below still show your points; favorite
                          SKUs are grouped when inventory loads, or see the flat lists at the bottom.
                        </p>
                      ) : null}

                      <div>
                        <div className="text-xs font-bold text-cyan-900 uppercase tracking-wider mb-2">
                          🥤 Beverages — by category
                        </div>
                        {drinkPointsRows.length === 0 ? (
                          <p className="text-gray-500 text-xs">No beverage points allocated.</p>
                        ) : (
                          <div className="space-y-2">
                            {[...drinkPointsRows]
                              .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
                              .map(([cat, pts]) => {
                                const hasInventory = inventory.length > 0;
                                const favs = hasInventory
                                  ? profile.favoriteDrinks
                                      .filter((f) => bevDisplayToCategory.get(f) === cat)
                                      .slice()
                                      .sort((a, b) =>
                                        stripServingSize(a).localeCompare(stripServingSize(b))
                                      )
                                  : [];
                                return (
                                  <details
                                    key={`d-${cat}`}
                                    className="group/bevcat rounded-lg border border-black/20 bg-white overflow-hidden"
                                  >
                                    <summary className="cursor-pointer list-none flex flex-wrap items-center justify-between gap-2 px-2 py-2 text-sm bg-cyan-50/80 hover:bg-cyan-50 border-b border-black/10 [&::-webkit-details-marker]:hidden">
                                      <span className="font-medium text-gray-900 min-w-0 break-words pr-1">
                                        {cat}
                                      </span>
                                      <span className="flex items-center gap-2 shrink-0">
                                        <span className="font-semibold text-cyan-800 tabular-nums">
                                          {pts} pts
                                        </span>
                                        <span
                                          className="text-gray-500 text-xs transition-transform group-open/bevcat:rotate-180"
                                          aria-hidden
                                        >
                                          ▼
                                        </span>
                                      </span>
                                    </summary>
                                    <div className="px-2 py-2 bg-white">
                                      {!hasInventory ? (
                                        <p className="text-xs text-gray-500 italic pl-1">
                                          Loading inventory to show your favorite SKUs here — full
                                          lists appear below if needed.
                                        </p>
                                      ) : favs.length === 0 ? (
                                        <p className="text-xs text-gray-500 italic pl-1">
                                          No favorites picked in this category.
                                        </p>
                                      ) : (
                                        <ul className="space-y-1.5">
                                          {favs.map((name) => (
                                            <li
                                              key={`d-${cat}-${name}`}
                                              className="text-xs text-gray-800 break-words pl-2 border-l-2 border-cyan-400/70"
                                            >
                                              {stripServingSize(name)}
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </div>
                                  </details>
                                );
                              })}
                            {bevFavoritesOrphans.length > 0 ? (
                              <details className="group/bevorph rounded-lg border border-dashed border-black/25 bg-amber-50/40 overflow-hidden">
                                <summary className="cursor-pointer list-none flex flex-wrap items-center justify-between gap-2 px-2 py-2 text-sm [&::-webkit-details-marker]:hidden">
                                  <span className="font-medium text-gray-700">
                                    Other beverages ({bevFavoritesOrphans.length})
                                  </span>
                                  <span
                                    className="text-gray-500 text-xs transition-transform group-open/bevorph:rotate-180"
                                    aria-hidden
                                  >
                                    ▼
                                  </span>
                                </summary>
                                <div className="px-2 pb-2 border-t border-black/10">
                                  <p className="text-[10px] text-gray-500 pt-1 pb-2">
                                    Not tied to a category with points, or no longer in inventory.
                                  </p>
                                  <ul className="space-y-1">
                                    {bevFavoritesOrphans
                                      .slice()
                                      .sort((a, b) =>
                                        stripServingSize(a).localeCompare(stripServingSize(b))
                                      )
                                      .map((name) => (
                                        <li
                                          key={`bev-orph-${name}`}
                                          className="text-xs text-gray-800 break-words pl-2 border-l-2 border-amber-400/70"
                                        >
                                          {stripServingSize(name)}
                                        </li>
                                      ))}
                                  </ul>
                                </div>
                              </details>
                            ) : null}
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-2">
                          🍿 Snacks — by category
                        </div>
                        {snackPointsRows.length === 0 ? (
                          <p className="text-gray-500 text-xs">No snack points allocated.</p>
                        ) : (
                          <div className="space-y-2">
                            {[...snackPointsRows]
                              .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
                              .map(([cat, pts]) => {
                                const hasInventory = inventory.length > 0;
                                const favs = hasInventory
                                  ? profile.favoriteSnacks
                                      .filter((f) => snkDisplayToCategory.get(f) === cat)
                                      .slice()
                                      .sort((a, b) =>
                                        stripServingSize(a).localeCompare(stripServingSize(b))
                                      )
                                  : [];
                                return (
                                  <details
                                    key={`s-${cat}`}
                                    className="group/snkcat rounded-lg border border-black/20 bg-white overflow-hidden"
                                  >
                                    <summary className="cursor-pointer list-none flex flex-wrap items-center justify-between gap-2 px-2 py-2 text-sm bg-amber-50/80 hover:bg-amber-50 border-b border-black/10 [&::-webkit-details-marker]:hidden">
                                      <span className="font-medium text-gray-900 min-w-0 break-words pr-1">
                                        {cat}
                                      </span>
                                      <span className="flex items-center gap-2 shrink-0">
                                        <span className="font-semibold text-amber-800 tabular-nums">
                                          {pts} pts
                                        </span>
                                        <span
                                          className="text-gray-500 text-xs transition-transform group-open/snkcat:rotate-180"
                                          aria-hidden
                                        >
                                          ▼
                                        </span>
                                      </span>
                                    </summary>
                                    <div className="px-2 py-2 bg-white">
                                      {!hasInventory ? (
                                        <p className="text-xs text-gray-500 italic pl-1">
                                          Loading inventory to show your favorite SKUs here — full
                                          lists appear below if needed.
                                        </p>
                                      ) : favs.length === 0 ? (
                                        <p className="text-xs text-gray-500 italic pl-1">
                                          No favorites picked in this category.
                                        </p>
                                      ) : (
                                        <ul className="space-y-1.5">
                                          {favs.map((name) => (
                                            <li
                                              key={`s-${cat}-${name}`}
                                              className="text-xs text-gray-800 break-words pl-2 border-l-2 border-amber-400/70"
                                            >
                                              {stripServingSize(name)}
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </div>
                                  </details>
                                );
                              })}
                            {snkFavoritesOrphans.length > 0 ? (
                              <details className="group/snkorph rounded-lg border border-dashed border-black/25 bg-amber-50/40 overflow-hidden">
                                <summary className="cursor-pointer list-none flex flex-wrap items-center justify-between gap-2 px-2 py-2 text-sm [&::-webkit-details-marker]:hidden">
                                  <span className="font-medium text-gray-700">
                                    Other snacks ({snkFavoritesOrphans.length})
                                  </span>
                                  <span
                                    className="text-gray-500 text-xs transition-transform group-open/snkorph:rotate-180"
                                    aria-hidden
                                  >
                                    ▼
                                  </span>
                                </summary>
                                <div className="px-2 pb-2 border-t border-black/10">
                                  <p className="text-[10px] text-gray-500 pt-1 pb-2">
                                    Not tied to a category with points, or no longer in inventory.
                                  </p>
                                  <ul className="space-y-1">
                                    {snkFavoritesOrphans
                                      .slice()
                                      .sort((a, b) =>
                                        stripServingSize(a).localeCompare(stripServingSize(b))
                                      )
                                      .map((name) => (
                                        <li
                                          key={`snk-orph-${name}`}
                                          className="text-xs text-gray-800 break-words pl-2 border-l-2 border-amber-400/70"
                                        >
                                          {stripServingSize(name)}
                                        </li>
                                      ))}
                                  </ul>
                                </div>
                              </details>
                            ) : null}
                          </div>
                        )}
                      </div>

                      {inventory.length === 0 &&
                      (profile.favoriteDrinks.length > 0 || profile.favoriteSnacks.length > 0) ? (
                        <>
                          <div>
                            <div className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                              Favorite beverages (flat)
                            </div>
                            {profile.favoriteDrinks.length === 0 ? (
                              <p className="text-gray-500 text-xs">None selected.</p>
                            ) : (
                              <ul className="list-disc list-inside space-y-1 text-gray-800 text-xs">
                                {profile.favoriteDrinks.map((name) => (
                                  <li key={`fd-fb-${name}`} className="break-words">
                                    {stripServingSize(name)}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                              Favorite snacks (flat)
                            </div>
                            {profile.favoriteSnacks.length === 0 ? (
                              <p className="text-gray-500 text-xs">None selected.</p>
                            ) : (
                              <ul className="list-disc list-inside space-y-1 text-gray-800 text-xs">
                                {profile.favoriteSnacks.map((name) => (
                                  <li key={`fs-fb-${name}`} className="break-words">
                                    {stripServingSize(name)}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </>
                      ) : null}
                    </div>

                    <Link
                      href="/snacks/profile"
                      className="block text-center text-sm font-semibold text-amber-700 hover:text-amber-900 pt-2 border-t border-black/10"
                    >
                      Edit profile →
                    </Link>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Suggestions: add at top, leaderboard below */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_#000] overflow-hidden">
              <div className="p-5 border-b-2 border-black bg-gradient-to-r from-cyan-50 via-amber-50 to-orange-50">
                <h2 className="font-bold text-gray-900 flex items-center gap-2 flex-wrap">
                  <span>🏆</span> Snack suggestions
                </h2>
                <p className="text-xs text-gray-600 mt-1">
                  Add an idea below — it joins the leaderboard. Vote on what you want in the kitchen.
                </p>
              </div>

              <div className="bg-gradient-to-b from-amber-50/55 via-amber-50/40 to-orange-50/35">
                <div className="p-5 relative">
                <p className="text-xs font-bold text-cyan-900 uppercase tracking-wider mb-3">
                  Suggest a snack
                </p>
                {!user ? (
                  <p className="text-gray-500 text-sm text-center py-2">Sign in to suggest snacks</p>
                ) : (
                  <form onSubmit={handleSubmitSuggestion}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
                      <div className="min-w-0 flex-1">
                        <input
                          type="text"
                          value={suggestionText}
                          onChange={(e) => setSuggestionText(e.target.value)}
                          placeholder="Enter any snack or drink name..."
                          className="w-full px-4 py-2.5 rounded-lg border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={!suggestionText.trim() || submitting}
                        className="w-full shrink-0 whitespace-nowrap bg-cyan-400 text-black font-bold py-2.5 px-4 rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto sm:min-h-[42px] flex items-center justify-center gap-2"
                      >
                        {submitting ? (
                          <>
                            <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                            Adding...
                          </>
                        ) : (
                          "Add to leaderboard"
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">
                      We'll find an image for your suggestion automatically
                    </p>
                  </form>
                )}
                </div>

                <div className="p-5 border-t border-black/[0.06]">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Leaderboard
                </h3>
                {user &&
                othersUpvotesUsed >= MAX_UPVOTES_ON_OTHERS_SUGGESTIONS ? (
                  <p className="text-xs text-amber-900/90 mb-3">
                    You’ve used your {MAX_UPVOTES_ON_OTHERS_SUGGESTIONS} upvotes on others’
                    suggestions. Remove one to upvote another — your own suggestions don’t
                    count toward this limit.
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 mb-3">
                    Up to {MAX_UPVOTES_ON_OTHERS_SUGGESTIONS} upvotes on teammates’ ideas
                    (yours don’t count).
                  </p>
                )}
                {sortedSuggestions.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-3">🍿</div>
                    <p className="text-gray-500">No suggestions yet. Add one above!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sortedSuggestions.map((suggestion, i) => {
                      const netVotes = suggestion.upvotes - suggestion.downvotes;
                      const isMine =
                        !!user &&
                        suggestion.submittedBy === webSnackProfileUserId(user.email);
                      const upvoteOnOthersBlocked =
                        !!user &&
                        !isMine &&
                        suggestion.userVote !== "up" &&
                        othersUpvotesUsed >= MAX_UPVOTES_ON_OTHERS_SUGGESTIONS;
                      return (
                        <div
                          key={suggestion.id}
                          className="flex items-center gap-3 sm:gap-4 p-4 rounded-xl border-2 border-black/10 bg-white hover:bg-amber-50/50 transition-colors"
                        >
                          {/* Image with rank badge */}
                          <div className="relative shrink-0">
                            {suggestion.imageUrl ? (
                              <img
                                src={suggestion.imageUrl}
                                alt=""
                                className="w-14 h-14 object-contain rounded-lg border border-black/10"
                              />
                            ) : (
                              <div className="w-14 h-14 bg-gray-100 rounded-lg border border-black/10 flex items-center justify-center text-2xl">
                                🍿
                              </div>
                            )}
                            <div className={`absolute -top-2 -left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 border-white shadow-sm ${
                              i === 0 ? "bg-yellow-400" : i === 1 ? "bg-gray-300" : i === 2 ? "bg-amber-600 text-white" : "bg-gray-100"
                            }`}>
                              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900 truncate">
                              {suggestion.snackName || "(unnamed)"}
                            </div>
                            <div className="text-xs text-gray-500">by {suggestion.submittedByName}</div>
                          </div>

                          {isMine && suggestion.upvotes < 2 ? (
                            <button
                              type="button"
                              onClick={() => void handleDeleteSuggestion(suggestion.id)}
                              disabled={deletingId === suggestion.id}
                              className="shrink-0 flex h-7 w-7 items-center justify-center rounded-md border border-black/15 text-base leading-none text-gray-500 hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                              title="Remove your suggestion"
                              aria-label="Remove your suggestion"
                            >
                              {deletingId === suggestion.id ? (
                                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                              ) : (
                                <span aria-hidden className="font-light">
                                  ×
                                </span>
                              )}
                            </button>
                          ) : null}

                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`inline-flex rounded-lg ${upvoteOnOthersBlocked ? "cursor-not-allowed" : "cursor-help"}`}
                              title={
                                upvoteOnOthersBlocked
                                  ? `You can upvote up to ${MAX_UPVOTES_ON_OTHERS_SUGGESTIONS} suggestions from others. Remove an upvote elsewhere to free a slot.`
                                  : upvoteHoverText(suggestion.upvoterNames)
                              }
                            >
                              <button
                                type="button"
                                onClick={() => handleVote(suggestion.id, "up")}
                                disabled={!user || upvoteOnOthersBlocked}
                                className={`p-2 rounded-lg border-2 transition-all ${
                                  suggestion.userVote === "up"
                                    ? "bg-green-400 border-black"
                                    : "bg-white border-black/20 hover:border-black hover:bg-green-50"
                                } disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed`}
                              >
                                <span className="text-lg">👍</span>
                              </button>
                            </span>
                            <div
                              className={`font-bold text-lg w-10 text-center ${
                                netVotes > 0 ? "text-green-600" : netVotes < 0 ? "text-red-500" : "text-gray-500"
                              }`}
                            >
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
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STEP = 10;
/** One shared pool across every beverage + snack category. */
const POINT_BUDGET_TOTAL = 100;

type InventoryRow = {
  category: string;
  brand: string;
  flavor: string;
  packSize: string;
  displayName: string;
  latestStock: string | null;
  tab: "beverages" | "snacks";
};

type ProfilePayload = {
  drinksAllocation: Record<string, number>;
  snacksAllocation: Record<string, number>;
  favoriteDrinks: string[];
  favoriteSnacks: string[];
};

function sumAlloc(m: Record<string, number>): number {
  return Object.values(m).reduce((a, b) => a + (Number(b) || 0), 0);
}

/** Strip serving size info after middle dot (e.g., "Taste Nirvana · 12/16.2 oz" -> "Taste Nirvana") */
function stripServingSize(name: string): string {
  const dotIndex = name.indexOf("·");
  if (dotIndex === -1) return name;
  return name.slice(0, dotIndex).trim();
}

function groupRowsByCategory(rows: InventoryRow[], tab: "beverages" | "snacks") {
  const m = new Map<string, InventoryRow[]>();
  for (const r of rows) {
    if (r.tab !== tab) continue;
    const k = (r.category || "").trim() || "Other";
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(r);
  }
  const keys = [...m.keys()].sort((a, b) => a.localeCompare(b));
  return keys.map((category) => ({
    category,
    items: (m.get(category) ?? []).sort((a, b) =>
      a.displayName.localeCompare(b.displayName)
    ),
  }));
}

function emptyAllocForCategories(categories: string[]): Record<string, number> {
  const o: Record<string, number> = {};
  for (const c of categories) o[c] = 0;
  return o;
}

function mergeAlloc(
  saved: Record<string, number> | undefined,
  categories: string[]
): Record<string, number> {
  const o = emptyAllocForCategories(categories);
  if (!saved) return o;
  for (const c of categories) {
    const v = saved[c];
    if (typeof v === "number" && v >= 0 && v % STEP === 0) o[c] = v;
  }
  return o;
}

export default function SnackProfilePage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [invLoading, setInvLoading] = useState(true);

  const [drinksAllocation, setDrinksAllocation] = useState<Record<string, number>>(
    {}
  );
  const [snacksAllocation, setSnacksAllocation] = useState<Record<string, number>>(
    {}
  );
  const [favoriteDrinks, setFavoriteDrinks] = useState<string[]>([]);
  const [favoriteSnacks, setFavoriteSnacks] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [productImages, setProductImages] = useState<Record<string, string | null>>({});
  const fetchedImagesRef = useRef<Set<string>>(new Set());

  const bevCategories = useMemo(
    () => groupRowsByCategory(inventory, "beverages"),
    [inventory]
  );
  const snkCategories = useMemo(
    () => groupRowsByCategory(inventory, "snacks"),
    [inventory]
  );

  const bevCatNames = useMemo(
    () => bevCategories.map((x) => x.category),
    [bevCategories]
  );
  const snkCatNames = useMemo(
    () => snkCategories.map((x) => x.category),
    [snkCategories]
  );

  const bevAllocated = sumAlloc(drinksAllocation);
  const snkAllocated = sumAlloc(snacksAllocation);
  const totalAllocated = bevAllocated + snkAllocated;
  const remaining = POINT_BUDGET_TOTAL - totalAllocated;
  const isBalanced = totalAllocated === POINT_BUDGET_TOTAL;

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        setLoggedIn(!!d.user);
        setAuthChecked(true);
      })
      .catch(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/snacks/inventory", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!res.ok) throw new Error("inventory");
        const json = (await res.json()) as { items?: InventoryRow[] };
        if (!cancelled) setInventory(json.items ?? []);
      } catch {
        if (!cancelled) setInventory([]);
      } finally {
        if (!cancelled) setInvLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!authChecked || !loggedIn || invLoading) return;
    if (bevCatNames.length === 0 && snkCatNames.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/snacks/web-profile", {
          credentials: "same-origin",
        });
        if (!res.ok) {
          if (!cancelled) {
            setDrinksAllocation(emptyAllocForCategories(bevCatNames));
            setSnacksAllocation(emptyAllocForCategories(snkCatNames));
          }
          return;
        }
        const data = (await res.json()) as { profile: ProfilePayload | null };
        if (cancelled) return;
        const p = data.profile;
        setDrinksAllocation(mergeAlloc(p?.drinksAllocation, bevCatNames));
        setSnacksAllocation(mergeAlloc(p?.snacksAllocation, snkCatNames));
        setFavoriteDrinks(p?.favoriteDrinks ?? []);
        setFavoriteSnacks(p?.favoriteSnacks ?? []);
      } catch {
        setDrinksAllocation(emptyAllocForCategories(bevCatNames));
        setSnacksAllocation(emptyAllocForCategories(snkCatNames));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    authChecked,
    loggedIn,
    invLoading,
    bevCatNames,
    snkCatNames,
  ]);

  // Fetch images for items in categories with allocated points
  useEffect(() => {
    const itemsToFetch: string[] = [];

    // Get items from beverage categories with points
    for (const { category, items } of bevCategories) {
      if ((drinksAllocation[category] ?? 0) > 0) {
        for (const item of items) {
          const name = stripServingSize(item.displayName);
          if (!fetchedImagesRef.current.has(name)) {
            itemsToFetch.push(name);
            fetchedImagesRef.current.add(name);
          }
        }
      }
    }

    // Get items from snack categories with points
    for (const { category, items } of snkCategories) {
      if ((snacksAllocation[category] ?? 0) > 0) {
        for (const item of items) {
          const name = stripServingSize(item.displayName);
          if (!fetchedImagesRef.current.has(name)) {
            itemsToFetch.push(name);
            fetchedImagesRef.current.add(name);
          }
        }
      }
    }

    if (itemsToFetch.length === 0) return;

    // Fetch in batches
    const fetchBatch = async (names: string[]) => {
      try {
        const res = await fetch("/api/snacks/images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ names }),
        });
        if (res.ok) {
          const data = await res.json();
          setProductImages((prev) => ({ ...prev, ...data.images }));
        }
      } catch (err) {
        console.error("Failed to fetch images:", err);
      }
    };

    // Fetch first 20 items
    void fetchBatch(itemsToFetch.slice(0, 20));
  }, [bevCategories, snkCategories, drinksAllocation, snacksAllocation]);

  const adjust = useCallback(
    (which: "drinks" | "snacks", category: string, delta: number) => {
      const set =
        which === "drinks" ? setDrinksAllocation : setSnacksAllocation;
      const map = which === "drinks" ? drinksAllocation : snacksAllocation;
      const cur = map[category] ?? 0;
      const poolRemaining =
        POINT_BUDGET_TOTAL -
        (sumAlloc(drinksAllocation) + sumAlloc(snacksAllocation));
      if (delta > 0) {
        if (poolRemaining < STEP || cur + delta > POINT_BUDGET_TOTAL) return;
      } else {
        if (cur + delta < 0) return;
      }
      set({ ...map, [category]: cur + delta });
    },
    [drinksAllocation, snacksAllocation]
  );

  const toggleFavorite = useCallback(
    (which: "drinks" | "snacks", displayName: string) => {
      const set =
        which === "drinks" ? setFavoriteDrinks : setFavoriteSnacks;
      set((prev) =>
        prev.includes(displayName)
          ? prev.filter((x) => x !== displayName)
          : [...prev, displayName]
      );
    },
    []
  );

  const handleSave = async () => {
    if (!isBalanced) {
      setSaveMsg(
        `Allocate exactly ${POINT_BUDGET_TOTAL} points across all categories (currently ${totalAllocated}).`
      );
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/snacks/web-profile", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drinksAllocation,
          snacksAllocation,
          favoriteDrinks,
          favoriteSnacks,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveMsg(
          typeof json.error === "string" ? json.error : "Could not save."
        );
        setSaving(false);
        return;
      }
      // Redirect to dashboard on success
      router.push("/snacks");
    } catch {
      setSaveMsg("Network error — try again.");
      setSaving(false);
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-white text-gray-900 p-8">
        <div className="max-w-md mx-auto text-center border-2 border-black rounded-xl p-8 shadow-[8px_8px_0px_0px_#000]">
          <div className="text-4xl mb-4">👤</div>
          <h1 className="font-display text-2xl font-extrabold mb-2">
            Snack Profile
          </h1>
          <p className="text-sm text-gray-600 mb-6">
            Sign in to allocate <strong>{POINT_BUDGET_TOTAL} points</strong> across
            categories and pick favorites from the live inventory.
          </p>
          <Link
            href={`/login?next=${encodeURIComponent("/snacks/profile")}`}
            className="inline-block bg-amber-400 text-black font-bold px-6 py-3 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
          >
            Sign in
          </Link>
          <div className="mt-6">
            <Link href="/snacks" className="text-sm text-gray-500 hover:text-gray-800">
              ← Back to SnackOverflow
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8 pb-6 border-b-2 border-black">
          <div>
            <h1 className="font-display text-4xl font-extrabold">
              👤 Snack Profile
            </h1>
            <p className="text-sm text-gray-600 mt-2 max-w-xl">
              You have <strong>{POINT_BUDGET_TOTAL} points</strong> to spread across{" "}
              <em>all</em> beverage and snack categories (steps of{" "}
              <strong>{STEP}</strong>). Expand each section, assign points, then pick
              favorites where you allocated.
            </p>
          </div>
          <Link
            href="/snacks"
            className="text-sm font-bold text-amber-700 hover:underline shrink-0"
          >
            Dashboard →
          </Link>
        </div>

        {/* Single 100-pt pool */}
        <div className="bg-amber-50 rounded-xl border-2 border-black p-4 md:p-5 mb-8 shadow-[4px_4px_0px_0px_#000] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
              Point budget
            </span>
            <span
              className={`text-sm font-bold tabular-nums ${
                isBalanced ? "text-green-700" : "text-amber-900"
              }`}
            >
              {totalAllocated} / {POINT_BUDGET_TOTAL}
              {remaining > 0 ? (
                <span className="text-gray-500 font-normal">
                  {" "}
                  ({remaining} left)
                </span>
              ) : null}
            </span>
          </div>
          <div className="h-5 rounded-full border-2 border-black overflow-hidden bg-white">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isBalanced ? "bg-green-500" : "bg-amber-400"
              }`}
              style={{
                width: `${Math.min(100, (totalAllocated / POINT_BUDGET_TOTAL) * 100)}%`,
              }}
            />
          </div>
          <p className="text-xs text-gray-600">
            <span className="font-semibold text-cyan-900">🥤 Bevs</span>{" "}
            <span className="tabular-nums">{bevAllocated} pts</span>
            <span className="mx-2 text-gray-400">·</span>
            <span className="font-semibold text-amber-900">🍿 Snacks</span>{" "}
            <span className="tabular-nums">{snkAllocated} pts</span>
            <span className="text-gray-500"> (split however you like)</span>
          </p>
          {!isBalanced ? (
            <p className="text-xs text-gray-600">
              Add or remove points until the total equals {POINT_BUDGET_TOTAL}.
            </p>
          ) : (
            <p className="text-xs text-green-700 font-medium">
              Budget balanced — pick favorites below, then save.
            </p>
          )}
        </div>

        {invLoading ? (
          <p className="text-gray-500 text-center py-12">Loading inventory…</p>
        ) : inventory.length === 0 ? (
          <p className="text-gray-500 text-center py-12">
            No inventory rows loaded. Check <code className="bg-gray-100 px-1 rounded">SNACK_SHEET_ID</code> and Google access.
          </p>
        ) : (
          <>
            <details
              className="group/bev mb-6 rounded-xl border-2 border-black bg-white overflow-hidden shadow-[4px_4px_0px_0px_#000]"
              open
            >
              <summary className="cursor-pointer list-none flex flex-wrap items-center justify-between gap-3 p-4 md:p-5 bg-cyan-50/80 hover:bg-cyan-50 border-b-2 border-black [&::-webkit-details-marker]:hidden">
                <div className="min-w-0">
                  <span className="text-sm font-bold uppercase tracking-wider text-cyan-950 flex items-center gap-2">
                    <span aria-hidden>🥤</span> Beverages
                  </span>
                  <p className="text-xs text-gray-600 mt-1">
                    Categories share the <strong>{POINT_BUDGET_TOTAL}</strong>-pt pool (steps of {STEP})
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-bold tabular-nums text-cyan-900">
                    {bevAllocated} pts
                  </span>
                  <span
                    className="text-gray-600 text-lg transition-transform group-open/bev:rotate-180"
                    aria-hidden
                  >
                    ▼
                  </span>
                </div>
              </summary>
              <div className="p-3 md:p-4 grid grid-cols-2 gap-2 sm:gap-3 bg-white items-start">
                {bevCategories.map(({ category, items }) => (
                  <CategoryBlock
                    key={`bev-${category}`}
                    title={category}
                    points={drinksAllocation[category] ?? 0}
                    remaining={remaining}
                    onDelta={(d) => adjust("drinks", category, d)}
                    items={items}
                    favorites={favoriteDrinks}
                    onToggleFav={(name) => toggleFavorite("drinks", name)}
                    productImages={productImages}
                  />
                ))}
              </div>
            </details>

            <details
              className="group/snk mb-10 rounded-xl border-2 border-black bg-white overflow-hidden shadow-[4px_4px_0px_0px_#000]"
              open
            >
              <summary className="cursor-pointer list-none flex flex-wrap items-center justify-between gap-3 p-4 md:p-5 bg-amber-50/80 hover:bg-amber-50 border-b-2 border-black [&::-webkit-details-marker]:hidden">
                <div className="min-w-0">
                  <span className="text-sm font-bold uppercase tracking-wider text-amber-950 flex items-center gap-2">
                    <span aria-hidden>🍿</span> Snacks
                  </span>
                  <p className="text-xs text-gray-600 mt-1">
                    Categories share the <strong>{POINT_BUDGET_TOTAL}</strong>-pt pool (steps of {STEP})
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-bold tabular-nums text-amber-900">
                    {snkAllocated} pts
                  </span>
                  <span
                    className="text-gray-600 text-lg transition-transform group-open/snk:rotate-180"
                    aria-hidden
                  >
                    ▼
                  </span>
                </div>
              </summary>
              <div className="p-3 md:p-4 grid grid-cols-2 gap-2 sm:gap-3 bg-white items-start">
                {snkCategories.map(({ category, items }) => (
                  <CategoryBlock
                    key={`snk-${category}`}
                    title={category}
                    points={snacksAllocation[category] ?? 0}
                    remaining={remaining}
                    onDelta={(d) => adjust("snacks", category, d)}
                    items={items}
                    favorites={favoriteSnacks}
                    onToggleFav={(name) => toggleFavorite("snacks", name)}
                    productImages={productImages}
                  />
                ))}
              </div>
            </details>
          </>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-4 border-t-2 border-black">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !isBalanced || invLoading}
            className="bg-amber-400 text-black font-bold px-6 py-3 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0"
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
          {saveMsg ? (
            <p className="text-sm text-gray-700 flex-1">{saveMsg}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CategoryBlock({
  title,
  points,
  remaining,
  onDelta,
  items,
  favorites,
  onToggleFav,
  productImages,
}: {
  title: string;
  points: number;
  remaining: number;
  onDelta: (delta: number) => void;
  items: InventoryRow[];
  favorites: string[];
  onToggleFav: (displayName: string) => void;
  productImages: Record<string, string | null>;
}) {
  const favSet = useMemo(() => new Set(favorites), [favorites]);
  const canAdd =
    remaining >= STEP && points + STEP <= POINT_BUDGET_TOTAL;
  const canSub = points >= STEP;

  return (
    <div className="min-w-0 rounded-xl border-2 border-black/15 bg-white overflow-hidden shadow-[2px_2px_0px_0px_rgba(0,0,0,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 md:p-4 bg-gray-50 border-b border-black/10">
        <span className="font-semibold text-gray-900">{title}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`Remove ${STEP} points from ${title}`}
            disabled={!canSub}
            onClick={() => onDelta(-STEP)}
            className="w-9 h-9 rounded-lg border-2 border-black bg-white font-bold hover:bg-amber-50 disabled:opacity-30"
          >
            −
          </button>
          <span className="tabular-nums font-bold text-amber-800 min-w-[4.5rem] text-center">
            {points} pts
          </span>
          <button
            type="button"
            aria-label={`Add ${STEP} points to ${title}`}
            disabled={!canAdd}
            onClick={() => onDelta(STEP)}
            className="w-9 h-9 rounded-lg border-2 border-black bg-white font-bold hover:bg-amber-50 disabled:opacity-30"
          >
            +
          </button>
        </div>
      </div>
      {points > 0 ? (
        <div className="p-3 md:p-4">
          <p className="text-xs text-gray-500 mb-2">
            Favorite SKUs (unlimited) — {items.length} options · scroll if needed
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5 max-h-[min(75vh,1400px)] overflow-y-auto overflow-x-hidden pr-1">
            {items.map((row) => {
              const isSelected = favSet.has(row.displayName);
              const cleanName = stripServingSize(row.displayName);
              const imageUrl = productImages[cleanName];
              return (
                <li key={row.displayName} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onToggleFav(row.displayName)}
                    className={`w-full text-left cursor-pointer rounded-md px-2 py-1.5 h-full transition-all flex items-center gap-2 ${
                      isSelected
                        ? "border-2 border-black bg-amber-100 shadow-[2px_2px_0px_0px_#000]"
                        : "border border-black/10 bg-amber-50/40 hover:bg-amber-50/80"
                    }`}
                  >
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt=""
                        className="w-8 h-8 object-contain rounded shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-gray-100 rounded shrink-0 flex items-center justify-center text-sm">
                        {title.toLowerCase().includes("beverage") || title.toLowerCase().includes("drink") || title.toLowerCase().includes("water") || title.toLowerCase().includes("tea") || title.toLowerCase().includes("coffee") || title.toLowerCase().includes("soda") || title.toLowerCase().includes("juice") ? "🥤" : "🍿"}
                      </div>
                    )}
                    <span className="text-xs sm:text-sm min-w-0 leading-snug">
                      <span className="text-gray-900 break-words">{cleanName}</span>
                      {row.latestStock != null && row.latestStock !== "" ? (
                        <span className="block text-[10px] sm:text-xs text-gray-500 tabular-nums mt-0.5">
                          stock {row.latestStock}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-gray-400 px-3 py-2 md:px-4 italic">
          Allocate points to unlock favorites for this category.
        </p>
      )}
    </div>
  );
}

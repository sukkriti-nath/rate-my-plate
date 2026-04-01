"use client";

import {
  useEffect,
  useState,
  useCallback,
  type ReactNode,
  type ComponentPropsWithoutRef,
} from "react";

const SNACKS_OPEN_SECTION = "snacks-open-section";

/** `<details defaultOpen>` — React 19 runtime; TS types omit `defaultOpen` on details in some setups. */
function SnacksDetails({
  defaultOpen: defaultOpenProp,
  className,
  children,
  ...rest
}: Omit<ComponentPropsWithoutRef<"details">, "open"> & {
  defaultOpen?: boolean;
}) {
  return (
    <details
      className={className}
      {...rest}
      {...({ defaultOpen: defaultOpenProp } as Record<string, unknown>)}
    >
      {children}
    </details>
  );
}

interface LeaderboardEntry {
  userId: string;
  displayName: string;
  points: number;
  actions: Record<string, number>;
}

interface CategoryDemand {
  category: string;
  emoji: string;
  tokens: number;
  percent: number;
}

interface MostWantedItem {
  item: string;
  score: number;
}

interface OutOfStockReport {
  snackName: string;
  category: string | null;
  count: number;
  lastReported: string;
}

interface SnackStats {
  profileCount: number;
  publicProfiles: number;
  outOfStockCount: number;
  totalPoints: number;
}

interface WeeklySurveyData {
  weekId: string;
  items: { item: string; score: number }[];
  voterCount: number;
}

interface DashboardData {
  stats: SnackStats;
  leaderboard: LeaderboardEntry[];
  categoryDemand: CategoryDemand[];
  mostWanted: MostWantedItem[];
  outOfStock: OutOfStockReport[];
  weeklySurvey: WeeklySurveyData | null;
}

/** Row from Kikoff Snack & Bev inventory sheet (same shape as `/api/snacks/inventory`). */
interface InventoryRow {
  category: string;
  brand: string;
  flavor: string;
  packSize: string;
  displayName: string;
  /** Rightmost non-empty cell in the date / stock columns from the sheet. */
  latestStock: string | null;
  tab: "beverages" | "snacks";
}

/** One brand’s lines under a category (tab → category → brand → SKUs). */
type InventoryBrandGroup = {
  brand: string;
  items: InventoryRow[];
};

/** Sheet category (Juice, Cold Brew, Chips, …) with brands inside. */
type InventoryCategorySection = {
  category: string;
  itemCount: number;
  brandGroups: InventoryBrandGroup[];
};

function groupInventoryForDisplay(rows: InventoryRow[]) {
  const byTab = (tab: "beverages" | "snacks") =>
    rows.filter((r) => r.tab === tab);

  const toCategorySections = (list: InventoryRow[]): InventoryCategorySection[] => {
    const byCat = new Map<string, InventoryRow[]>();
    for (const r of list) {
      const c = (r.category || "").trim() || "Other";
      if (!byCat.has(c)) byCat.set(c, []);
      byCat.get(c)!.push(r);
    }
    const catKeys = [...byCat.keys()].sort((a, b) => a.localeCompare(b));
    return catKeys.map((category) => {
      const catRows = byCat.get(category)!;
      const byBrand = new Map<string, InventoryRow[]>();
      for (const r of catRows) {
        const b = (r.brand || "").trim() || "Other";
        if (!byBrand.has(b)) byBrand.set(b, []);
        byBrand.get(b)!.push(r);
      }
      const brandKeys = [...byBrand.keys()].sort((a, b) => a.localeCompare(b));
      const brandGroups: InventoryBrandGroup[] = brandKeys.map((brand) => ({
        brand,
        items: [...(byBrand.get(brand) ?? [])].sort((a, b) =>
          a.displayName.localeCompare(b.displayName)
        ),
      }));
      return {
        category,
        itemCount: catRows.length,
        brandGroups,
      };
    });
  };

  return {
    beverages: toCategorySections(byTab("beverages")),
    snacks: toCategorySections(byTab("snacks")),
  };
}

function InventoryCatalog({ rows }: { rows: InventoryRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-gray-500 text-center py-6">
        No rows loaded from the inventory sheet. Confirm{" "}
        <code className="bg-gray-100 px-2 py-1 rounded">SNACK_SHEET_ID</code> and Google
        access are configured on the server.
      </p>
    );
  }

  const g = groupInventoryForDisplay(rows);

  return (
    <div className="space-y-4">
      {(["beverages", "snacks"] as const).map((tab) => {
        const label = tab === "beverages" ? "Beverages" : "Snacks";
        const sections = tab === "beverages" ? g.beverages : g.snacks;
        const tabTotal = sections.reduce((n, s) => n + s.itemCount, 0);
        return (
          <SnacksDetails
            key={tab}
            className="group/tab rounded-xl border-2 border-black/20 bg-white overflow-hidden open:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]"
            defaultOpen
          >
            <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-4 py-3 md:px-5 md:py-4 text-left font-semibold text-gray-800 bg-amber-50/60 hover:bg-amber-50 border-b-2 border-black/10 [&::-webkit-details-marker]:hidden">
              <span className="text-sm uppercase tracking-wider text-gray-600">
                {tab === "beverages" ? "🥤" : "🍿"} {label}
                <span className="ml-2 font-normal normal-case text-gray-500">
                  ({tabTotal} items · {sections.length}{" "}
                  {sections.length === 1 ? "category" : "categories"})
                </span>
              </span>
              <span
                className="shrink-0 text-gray-600 text-lg leading-none transition-transform duration-200 group-open/tab:rotate-180"
                aria-hidden
              >
                ▼
              </span>
            </summary>
            <div className="p-3 md:p-4 space-y-2 bg-white">
              {sections.map((catSec) => (
                <SnacksDetails
                  key={`${tab}-${catSec.category}`}
                  className="group/category rounded-lg border-2 border-black/12 overflow-hidden bg-gray-50/40"
                  defaultOpen={false}
                >
                  <summary className="cursor-pointer list-none flex items-center justify-between gap-2 px-3 py-2.5 md:px-4 text-left text-sm font-semibold text-gray-800 bg-white hover:bg-amber-50/50 border-b border-black/10 [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0">
                      <span className="text-gray-900">{catSec.category}</span>
                      <span className="ml-2 font-normal text-gray-500 text-xs">
                        ({catSec.itemCount} items · {catSec.brandGroups.length}{" "}
                        {catSec.brandGroups.length === 1 ? "brand" : "brands"})
                      </span>
                    </span>
                    <span
                      className="shrink-0 text-gray-500 text-sm transition-transform duration-200 group-open/category:rotate-180"
                      aria-hidden
                    >
                      ▼
                    </span>
                  </summary>
                  <div className="p-2 space-y-2 bg-white border-t border-black/5">
                    {catSec.brandGroups.map((grp) => (
                      <details
                        key={`${tab}-${catSec.category}-${grp.brand}`}
                        className="group/brand rounded-lg border border-black/15 overflow-hidden"
                      >
                        <summary className="cursor-pointer list-none flex items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-semibold text-gray-800 bg-gray-50 hover:bg-amber-50/40 border-b border-black/10 [&::-webkit-details-marker]:hidden">
                          <span className="min-w-0">{grp.brand}</span>
                          <span
                            className="shrink-0 text-gray-500 text-xs transition-transform duration-200 group-open/brand:rotate-180"
                            aria-hidden
                          >
                            ▼
                          </span>
                        </summary>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-3 pt-2">
                          {grp.items.map((it) => {
                            const title = [it.brand, it.flavor]
                              .filter(Boolean)
                              .join(" ")
                              .trim();
                            return (
                              <li
                                key={`${catSec.category}-${grp.brand}-${it.displayName}`}
                                className="text-sm bg-amber-50/50 rounded-lg px-3 py-2 border border-black/10"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 text-gray-900">
                                    <div className="font-medium leading-snug">
                                      {title || it.displayName}
                                    </div>
                                    {it.packSize ? (
                                      <div className="text-xs text-gray-500 mt-0.5">
                                        {it.packSize}
                                      </div>
                                    ) : null}
                                  </div>
                                  {it.latestStock != null && it.latestStock !== "" ? (
                                    <span
                                      className="shrink-0 text-xs font-semibold tabular-nums text-right bg-white/90 text-gray-800 px-2 py-0.5 rounded border border-black/15"
                                      title="Latest stock (rightmost value in the sheet row)"
                                    >
                                      {it.latestStock}
                                    </span>
                                  ) : null}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </details>
                    ))}
                  </div>
                </SnacksDetails>
              ))}
            </div>
          </SnacksDetails>
        );
      })}
    </div>
  );
}

function RatingBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = (value / max) * 100;
  return (
    <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden border border-black">
      <div
        className="h-full bg-amber-400 rounded-full transition-all duration-1000"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function CollapsibleSection({
  id,
  title,
  subtitle,
  emoji,
  defaultOpen,
  children,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  emoji: string;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (!id) return;
    const onOpen = (e: Event) => {
      const ce = e as CustomEvent<{ id: string }>;
      if (ce.detail?.id === id) setOpen(true);
    };
    window.addEventListener(SNACKS_OPEN_SECTION, onOpen as EventListener);
    return () =>
      window.removeEventListener(SNACKS_OPEN_SECTION, onOpen as EventListener);
  }, [id]);

  return (
    <div
      id={id}
      className="bg-white rounded-xl border-2 border-black shadow-[8px_8px_0px_0px_#000] mb-6 overflow-hidden scroll-mt-20"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 p-4 md:p-5 text-left hover:bg-amber-50/50 transition-colors border-b-2 border-black"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <span aria-hidden>{emoji}</span>
            {title}
          </h2>
          {subtitle ? (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          ) : null}
        </div>
        <span
          className={`shrink-0 text-gray-600 text-lg leading-none transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        >
          ▼
        </span>
      </button>
      {open ? (
        <div className="p-4 md:p-6 pt-4">{children}</div>
      ) : null}
    </div>
  );
}

function jumpToSection(sectionId: string) {
  if (sectionId === "snacks-top") {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  window.dispatchEvent(
    new CustomEvent(SNACKS_OPEN_SECTION, { detail: { id: sectionId } })
  );
  setTimeout(() => {
    const el = document.getElementById(sectionId);
    if (el instanceof HTMLDetailsElement) {
      el.open = true;
    }
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 0);
}

export default function SnacksPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const statsUrl = origin ? `${origin}/api/snacks/stats` : "/api/snacks/stats";
    const inventoryUrl = origin
      ? `${origin}/api/snacks/inventory`
      : "/api/snacks/inventory";

    const attempt = async (): Promise<void> => {
      const [statsRes, invRes] = await Promise.all([
        fetch(statsUrl, {
          signal,
          cache: "no-store",
          credentials: "same-origin",
        }),
        fetch(inventoryUrl, {
          signal,
          cache: "no-store",
          credentials: "same-origin",
        }).catch(() => null as Response | null),
      ]);

      if (!statsRes.ok) {
        const text = await statsRes.text().catch(() => "");
        throw new Error(
          `snack stats ${statsRes.status}${text ? `: ${text.slice(0, 120)}` : ""}`
        );
      }
      const json = (await statsRes.json()) as DashboardData;
      setData(json);

      if (invRes?.ok) {
        const invJson = (await invRes.json()) as { items?: InventoryRow[] };
        setInventory(invJson.items ?? []);
      } else {
        setInventory([]);
      }
    };

    try {
      await attempt();
    } catch (first) {
      if (signal?.aborted) return;
      if (first instanceof DOMException && first.name === "AbortError") return;
      await new Promise((r) => setTimeout(r, 400));
      if (signal?.aborted) return;
      try {
        await attempt();
      } catch (err) {
        if (signal?.aborted) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Failed to fetch snack stats:", err);
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void fetchData(ac.signal);
    const interval = setInterval(() => {
      void fetchData(ac.signal);
    }, 10000);
    return () => {
      ac.abort();
      clearInterval(interval);
    };
  }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">🍿</div>
          <p className="text-gray-500">Loading snack data...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">😢</div>
          <p className="text-gray-500">Failed to load data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div
          id="snacks-top"
          className="text-center mb-8 pb-6 border-b-2 border-black scroll-mt-20"
        >
          <h1 className="font-display text-5xl mb-1 font-extrabold">
            🍿 Snack<span className="text-amber-500">Overflow</span>
          </h1>
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-sm">Live Dashboard — auto-refreshes every 10s</span>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl p-4 border-2 border-black shadow-[4px_4px_0px_0px_#000] text-center">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Profiles</div>
            <div className="text-4xl font-bold text-amber-600">{data.stats.profileCount}</div>
            <div className="text-xs text-gray-500 mt-1">created</div>
          </div>
          <div className="bg-white rounded-xl p-4 border-2 border-black shadow-[4px_4px_0px_0px_#000] text-center">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Out of Stock</div>
            <div className="text-4xl font-bold text-red-500">{data.stats.outOfStockCount}</div>
            <div className="text-xs text-gray-500 mt-1">items reported</div>
          </div>
          <div className="bg-white rounded-xl p-4 border-2 border-black shadow-[4px_4px_0px_0px_#000] text-center">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Points</div>
            <div className="text-4xl font-bold text-amber-600">{data.stats.totalPoints}</div>
            <div className="text-xs text-gray-500 mt-1">earned</div>
          </div>
          <div className="bg-white rounded-xl p-4 border-2 border-black shadow-[4px_4px_0px_0px_#000] text-center">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Champions</div>
            <div className="text-4xl font-bold text-amber-600">{data.leaderboard.length}</div>
            <div className="text-xs text-gray-500 mt-1">on leaderboard</div>
          </div>
        </div>

        {/* Jump to section — scrolls and opens the target panel */}
        <div className="sticky top-3 z-30 mb-6 -mx-1 px-1 py-2 md:static md:py-0 md:mb-6">
          <label
            htmlFor="snacks-section-jump"
            className="sr-only"
          >
            Jump to section
          </label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 max-w-xl mx-auto md:mx-0">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider shrink-0">
              Jump to
            </span>
            <select
              id="snacks-section-jump"
              className="w-full sm:flex-1 rounded-lg border-2 border-black bg-white px-3 py-2.5 text-sm font-medium text-gray-900 shadow-[3px_3px_0px_0px_#000] focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
              defaultValue=""
              onChange={(e) => {
                const v = e.target.value;
                if (v) jumpToSection(v);
                e.target.selectedIndex = 0;
              }}
            >
              <option value="" disabled>
                Choose a section…
              </option>
              <option value="snacks-top">Top</option>
              <option value="section-inventory">Snack &amp; Bev inventory</option>
              {data.weeklySurvey && data.weeklySurvey.items.length > 0 ? (
                <option value="section-weekly">Weekly ballot</option>
              ) : null}
              <option value="section-leaderboard">Leaderboard</option>
              <option value="section-profiles">Profile ranking</option>
              {data.outOfStock.length > 0 ? (
                <option value="section-oos">Out of stock</option>
              ) : null}
            </select>
          </div>
        </div>

        {/* Full sheet catalog — loaded on this page, not via Slack profile */}
        <CollapsibleSection
          id="section-inventory"
          emoji="📋"
          title="Snack & Bev inventory"
          subtitle={
            inventory.length > 0
              ? `${inventory.filter((r) => r.tab === "beverages").length} beverages · ${inventory.filter((r) => r.tab === "snacks").length} snacks — from the Google Sheet`
              : "All stocked lines from the Kikoff inventory sheet"
          }
          defaultOpen
        >
          <InventoryCatalog rows={inventory} />
        </CollapsibleSection>

        {/* Weekly top-5 survey (Slack votes + Google Sheet log) */}
        {data.weeklySurvey && data.weeklySurvey.items.length > 0 && (
          <SnacksDetails
            id="section-weekly"
            className="group/weekly bg-white rounded-xl border-2 border-black shadow-[8px_8px_0px_0px_#000] mb-6 overflow-hidden scroll-mt-20"
            defaultOpen
          >
            <summary className="cursor-pointer list-none p-4 md:p-6 pb-3 border-b-2 border-black hover:bg-amber-50/50 [&::-webkit-details-marker]:hidden">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">
                    🗳️ Weekly ballot — {data.weeklySurvey.weekId}
                  </h2>
                  <p className="text-xs text-gray-500">
                    Ranked votes from Slack (5 pts → 1 pt). Raw rows also sync to your Snack Votes Google Sheet.
                  </p>
                </div>
                <span
                  className="shrink-0 text-gray-600 text-lg leading-none transition-transform duration-200 group-open/weekly:rotate-180 mt-0.5"
                  aria-hidden
                >
                  ▼
                </span>
              </div>
            </summary>
            <div className="p-4 md:p-6 pt-2">
              <div className="text-xs text-gray-600 mb-4">
                <span className="font-semibold text-gray-800">
                  {data.weeklySurvey.voterCount}
                </span>{" "}
                voter{data.weeklySurvey.voterCount === 1 ? "" : "s"} this week
              </div>
              <div className="space-y-2">
                {data.weeklySurvey.items.slice(0, 15).map((row, i) => (
                  <div
                    key={row.item}
                    className="flex items-center justify-between gap-3 bg-amber-50/80 rounded-lg px-3 py-2 border border-black/10"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm w-6 shrink-0 text-gray-500">
                        {i + 1}.
                      </span>
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {row.item}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-amber-700 shrink-0">
                      {row.score} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </SnacksDetails>
        )}

        {/* Collapsible: Leaderboard (points) */}
        <CollapsibleSection
          id="section-leaderboard"
          emoji="🏆"
          title="Leaderboard"
          subtitle="Snack Champions — points from Slack activity and profiles"
          defaultOpen
        >
          {data.leaderboard.length > 0 ? (
            <div className="space-y-3">
              {data.leaderboard.map((user, i) => (
                <div
                  key={user.userId}
                  className="flex items-center justify-between bg-amber-50 rounded-xl px-4 py-3 border-2 border-black shadow-[2px_2px_0px_0px_#000] animate-slide-up"
                  style={{ animationDelay: `${i * 0.08}s` }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl w-8 text-center shrink-0">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </span>
                    <span className="font-medium text-gray-900 truncate">{user.displayName}</span>
                  </div>
                  <span className="bg-amber-400 text-black text-sm px-3 py-1 rounded-full font-bold border border-black shrink-0">
                    {user.points} pts
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-6">
              No activity yet. Use{" "}
              <code className="bg-gray-100 px-2 py-1 rounded">/snack-profile</code> to earn points!
            </p>
          )}
        </CollapsibleSection>

        {/* Collapsible: Profile ranking (aggregated from /snack-profile data) */}
        <CollapsibleSection
          id="section-profiles"
          emoji="👤"
          title="Profile ranking"
          subtitle="Category demand from token allocations + most wanted favorites"
          defaultOpen={false}
        >
          {data.categoryDemand.length === 0 && data.mostWanted.length === 0 ? (
            <p className="text-gray-500 text-center py-6">
              No profile data yet. Complete{" "}
              <code className="bg-gray-100 px-2 py-1 rounded">/snack-profile</code> in Slack.
            </p>
          ) : (
            <div className="space-y-8">
              {data.categoryDemand.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">
                    📊 Category demand (token allocations)
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {data.categoryDemand.slice(0, 10).map((cat, i) => (
                      <div
                        key={cat.category}
                        className="text-center animate-slide-up"
                        style={{ animationDelay: `${i * 0.05}s` }}
                      >
                        <div className="text-3xl mb-2">{cat.emoji}</div>
                        <div className="relative h-20 bg-gray-100 rounded-lg overflow-hidden border border-black mb-2">
                          <div
                            className="absolute bottom-0 w-full bg-gradient-to-t from-amber-500 to-amber-300 transition-all duration-1000 rounded-t"
                            style={{ height: `${cat.percent}%` }}
                          />
                        </div>
                        <div className="text-xs font-medium text-gray-700 truncate">{cat.category}</div>
                        <div className="text-lg font-bold text-amber-600">{cat.percent}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {data.mostWanted.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">
                    ⭐ Most wanted (favorites from profiles)
                  </h3>
                  <div className="space-y-3">
                    {data.mostWanted.map((item, i) => (
                      <div
                        key={item.item}
                        className="flex items-center gap-3 animate-slide-up"
                        style={{ animationDelay: `${i * 0.08}s` }}
                      >
                        <span className="text-lg w-8 text-center shrink-0">
                          {i === 0 ? "🔥" : i === 1 ? "💫" : i === 2 ? "✨" : `${i + 1}.`}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{item.item}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <RatingBar value={item.score} max={data.mostWanted[0]?.score || 1} />
                            <span className="text-xs text-gray-500 w-8 text-right">{item.score}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CollapsibleSection>

        {/* Out of Stock Reports */}
        {data.outOfStock.length > 0 && (
          <SnacksDetails
            id="section-oos"
            className="group/oos bg-white rounded-xl border-2 border-black shadow-[8px_8px_0px_0px_#000] mb-6 overflow-hidden scroll-mt-20"
            defaultOpen
          >
            <summary className="cursor-pointer list-none p-4 md:p-6 pb-4 border-b-2 border-black hover:bg-amber-50/50 flex items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                🚨 Out of Stock Reports
              </h2>
              <span
                className="shrink-0 text-gray-600 text-lg leading-none transition-transform duration-200 group-open/oos:rotate-180"
                aria-hidden
              >
                ▼
              </span>
            </summary>
            <div className="p-4 md:p-6 pt-2 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-black">
                    <th className="text-left py-3 px-4 text-xs uppercase text-gray-500">Snack</th>
                    <th className="text-left py-3 px-4 text-xs uppercase text-gray-500">Category</th>
                    <th className="text-right py-3 px-4 text-xs uppercase text-gray-500">Reports</th>
                    <th className="text-right py-3 px-4 text-xs uppercase text-gray-500">Last Reported</th>
                  </tr>
                </thead>
                <tbody>
                  {data.outOfStock.slice(0, 10).map((report, i) => (
                    <tr
                      key={report.snackName}
                      className="border-b border-gray-200 hover:bg-amber-50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <span className="font-medium">{report.snackName}</span>
                        {i < 3 && (
                          <span className="ml-2 bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded border border-red-200">
                            High Priority
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-500">{report.category || "Unknown"}</td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold border border-black ${
                            report.count >= 3
                              ? "bg-red-100 text-red-800"
                              : report.count >= 2
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {report.count}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-500 text-sm">
                        {new Date(report.lastReported).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SnacksDetails>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-xs text-gray-400">
          Auto-refreshes every 10 seconds • Built with 💚 at Kikoff Hackweek
        </div>
      </div>
    </div>
  );
}

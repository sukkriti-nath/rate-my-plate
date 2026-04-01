import { Pool } from "pg";
import { appendSnackVoteToGoogleSheet } from "@/lib/snack-votes-sheet";

// Use the same pool from the main db, but with snack-specific tables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("rds.amazonaws.com")
    ? { rejectUnauthorized: false }
    : undefined,
  connectionTimeoutMillis: 10000,
  max: 5,
});

let snackInitPromise: Promise<void> | null = null;

export async function getSnackDb(): Promise<Pool> {
  if (!snackInitPromise) {
    snackInitPromise = initSnackDb().catch((err) => {
      snackInitPromise = null;
      throw err;
    });
  }
  await snackInitPromise;
  return pool;
}

async function initSnackDb() {
  await pool.query(`
    -- Snack profiles with token allocations
    CREATE TABLE IF NOT EXISTS snack_profiles (
      user_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      drinks_allocation JSONB DEFAULT '{}',
      snacks_allocation JSONB DEFAULT '{}',
      favorite_drinks TEXT[] DEFAULT '{}',
      favorite_snacks TEXT[] DEFAULT '{}',
      vibes JSONB DEFAULT '{}',
      feedback TEXT,
      is_public BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Snack leaderboard
    CREATE TABLE IF NOT EXISTS snack_leaderboard (
      user_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      points INTEGER DEFAULT 0,
      actions JSONB DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Out of stock reports
    CREATE TABLE IF NOT EXISTS snack_out_of_stock (
      id SERIAL PRIMARY KEY,
      snack_name TEXT NOT NULL,
      category TEXT,
      reported_by TEXT NOT NULL,
      reported_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Snack surveys (weekly)
    CREATE TABLE IF NOT EXISTS snack_surveys (
      week_id TEXT PRIMARY KEY,
      votes JSONB DEFAULT '{}',
      voters JSONB DEFAULT '{}',
      suggestions JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_snack_out_of_stock_name ON snack_out_of_stock(snack_name);
    CREATE INDEX IF NOT EXISTS idx_snack_leaderboard_points ON snack_leaderboard(points DESC);
  `);
}

// ============== Profile Functions ==============

export interface SnackProfile {
  userId: string;
  displayName: string;
  drinksAllocation: Record<string, number>;
  snacksAllocation: Record<string, number>;
  favoriteDrinks: string[];
  favoriteSnacks: string[];
  vibes: Record<string, string>;
  feedback: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getProfile(userId: string): Promise<SnackProfile | null> {
  const db = await getSnackDb();
  const result = await db.query(
    "SELECT * FROM snack_profiles WHERE user_id = $1",
    [userId]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    userId: row.user_id,
    displayName: row.display_name,
    drinksAllocation: row.drinks_allocation || {},
    snacksAllocation: row.snacks_allocation || {},
    favoriteDrinks: row.favorite_drinks || [],
    favoriteSnacks: row.favorite_snacks || [],
    vibes: row.vibes || {},
    feedback: row.feedback,
    isPublic: row.is_public,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function upsertProfile(profile: Partial<SnackProfile> & { userId: string; displayName: string }): Promise<void> {
  const db = await getSnackDb();
  await db.query(
    `INSERT INTO snack_profiles (user_id, display_name, drinks_allocation, snacks_allocation, favorite_drinks, favorite_snacks, vibes, feedback, is_public, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       drinks_allocation = EXCLUDED.drinks_allocation,
       snacks_allocation = EXCLUDED.snacks_allocation,
       favorite_drinks = EXCLUDED.favorite_drinks,
       favorite_snacks = EXCLUDED.favorite_snacks,
       vibes = EXCLUDED.vibes,
       feedback = EXCLUDED.feedback,
       is_public = EXCLUDED.is_public,
       updated_at = NOW()`,
    [
      profile.userId,
      profile.displayName,
      JSON.stringify(profile.drinksAllocation || {}),
      JSON.stringify(profile.snacksAllocation || {}),
      profile.favoriteDrinks || [],
      profile.favoriteSnacks || [],
      JSON.stringify(profile.vibes || {}),
      profile.feedback || null,
      profile.isPublic ?? true,
    ]
  );
}

export async function getAllProfiles(): Promise<SnackProfile[]> {
  const db = await getSnackDb();
  const result = await db.query(
    "SELECT * FROM snack_profiles ORDER BY updated_at DESC"
  );
  return result.rows.map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    drinksAllocation: row.drinks_allocation || {},
    snacksAllocation: row.snacks_allocation || {},
    favoriteDrinks: row.favorite_drinks || [],
    favoriteSnacks: row.favorite_snacks || [],
    vibes: row.vibes || {},
    feedback: row.feedback,
    isPublic: row.is_public,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getPublicProfiles(): Promise<SnackProfile[]> {
  const db = await getSnackDb();
  const result = await db.query(
    "SELECT * FROM snack_profiles WHERE is_public = true ORDER BY updated_at DESC"
  );
  return result.rows.map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    drinksAllocation: row.drinks_allocation || {},
    snacksAllocation: row.snacks_allocation || {},
    favoriteDrinks: row.favorite_drinks || [],
    favoriteSnacks: row.favorite_snacks || [],
    vibes: row.vibes || {},
    feedback: row.feedback,
    isPublic: row.is_public,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

// ============== Leaderboard Functions ==============

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  points: number;
  actions: Record<string, number>;
}

export const POINTS = {
  profile_create: 10,
  profile_update: 5,
  weekly_vote: 3,
  suggestion: 2,
  out_of_stock: 1,
};

export async function awardPoints(
  userId: string,
  action: keyof typeof POINTS,
  displayName: string
): Promise<void> {
  const points = POINTS[action];
  const db = await getSnackDb();

  // Get existing entry
  const existing = await db.query(
    "SELECT actions FROM snack_leaderboard WHERE user_id = $1",
    [userId]
  );

  const currentActions = existing.rows[0]?.actions || {};
  currentActions[action] = (currentActions[action] || 0) + 1;

  await db.query(
    `INSERT INTO snack_leaderboard (user_id, display_name, points, actions, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       points = snack_leaderboard.points + $3,
       actions = $4,
       updated_at = NOW()`,
    [userId, displayName, points, JSON.stringify(currentActions)]
  );
}

export async function getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  const db = await getSnackDb();
  const result = await db.query(
    "SELECT * FROM snack_leaderboard ORDER BY points DESC LIMIT $1",
    [limit]
  );
  return result.rows.map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    points: row.points,
    actions: row.actions || {},
  }));
}

// ============== Out of Stock Functions ==============

export interface OutOfStockReport {
  snackName: string;
  category: string | null;
  count: number;
  lastReported: string;
}

export async function reportOutOfStock(
  snackName: string,
  reportedBy: string,
  category?: string
): Promise<void> {
  const db = await getSnackDb();
  await db.query(
    `INSERT INTO snack_out_of_stock (snack_name, category, reported_by)
     VALUES ($1, $2, $3)`,
    [snackName, category || null, reportedBy]
  );
}

// ============== Weekly snack survey ==============

/** ISO week id e.g. `2026-W14` (Monday-based week, UTC). */
export function getCurrentSnackSurveyWeekId(now = new Date()): string {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export interface SnackTop5VoterEntry {
  picks: string[];
  at: string;
}

function aggregateTop5Scores(
  voters: Record<string, SnackTop5VoterEntry | unknown>
): Record<string, number> {
  const scores: Record<string, number> = {};
  const weights = [5, 4, 3, 2, 1];
  for (const val of Object.values(voters)) {
    if (!val || typeof val !== "object" || !("picks" in val)) continue;
    const picks = (val as SnackTop5VoterEntry).picks;
    if (!Array.isArray(picks) || picks.length !== 5) continue;
    picks.forEach((name, i) => {
      const w = weights[i] ?? 0;
      scores[name] = (scores[name] || 0) + w;
    });
  }
  return scores;
}

/** Save ranked top-5 picks (5 pts … 1 pt). `isNewVoter` = first top-5 submission this week. */
export async function recordSnackTop5Vote(
  weekId: string,
  userId: string,
  picks: string[],
  options?: { displayName?: string }
): Promise<{ isNewVoter: boolean }> {
  if (picks.length !== 5 || new Set(picks).size !== 5) {
    throw new Error("Exactly 5 distinct snacks required");
  }
  const db = await getSnackDb();
  const existing = await db.query(
    "SELECT voters FROM snack_surveys WHERE week_id = $1",
    [weekId]
  );
  const raw = (existing.rows[0]?.voters as Record<string, unknown>) || {};
  const voters: Record<string, SnackTop5VoterEntry> = {};
  for (const [uid, val] of Object.entries(raw)) {
    if (
      val &&
      typeof val === "object" &&
      "picks" in val &&
      Array.isArray((val as SnackTop5VoterEntry).picks)
    ) {
      voters[uid] = val as SnackTop5VoterEntry;
    }
  }
  const hadTop5Before = Boolean(voters[userId]);
  const at = new Date().toISOString();
  voters[userId] = {
    picks,
    at,
  };
  const top5_scores = aggregateTop5Scores(voters);

  await db.query(
    `INSERT INTO snack_surveys (week_id, votes, voters, suggestions)
     VALUES ($1, $2::jsonb, $3::jsonb, '[]'::jsonb)
     ON CONFLICT (week_id) DO UPDATE SET
       votes = EXCLUDED.votes,
       voters = EXCLUDED.voters`,
    [weekId, JSON.stringify({ top5_scores }), JSON.stringify(voters)]
  );

  const displayName = options?.displayName?.trim() || "";
  void appendSnackVoteToGoogleSheet({
    at,
    weekId,
    userId,
    displayName,
    picks,
  }).catch((e) => console.error("[snack-votes-sheet] append failed:", e));

  return { isNewVoter: !hadTop5Before };
}

/** Aggregated scores for the weekly top-5 survey (from Postgres). */
export async function getSnackSurveyWeeklyScores(weekId?: string): Promise<{
  weekId: string;
  items: { item: string; score: number }[];
  voterCount: number;
} | null> {
  const db = await getSnackDb();
  const wid = weekId ?? getCurrentSnackSurveyWeekId();
  const result = await db.query(
    "SELECT votes, voters FROM snack_surveys WHERE week_id = $1",
    [wid]
  );
  if (result.rows.length === 0) return null;
  const votes = result.rows[0].votes as { top5_scores?: Record<string, number> } | null;
  const votersRaw = result.rows[0].voters as Record<string, unknown> | null;
  const top5_scores = votes?.top5_scores || {};
  const items = Object.entries(top5_scores)
    .map(([item, score]) => ({ item, score: Number(score) || 0 }))
    .sort((a, b) => b.score - a.score);
  let voterCount = 0;
  if (votersRaw) {
    for (const val of Object.values(votersRaw)) {
      if (
        val &&
        typeof val === "object" &&
        "picks" in val &&
        Array.isArray((val as SnackTop5VoterEntry).picks) &&
        (val as SnackTop5VoterEntry).picks.length === 5
      ) {
        voterCount += 1;
      }
    }
  }
  return { weekId: wid, items, voterCount };
}

export async function getOutOfStockReports(): Promise<OutOfStockReport[]> {
  const db = await getSnackDb();
  const result = await db.query(
    `SELECT snack_name, category, COUNT(*) as count, MAX(reported_at) as last_reported
     FROM snack_out_of_stock
     GROUP BY snack_name, category
     ORDER BY count DESC, last_reported DESC`
  );
  return result.rows.map((row) => ({
    snackName: row.snack_name,
    category: row.category,
    count: Number(row.count),
    lastReported: row.last_reported,
  }));
}

// ============== Category Demand Functions ==============

export async function getCategoryDemand(): Promise<{ category: string; emoji: string; tokens: number; percent: number }[]> {
  const profiles = await getAllProfiles();

  const CATEGORY_EMOJIS: Record<string, string> = {
    "Coffee & Lattes": "☕",
    "Tea": "🍵",
    "Yerba Mate": "🧉",
    "Juice": "🧃",
    "Energy Drinks": "⚡",
    "Sparkling & Soda": "🥤",
    "Water": "💧",
    "Milk Tea": "🥛",
    "Protein Drinks": "💪",
    "Wellness Shots": "🌿",
    "Baked Goods": "🍪",
    "Chocolate & Candy": "🍫",
    "Chips": "🥜",
    "Popcorn & Crackers": "🍿",
    "Protein Bars": "💪",
    "Granola & Oatmeal": "🥗",
    "Fruit Snacks": "🍎",
    "Jerky": "🥩",
    "Seaweed": "🌊",
    "Trail Mix & Nuts": "🥾",
  };

  const demand: Record<string, number> = {};

  for (const profile of profiles) {
    for (const [category, tokens] of Object.entries(profile.drinksAllocation)) {
      demand[category] = (demand[category] || 0) + tokens;
    }
    for (const [category, tokens] of Object.entries(profile.snacksAllocation)) {
      demand[category] = (demand[category] || 0) + tokens;
    }
  }

  const total = Object.values(demand).reduce((a, b) => a + b, 0) || 1;

  return Object.entries(demand)
    .map(([category, tokens]) => ({
      category,
      emoji: CATEGORY_EMOJIS[category] || "🍿",
      tokens,
      percent: Math.round((tokens / total) * 100),
    }))
    .sort((a, b) => b.tokens - a.tokens);
}

// ============== Most Wanted Items ==============

export async function getMostWantedItems(limit = 10): Promise<{ item: string; score: number }[]> {
  const profiles = await getAllProfiles();
  const itemScores: Record<string, number> = {};

  // Score from favorite picks (weight: 3 for first pick, decreasing)
  for (const profile of profiles) {
    for (let i = 0; i < profile.favoriteDrinks.length; i++) {
      const score = (5 - i) * 3;
      itemScores[profile.favoriteDrinks[i]] = (itemScores[profile.favoriteDrinks[i]] || 0) + score;
    }
    for (let i = 0; i < profile.favoriteSnacks.length; i++) {
      const score = (5 - i) * 3;
      itemScores[profile.favoriteSnacks[i]] = (itemScores[profile.favoriteSnacks[i]] || 0) + score;
    }
  }

  return Object.entries(itemScores)
    .map(([item, score]) => ({ item, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ============== Stats ==============

export async function getSnackStats(): Promise<{
  profileCount: number;
  publicProfiles: number;
  outOfStockCount: number;
  totalPoints: number;
}> {
  const db = await getSnackDb();

  const profileResult = await db.query(
    "SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_public = true) as public_count FROM snack_profiles"
  );
  const oosResult = await db.query(
    "SELECT COUNT(DISTINCT snack_name) as count FROM snack_out_of_stock"
  );
  const pointsResult = await db.query(
    "SELECT COALESCE(SUM(points), 0) as total FROM snack_leaderboard"
  );

  return {
    profileCount: Number(profileResult.rows[0]?.total || 0),
    publicProfiles: Number(profileResult.rows[0]?.public_count || 0),
    outOfStockCount: Number(oosResult.rows[0]?.count || 0),
    totalPoints: Number(pointsResult.rows[0]?.total || 0),
  };
}

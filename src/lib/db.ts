import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

let initialized = false;

export async function getDb(): Promise<Pool> {
  if (!initialized) {
    await initDb();
    initialized = true;
  }
  return pool;
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS menu_days (
      date TEXT PRIMARY KEY,
      day_name TEXT NOT NULL,
      breakfast TEXT,
      starch TEXT,
      vegan_protein TEXT,
      veg TEXT,
      protein_1 TEXT,
      protein_2 TEXT,
      sauce_sides TEXT,
      restaurant TEXT,
      no_service INTEGER DEFAULT 0,
      synced_at TEXT DEFAULT (NOW()::text)
    );

    CREATE TABLE IF NOT EXISTS votes (
      id SERIAL PRIMARY KEY,
      menu_date TEXT NOT NULL REFERENCES menu_days(date),
      user_name TEXT NOT NULL,
      user_email TEXT NOT NULL,
      slack_user_id TEXT,
      rating_overall INTEGER CHECK (rating_overall BETWEEN 1 AND 5),
      rating_starch INTEGER CHECK (rating_starch BETWEEN 1 AND 5),
      rating_vegan_protein INTEGER CHECK (rating_vegan_protein BETWEEN 1 AND 5),
      rating_veg INTEGER CHECK (rating_veg BETWEEN 1 AND 5),
      rating_protein_1 INTEGER CHECK (rating_protein_1 BETWEEN 1 AND 5),
      rating_protein_2 INTEGER CHECK (rating_protein_2 BETWEEN 1 AND 5),
      comment TEXT,
      comment_starch TEXT,
      comment_vegan_protein TEXT,
      comment_veg TEXT,
      comment_protein_1 TEXT,
      comment_protein_2 TEXT,
      created_at TEXT DEFAULT (NOW()::text),
      UNIQUE(menu_date, user_email)
    );

    CREATE INDEX IF NOT EXISTS idx_votes_date ON votes(menu_date);
    CREATE INDEX IF NOT EXISTS idx_votes_email ON votes(user_email);
  `);

  // Migration: add new columns if upgrading from old schema
  const migrations = [
    `ALTER TABLE votes ADD COLUMN IF NOT EXISTS rating_overall INTEGER CHECK (rating_overall BETWEEN 1 AND 5)`,
    `ALTER TABLE votes ADD COLUMN IF NOT EXISTS rating_starch INTEGER CHECK (rating_starch BETWEEN 1 AND 5)`,
    `ALTER TABLE votes ADD COLUMN IF NOT EXISTS rating_vegan_protein INTEGER CHECK (rating_vegan_protein BETWEEN 1 AND 5)`,
    `ALTER TABLE votes ADD COLUMN IF NOT EXISTS rating_veg INTEGER CHECK (rating_veg BETWEEN 1 AND 5)`,
    `ALTER TABLE votes ADD COLUMN IF NOT EXISTS rating_protein_1 INTEGER CHECK (rating_protein_1 BETWEEN 1 AND 5)`,
    `ALTER TABLE votes ADD COLUMN IF NOT EXISTS rating_protein_2 INTEGER CHECK (rating_protein_2 BETWEEN 1 AND 5)`,
    `ALTER TABLE votes ADD COLUMN IF NOT EXISTS user_email TEXT`,
    `ALTER TABLE votes ADD COLUMN IF NOT EXISTS slack_user_id TEXT`,
    `ALTER TABLE votes ADD COLUMN IF NOT EXISTS comment_starch TEXT`,
    `ALTER TABLE votes ADD COLUMN IF NOT EXISTS comment_vegan_protein TEXT`,
    `ALTER TABLE votes ADD COLUMN IF NOT EXISTS comment_veg TEXT`,
    `ALTER TABLE votes ADD COLUMN IF NOT EXISTS comment_protein_1 TEXT`,
    `ALTER TABLE votes ADD COLUMN IF NOT EXISTS comment_protein_2 TEXT`,
    `ALTER TABLE menu_days ADD COLUMN IF NOT EXISTS restaurant TEXT`,
  ];

  for (const sql of migrations) {
    await pool.query(sql);
  }
}

export async function upsertMenuDay(menu: {
  date: string;
  dayName: string;
  breakfast: string;
  starch: string | null;
  veganProtein: string | null;
  veg: string | null;
  protein1: string | null;
  protein2: string | null;
  sauceSides: string | null;
  restaurant?: string | null;
  noService: boolean;
}) {
  const db = await getDb();
  await db.query(
    `INSERT INTO menu_days (date, day_name, breakfast, starch, vegan_protein, veg, protein_1, protein_2, sauce_sides, restaurant, no_service)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (date) DO UPDATE SET
      day_name = EXCLUDED.day_name,
      breakfast = EXCLUDED.breakfast,
      starch = EXCLUDED.starch,
      vegan_protein = EXCLUDED.vegan_protein,
      veg = EXCLUDED.veg,
      protein_1 = EXCLUDED.protein_1,
      protein_2 = EXCLUDED.protein_2,
      sauce_sides = EXCLUDED.sauce_sides,
      restaurant = EXCLUDED.restaurant,
      no_service = EXCLUDED.no_service,
      synced_at = NOW()::text`,
    [
      menu.date,
      menu.dayName,
      menu.breakfast,
      menu.starch,
      menu.veganProtein,
      menu.veg,
      menu.protein1,
      menu.protein2,
      menu.sauceSides,
      menu.restaurant ?? null,
      menu.noService ? 1 : 0,
    ]
  );
}

export async function getMenuForDate(date: string) {
  const db = await getDb();
  const result = await db.query("SELECT * FROM menu_days WHERE date = $1", [date]);
  return result.rows[0] as Record<string, unknown> | undefined;
}

export async function getMenuForWeek(startDate: string, endDate: string) {
  const db = await getDb();
  const result = await db.query(
    "SELECT * FROM menu_days WHERE date BETWEEN $1 AND $2 ORDER BY date",
    [startDate, endDate]
  );
  return result.rows as Record<string, unknown>[];
}

export async function upsertVote(vote: {
  menuDate: string;
  userName: string;
  userEmail: string;
  slackUserId?: string | null;
  ratingOverall: number | null;
  ratingStarch: number | null;
  ratingVeganProtein: number | null;
  ratingVeg: number | null;
  ratingProtein1: number | null;
  ratingProtein2: number | null;
  comment: string | null;
  commentStarch?: string | null;
  commentVeganProtein?: string | null;
  commentVeg?: string | null;
  commentProtein1?: string | null;
  commentProtein2?: string | null;
}) {
  const db = await getDb();
  return await db.query(
    `INSERT INTO votes (menu_date, user_name, user_email, slack_user_id, rating_overall, rating_starch, rating_vegan_protein, rating_veg, rating_protein_1, rating_protein_2, comment, comment_starch, comment_vegan_protein, comment_veg, comment_protein_1, comment_protein_2)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    ON CONFLICT (menu_date, user_email) DO UPDATE SET
      rating_overall = EXCLUDED.rating_overall,
      rating_starch = EXCLUDED.rating_starch,
      rating_vegan_protein = EXCLUDED.rating_vegan_protein,
      rating_veg = EXCLUDED.rating_veg,
      rating_protein_1 = EXCLUDED.rating_protein_1,
      rating_protein_2 = EXCLUDED.rating_protein_2,
      comment = EXCLUDED.comment,
      comment_starch = EXCLUDED.comment_starch,
      comment_vegan_protein = EXCLUDED.comment_vegan_protein,
      comment_veg = EXCLUDED.comment_veg,
      comment_protein_1 = EXCLUDED.comment_protein_1,
      comment_protein_2 = EXCLUDED.comment_protein_2,
      slack_user_id = EXCLUDED.slack_user_id,
      created_at = NOW()::text`,
    [
      vote.menuDate,
      vote.userName,
      vote.userEmail,
      vote.slackUserId ?? null,
      vote.ratingOverall,
      vote.ratingStarch,
      vote.ratingVeganProtein,
      vote.ratingVeg,
      vote.ratingProtein1,
      vote.ratingProtein2,
      vote.comment,
      vote.commentStarch ?? null,
      vote.commentVeganProtein ?? null,
      vote.commentVeg ?? null,
      vote.commentProtein1 ?? null,
      vote.commentProtein2 ?? null,
    ]
  );
}

export async function getVotesForDate(date: string) {
  const db = await getDb();
  const result = await db.query(
    "SELECT * FROM votes WHERE menu_date = $1 ORDER BY created_at DESC",
    [date]
  );
  return result.rows as Record<string, unknown>[];
}

export async function getVoteStatsForDate(date: string) {
  const db = await getDb();
  const statsResult = await db.query(
    `SELECT
      COUNT(*) as total_votes,
      AVG(rating_overall) as avg_overall,
      AVG(rating_starch) as avg_starch,
      AVG(rating_vegan_protein) as avg_vegan_protein,
      AVG(rating_veg) as avg_veg,
      AVG(rating_protein_1) as avg_protein_1,
      AVG(rating_protein_2) as avg_protein_2,
      COUNT(rating_starch) as votes_starch,
      COUNT(rating_vegan_protein) as votes_vegan_protein,
      COUNT(rating_veg) as votes_veg,
      COUNT(rating_protein_1) as votes_protein_1,
      COUNT(rating_protein_2) as votes_protein_2
    FROM votes WHERE menu_date = $1`,
    [date]
  );
  const stats = statsResult.rows[0] as Record<string, number | null>;

  const distResult = await db.query(
    `SELECT rating_overall as rating, COUNT(*) as count
    FROM votes WHERE menu_date = $1
    GROUP BY rating_overall ORDER BY rating_overall`,
    [date]
  );
  const distribution = distResult.rows as { rating: number; count: number }[];

  return {
    totalVotes: Number(stats.total_votes) || 0,
    averageOverall: Number(stats.avg_overall) || 0,
    dishRatings: {
      starch: { avg: Number(stats.avg_starch) || 0, votes: Number(stats.votes_starch) || 0 },
      veganProtein: { avg: Number(stats.avg_vegan_protein) || 0, votes: Number(stats.votes_vegan_protein) || 0 },
      veg: { avg: Number(stats.avg_veg) || 0, votes: Number(stats.votes_veg) || 0 },
      protein1: { avg: Number(stats.avg_protein_1) || 0, votes: Number(stats.votes_protein_1) || 0 },
      protein2: { avg: Number(stats.avg_protein_2) || 0, votes: Number(stats.votes_protein_2) || 0 },
    },
    distribution: Object.fromEntries(distribution.map((d) => [d.rating, Number(d.count)])),
  };
}

export async function getUserVoteForDate(userEmail: string, date: string) {
  const db = await getDb();
  const result = await db.query(
    "SELECT * FROM votes WHERE user_email = $1 AND menu_date = $2",
    [userEmail, date]
  );
  return result.rows[0] as Record<string, unknown> | undefined;
}

export async function getVoterEmailsForDate(date: string): Promise<string[]> {
  const db = await getDb();
  const result = await db.query(
    "SELECT DISTINCT user_email FROM votes WHERE menu_date = $1",
    [date]
  );
  return result.rows.map((r: { user_email: string }) => r.user_email);
}

export async function getCommentsForDateRange(startDate: string, endDate: string): Promise<{ date: string; comment: string; userName: string }[]> {
  const db = await getDb();
  const result = await db.query(
    `SELECT menu_date as date, comment, user_name as "userName"
    FROM votes WHERE menu_date BETWEEN $1 AND $2 AND comment IS NOT NULL AND comment != ''
    ORDER BY menu_date`,
    [startDate, endDate]
  );
  return result.rows as { date: string; comment: string; userName: string }[];
}

export interface WeeklyDayRanking {
  date: string;
  dayName: string;
  avgOverall: number;
  totalVotes: number;
  menu: Record<string, unknown>;
  dishRankings: { name: string; category: string; avg: number; votes: number }[];
}

export async function getWeeklyRankings(startDate: string, endDate: string): Promise<WeeklyDayRanking[]> {
  const db = await getDb();
  const daysResult = await db.query(
    "SELECT * FROM menu_days WHERE date BETWEEN $1 AND $2 AND no_service = 0 ORDER BY date",
    [startDate, endDate]
  );
  const days = daysResult.rows as Record<string, unknown>[];

  const results: WeeklyDayRanking[] = [];

  for (const day of days) {
    const date = day.date as string;
    const stats = await getVoteStatsForDate(date);

    const dishCategories = [
      { key: "starch", label: "Starch", field: "starch" },
      { key: "veganProtein", label: "Vegan Protein", field: "vegan_protein" },
      { key: "veg", label: "Veg", field: "veg" },
      { key: "protein1", label: "Protein 1", field: "protein_1" },
      { key: "protein2", label: "Protein 2", field: "protein_2" },
    ];

    const dishRankings: WeeklyDayRanking["dishRankings"] = [];
    for (const cat of dishCategories) {
      const dishName = day[cat.field] as string | null;
      const dishStats = stats.dishRatings[cat.key as keyof typeof stats.dishRatings];
      if (dishName && dishStats.votes > 0) {
        dishRankings.push({
          name: dishName,
          category: cat.label,
          avg: dishStats.avg,
          votes: dishStats.votes,
        });
      }
    }

    results.push({
      date,
      dayName: day.day_name as string,
      avgOverall: stats.averageOverall,
      totalVotes: stats.totalVotes,
      menu: day,
      dishRankings,
    });
  }

  return results;
}

export async function getRecentServiceDates(todayDate: string, maxDaysBack: number = 7): Promise<string[]> {
  const db = await getDb();
  const cutoff = new Date(todayDate + "T12:00:00");
  cutoff.setDate(cutoff.getDate() - maxDaysBack);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  const result = await db.query(
    "SELECT date FROM menu_days WHERE date BETWEEN $1 AND $2 AND no_service = 0 ORDER BY date DESC",
    [cutoffStr, todayDate]
  );
  return result.rows.map((r: { date: string }) => r.date);
}

// --- Participation & Streak tracking ---

export interface ParticipantStats {
  userName: string;
  userEmail: string;
  totalVotes: number;
  daysVoted: string[];
}

export async function getParticipationForRange(startDate: string, endDate: string): Promise<ParticipantStats[]> {
  const db = await getDb();
  const result = await db.query(
    `SELECT user_name, user_email, menu_date
    FROM votes
    WHERE menu_date BETWEEN $1 AND $2
    ORDER BY user_name, menu_date`,
    [startDate, endDate]
  );
  const rows = result.rows as { user_name: string; user_email: string; menu_date: string }[];

  const map = new Map<string, ParticipantStats>();
  for (const row of rows) {
    const key = row.user_email;
    if (!map.has(key)) {
      map.set(key, { userName: row.user_name, userEmail: row.user_email, totalVotes: 0, daysVoted: [] });
    }
    const stats = map.get(key)!;
    stats.totalVotes++;
    if (!stats.daysVoted.includes(row.menu_date)) {
      stats.daysVoted.push(row.menu_date);
    }
  }

  return Array.from(map.values()).sort((a, b) => b.daysVoted.length - a.daysVoted.length);
}

export async function getServiceDaysInRange(startDate: string, endDate: string): Promise<string[]> {
  const db = await getDb();
  const result = await db.query(
    "SELECT date FROM menu_days WHERE date BETWEEN $1 AND $2 AND no_service = 0 ORDER BY date",
    [startDate, endDate]
  );
  return result.rows.map((r: { date: string }) => r.date);
}

export interface StreakInfo {
  userName: string;
  userEmail: string;
  currentStreak: number;
  longestStreak: number;
  lastVoteDate: string;
}

export async function getVotingStreaks(): Promise<StreakInfo[]> {
  const db = await getDb();

  // Get all service days (days with menus)
  const serviceDaysResult = await db.query(
    "SELECT date FROM menu_days WHERE no_service = 0 ORDER BY date"
  );
  const serviceDays = serviceDaysResult.rows as { date: string }[];
  const serviceDateList = serviceDays.map((d) => d.date);

  // Get all votes grouped by user
  const votesResult = await db.query(
    "SELECT DISTINCT user_name, user_email, menu_date FROM votes ORDER BY user_email, menu_date"
  );
  const votes = votesResult.rows as { user_name: string; user_email: string; menu_date: string }[];

  const userVotes = new Map<string, { userName: string; dates: Set<string> }>();
  for (const v of votes) {
    if (!userVotes.has(v.user_email)) {
      userVotes.set(v.user_email, { userName: v.user_name, dates: new Set() });
    }
    userVotes.get(v.user_email)!.dates.add(v.menu_date);
  }

  const results: StreakInfo[] = [];

  for (const [email, { userName, dates }] of userVotes) {
    let longestStreak = 0;
    let streak = 0;
    let lastVoteDate = "";

    // Walk through service days in order
    for (const day of serviceDateList) {
      if (dates.has(day)) {
        streak++;
        lastVoteDate = day;
        if (streak > longestStreak) longestStreak = streak;
      } else {
        streak = 0;
      }
    }
    const currentStreak = streak;

    if (lastVoteDate) {
      results.push({ userName, userEmail: email, currentStreak, longestStreak, lastVoteDate });
    }
  }

  return results.sort((a, b) => b.currentStreak - a.currentStreak);
}

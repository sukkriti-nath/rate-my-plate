import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "food-rater.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const fs = require("fs");
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initDb(db);
  }
  return db;
}

function initDb(db: Database.Database) {
  db.exec(`
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
      synced_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(menu_date, user_email)
    );

    CREATE INDEX IF NOT EXISTS idx_votes_date ON votes(menu_date);
    CREATE INDEX IF NOT EXISTS idx_votes_email ON votes(user_email);
  `);

  // Migration: add new columns if upgrading from old schema
  try {
    db.exec(`ALTER TABLE votes ADD COLUMN rating_overall INTEGER CHECK (rating_overall BETWEEN 1 AND 5)`);
  } catch { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE votes ADD COLUMN rating_starch INTEGER CHECK (rating_starch BETWEEN 1 AND 5)`);
  } catch { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE votes ADD COLUMN rating_vegan_protein INTEGER CHECK (rating_vegan_protein BETWEEN 1 AND 5)`);
  } catch { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE votes ADD COLUMN rating_veg INTEGER CHECK (rating_veg BETWEEN 1 AND 5)`);
  } catch { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE votes ADD COLUMN rating_protein_1 INTEGER CHECK (rating_protein_1 BETWEEN 1 AND 5)`);
  } catch { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE votes ADD COLUMN rating_protein_2 INTEGER CHECK (rating_protein_2 BETWEEN 1 AND 5)`);
  } catch { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE votes ADD COLUMN user_email TEXT`);
  } catch { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE votes ADD COLUMN slack_user_id TEXT`);
  } catch { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE votes ADD COLUMN comment_starch TEXT`);
  } catch { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE votes ADD COLUMN comment_vegan_protein TEXT`);
  } catch { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE votes ADD COLUMN comment_veg TEXT`);
  } catch { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE votes ADD COLUMN comment_protein_1 TEXT`);
  } catch { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE votes ADD COLUMN comment_protein_2 TEXT`);
  } catch { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE menu_days ADD COLUMN restaurant TEXT`);
  } catch { /* column already exists */ }
}

export function upsertMenuDay(menu: {
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
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO menu_days (date, day_name, breakfast, starch, vegan_protein, veg, protein_1, protein_2, sauce_sides, restaurant, no_service)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      day_name = excluded.day_name,
      breakfast = excluded.breakfast,
      starch = excluded.starch,
      vegan_protein = excluded.vegan_protein,
      veg = excluded.veg,
      protein_1 = excluded.protein_1,
      protein_2 = excluded.protein_2,
      sauce_sides = excluded.sauce_sides,
      restaurant = excluded.restaurant,
      no_service = excluded.no_service,
      synced_at = datetime('now')
  `);
  stmt.run(
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
    menu.noService ? 1 : 0
  );
}

export function getMenuForDate(date: string) {
  const db = getDb();
  return db
    .prepare("SELECT * FROM menu_days WHERE date = ?")
    .get(date) as Record<string, unknown> | undefined;
}

export function getMenuForWeek(startDate: string, endDate: string) {
  const db = getDb();
  return db
    .prepare("SELECT * FROM menu_days WHERE date BETWEEN ? AND ? ORDER BY date")
    .all(startDate, endDate) as Record<string, unknown>[];
}

export function upsertVote(vote: {
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
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO votes (menu_date, user_name, user_email, slack_user_id, rating_overall, rating_starch, rating_vegan_protein, rating_veg, rating_protein_1, rating_protein_2, comment, comment_starch, comment_vegan_protein, comment_veg, comment_protein_1, comment_protein_2)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(menu_date, user_email) DO UPDATE SET
      rating_overall = excluded.rating_overall,
      rating_starch = excluded.rating_starch,
      rating_vegan_protein = excluded.rating_vegan_protein,
      rating_veg = excluded.rating_veg,
      rating_protein_1 = excluded.rating_protein_1,
      rating_protein_2 = excluded.rating_protein_2,
      comment = excluded.comment,
      comment_starch = excluded.comment_starch,
      comment_vegan_protein = excluded.comment_vegan_protein,
      comment_veg = excluded.comment_veg,
      comment_protein_1 = excluded.comment_protein_1,
      comment_protein_2 = excluded.comment_protein_2,
      slack_user_id = excluded.slack_user_id,
      created_at = datetime('now')
  `);
  return stmt.run(
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
  );
}

export function getVotesForDate(date: string) {
  const db = getDb();
  return db
    .prepare("SELECT * FROM votes WHERE menu_date = ? ORDER BY created_at DESC")
    .all(date) as Record<string, unknown>[];
}

export function getVoteStatsForDate(date: string) {
  const db = getDb();
  const stats = db
    .prepare(
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
      FROM votes WHERE menu_date = ?`
    )
    .get(date) as Record<string, number | null>;

  const distribution = db
    .prepare(
      `SELECT rating_overall as rating, COUNT(*) as count
      FROM votes WHERE menu_date = ?
      GROUP BY rating_overall ORDER BY rating_overall`
    )
    .all(date) as { rating: number; count: number }[];

  return {
    totalVotes: (stats.total_votes as number) || 0,
    averageOverall: (stats.avg_overall as number) ?? 0,
    dishRatings: {
      starch: { avg: (stats.avg_starch as number) ?? 0, votes: (stats.votes_starch as number) || 0 },
      veganProtein: { avg: (stats.avg_vegan_protein as number) ?? 0, votes: (stats.votes_vegan_protein as number) || 0 },
      veg: { avg: (stats.avg_veg as number) ?? 0, votes: (stats.votes_veg as number) || 0 },
      protein1: { avg: (stats.avg_protein_1 as number) ?? 0, votes: (stats.votes_protein_1 as number) || 0 },
      protein2: { avg: (stats.avg_protein_2 as number) ?? 0, votes: (stats.votes_protein_2 as number) || 0 },
    },
    distribution: Object.fromEntries(distribution.map((d) => [d.rating, d.count])),
  };
}

export function getUserVoteForDate(userEmail: string, date: string) {
  const db = getDb();
  return db
    .prepare("SELECT * FROM votes WHERE user_email = ? AND menu_date = ?")
    .get(userEmail, date) as Record<string, unknown> | undefined;
}

export function getVoterEmailsForDate(date: string): string[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT DISTINCT user_email FROM votes WHERE menu_date = ?")
    .all(date) as { user_email: string }[];
  return rows.map((r) => r.user_email);
}

export function getCommentsForDateRange(startDate: string, endDate: string): { date: string; comment: string; userName: string }[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT menu_date as date, comment, user_name as userName
      FROM votes WHERE menu_date BETWEEN ? AND ? AND comment IS NOT NULL AND comment != ''
      ORDER BY menu_date`
    )
    .all(startDate, endDate) as { date: string; comment: string; userName: string }[];
}

export interface WeeklyDayRanking {
  date: string;
  dayName: string;
  avgOverall: number;
  totalVotes: number;
  menu: Record<string, unknown>;
  dishRankings: { name: string; category: string; avg: number; votes: number }[];
}

export function getWeeklyRankings(startDate: string, endDate: string): WeeklyDayRanking[] {
  const db = getDb();
  const days = db
    .prepare("SELECT * FROM menu_days WHERE date BETWEEN ? AND ? AND no_service = 0 ORDER BY date")
    .all(startDate, endDate) as Record<string, unknown>[];

  const results: WeeklyDayRanking[] = [];

  for (const day of days) {
    const date = day.date as string;
    const stats = getVoteStatsForDate(date);

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

export function getRecentServiceDates(todayDate: string, maxDaysBack: number = 7): string[] {
  const db = getDb();
  const cutoff = new Date(todayDate + "T12:00:00");
  cutoff.setDate(cutoff.getDate() - maxDaysBack);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  const rows = db.prepare(
    "SELECT date FROM menu_days WHERE date BETWEEN ? AND ? AND no_service = 0 ORDER BY date DESC"
  ).all(cutoffStr, todayDate) as { date: string }[];
  return rows.map(r => r.date);
}

// ─── Participation & Streak tracking ──────────────────────────────────────────

export interface ParticipantStats {
  userName: string;
  userEmail: string;
  totalVotes: number;
  daysVoted: string[];
}

export function getParticipationForRange(startDate: string, endDate: string): ParticipantStats[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT user_name, user_email, menu_date
    FROM votes
    WHERE menu_date BETWEEN ? AND ?
    ORDER BY user_name, menu_date
  `).all(startDate, endDate) as { user_name: string; user_email: string; menu_date: string }[];

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

export function getServiceDaysInRange(startDate: string, endDate: string): string[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT date FROM menu_days WHERE date BETWEEN ? AND ? AND no_service = 0 ORDER BY date"
  ).all(startDate, endDate) as { date: string }[];
  return rows.map(r => r.date);
}

export interface StreakInfo {
  userName: string;
  userEmail: string;
  currentStreak: number;
  longestStreak: number;
  lastVoteDate: string;
}

export function getVotingStreaks(): StreakInfo[] {
  const db = getDb();

  // Get all service days (days with menus)
  const serviceDays = db.prepare(
    "SELECT date FROM menu_days WHERE no_service = 0 ORDER BY date"
  ).all() as { date: string }[];
  const serviceDateSet = new Set(serviceDays.map(d => d.date));
  const serviceDateList = serviceDays.map(d => d.date);

  // Get all votes grouped by user
  const votes = db.prepare(
    "SELECT DISTINCT user_name, user_email, menu_date FROM votes ORDER BY user_email, menu_date"
  ).all() as { user_name: string; user_email: string; menu_date: string }[];

  const userVotes = new Map<string, { userName: string; dates: Set<string> }>();
  for (const v of votes) {
    if (!userVotes.has(v.user_email)) {
      userVotes.set(v.user_email, { userName: v.user_name, dates: new Set() });
    }
    userVotes.get(v.user_email)!.dates.add(v.menu_date);
  }

  const results: StreakInfo[] = [];

  for (const [email, { userName, dates }] of userVotes) {
    let currentStreak = 0;
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
    currentStreak = streak;

    if (lastVoteDate) {
      results.push({ userName, userEmail: email, currentStreak, longestStreak, lastVoteDate });
    }
  }

  return results.sort((a, b) => b.currentStreak - a.currentStreak);
}

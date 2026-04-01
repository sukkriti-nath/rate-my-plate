import fs from "fs";
import path from "path";
import { google } from "googleapis";

// ─── Auth & Client ──────────────────────────────────────────────────────────

/** True when Sheets API can use a service account (inline JSON, base64, or key file path). */
export function isGoogleServiceAccountConfigured(): boolean {
  return !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH?.trim() ||
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()
  );
}

function parseServiceAccountCredentials(): Record<string, string> {
  const filePath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH?.trim();
  if (filePath) {
    const resolved = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);
    let raw: string;
    try {
      raw = fs.readFileSync(resolved, "utf8");
    } catch (e) {
      throw new Error(
        `GOOGLE_SERVICE_ACCOUNT_JSON_PATH: cannot read ${resolved}: ${e instanceof Error ? e.message : e}`
      );
    }
    return JSON.parse(raw) as Record<string, string>;
  }

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    throw new Error(
      "Set GOOGLE_SERVICE_ACCOUNT_JSON (single-line or base64) or GOOGLE_SERVICE_ACCOUNT_JSON_PATH to a .json key file"
    );
  }

  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch (firstErr) {
    try {
      const decoded = Buffer.from(raw, "base64").toString("utf8").trim();
      if (!decoded) {
        throw new Error("base64 decoded to empty string");
      }
      return JSON.parse(decoded) as Record<string, string>;
    } catch {
      const hint =
        "Multi-line JSON in .env is not supported — only the first line loads. " +
        "Use GOOGLE_SERVICE_ACCOUNT_JSON_PATH=./google-service-account.json pointing at your downloaded key, " +
        "or minify JSON to one line / base64.";
      throw new Error(
        `GOOGLE_SERVICE_ACCOUNT_JSON: invalid JSON. ${hint} (${firstErr instanceof Error ? firstErr.message : String(firstErr)})`
      );
    }
  }
}

function getAuthClient() {
  const credentials = parseServiceAccountCredentials();

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

/** Same client as vote sync — use for reading private spreadsheets too. */
export function getGoogleSheetsClient() {
  return google.sheets({ version: "v4", auth: getAuthClient() });
}

function getOutputSheetId(): string {
  const id = process.env.VOTES_GOOGLE_SHEET_ID;
  if (!id) throw new Error("VOTES_GOOGLE_SHEET_ID is not configured");
  return id;
}

// ─── Raw Votes Sync (called on every vote) ──────────────────────────────────

export interface VoteRow {
  date: string;
  dayName: string;
  userName: string;
  userEmail: string;
  ratingOverall: number | null;
  starch: string | null;
  ratingStarch: number | null;
  veganProtein: string | null;
  ratingVeganProtein: number | null;
  veg: string | null;
  ratingVeg: number | null;
  protein1: string | null;
  ratingProtein1: number | null;
  protein2: string | null;
  ratingProtein2: number | null;
  comment: string | null;
  timestamp: string;
}

/**
 * Sync a single vote to the "Raw Votes" tab in Google Sheets.
 * Upserts by (date, email) — updates existing row or appends new one.
 */
export async function syncVoteToSheet(vote: VoteRow): Promise<void> {
  const sheets = getGoogleSheetsClient();
  const sheetId = getOutputSheetId();
  const range = "Raw Votes";

  // Read existing data to find if this (date, email) row exists
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${range}!A:R`,
  });

  const rows = existing.data.values || [];
  const rowValues = [
    vote.date,
    vote.dayName,
    vote.userName,
    vote.userEmail,
    vote.ratingOverall ?? "",
    vote.starch ?? "",
    vote.ratingStarch ?? "",
    vote.veganProtein ?? "",
    vote.ratingVeganProtein ?? "",
    vote.veg ?? "",
    vote.ratingVeg ?? "",
    vote.protein1 ?? "",
    vote.ratingProtein1 ?? "",
    vote.protein2 ?? "",
    vote.ratingProtein2 ?? "",
    vote.comment ?? "",
    vote.timestamp,
  ];

  // Find existing row by matching date (col A) + email (col D)
  let existingRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === vote.date && rows[i][3] === vote.userEmail) {
      existingRowIndex = i + 1; // 1-indexed for Sheets API
      break;
    }
  }

  if (existingRowIndex > 0) {
    // Update existing row
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${range}!A${existingRowIndex}:Q${existingRowIndex}`,
      valueInputOption: "RAW",
      requestBody: { values: [rowValues] },
    });
  } else {
    // Append new row
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${range}!A:Q`,
      valueInputOption: "RAW",
      requestBody: { values: [rowValues] },
    });
  }
}

// ─── Daily Summary Sync ─────────────────────────────────────────────────────

export interface DailySummaryRow {
  date: string;
  dayName: string;
  totalVotes: number;
  avgOverall: number;
  topDish: string;
  topDishRating: number;
  bottomDish: string;
  bottomDishRating: number;
}

export async function syncDailySummary(summary: DailySummaryRow): Promise<void> {
  const sheets = getGoogleSheetsClient();
  const sheetId = getOutputSheetId();
  const range = "Daily Summary";

  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${range}!A:H`,
  });
  const rows = existing.data.values || [];

  const rowValues = [
    summary.date,
    summary.dayName,
    summary.totalVotes,
    Math.round(summary.avgOverall * 100) / 100,
    summary.topDish,
    Math.round(summary.topDishRating * 100) / 100,
    summary.bottomDish,
    Math.round(summary.bottomDishRating * 100) / 100,
  ];

  let existingRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === summary.date) {
      existingRowIndex = i + 1;
      break;
    }
  }

  if (existingRowIndex > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${range}!A${existingRowIndex}:H${existingRowIndex}`,
      valueInputOption: "RAW",
      requestBody: { values: [rowValues] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${range}!A:H`,
      valueInputOption: "RAW",
      requestBody: { values: [rowValues] },
    });
  }
}

// ─── Initialize Sheet Tabs with Headers ─────────────────────────────────────

export async function initializeSheetTabs(): Promise<void> {
  const sheets = getGoogleSheetsClient();
  const sheetId = getOutputSheetId();

  const tabConfigs = [
    {
      name: "Raw Votes",
      headers: [
        "Date", "Day", "User Name", "User Email", "Overall Rating",
        "Starch", "Starch Rating", "Vegan Protein", "VP Rating",
        "Veg", "Veg Rating", "Protein 1", "P1 Rating",
        "Protein 2", "P2 Rating", "Comment", "Timestamp",
      ],
    },
    {
      name: "Daily Summary",
      headers: [
        "Date", "Day", "Total Votes", "Avg Overall",
        "Top Dish", "Top Dish Rating", "Bottom Dish", "Bottom Dish Rating",
      ],
    },
    {
      name: "Bi-Weekly Trends",
      headers: [
        "Period", "Date Range", "Avg Overall", "Best Day", "Best Day Menu",
        "Worst Day", "Worst Day Menu", "Top Dish (Category)", "Top Dish Rating",
        "Worst Dish (Category)", "Worst Dish Rating",
        "Rec: Order More", "Rec: Phase Out", "Rec: Replicate", "Rec: Improve",
      ],
    },
  ];

  for (const tab of tabConfigs) {
    try {
      // Check if headers already exist
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `'${tab.name}'!A1:A1`,
      });
      if (existing.data.values && existing.data.values.length > 0) continue;
    } catch {
      // Tab might not exist — that's ok, the append will work if it does
    }

    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `'${tab.name}'!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [tab.headers] },
      });
    } catch (err) {
      console.error(`Failed to initialize tab '${tab.name}':`, err);
    }
  }
}

// ─── Bi-Weekly Trends Sync ──────────────────────────────────────────────────

export interface BiWeeklyTrendsRow {
  period: string;
  dateRange: string;
  avgOverall: number;
  bestDay: string;
  bestDayMenu: string;
  worstDay: string;
  worstDayMenu: string;
  topDish: string;
  topDishRating: number;
  worstDish: string;
  worstDishRating: number;
  recOrderMore: string;
  recPhaseOut: string;
  recReplicate: string;
  recImprove: string;
}

export async function syncBiWeeklyTrends(trends: BiWeeklyTrendsRow): Promise<void> {
  const sheets = getGoogleSheetsClient();
  const sheetId = getOutputSheetId();
  const range = "Bi-Weekly Trends";

  const rowValues = [
    trends.period,
    trends.dateRange,
    Math.round(trends.avgOverall * 100) / 100,
    trends.bestDay,
    trends.bestDayMenu,
    trends.worstDay,
    trends.worstDayMenu,
    trends.topDish,
    Math.round(trends.topDishRating * 100) / 100,
    trends.worstDish,
    Math.round(trends.worstDishRating * 100) / 100,
    trends.recOrderMore,
    trends.recPhaseOut,
    trends.recReplicate,
    trends.recImprove,
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${range}!A:O`,
    valueInputOption: "RAW",
    requestBody: { values: [rowValues] },
  });
}

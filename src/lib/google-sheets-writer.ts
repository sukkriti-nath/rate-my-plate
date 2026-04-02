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
    const raw = fs.readFileSync(resolved, "utf8");
    return JSON.parse(raw) as Record<string, string>;
  }

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    throw new Error(
      "Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_JSON_PATH"
    );
  }

  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as Record<string, string>;
  }
}

export function getAuthClient() {
  const credentials = parseServiceAccountCredentials();

  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.file",
    ],
  });
}

/** Sheets API client — use for reading/writing spreadsheets. */
export function getSheetsClient() {
  return google.sheets({ version: "v4", auth: getAuthClient() });
}

function getOutputSheetId(): string {
  const id = process.env.VOTES_GOOGLE_SHEET_ID;
  if (!id) throw new Error("VOTES_GOOGLE_SHEET_ID is not configured");
  return id;
}

// ─── Write Queue (prevents race conditions on concurrent votes) ─────────────

let writeQueue: Promise<void> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const task = writeQueue.then(fn, fn); // run even if prior task failed
  writeQueue = task.then(() => {}, () => {}); // swallow to keep chain alive
  return task;
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

let headersInitialized = false;

/**
 * Sync a single vote to the "Raw Votes" tab in Google Sheets.
 * Upserts by (date, email) — updates existing row or appends new one.
 */
export function syncVoteToSheet(vote: VoteRow): Promise<void> {
  return enqueue(() => _syncVoteToSheet(vote));
}

async function _syncVoteToSheet(vote: VoteRow): Promise<void> {
  const sheets = getSheetsClient();
  const sheetId = getOutputSheetId();
  const range = "Raw Votes";

  // Ensure headers exist on first call
  if (!headersInitialized) {
    await initializeSheetTabs();
    headersInitialized = true;
  }

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

export function syncDailySummary(summary: DailySummaryRow): Promise<void> {
  return enqueue(() => _syncDailySummary(summary));
}

async function _syncDailySummary(summary: DailySummaryRow): Promise<void> {
  const sheets = getSheetsClient();
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
  const sheets = getSheetsClient();
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
    {
      name: "Friday Catering",
      headers: [
        "Date", "Restaurant", "Overall Rating", "Total Votes",
        "Top Dish", "Top Dish Rating", "Bottom Dish", "Bottom Dish Rating",
        "Starch", "Starch Rating", "Vegan Protein", "VP Rating",
        "Protein 1", "P1 Rating", "Protein 2", "P2 Rating",
      ],
    },
    {
      name: "Super Reviewers",
      headers: [
        "Rank", "Name", "Email", "Current Streak", "Longest Streak",
        "Last Vote Date", "Badge",
      ],
    },
  ];

  for (const tab of tabConfigs) {
    try {
      // Check if row 1 already has the correct headers
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `'${tab.name}'!A1:${String.fromCharCode(64 + tab.headers.length)}1`,
      });
      const firstRow = existing.data.values?.[0] || [];
      // Skip if headers already match
      if (firstRow.length > 0 && firstRow[0] === tab.headers[0] && firstRow[1] === tab.headers[1]) continue;
    } catch {
      // Tab might not exist yet — proceed to write headers
    }

    try {
      // Insert a row at the top for headers
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: sheetId,
      });
      const sheetTab = spreadsheet.data.sheets?.find(
        (s) => s.properties?.title === tab.name
      );
      if (sheetTab?.properties?.sheetId != null) {
        // Insert a blank row at position 0 to push existing data down
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheetId,
          requestBody: {
            requests: [{
              insertDimension: {
                range: {
                  sheetId: sheetTab.properties.sheetId,
                  dimension: "ROWS",
                  startIndex: 0,
                  endIndex: 1,
                },
              },
            }],
          },
        });
      }

      // Write headers to row 1
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
  dishRatings?: { category: string; dishName: string; avgRating: number; totalRatings: number; datesServed?: string[] }[];
}

export async function syncBiWeeklyTrends(trends: BiWeeklyTrendsRow): Promise<void> {
  const sheets = getSheetsClient();
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

  // Append dish ratings section below the trends data
  if (trends.dishRatings && trends.dishRatings.length > 0) {
    // Find the next empty row after existing data
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${range}'!A:A`,
    });
    const nextRow = (existing.data.values?.length ?? 1) + 2; // leave a gap

    const dishSection = [
      ["ALL DISHES SERVED (Mon-Thu)", "", "", "", ""],
      ["Category", "Dish", "Avg Rating", "# Ratings", "Date(s) Served"],
      ...trends.dishRatings.map((d) => [
        d.category,
        d.dishName,
        Math.round(d.avgRating * 100) / 100,
        d.totalRatings,
        (d.datesServed ?? []).join(", "),
      ]),
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `'${range}'!A${nextRow}`,
      valueInputOption: "RAW",
      requestBody: { values: dishSection },
    });
  }
}

// ─── Friday Catering Sync ─────────────────────────────────────────────────

export interface FridayCateringRow {
  date: string;
  restaurant: string;
  overallRating: number;
  totalVotes: number;
  topDish: string;
  topDishRating: number;
  bottomDish: string;
  bottomDishRating: number;
  starch: string | null;
  starchRating: number | null;
  veganProtein: string | null;
  vpRating: number | null;
  protein1: string | null;
  p1Rating: number | null;
  protein2: string | null;
  p2Rating: number | null;
}

export async function syncFridayCatering(row: FridayCateringRow): Promise<void> {
  const sheets = getSheetsClient();
  const sheetId = getOutputSheetId();
  const range = "Friday Catering";

  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${range}'!A:A`,
  });
  const rows = existing.data.values || [];

  const rowValues = [
    row.date,
    row.restaurant,
    Math.round(row.overallRating * 100) / 100,
    row.totalVotes,
    row.topDish,
    Math.round(row.topDishRating * 100) / 100,
    row.bottomDish,
    Math.round(row.bottomDishRating * 100) / 100,
    row.starch ?? "",
    row.starchRating ?? "",
    row.veganProtein ?? "",
    row.vpRating ?? "",
    row.protein1 ?? "",
    row.p1Rating ?? "",
    row.protein2 ?? "",
    row.p2Rating ?? "",
  ];

  // Upsert by date
  let existingRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === row.date) {
      existingRowIndex = i + 1;
      break;
    }
  }

  if (existingRowIndex > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `'${range}'!A${existingRowIndex}:P${existingRowIndex}`,
      valueInputOption: "RAW",
      requestBody: { values: [rowValues] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `'${range}'!A:P`,
      valueInputOption: "RAW",
      requestBody: { values: [rowValues] },
    });
  }
}

// ─── Super Reviewers Sync ─────────────────────────────────────────────────

export interface SuperReviewerRow {
  rank: number;
  userName: string;
  userEmail: string;
  currentStreak: number;
  longestStreak: number;
  lastVoteDate: string;
  monthlyVotes: number;
  badge: string;
}

/**
 * Overwrites the entire Super Reviewers tab with current leaderboard data.
 * Called periodically (e.g., after each vote or on a schedule).
 */
export async function syncSuperReviewers(reviewers: SuperReviewerRow[]): Promise<void> {
  const sheets = getSheetsClient();
  const sheetId = getOutputSheetId();
  const range = "Super Reviewers";

  const headers = [
    "Rank", "Name", "Email", "Current Streak", "Longest Streak",
    "Last Vote Date", "Monthly Votes", "Badge",
  ];

  const values = [
    headers,
    ...reviewers.map((r) => [
      r.rank,
      r.userName,
      r.userEmail,
      r.currentStreak,
      r.longestStreak,
      r.lastVoteDate,
      r.monthlyVotes,
      r.badge,
    ]),
  ];

  // Clear and rewrite the whole tab (leaderboard changes with every vote)
  await sheets.spreadsheets.values.clear({
    spreadsheetId: sheetId,
    range: `'${range}'!A:H`,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `'${range}'!A1`,
    valueInputOption: "RAW",
    requestBody: { values },
  });
}

// ─── PDF Export & Google Drive Upload ──────────────────────────────────────

const DRIVE_FOLDER_ID = "1AEA_wG2ySh4Q9NOgaiygrO_F3QL28qYy";

/**
 * Copy the "Bi-Weekly Trends" tab into a new Google Sheet in the Drive folder.
 * Returns the file ID and web link.
 */
export async function exportBiWeeklyTrendsSheet(
  dateRange: string
): Promise<{ fileId: string; webViewLink: string }> {
  const auth = getAuthClient();
  const sheetId = getOutputSheetId();
  const drive = google.drive({ version: "v3", auth });
  const sheets = getSheetsClient();

  // Get the sheet GID for the Bi-Weekly Trends tab
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const trendsTab = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === "Bi-Weekly Trends"
  );
  const trendsSheetId = trendsTab?.properties?.sheetId ?? 0;

  // Copy the entire spreadsheet to a new file
  const sanitizedRange = dateRange.replace(/\//g, "-");
  const fileName = `Bi-Weekly Trends: ${sanitizedRange}`;

  const copyResponse = await drive.files.copy({
    fileId: sheetId,
    requestBody: {
      name: fileName,
      parents: [DRIVE_FOLDER_ID],
    },
    fields: "id,webViewLink",
  });

  const newFileId = copyResponse.data.id!;

  // Remove all tabs except "Bi-Weekly Trends" from the copy
  const newSpreadsheet = await sheets.spreadsheets.get({ spreadsheetId: newFileId });
  const deleteRequests = (newSpreadsheet.data.sheets || [])
    .filter((s) => s.properties?.sheetId !== trendsSheetId)
    .map((s) => ({
      deleteSheet: { sheetId: s.properties!.sheetId! },
    }));

  if (deleteRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: newFileId,
      requestBody: { requests: deleteRequests },
    });
  }

  return {
    fileId: newFileId,
    webViewLink: copyResponse.data.webViewLink!,
  };
}

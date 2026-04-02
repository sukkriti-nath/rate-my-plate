import { google } from "googleapis";
import { getAuthClient, isGoogleServiceAccountConfigured } from "@/lib/google-sheets-writer";

/**
 * Read user data from the Super Reviewers tab in Rate my Plate: Raw Data.
 * This is the source of truth for user names and emails.
 */

const RATE_MY_PLATE_SHEET_ID = "1f8IlJw1Jsho1xEK0RA5037ATq9nHexEnTeQ2bI6n6F4";
const SUPER_REVIEWERS_TAB = "Super Reviewers";

export interface SuperReviewer {
  rank: number;
  name: string;
  email: string;
  currentStreak: number;
  longestStreak: number;
  lastVoteDate: string;
  badge: string;
}

let cachedReviewers: SuperReviewer[] | null = null;
let cacheTime: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get all super reviewers from the sheet.
 * Results are cached for 5 minutes.
 */
export async function getSuperReviewers(): Promise<SuperReviewer[]> {
  if (!isGoogleServiceAccountConfigured()) {
    return [];
  }

  // Return cached data if still valid
  if (cachedReviewers && Date.now() - cacheTime < CACHE_TTL_MS) {
    return cachedReviewers;
  }

  try {
    const sheets = google.sheets({ version: "v4", auth: getAuthClient() });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: RATE_MY_PLATE_SHEET_ID,
      range: `'${SUPER_REVIEWERS_TAB}'!A2:G500`, // Skip header, get up to 500 rows
    });

    const rows = res.data.values || [];
    cachedReviewers = rows
      .filter((row) => row[2]) // Must have email
      .map((row) => ({
        rank: parseInt(row[0]) || 0,
        name: row[1] || "",
        email: (row[2] || "").toLowerCase().trim(),
        currentStreak: parseInt(row[3]) || 0,
        longestStreak: parseInt(row[4]) || 0,
        lastVoteDate: row[5] || "",
        badge: row[6] || "",
      }));
    cacheTime = Date.now();

    return cachedReviewers;
  } catch (e) {
    console.error("[super-reviewers] Failed to fetch:", e);
    return cachedReviewers || [];
  }
}

/**
 * Look up a user by email.
 * Returns the user's display name and other info.
 */
export async function getUserByEmail(email: string): Promise<SuperReviewer | null> {
  const reviewers = await getSuperReviewers();
  const normalizedEmail = email.toLowerCase().trim();
  return reviewers.find((r) => r.email === normalizedEmail) || null;
}

/**
 * Get display name for an email, with fallback.
 */
export async function getDisplayNameByEmail(email: string, fallback?: string): Promise<string> {
  const user = await getUserByEmail(email);
  return user?.name || fallback || email.split("@")[0];
}

/**
 * Check if an email exists in Super Reviewers.
 */
export async function isValidReviewer(email: string): Promise<boolean> {
  const user = await getUserByEmail(email);
  return user !== null;
}

/**
 * Clear the cache (useful for testing or forcing refresh).
 */
export function clearSuperReviewersCache(): void {
  cachedReviewers = null;
  cacheTime = 0;
}

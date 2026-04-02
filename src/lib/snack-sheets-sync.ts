import { getSheetsClient, isGoogleServiceAccountConfigured } from "@/lib/google-sheets-writer";

/**
 * Snack Overflow data stored in Google Sheets (no Postgres).
 * This is the primary data layer - all reads and writes go to Google Sheets.
 */

export const SNACK_SHEETS_SPREADSHEET_ID =
  process.env.SNACK_VOTES_GOOGLE_SHEET_ID?.trim() ||
  "1kNTj7jrtHYGQuSpTlaeKA0-WhfEKsQIsm2IVZw5NUXw";

const TABS = {
  SUGGESTIONS: "Suggestions",
  SUGGESTION_VOTES: "Suggestion Votes",
  PROFILES: "Profiles",
  LEADERBOARD: "Leaderboard",
} as const;

function escapeSheetTitle(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

/**
 * Ensure a tab exists in the spreadsheet, creating it if needed.
 */
async function ensureTabExists(tabName: string): Promise<void> {
  if (!isGoogleServiceAccountConfigured()) return;

  try {
    const sheets = getSheetsClient();

    // Get list of existing sheets
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: SNACK_SHEETS_SPREADSHEET_ID,
      fields: "sheets.properties.title",
    });

    const existingTabs = meta.data.sheets?.map(s => s.properties?.title) || [];

    if (!existingTabs.includes(tabName)) {
      // Create the tab
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SNACK_SHEETS_SPREADSHEET_ID,
        requestBody: {
          requests: [{
            addSheet: {
              properties: { title: tabName }
            }
          }]
        }
      });
      console.log(`[snack-sheets] Created tab: ${tabName}`);
    }
  } catch (e) {
    console.error(`[snack-sheets] Failed to ensure tab ${tabName}:`, e);
  }
}

// ============== Suggestions ==============

export interface SnackSuggestion {
  id: string;
  snackName: string;
  submittedBy: string;
  submittedByName: string;
  upvotes: number;
  downvotes: number;
  userVote: "up" | "down" | null;
  createdAt: string;
}

function generateSuggestionId(): string {
  return `sug_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Get all suggestions from the sheet, with the current user's vote status.
 */
export async function getSuggestions(viewerUserId?: string): Promise<SnackSuggestion[]> {
  if (!isGoogleServiceAccountConfigured()) return [];

  try {
    // Ensure tabs exist
    await ensureTabExists(TABS.SUGGESTIONS);
    await ensureTabExists(TABS.SUGGESTION_VOTES);

    const sheets = getSheetsClient();

    // Get suggestions
    const suggestionsRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SNACK_SHEETS_SPREADSHEET_ID,
      range: `${escapeSheetTitle(TABS.SUGGESTIONS)}!A:G`,
    });
    const suggestionRows = suggestionsRes.data.values || [];

    // Get user votes to determine current user's vote on each suggestion
    let userVotes: Map<string, "up" | "down"> = new Map();
    if (viewerUserId) {
      try {
        const votesRes = await sheets.spreadsheets.values.get({
          spreadsheetId: SNACK_SHEETS_SPREADSHEET_ID,
          range: `${escapeSheetTitle(TABS.SUGGESTION_VOTES)}!A:C`,
        });
        const voteRows = votesRes.data.values || [];
        for (const row of voteRows) {
          if (row[1] === viewerUserId) {
            userVotes.set(row[0], row[2] as "up" | "down");
          }
        }
      } catch (e) {
        // Tab might not exist yet - that's ok, just no votes recorded
        console.warn("[snack-sheets] Could not read Suggestion Votes tab:", e);
      }
    }

    // Skip header row if present
    const dataRows = suggestionRows.length > 0 && suggestionRows[0][0] === "id"
      ? suggestionRows.slice(1)
      : suggestionRows;

    return dataRows
      .filter(row => row[0]) // Must have an ID
      .map((row) => ({
        id: row[0] || "",
        snackName: row[1] || "",
        submittedBy: row[2] || "",
        submittedByName: row[3] || "",
        upvotes: parseInt(row[4]) || 0,
        downvotes: parseInt(row[5]) || 0,
        createdAt: row[6] || "",
        userVote: userVotes.get(row[0]) || null,
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (e) {
    console.error("[snack-sheets] getSuggestions failed:", e);
    return [];
  }
}

/**
 * Add a new suggestion to the sheet.
 * Automatically upvotes the suggestion by the submitter.
 */
export async function addSuggestion(
  snackName: string,
  submittedBy: string,
  submittedByName: string
): Promise<SnackSuggestion> {
  const id = generateSuggestionId();
  const createdAt = new Date().toISOString();

  if (isGoogleServiceAccountConfigured()) {
    try {
      // Ensure tabs exist
      await ensureTabExists(TABS.SUGGESTIONS);
      await ensureTabExists(TABS.SUGGESTION_VOTES);

      const sheets = getSheetsClient();

      // Add suggestion with 1 upvote (auto-upvote by submitter)
      await sheets.spreadsheets.values.append({
        spreadsheetId: SNACK_SHEETS_SPREADSHEET_ID,
        range: `${escapeSheetTitle(TABS.SUGGESTIONS)}!A:G`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [[id, snackName, submittedBy, submittedByName, 1, 0, createdAt]],
        },
      });

      // Record the submitter's upvote in the votes tab
      await sheets.spreadsheets.values.append({
        spreadsheetId: SNACK_SHEETS_SPREADSHEET_ID,
        range: `${escapeSheetTitle(TABS.SUGGESTION_VOTES)}!A:C`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [[id, submittedBy, "up"]],
        },
      });
    } catch (e) {
      console.error("[snack-sheets] addSuggestion failed:", e);
      throw e;
    }
  }

  return {
    id,
    snackName,
    submittedBy,
    submittedByName,
    upvotes: 1,
    downvotes: 0,
    userVote: "up",
    createdAt,
  };
}

/**
 * Vote on a suggestion. Handles:
 * - New vote: adds the vote
 * - Same vote again: removes the vote (toggle off)
 * - Different vote: switches the vote
 */
export async function voteSuggestion(
  suggestionId: string,
  userId: string,
  vote: "up" | "down"
): Promise<void> {
  if (!isGoogleServiceAccountConfigured()) return;

  try {
    // Ensure tabs exist
    await ensureTabExists(TABS.SUGGESTION_VOTES);

    const sheets = getSheetsClient();
    const tab = escapeSheetTitle(TABS.SUGGESTION_VOTES);
    const suggestionsTab = escapeSheetTitle(TABS.SUGGESTIONS);

    // Get all votes to find if user already voted
    const votesRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SNACK_SHEETS_SPREADSHEET_ID,
      range: `${tab}!A:C`,
    });
    const voteRows = votesRes.data.values || [];

    // Find existing vote by this user on this suggestion
    let existingVoteIndex = -1;
    let existingVote: "up" | "down" | null = null;
    for (let i = 0; i < voteRows.length; i++) {
      if (voteRows[i][0] === suggestionId && voteRows[i][1] === userId) {
        existingVoteIndex = i;
        existingVote = voteRows[i][2] as "up" | "down";
        break;
      }
    }

    // Get suggestions to find the row to update vote counts
    const suggestionsRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SNACK_SHEETS_SPREADSHEET_ID,
      range: `${suggestionsTab}!A:G`,
    });
    const suggestionRows = suggestionsRes.data.values || [];

    // Find the suggestion row
    let suggestionRowIndex = -1;
    let currentUpvotes = 0;
    let currentDownvotes = 0;
    for (let i = 0; i < suggestionRows.length; i++) {
      if (suggestionRows[i][0] === suggestionId) {
        suggestionRowIndex = i;
        currentUpvotes = parseInt(suggestionRows[i][4]) || 0;
        currentDownvotes = parseInt(suggestionRows[i][5]) || 0;
        break;
      }
    }

    if (suggestionRowIndex === -1) {
      console.warn(`[snack-sheets] Suggestion ${suggestionId} not found`);
      return;
    }

    let newUpvotes = currentUpvotes;
    let newDownvotes = currentDownvotes;

    if (existingVote === vote) {
      // Same vote = remove vote (toggle off)
      if (vote === "up") newUpvotes--;
      else newDownvotes--;

      // Delete the vote row by clearing it (sheets don't easily delete rows)
      // We'll clear the row and filter out empty rows when reading
      if (existingVoteIndex >= 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SNACK_SHEETS_SPREADSHEET_ID,
          range: `${tab}!A${existingVoteIndex + 1}:C${existingVoteIndex + 1}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [["", "", ""]] },
        });
      }
    } else if (existingVote) {
      // Different vote = switch
      if (vote === "up") {
        newUpvotes++;
        newDownvotes--;
      } else {
        newUpvotes--;
        newDownvotes++;
      }

      // Update the vote row
      await sheets.spreadsheets.values.update({
        spreadsheetId: SNACK_SHEETS_SPREADSHEET_ID,
        range: `${tab}!A${existingVoteIndex + 1}:C${existingVoteIndex + 1}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[suggestionId, userId, vote]] },
      });
    } else {
      // New vote
      if (vote === "up") newUpvotes++;
      else newDownvotes++;

      // Append new vote row
      await sheets.spreadsheets.values.append({
        spreadsheetId: SNACK_SHEETS_SPREADSHEET_ID,
        range: `${tab}!A:C`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [[suggestionId, userId, vote]] },
      });
    }

    // Update suggestion vote counts
    await sheets.spreadsheets.values.update({
      spreadsheetId: SNACK_SHEETS_SPREADSHEET_ID,
      range: `${suggestionsTab}!E${suggestionRowIndex + 1}:F${suggestionRowIndex + 1}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[newUpvotes, newDownvotes]] },
    });
  } catch (e) {
    console.error("[snack-sheets] voteSuggestion failed:", e);
    throw e;
  }
}

// ============== Profiles ==============

export interface SnackProfile {
  email: string;
  displayName: string;
  drinksAllocation: Record<string, number>;
  snacksAllocation: Record<string, number>;
  favoriteDrinks: string[];
  favoriteSnacks: string[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get a profile by email.
 */
export async function getProfile(email: string): Promise<SnackProfile | null> {
  if (!isGoogleServiceAccountConfigured()) return null;

  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SNACK_SHEETS_SPREADSHEET_ID,
      range: `${escapeSheetTitle(TABS.PROFILES)}!A:I`,
    });

    const rows = res.data.values || [];
    const normalizedEmail = email.toLowerCase().trim();

    for (const row of rows) {
      if ((row[0] || "").toLowerCase().trim() === normalizedEmail) {
        return {
          email: row[0] || "",
          displayName: row[1] || "",
          drinksAllocation: row[2] ? JSON.parse(row[2]) : {},
          snacksAllocation: row[3] ? JSON.parse(row[3]) : {},
          favoriteDrinks: row[4] ? row[4].split(", ").filter(Boolean) : [],
          favoriteSnacks: row[5] ? row[5].split(", ").filter(Boolean) : [],
          isPublic: row[6] === "TRUE",
          createdAt: row[7] || "",
          updatedAt: row[8] || "",
        };
      }
    }
    return null;
  } catch (e) {
    console.error("[snack-sheets] getProfile failed:", e);
    return null;
  }
}

/**
 * Upsert a profile to the Profiles sheet.
 */
export async function upsertProfile(profile: SnackProfile): Promise<void> {
  if (!isGoogleServiceAccountConfigured()) return;

  try {
    await ensureTabExists(TABS.PROFILES);

    const sheets = getSheetsClient();
    const tab = escapeSheetTitle(TABS.PROFILES);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SNACK_SHEETS_SPREADSHEET_ID,
      range: `${tab}!A:I`,
    });

    const rows = res.data.values || [];
    const normalizedEmail = profile.email.toLowerCase().trim();
    const rowIndex = rows.findIndex((r) => (r[0] || "").toLowerCase().trim() === normalizedEmail);

    const values = [
      profile.email,
      profile.displayName,
      JSON.stringify(profile.drinksAllocation),
      JSON.stringify(profile.snacksAllocation),
      profile.favoriteDrinks.join(", "),
      profile.favoriteSnacks.join(", "),
      profile.isPublic ? "TRUE" : "FALSE",
      profile.createdAt,
      profile.updatedAt,
    ];

    if (rowIndex === -1) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SNACK_SHEETS_SPREADSHEET_ID,
        range: `${tab}!A:I`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [values] },
      });
    } else {
      const rowNum = rowIndex + 1;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SNACK_SHEETS_SPREADSHEET_ID,
        range: `${tab}!A${rowNum}:I${rowNum}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [values] },
      });
    }
  } catch (e) {
    console.error("[snack-sheets] upsertProfile failed:", e);
    throw e;
  }
}

/**
 * Get all profiles.
 */
export async function getAllProfiles(): Promise<SnackProfile[]> {
  if (!isGoogleServiceAccountConfigured()) return [];

  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SNACK_SHEETS_SPREADSHEET_ID,
      range: `${escapeSheetTitle(TABS.PROFILES)}!A:I`,
    });

    const rows = res.data.values || [];
    // Skip header if present
    const dataRows = rows.length > 0 && rows[0][0]?.toLowerCase() === "email"
      ? rows.slice(1)
      : rows;

    return dataRows
      .filter(row => row[0]) // Must have email
      .map((row) => ({
        email: row[0] || "",
        displayName: row[1] || "",
        drinksAllocation: row[2] ? JSON.parse(row[2]) : {},
        snacksAllocation: row[3] ? JSON.parse(row[3]) : {},
        favoriteDrinks: row[4] ? row[4].split(", ").filter(Boolean) : [],
        favoriteSnacks: row[5] ? row[5].split(", ").filter(Boolean) : [],
        isPublic: row[6] === "TRUE",
        createdAt: row[7] || "",
        updatedAt: row[8] || "",
      }));
  } catch (e) {
    console.error("[snack-sheets] getAllProfiles failed:", e);
    return [];
  }
}

// ============== Leaderboard ==============

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  points: number;
  actions: Record<string, number>;
  updatedAt: string;
}

export const POINTS = {
  profile_create: 10,
  profile_update: 5,
  weekly_vote: 3,
  suggestion: 2,
  out_of_stock: 1,
};

/**
 * Award points to a user.
 */
export async function awardPoints(
  userId: string,
  action: keyof typeof POINTS,
  displayName: string
): Promise<void> {
  if (!isGoogleServiceAccountConfigured()) return;

  try {
    await ensureTabExists(TABS.LEADERBOARD);

    const sheets = getSheetsClient();
    const tab = escapeSheetTitle(TABS.LEADERBOARD);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SNACK_SHEETS_SPREADSHEET_ID,
      range: `${tab}!A:I`,
    });

    const rows = res.data.values || [];
    const rowIndex = rows.findIndex((r) => r[0] === userId);

    const pointsAwarded = POINTS[action];
    const now = new Date().toISOString();

    if (rowIndex === -1) {
      // New entry
      const actions: Record<string, number> = { [action]: 1 };
      const values = [
        userId,
        displayName,
        pointsAwarded,
        actions.profile_create || 0,
        actions.profile_update || 0,
        actions.weekly_vote || 0,
        actions.suggestion || 0,
        actions.out_of_stock || 0,
        now,
      ];
      await sheets.spreadsheets.values.append({
        spreadsheetId: SNACK_SHEETS_SPREADSHEET_ID,
        range: `${tab}!A:I`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [values] },
      });
    } else {
      // Update existing
      const row = rows[rowIndex];
      const currentPoints = parseInt(row[2]) || 0;
      const actions = {
        profile_create: parseInt(row[3]) || 0,
        profile_update: parseInt(row[4]) || 0,
        weekly_vote: parseInt(row[5]) || 0,
        suggestion: parseInt(row[6]) || 0,
        out_of_stock: parseInt(row[7]) || 0,
      };
      actions[action] = (actions[action] || 0) + 1;

      const values = [
        userId,
        displayName,
        currentPoints + pointsAwarded,
        actions.profile_create,
        actions.profile_update,
        actions.weekly_vote,
        actions.suggestion,
        actions.out_of_stock,
        now,
      ];

      const rowNum = rowIndex + 1;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SNACK_SHEETS_SPREADSHEET_ID,
        range: `${tab}!A${rowNum}:I${rowNum}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [values] },
      });
    }
  } catch (e) {
    console.error("[snack-sheets] awardPoints failed:", e);
  }
}

/**
 * Get leaderboard entries.
 */
export async function getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  if (!isGoogleServiceAccountConfigured()) return [];

  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SNACK_SHEETS_SPREADSHEET_ID,
      range: `${escapeSheetTitle(TABS.LEADERBOARD)}!A:I`,
    });

    const rows = res.data.values || [];
    // Skip header if present
    const dataRows = rows.length > 0 && rows[0][0]?.toLowerCase() === "user_id"
      ? rows.slice(1)
      : rows;

    return dataRows
      .filter(row => row[0])
      .map((row) => ({
        userId: row[0] || "",
        displayName: row[1] || "",
        points: parseInt(row[2]) || 0,
        actions: {
          profile_create: parseInt(row[3]) || 0,
          profile_update: parseInt(row[4]) || 0,
          weekly_vote: parseInt(row[5]) || 0,
          suggestion: parseInt(row[6]) || 0,
          out_of_stock: parseInt(row[7]) || 0,
        },
        updatedAt: row[8] || "",
      }))
      .sort((a, b) => b.points - a.points)
      .slice(0, limit);
  } catch (e) {
    console.error("[snack-sheets] getLeaderboard failed:", e);
    return [];
  }
}

// ============== Helper: Web user ID ==============

export function getWebSnackProfileUserId(email: string): string {
  return `web:${email.trim().toLowerCase()}`;
}

// ============== Stats ==============

export async function getSnackStats(): Promise<{
  profileCount: number;
  suggestionCount: number;
  totalPoints: number;
}> {
  const [profiles, suggestions, leaderboard] = await Promise.all([
    getAllProfiles(),
    getSuggestions(),
    getLeaderboard(1000),
  ]);

  const totalPoints = leaderboard.reduce((sum, entry) => sum + entry.points, 0);

  return {
    profileCount: profiles.length,
    suggestionCount: suggestions.length,
    totalPoints,
  };
}

const CATEGORY_EMOJIS: Record<string, string> = {
  "Coffee & Lattes": "☕",
  "Cold Brew Latte": "☕",
  "Tea": "🍵",
  "Yerba Mate": "🧉",
  "Juice": "🧃",
  "Energy Drinks": "⚡",
  "Energy Drink": "⚡",
  "Sparkling & Soda": "🥤",
  "Water": "💧",
  "Enhanced Water": "💧",
  "Milk Tea": "🥛",
  "Protein Drinks": "💪",
  "Wellness Shots": "🌿",
  "Baked Goods": "🍪",
  "Chocolate & Candy": "🍫",
  "Chips": "🥜",
  "Popcorn & Crackers": "🍿",
  "Protein Bars": "💪",
  "Snack Bars": "🍫",
  "Granola & Oatmeal": "🥗",
  "Fruit Snacks": "🍎",
  "Gummies": "🍬",
  "Jerky": "🥩",
  "Meat Jerky & Sticks": "🥩",
  "Seaweed": "🌊",
  "Trail Mix & Nuts": "🥾",
};

export async function getCategoryDemand(): Promise<
  { category: string; emoji: string; tokens: number; percent: number }[]
> {
  const profiles = await getAllProfiles();
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

export async function getMostWantedItems(
  limit = 10
): Promise<{ item: string; score: number }[]> {
  const profiles = await getAllProfiles();
  const itemScores: Record<string, number> = {};

  for (const profile of profiles) {
    for (let i = 0; i < profile.favoriteDrinks.length; i++) {
      const score = (5 - i) * 3;
      itemScores[profile.favoriteDrinks[i]] =
        (itemScores[profile.favoriteDrinks[i]] || 0) + score;
    }
    for (let i = 0; i < profile.favoriteSnacks.length; i++) {
      const score = (5 - i) * 3;
      itemScores[profile.favoriteSnacks[i]] =
        (itemScores[profile.favoriteSnacks[i]] || 0) + score;
    }
  }

  return Object.entries(itemScores)
    .map(([item, score]) => ({ item, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function getPublicProfiles(): Promise<SnackProfile[]> {
  const profiles = await getAllProfiles();
  return profiles.filter((p) => p.isPublic);
}

/**
 * Get profile by Slack user ID (for Slack bot compatibility).
 * Slack profiles use the user ID directly as the key.
 */
export async function getProfileBySlackId(slackUserId: string): Promise<SnackProfile | null> {
  if (!isGoogleServiceAccountConfigured()) return null;

  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SNACK_SHEETS_SPREADSHEET_ID,
      range: `${escapeSheetTitle(TABS.PROFILES)}!A:I`,
    });

    const rows = res.data.values || [];
    // Slack profiles might be stored with the Slack ID as identifier
    for (const row of rows) {
      if (row[0] === slackUserId || (row[0] || "").toLowerCase().trim() === slackUserId.toLowerCase()) {
        return {
          email: row[0] || "",
          displayName: row[1] || "",
          drinksAllocation: row[2] ? JSON.parse(row[2]) : {},
          snacksAllocation: row[3] ? JSON.parse(row[3]) : {},
          favoriteDrinks: row[4] ? row[4].split(", ").filter(Boolean) : [],
          favoriteSnacks: row[5] ? row[5].split(", ").filter(Boolean) : [],
          isPublic: row[6] === "TRUE",
          createdAt: row[7] || "",
          updatedAt: row[8] || "",
        };
      }
    }
    return null;
  } catch (e) {
    console.error("[snack-sheets] getProfileBySlackId failed:", e);
    return null;
  }
}

/**
 * Upsert profile for Slack users (uses Slack user ID as key).
 */
export async function upsertSlackProfile(profile: {
  slackUserId: string;
  displayName: string;
  drinksAllocation: Record<string, number>;
  snacksAllocation: Record<string, number>;
  favoriteDrinks: string[];
  favoriteSnacks: string[];
  isPublic: boolean;
}): Promise<void> {
  const now = new Date().toISOString();
  const existing = await getProfileBySlackId(profile.slackUserId);

  await upsertProfile({
    email: profile.slackUserId, // Use Slack ID as the key for Slack users
    displayName: profile.displayName,
    drinksAllocation: profile.drinksAllocation,
    snacksAllocation: profile.snacksAllocation,
    favoriteDrinks: profile.favoriteDrinks,
    favoriteSnacks: profile.favoriteSnacks,
    isPublic: profile.isPublic,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });
}

// ============== Out of Stock Reports ==============

const OUT_OF_STOCK_TAB = "Out of Stock";

export async function reportOutOfStock(
  snackName: string,
  reportedBy: string,
  category?: string
): Promise<void> {
  if (!isGoogleServiceAccountConfigured()) return;

  try {
    const sheets = getSheetsClient();
    const now = new Date().toISOString();

    await sheets.spreadsheets.values.append({
      spreadsheetId: SNACK_SHEETS_SPREADSHEET_ID,
      range: `${escapeSheetTitle(OUT_OF_STOCK_TAB)}!A:D`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[snackName, category || "", reportedBy, now]],
      },
    });
  } catch (e) {
    console.error("[snack-sheets] reportOutOfStock failed:", e);
  }
}

// ============== Weekly Snack Survey ==============

const WEEKLY_VOTES_TAB = "Weekly Votes";

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

/**
 * Record a user's top 5 snack picks for the week.
 * Returns whether this was the user's first vote this week.
 */
export async function recordSnackTop5Vote(
  weekId: string,
  userId: string,
  picks: string[],
  options?: { displayName?: string }
): Promise<{ isNewVoter: boolean }> {
  if (picks.length !== 5 || new Set(picks).size !== 5) {
    throw new Error("Exactly 5 distinct snacks required");
  }

  if (!isGoogleServiceAccountConfigured()) {
    return { isNewVoter: false };
  }

  try {
    const sheets = getSheetsClient();
    const tab = escapeSheetTitle(WEEKLY_VOTES_TAB);
    const now = new Date().toISOString();
    const displayName = options?.displayName || "";

    // Check if user already voted this week
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SNACK_SHEETS_SPREADSHEET_ID,
      range: `${tab}!A:I`,
    });

    const rows = res.data.values || [];
    let existingRowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][1] === weekId && rows[i][2] === userId) {
        existingRowIndex = i;
        break;
      }
    }

    const isNewVoter = existingRowIndex === -1;

    // Columns: timestamp, week_id, slack_user_id, display_name, rank1, rank2, rank3, rank4, rank5
    const values = [now, weekId, userId, displayName, ...picks];

    if (isNewVoter) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SNACK_SHEETS_SPREADSHEET_ID,
        range: `${tab}!A:I`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [values] },
      });
    } else {
      // Update existing row
      const rowNum = existingRowIndex + 1;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SNACK_SHEETS_SPREADSHEET_ID,
        range: `${tab}!A${rowNum}:I${rowNum}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [values] },
      });
    }

    return { isNewVoter };
  } catch (e) {
    console.error("[snack-sheets] recordSnackTop5Vote failed:", e);
    return { isNewVoter: false };
  }
}

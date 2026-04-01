import { getGoogleSheetsClient, isGoogleServiceAccountConfigured } from "@/lib/google-sheets-writer";

/**
 * Append-only log of Slack “top 5” votes to a dedicated spreadsheet (separate from inventory SNACK_SHEET_*).
 * Share the doc with the same service account as GOOGLE_SERVICE_ACCOUNT_JSON / *_PATH (Editor).
 */

export const DEFAULT_SNACK_VOTES_SHEET_ID =
  "1kNTj7jrtHYGQuSpTlaeKA0-WhfEKsQIsm2IVZw5NUXw";

const HEADER_ROW = [
  "timestamp_utc",
  "week_id",
  "slack_user_id",
  "display_name",
  "rank_1_5pts",
  "rank_2_4pts",
  "rank_3_3pts",
  "rank_4_2pts",
  "rank_5_1pt",
] as const;

function escapeSheetTitleForRange(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

export function getVotesSpreadsheetId(): string {
  return (
    process.env.SNACK_VOTES_GOOGLE_SHEET_ID?.trim() ||
    DEFAULT_SNACK_VOTES_SHEET_ID
  );
}

/** First tab is usually “Sheet1” on a new doc; override with SNACK_VOTES_SHEET_TAB. */
export function getVotesTabName(): string {
  return process.env.SNACK_VOTES_SHEET_TAB?.trim() || "Sheet1";
}

/** For health checks / `/api/snacks/test?action=votes-sheet`. */
export function getSnackVotesSheetDebugInfo(): {
  spreadsheetId: string;
  tab: string;
  hasCredentials: boolean;
} {
  return {
    spreadsheetId: getVotesSpreadsheetId(),
    tab: getVotesTabName(),
    hasCredentials: isGoogleServiceAccountConfigured(),
  };
}

let headerEnsuredFor: string | null = null;

async function ensureHeaderRow(spreadsheetId: string, tab: string): Promise<void> {
  const key = `${spreadsheetId}:${tab}`;
  if (headerEnsuredFor === key) return;

  const sheets = getGoogleSheetsClient();
  const range = `${escapeSheetTitleForRange(tab)}!A1:I1`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const row = res.data.values?.[0];
  if (row?.[0]) {
    headerEnsuredFor = key;
    return;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[...HEADER_ROW]] },
  });
  headerEnsuredFor = key;
}

export type SnackVoteSheetRow = {
  at: string;
  weekId: string;
  userId: string;
  displayName: string;
  picks: string[];
};

/**
 * Appends one row per submission (re-votes in the same week append another row — audit trail).
 * No-op if no service account env is configured.
 */
export async function appendSnackVoteToGoogleSheet(
  row: SnackVoteSheetRow
): Promise<void> {
  if (!isGoogleServiceAccountConfigured()) {
    return;
  }

  const spreadsheetId = getVotesSpreadsheetId();
  const tab = getVotesTabName();
  const padded: string[] = row.picks.slice(0, 5);
  while (padded.length < 5) padded.push("");

  await ensureHeaderRow(spreadsheetId, tab);

  const sheets = getGoogleSheetsClient();
  const range = `${escapeSheetTitleForRange(tab)}!A:I`;
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [
        [
          row.at,
          row.weekId,
          row.userId,
          row.displayName,
          padded[0],
          padded[1],
          padded[2],
          padded[3],
          padded[4],
        ],
      ],
    },
  });
}

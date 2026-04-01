import Papa from "papaparse";
import { SNACKS, getItemName } from "@/lib/snack-inventory";
import { getGoogleSheetsClient } from "@/lib/google-sheets-writer";

/**
 * Kikoff Snack and Bev Inventory sheet layout (see tab “External” / gid=0):
 * https://docs.google.com/spreadsheets/d/1LwDGuGMNLhOx0QCJoBgRkQDRZREoQk34jBGCjw8QRm0/edit
 *
 * Row 1: Category | Brand | Flavor | Pack Size | &lt;date columns with stock levels&gt;
 * Each product row is one beverage/snack line; we use Brand + Flavor as the display name
 * (same pattern as `getItemName` in snack-inventory).
 *
 * **Private sheets:** use the same `GOOGLE_SERVICE_ACCOUNT_JSON` as vote sync / Rate My Plate
 * (`google-sheets-writer.ts`). Share the spreadsheet with that service account’s `client_email`
 * (Viewer is enough). Reads use the Sheets API v4; if that fails, we fall back to public CSV export.
 */

/** Default = Kikoff inventory doc; override with SNACK_SHEET_ID / SNACK_SHEET_GID. */
export const DEFAULT_SNACK_SHEET_ID =
  "1LwDGuGMNLhOx0QCJoBgRkQDRZREoQk34jBGCjw8QRm0";

function escapeSheetTitleForRange(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

/** Read tab by gid using the same service account as `google-sheets-writer` (works for private docs). */
async function fetchSheetRowsViaGoogleApi(
  spreadsheetId: string,
  gid: string
): Promise<string[][]> {
  const sheets = getGoogleSheetsClient();
  const gidNum = parseInt(gid, 10);
  if (Number.isNaN(gidNum)) {
    throw new Error(`Invalid SNACK_SHEET_GID: ${gid}`);
  }
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });
  const sheet = meta.data.sheets?.find(
    (s) => s.properties?.sheetId === gidNum
  );
  const title = sheet?.properties?.title;
  if (!title) {
    throw new Error(`No tab with gid ${gid} in spreadsheet`);
  }
  const range = `${escapeSheetTitleForRange(title)}!A:ZZ`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  return (res.data.values as string[][]) || [];
}

async function fetchSheetCsv(sheetId: string, gid: string): Promise<string[][]> {
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  const response = await fetch(csvUrl, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Failed to fetch snack sheet: ${response.status}`);
  }
  const csvText = await response.text();
  const parsed = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: "greedy",
  });
  return parsed.data;
}

function normCell(s: string | undefined): string {
  return (s ?? "").trim();
}

/** Kikoff-style grid with Brand + Flavor columns. */
function parseKikoffInventoryRows(rows: string[][]): string[] | null {
  if (rows.length < 2) return null;
  const header = rows[0].map((c) => normCell(c).toLowerCase());
  const brandIdx = header.indexOf("brand");
  const flavorIdx = header.indexOf("flavor");
  if (brandIdx < 0 || flavorIdx < 0) return null;

  const names: string[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row?.length) continue;
    const brand = normCell(row[brandIdx]);
    const flavor = normCell(row[flavorIdx]);
    if (!brand && !flavor) continue;

    const firstCol = normCell(row[0]);
    if (
      /quotes are not sourced|disclaimer|browser error/i.test(firstCol) ||
      firstCol.length > 120
    ) {
      continue;
    }

    const name = `${brand} ${flavor}`.trim();
    if (name.length > 0 && name.length <= 200) {
      names.push(name);
    }
  }
  return [...new Set(names)];
}

/** Legacy: column A = one label per row (optional header Name/Snack). */
function parseSnackColumn(rows: string[][]): string[] {
  const names: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const cell = rows[i]?.[0]?.trim();
    if (!cell) continue;
    if (i === 0 && /^(name|snack|item|product)$/i.test(cell)) continue;
    if (/quotes are not sourced|disclaimer/i.test(cell)) continue;
    names.push(cell);
  }
  return [...new Set(names)];
}

function parseSheetRowsToProductNames(rows: string[][]): string[] {
  const kikoff = parseKikoffInventoryRows(rows);
  if (kikoff && kikoff.length > 0) return kikoff;
  return parseSnackColumn(rows);
}

async function fetchSheetRows(spreadsheetId: string, gid: string): Promise<string[][]> {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()) {
    try {
      return await fetchSheetRowsViaGoogleApi(spreadsheetId, gid);
    } catch (apiErr) {
      console.warn(
        "Snack sheet: Sheets API read failed (is the doc shared with the service account?). Trying public CSV:",
        apiErr
      );
      try {
        return await fetchSheetCsv(spreadsheetId, gid);
      } catch {
        throw apiErr;
      }
    }
  }
  return fetchSheetCsv(spreadsheetId, gid);
}

/** Load product names (Brand + Flavor) from Google Sheet. */
export async function fetchSnackNamesFromSheet(): Promise<string[]> {
  const sheetId = process.env.SNACK_SHEET_ID?.trim() || DEFAULT_SNACK_SHEET_ID;
  const gid = process.env.SNACK_SHEET_GID?.trim() || "0";
  const rows = await fetchSheetRows(sheetId, gid);
  return parseSheetRowsToProductNames(rows);
}

/** In-memory cache so Slack interactivity can answer within ~3s (sheet fetch is slow). */
let surveyNamesCache: { names: string[]; fetchedAt: number } | null = null;
const SURVEY_CACHE_MS = 60 * 60 * 1000; // 1h

function resolveSurveyNamesFromFetch(names: string[]): string[] {
  if (names.length === 0) {
    console.warn("Snack sheet returned no products; falling back to embedded SNACKS");
    return SNACKS.map(getItemName);
  }
  return names;
}

/**
 * Names for the weekly survey: Kikoff sheet by default; cached ~1h. Call `warmSnackSurveyCache()`
 * when posting the survey message so the first button click is fast.
 */
export async function getSnackNamesForSurvey(): Promise<string[]> {
  if (surveyNamesCache && Date.now() - surveyNamesCache.fetchedAt < SURVEY_CACHE_MS) {
    return surveyNamesCache.names;
  }
  try {
    const names = resolveSurveyNamesFromFetch(await fetchSnackNamesFromSheet());
    surveyNamesCache = { names, fetchedAt: Date.now() };
    return names;
  } catch (e) {
    console.error("Snack sheet fetch failed; falling back to embedded SNACKS", e);
    const fallback = SNACKS.map(getItemName);
    surveyNamesCache = { names: fallback, fetchedAt: Date.now() };
    return fallback;
  }
}

/** Prefetch sheet into cache (e.g. right before `postSnackMessage` with survey blocks). */
export async function warmSnackSurveyCache(): Promise<void> {
  await getSnackNamesForSurvey();
}

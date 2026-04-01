import Papa from "papaparse";
import { SNACKS, getItemName } from "@/lib/snack-inventory";
import {
  getGoogleSheetsClient,
  isGoogleServiceAccountConfigured,
} from "@/lib/google-sheets-writer";

/**
 * Kikoff Snack and Bev Inventory sheet layout:
 * https://docs.google.com/spreadsheets/d/1LwDGuGMNLhOx0QCJoBgRkQDRZREoQk34jBGCjw8QRm0/edit
 *
 * Row 1: Category | Brand | Flavor | Pack Size | &lt;date columns with stock levels&gt;
 * Each product row is one beverage/snack line; we use Brand + Flavor as the display name
 * (same pattern as `getItemName` in snack-inventory).
 *
 * **Multiple tabs (snacks + bevs):** set `SNACK_SHEET_GIDS` to comma-separated gids from each tab’s URL,
 * or rely on auto-discovery when `GOOGLE_SERVICE_ACCOUNT_JSON` is set and the workbook has tabs named
 * **Beverages** and **Snacks** (case-insensitive). Otherwise the first tab only (`gid=0`).
 *
 * **Private sheets:** use the same `GOOGLE_SERVICE_ACCOUNT_JSON` as vote sync / Rate My Plate
 * (`google-sheets-writer.ts`). Share the spreadsheet with that service account’s `client_email`
 * (Viewer is enough). Reads use the Sheets API v4; if that fails, we fall back to public CSV export
 * (CSV is single-tab — use explicit `SNACK_SHEET_GIDS` if you need multiple tabs without the API).
 */

/** Default = Kikoff inventory doc; override with SNACK_SHEET_ID / SNACK_SHEET_GID(S). */
export const DEFAULT_SNACK_SHEET_ID =
  "1LwDGuGMNLhOx0QCJoBgRkQDRZREoQk34jBGCjw8QRm0";

const DEFAULT_SNACK_GIDS_FALLBACK: string[] = ["0"];

/** Merge tab lists in order; duplicate Brand+Flavor across tabs appear once (first tab wins). */
function mergeNameLists(lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const n of list) {
      if (seen.has(n)) continue;
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

/**
 * Explicit gids: `SNACK_SHEET_GIDS=0,123456789` (comma-separated).
 * Single tab: `SNACK_SHEET_GID=0` (still supported).
 * If neither is set, we try to auto-detect tabs named "Beverages" and "Snacks" (see below).
 */
function parseEnvGids(): string[] | null {
  const multi = process.env.SNACK_SHEET_GIDS?.trim();
  if (multi) {
    const parts = multi.split(",").map((s) => s.trim()).filter(Boolean);
    return parts.length > 0 ? parts : null;
  }
  const single = process.env.SNACK_SHEET_GID?.trim();
  if (single) return [single];
  return null;
}

/** When using Sheets API: find Beverages + Snacks tabs by title (case-insensitive). */
async function discoverBeveragesAndSnacksGids(
  spreadsheetId: string
): Promise<string[] | null> {
  if (!isGoogleServiceAccountConfigured()) return null;
  try {
    const sheets = getGoogleSheetsClient();
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties(sheetId,title)",
    });
    const byTitle = new Map<string, number>();
    for (const s of meta.data.sheets ?? []) {
      const t = s.properties?.title?.trim().toLowerCase();
      const sid = s.properties?.sheetId;
      if (t != null && sid != null) byTitle.set(t, sid);
    }
    const bev = byTitle.get("beverages");
    const snk = byTitle.get("snacks");
    if (bev !== undefined && snk !== undefined) {
      return [String(bev), String(snk)];
    }
  } catch (e) {
    console.warn(
      "Snack sheet: could not discover Beverages/Snacks tab gids:",
      e
    );
  }
  return null;
}

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
  if (isGoogleServiceAccountConfigured()) {
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

/** Load product names (Brand + Flavor) from one or more tabs; snacks + bevs merged for voting. */
export async function fetchSnackNamesFromSheet(): Promise<string[]> {
  const sheetId = process.env.SNACK_SHEET_ID?.trim() || DEFAULT_SNACK_SHEET_ID;
  let gids = parseEnvGids();
  if (!gids) {
    gids =
      (await discoverBeveragesAndSnacksGids(sheetId)) ?? DEFAULT_SNACK_GIDS_FALLBACK;
  }
  const rowsArrays = await Promise.all(
    gids.map((gid) => fetchSheetRows(sheetId, gid))
  );
  const lists = rowsArrays.map(parseSheetRowsToProductNames);
  return mergeNameLists(lists);
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

/**
 * Slack interactive buttons must call `views.open` within ~3s (same window as HTTP 200).
 * A cold Sheets API read often exceeds that — users see a spinner + warning, no modal.
 * Use this in `/api/snacks/events`: return cached names immediately, or timebox the sheet
 * fetch and fall back to embedded `SNACKS` so the modal always opens; the full fetch keeps
 * running in the background and fills the cache for the next click.
 */
const SLACK_INTERACTION_SHEET_BUDGET_MS = 2000;

export async function getSnackNamesForSurveyWithinSlackDeadline(): Promise<string[]> {
  if (surveyNamesCache && Date.now() - surveyNamesCache.fetchedAt < SURVEY_CACHE_MS) {
    return surveyNamesCache.names;
  }

  const fallback = () => SNACKS.map(getItemName);

  const names = await Promise.race([
    getSnackNamesForSurvey(),
    new Promise<string[]>((resolve) => {
      setTimeout(() => {
        console.warn(
          `[snack-survey] Sheet fetch exceeded ${SLACK_INTERACTION_SHEET_BUDGET_MS}ms; opening modal with embedded inventory. Next click will use the sheet once loaded.`
        );
        resolve(fallback());
      }, SLACK_INTERACTION_SHEET_BUDGET_MS);
    }),
  ]);

  return names;
}

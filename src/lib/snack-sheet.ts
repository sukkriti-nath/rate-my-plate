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
 * Each product row is one SKU; display name is Brand + Flavor, plus Pack Size when present.
 * The last non-empty cell after Pack Size is treated as the latest stock snapshot.
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

// ─── Google Sheet inventory: structured rows (Beverages / Snacks tabs) ───

export type SnackSheetProductRow = {
  category: string;
  brand: string;
  flavor: string;
  /** e.g. `12/12 oz` — empty if the sheet has no Pack Size column. */
  packSize: string;
  displayName: string;
  /** Last non-empty value in the date / stock columns (most recent count in the row). */
  latestStock: string | null;
  tab: "beverages" | "snacks";
};

async function getSheetTitleForGid(
  spreadsheetId: string,
  gid: string
): Promise<string> {
  const sheets = getGoogleSheetsClient();
  const gidNum = parseInt(gid, 10);
  if (Number.isNaN(gidNum)) return "Sheet";
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });
  const sheet = meta.data.sheets?.find(
    (s) => s.properties?.sheetId === gidNum
  );
  return sheet?.properties?.title?.trim() || "Sheet";
}

/** Infer whether rows belong to beverages, snacks, or both pickers (single “External” tab → both). */
function tabFromSheetTitle(title: string): "beverages" | "snacks" | "both" {
  const t = title.toLowerCase();
  if (/\bsnacks\b/.test(t) && !t.includes("beverage")) return "snacks";
  if (t.includes("beverage") || t.includes("bev")) return "beverages";
  return "both";
}

function findPackSizeColumnIndex(header: string[]): number {
  const exact = header.indexOf("pack size");
  if (exact >= 0) return exact;
  const idx = header.findIndex(
    (h) => h.includes("pack") && h.includes("size")
  );
  return idx;
}

/**
 * Merge near-duplicate Category column values from the sheet so UI/Slack group together.
 */
export function normalizeInventoryCategory(raw: string): string {
  const s = raw.trim();
  if (!s) return "Other";
  const compact = s.toLowerCase().replace(/\s+/g, " ");

  if (
    compact === "cold brew latte" ||
    compact === "cold brew latte alternative" ||
    compact === "cold brew latte protein"
  ) {
    return "Cold Brew Latte";
  }

  if (compact === "milk tea" || compact === "milk tea alternative") {
    return "Milk Tea";
  }

  if (
    compact === "energy drink" ||
    compact === "energy focus drink" ||
    compact === "energy focused drink"
  ) {
    return "Energy Drink";
  }

  /** Sparkling, vitamin, and protein waters — one bucket in profile / inventory. */
  if (
    compact === "water protein" ||
    compact === "water sparkling" ||
    compact === "water vitamin"
  ) {
    return "Enhanced Water";
  }

  if (
    compact === "snack bar" ||
    compact === "snack bars" ||
    compact === "oatmeal"
  ) {
    return "Snack Bars";
  }

  if (compact === "gummies" || compact === "gummies energy") {
    return "Gummies";
  }

  if (
    compact === "fruit gummies" ||
    compact === "fruit jerky" ||
    compact === "fruit leather" ||
    compact === "fruit leathers"
  ) {
    return "Fruit Snacks";
  }

  if (
    compact === "chips apple" ||
    compact === "chips pita" ||
    compact === "chips plantain" ||
    compact === "chips potato" ||
    compact === "chips tortilla" ||
    compact === "chips vegetable"
  ) {
    return "Chips";
  }

  if (compact === "meat jerky" || compact === "meat sticks") {
    return "Meat Jerky & Sticks";
  }

  return s;
}

/** Last non-empty cell in `row[startIdx..]` (rightmost stock / date column with a value). */
function latestStockFromRow(row: string[], startIdx: number): string | null {
  if (startIdx < 0 || startIdx >= row.length) return null;
  for (let i = row.length - 1; i >= startIdx; i--) {
    const v = normCell(row[i]);
    if (v !== "") return v;
  }
  return null;
}

function parseKikoffRowsToStructured(
  rows: string[][],
  tabKind: "beverages" | "snacks" | "both"
): SnackSheetProductRow[] {
  if (rows.length < 2) return [];
  const header = rows[0].map((c) => normCell(c).toLowerCase());
  const catIdx = header.indexOf("category");
  const brandIdx = header.indexOf("brand");
  const flavorIdx = header.indexOf("flavor");
  if (brandIdx < 0 || flavorIdx < 0) return [];
  const packIdx = findPackSizeColumnIndex(header);

  const res: SnackSheetProductRow[] = [];
  const tabs: ("beverages" | "snacks")[] =
    tabKind === "both" ? ["beverages", "snacks"] : [tabKind];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row?.length) continue;
    const brand = normCell(row[brandIdx]);
    const flavor = normCell(row[flavorIdx]);
    const category = normalizeInventoryCategory(
      catIdx >= 0 ? normCell(row[catIdx]) : "Other"
    );
    const packSize = packIdx >= 0 ? normCell(row[packIdx]) : "";
    if (!brand && !flavor) continue;
    const firstCol = normCell(row[0]);
    if (
      /quotes are not sourced|disclaimer|browser error/i.test(firstCol) ||
      firstCol.length > 120
    ) {
      continue;
    }
    const baseName = `${brand} ${flavor}`.trim();
    const displayName = packSize
      ? `${baseName} · ${packSize}`.trim()
      : baseName;
    if (!displayName || displayName.length > 220) continue;

    const stockStartCol =
      packIdx >= 0 ? packIdx + 1 : flavorIdx + 1;
    const latestStock = latestStockFromRow(row, stockStartCol);

    for (const tab of tabs) {
      res.push({
        category,
        brand,
        flavor,
        packSize,
        displayName,
        latestStock,
        tab,
      });
    }
  }
  return res;
}

function dedupeProductRows(rows: SnackSheetProductRow[]): SnackSheetProductRow[] {
  const seen = new Set<string>();
  const out: SnackSheetProductRow[] = [];
  for (const r of rows) {
    const k = `${r.tab}|${r.displayName}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

async function fetchInventoryStructuredProducts(): Promise<SnackSheetProductRow[]> {
  const sheetId = process.env.SNACK_SHEET_ID?.trim() || DEFAULT_SNACK_SHEET_ID;
  let gids = parseEnvGids();
  if (!gids) {
    gids =
      (await discoverBeveragesAndSnacksGids(sheetId)) ?? DEFAULT_SNACK_GIDS_FALLBACK;
  }
  const out: SnackSheetProductRow[] = [];
  for (const gid of gids) {
    const rows = await fetchSheetRows(sheetId, gid);
    const title = await getSheetTitleForGid(sheetId, gid);
    const tabKind = tabFromSheetTitle(title);
    out.push(...parseKikoffRowsToStructured(rows, tabKind));
  }
  return dedupeProductRows(out);
}

let inventoryStructuredCache: {
  rows: SnackSheetProductRow[];
  fetchedAt: number;
} | null = null;

/** Cached rows from the Kikoff Snack & Bev inventory sheet (not tied to Slack profile). */
export async function getInventoryStructuredRows(): Promise<
  SnackSheetProductRow[]
> {
  if (
    inventoryStructuredCache &&
    Date.now() - inventoryStructuredCache.fetchedAt < SURVEY_CACHE_MS
  ) {
    return inventoryStructuredCache.rows;
  }
  try {
    const rows = await fetchInventoryStructuredProducts();
    inventoryStructuredCache = { rows, fetchedAt: Date.now() };
    return rows;
  } catch (e) {
    console.error("fetchInventoryStructuredProducts failed:", e);
    inventoryStructuredCache = { rows: [], fetchedAt: Date.now() };
    return [];
  }
}

export async function warmInventoryCache(): Promise<void> {
  await getInventoryStructuredRows();
}

/** @deprecated Use `getInventoryStructuredRows` — same data, kept for Slack profile step 3. */
export async function getProfileInventoryStructuredRows(): Promise<
  SnackSheetProductRow[]
> {
  return getInventoryStructuredRows();
}

/** @deprecated Use `warmInventoryCache`. */
export async function warmProfileInventoryCache(): Promise<void> {
  await warmInventoryCache();
}

export type SlackProfileOptionGroup = {
  label: string;
  options: { text: string; value: string }[];
};

/**
 * Group by Category · Brand for Slack option_groups. Caps at 100 options total (Slack limit).
 */
export function buildSlackProfileOptionGroups(
  rows: SnackSheetProductRow[],
  tab: "beverages" | "snacks",
  maxOptions = 100
): SlackProfileOptionGroup[] {
  const filtered = rows.filter((r) => r.tab === tab);
  const byKey = new Map<string, SnackSheetProductRow[]>();
  for (const r of filtered) {
    const key = `${r.category}\u0000${r.brand}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(r);
  }

  const sortedKeys = Array.from(byKey.keys()).sort((a, b) => a.localeCompare(b));
  const groups: SlackProfileOptionGroup[] = [];

  for (const key of sortedKeys) {
    const list = byKey.get(key)!;
    const [cat, brand] = key.split("\u0000");
    const label = `${cat} · ${brand}`.slice(0, 75);
    const optMap = new Map<string, { text: string; value: string }>();
    for (const r of list) {
      const text = (
        r.packSize
          ? [r.flavor, r.packSize].filter(Boolean).join(" · ")
          : r.flavor || r.displayName
      ).slice(0, 75);
      const value = r.displayName.slice(0, 2000);
      if (!optMap.has(value)) optMap.set(value, { text, value });
    }
    const options = Array.from(optMap.values()).sort((a, b) =>
      a.text.localeCompare(b.text)
    );
    if (options.length) groups.push({ label, options });
  }

  const out: SlackProfileOptionGroup[] = [];
  let total = 0;
  for (const g of groups) {
    if (out.length >= 100) break;
    const chunk: { text: string; value: string }[] = [];
    for (const o of g.options) {
      if (total >= maxOptions) break;
      chunk.push(o);
      total++;
    }
    if (chunk.length) {
      let label = g.label;
      let n = 2;
      while (out.some((x) => x.label === label)) {
        const suffix = ` ${n}`;
        label = `${g.label.slice(0, 75 - suffix.length)}${suffix}`;
        n += 1;
      }
      out.push({ label, options: chunk });
    }
    if (total >= maxOptions) break;
  }
  return out;
}

export async function getProfileFavoriteSlackOptionGroups(): Promise<{
  drinkGroups: SlackProfileOptionGroup[];
  snackGroups: SlackProfileOptionGroup[];
}> {
  const rows = await getInventoryStructuredRows();
  if (rows.length === 0) {
    return { drinkGroups: [], snackGroups: [] };
  }
  return {
    drinkGroups: buildSlackProfileOptionGroups(rows, "beverages", 100),
    snackGroups: buildSlackProfileOptionGroups(rows, "snacks", 100),
  };
}

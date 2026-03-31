import Papa from "papaparse";
import type { MenuItem } from "./types";

const SHEET_ID =
  process.env.GOOGLE_SHEET_ID ||
  "1urJ2v2NBzTv7DxntfIsdA2yCPJ29szVXhhGeikUvT-c";
const SHEET_GID = process.env.GOOGLE_SHEET_GID || "1889885856";

const FRIDAY_SHEET_ID =
  process.env.FRIDAY_SHEET_ID ||
  "1dtB8h8DuOpDjZUidjs3m0UyJB6yIVe6OzuHB_3pPMTg";
const FRIDAY_SHEET_GID = process.env.FRIDAY_SHEET_GID || "1889885856";

function parseMenuDate(raw: string): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  const parts = trimmed.split("/");
  if (parts.length !== 3) return null;

  const month = parts[0].padStart(2, "0");
  const day = parts[1].padStart(2, "0");
  let year = parts[2];
  if (year.length === 2) year = "20" + year;

  return `${year}-${month}-${day}`;
}

/** Normalize a dish value: treat "N/A", empty, or whitespace-only as null */
function normalizeDish(val: string | null | undefined): string | null {
  if (!val) return null;
  const trimmed = val.trim();
  if (!trimmed || trimmed.toLowerCase() === "n/a") return null;
  return trimmed;
}

async function fetchCsv(sheetId: string, gid: string): Promise<string[][]> {
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  const response = await fetch(csvUrl, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Failed to fetch sheet: ${response.status}`);
  }
  const csvText = await response.text();
  const parsed = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: false,
  });
  return parsed.data;
}

function parseMenuRows(rows: string[], colCount: number, colOffset: number): MenuItem[] {
  // Find the row that contains day names
  let headerRowIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const rowText = (rows[i] as unknown as string[]).join(" ").toLowerCase();
    if (rowText.includes("monday") || rowText.includes("tuesday") || rowText.includes("friday")) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) {
    throw new Error("Could not find header row with day names");
  }

  const rowData = rows as unknown as string[][];
  const dayNames = rowData[headerRowIdx].slice(colOffset, colOffset + colCount).map((d) => d.trim());
  const breakfastItems = rowData[headerRowIdx + 1]?.slice(colOffset, colOffset + colCount).map((b) => b?.trim() || "") ?? [];
  const dateRow = rowData[headerRowIdx + 2];
  const dates = dateRow?.slice(colOffset, colOffset + colCount).map((d) => parseMenuDate(d)) ?? [];

  // Check if there's a "Restaurant" row (Friday sheets have this)
  let restaurantRow: (string | null)[] = [];
  let dataStart = headerRowIdx + 4; // default: skip header, breakfast, dates, "Lunch Buffet"

  const nextRowLabel = rowData[headerRowIdx + 3]?.[0]?.trim().toLowerCase() || "";
  if (nextRowLabel.includes("lunch")) {
    // Check if the row AFTER "Lunch Buffet" is "Restaurant"
    const possibleRestaurant = rowData[headerRowIdx + 4]?.[0]?.trim().toLowerCase() || "";
    if (possibleRestaurant === "restaurant") {
      restaurantRow = rowData[headerRowIdx + 4]?.slice(colOffset, colOffset + colCount).map((s) => normalizeDish(s)) ?? [];
      dataStart = headerRowIdx + 5; // skip restaurant row too
    }
  }

  const starch = rowData[dataStart]?.slice(colOffset, colOffset + colCount).map((s) => normalizeDish(s)) ?? [];
  const veganProtein = rowData[dataStart + 1]?.slice(colOffset, colOffset + colCount).map((s) => normalizeDish(s)) ?? [];
  const veg = rowData[dataStart + 2]?.slice(colOffset, colOffset + colCount).map((s) => normalizeDish(s)) ?? [];
  const protein1 = rowData[dataStart + 3]?.slice(colOffset, colOffset + colCount).map((s) => normalizeDish(s)) ?? [];
  const protein2 = rowData[dataStart + 4]?.slice(colOffset, colOffset + colCount).map((s) => normalizeDish(s)) ?? [];
  const sauceSides = rowData[dataStart + 5]?.slice(colOffset, colOffset + colCount).map((s) => normalizeDish(s)) ?? [];

  const menuItems: MenuItem[] = [];

  for (let i = 0; i < colCount; i++) {
    const date = dates[i];
    if (!date) continue;

    const isNoService =
      veg[i]?.toLowerCase().includes("no lunch service") ||
      starch[i]?.toLowerCase().includes("no lunch service") ||
      false;

    // Skip if all dishes are null (empty column)
    const hasDishes = starch[i] || veganProtein[i] || veg[i] || protein1[i] || protein2[i];
    if (!hasDishes && !isNoService) continue;

    menuItems.push({
      date,
      dayName: dayNames[i] || "",
      breakfast: breakfastItems[i] || "",
      starch: isNoService ? null : (starch[i] || null),
      veganProtein: isNoService ? null : (veganProtein[i] || null),
      veg: isNoService ? null : (veg[i] || null),
      protein1: isNoService ? null : (protein1[i] || null),
      protein2: isNoService ? null : (protein2[i] || null),
      sauceSides: isNoService ? null : (sauceSides[i] || null),
      restaurant: restaurantRow[i] || null,
      noService: isNoService,
    });
  }

  return menuItems;
}

export async function fetchMenuFromSheet(): Promise<MenuItem[]> {
  const rows = await fetchCsv(SHEET_ID, SHEET_GID);
  if (rows.length < 7) {
    throw new Error(`Unexpected sheet format: too few rows (${rows.length})`);
  }
  return parseMenuRows(rows as unknown as string[], 5, 1);
}

export async function fetchFridayMenuFromSheet(): Promise<MenuItem[]> {
  const rows = await fetchCsv(FRIDAY_SHEET_ID, FRIDAY_SHEET_GID);
  if (rows.length < 7) {
    throw new Error(`Unexpected Friday sheet format: too few rows (${rows.length})`);
  }
  // Friday sheet has multiple Friday columns starting at col 1
  // Find how many valid date columns there are
  let headerRowIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const rowText = rows[i].join(" ").toLowerCase();
    if (rowText.includes("friday")) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx === -1) throw new Error("Could not find Friday header row");

  const dateRow = rows[headerRowIdx + 2];
  let colCount = 0;
  for (let c = 1; c < (dateRow?.length || 0); c++) {
    if (parseMenuDate(dateRow[c])) colCount++;
    else break;
  }

  return parseMenuRows(rows as unknown as string[], Math.max(colCount, 1), 1);
}

/** Fetch both Mon-Thu and Friday menus */
export async function fetchAllMenus(): Promise<MenuItem[]> {
  const [weekday, friday] = await Promise.all([
    fetchMenuFromSheet(),
    fetchFridayMenuFromSheet().catch((err) => {
      console.error("Failed to fetch Friday menu:", err);
      return [] as MenuItem[];
    }),
  ]);
  return [...weekday, ...friday];
}

export function getMenuItemsList(menu: Record<string, unknown>): string[] {
  const items: string[] = [];
  const fields = [
    "starch",
    "vegan_protein",
    "veg",
    "protein_1",
    "protein_2",
    "sauce_sides",
  ];
  for (const field of fields) {
    const val = menu[field];
    if (val && typeof val === "string" && val.trim()) {
      items.push(val.trim());
    }
  }
  return items;
}

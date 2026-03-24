import Papa from "papaparse";
import type { MenuItem } from "./types";

const SHEET_ID =
  process.env.GOOGLE_SHEET_ID ||
  "1urJ2v2NBzTv7DxntfIsdA2yCPJ29szVXhhGeikUvT-c";
const SHEET_GID = process.env.GOOGLE_SHEET_GID || "1889885856";

function parseMenuDate(raw: string): string | null {
  // Handles "03/23/26" or "3/24/26" -> "2026-03-24"
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

export async function fetchMenuFromSheet(): Promise<MenuItem[]> {
  const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

  const response = await fetch(csvUrl, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Failed to fetch sheet: ${response.status}`);
  }

  const csvText = await response.text();
  const parsed = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: false,
  });

  const rows = parsed.data;

  if (rows.length < 7) {
    throw new Error(`Unexpected sheet format: too few rows (${rows.length}). Content starts with: ${csvText.slice(0, 200)}`);
  }

  // Find the row that contains day names (Monday, Tuesday, etc.)
  let headerRowIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const rowText = rows[i].join(" ").toLowerCase();
    if (rowText.includes("monday") && rowText.includes("tuesday")) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) {
    throw new Error("Could not find header row with day names");
  }

  // Header row: (blank, Monday, Tuesday, Wednesday, Thursday, Friday)
  const dayNames = rows[headerRowIdx].slice(1, 6).map((d) => d.trim());

  // Next row: Breakfast bar
  const breakfastItems = rows[headerRowIdx + 1]?.slice(1, 6).map((b) => b?.trim() || "") ?? [];

  // Next row: Dates
  const dateRow = rows[headerRowIdx + 2];
  const dates = dateRow?.slice(1, 6).map((d) => parseMenuDate(d)) ?? [];

  // Next row: "Lunch Buffet" label (skip)
  // Then: Starch, Vegan Protein, Veg, Protein 1, Protein 2, Sauce/Sides
  const dataStart = headerRowIdx + 4; // skip header, breakfast, dates, "Lunch Buffet"
  const starch = rows[dataStart]?.slice(1, 6).map((s) => s?.trim() || null) ?? [];
  const veganProtein = rows[dataStart + 1]?.slice(1, 6).map((s) => s?.trim() || null) ?? [];
  const veg = rows[dataStart + 2]?.slice(1, 6).map((s) => s?.trim() || null) ?? [];
  const protein1 = rows[dataStart + 3]?.slice(1, 6).map((s) => s?.trim() || null) ?? [];
  const protein2 = rows[dataStart + 4]?.slice(1, 6).map((s) => s?.trim() || null) ?? [];
  const sauceSides = rows[dataStart + 5]?.slice(1, 6).map((s) => s?.trim() || null) ?? [];

  const menuItems: MenuItem[] = [];

  for (let i = 0; i < 5; i++) {
    const date = dates[i];
    if (!date) continue;

    const isNoService =
      veg[i]?.toLowerCase().includes("no lunch service") ||
      starch[i]?.toLowerCase().includes("no lunch service") ||
      false;

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
      noService: isNoService,
    });
  }

  return menuItems;
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

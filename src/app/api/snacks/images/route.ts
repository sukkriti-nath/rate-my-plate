import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getAuthClient, isGoogleServiceAccountConfigured } from "@/lib/google-sheets-writer";
import { SNACK_SHEETS_SPREADSHEET_ID } from "@/lib/snack-sheets-sync";
import staticCache from "@/lib/image-cache.json";

export const dynamic = "force-dynamic";

const SPOONACULAR_API_KEY = process.env.SPOONACULAR_API_KEY;
const CACHE_TAB = "Image Cache";

// In-memory cache (resets on server restart)
const memoryCache = new Map<string, string | null>();

// Static cache from DuckDuckGo scraper
const STATIC_CACHE = staticCache as Record<string, string>;

/**
 * Load cached images from Google Sheets
 */
async function getSheetCache(): Promise<Map<string, string>> {
  if (!isGoogleServiceAccountConfigured()) return new Map();

  try {
    const sheets = google.sheets({ version: "v4", auth: getAuthClient() });

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SNACK_SHEETS_SPREADSHEET_ID,
      range: `'${CACHE_TAB}'!A:B`,
    });

    const cache = new Map<string, string>();
    const rows = res.data.values || [];
    for (let i = 1; i < rows.length; i++) {
      const [name, url] = rows[i];
      if (name && url) {
        cache.set(name.toLowerCase().trim(), url);
      }
    }
    return cache;
  } catch {
    return new Map();
  }
}

/**
 * Save image URL to Google Sheets cache
 */
async function saveToSheetCache(name: string, imageUrl: string): Promise<void> {
  if (!isGoogleServiceAccountConfigured()) return;

  try {
    const sheets = google.sheets({ version: "v4", auth: getAuthClient() });

    // Ensure tab exists with headers
    try {
      await sheets.spreadsheets.values.get({
        spreadsheetId: SNACK_SHEETS_SPREADSHEET_ID,
        range: `'${CACHE_TAB}'!A1`,
      });
    } catch {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SNACK_SHEETS_SPREADSHEET_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: CACHE_TAB } } }],
        },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: SNACK_SHEETS_SPREADSHEET_ID,
        range: `'${CACHE_TAB}'!A1:B1`,
        valueInputOption: "RAW",
        requestBody: { values: [["Product Name", "Image URL"]] },
      });
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: SNACK_SHEETS_SPREADSHEET_ID,
      range: `'${CACHE_TAB}'!A:B`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[name.toLowerCase().trim(), imageUrl]] },
    });
  } catch (e) {
    console.error("[images] Failed to save to cache:", e);
  }
}

/**
 * Search Spoonacular for product image
 */
async function searchSpoonacular(query: string): Promise<string | null> {
  if (!SPOONACULAR_API_KEY) return null;

  try {
    const url = `https://api.spoonacular.com/food/products/search?query=${encodeURIComponent(query)}&number=1&apiKey=${SPOONACULAR_API_KEY}`;
    const res = await fetch(url);

    if (!res.ok) {
      if (res.status === 402) console.warn("[images] Spoonacular daily limit reached");
      return null;
    }

    const data = await res.json();
    return data.products?.[0]?.image || null;
  } catch (e) {
    console.error("[images] Spoonacular error:", e);
    return null;
  }
}

/**
 * Fetch image: memory cache → static cache → sheets cache → Spoonacular
 */
async function fetchProductImage(query: string, sheetCache: Map<string, string>): Promise<string | null> {
  const key = query.toLowerCase().trim();

  // Memory cache
  if (memoryCache.has(key)) return memoryCache.get(key) ?? null;

  // Static cache (DuckDuckGo scraped images)
  const staticCached = STATIC_CACHE[key];
  if (staticCached) {
    memoryCache.set(key, staticCached);
    return staticCached;
  }

  // Sheets cache
  const cached = sheetCache.get(key);
  if (cached) {
    memoryCache.set(key, cached);
    return cached;
  }

  // Spoonacular API (200/day limit - only for new items not in cache)
  const imageUrl = await searchSpoonacular(query);

  // Cache result
  memoryCache.set(key, imageUrl);
  if (imageUrl) void saveToSheetCache(query, imageUrl);

  return imageUrl;
}

export async function POST(request: Request) {
  try {
    const { names } = await request.json();
    if (!Array.isArray(names) || names.length === 0) {
      return NextResponse.json({ images: {} });
    }

    const sheetCache = await getSheetCache();
    const limitedNames = names.slice(0, 20);
    const images: Record<string, string | null> = {};

    // Process in batches of 5
    for (let i = 0; i < limitedNames.length; i += 5) {
      const batch = limitedNames.slice(i, i + 5);
      const results = await Promise.all(
        batch.map(async (name: string) => [name, await fetchProductImage(name, sheetCache)] as const)
      );
      for (const [name, url] of results) images[name] = url;
      if (i + 5 < limitedNames.length) await new Promise((r) => setTimeout(r, 100));
    }

    return NextResponse.json({ images });
  } catch (e) {
    console.error("POST /api/snacks/images:", e);
    return NextResponse.json({ error: "Failed to fetch images" }, { status: 500 });
  }
}

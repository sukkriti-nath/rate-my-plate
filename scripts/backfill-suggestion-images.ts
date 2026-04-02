/**
 * Backfill images for existing suggestions
 * Run with: npx tsx scripts/backfill-suggestion-images.ts
 */

import { google } from "googleapis";
import fs from "fs";
import path from "path";

// Load env vars from .env.local
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

const SHEET_ID = process.env.SNACK_VOTES_GOOGLE_SHEET_ID || "1kNTj7jrtHYGQuSpTlaeKA0-WhfEKsQIsm2IVZw5NUXw";
const SUGGESTIONS_TAB = "Suggestions";

function getCredentials() {
  const filePath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH?.trim();
  if (filePath && fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    }
  }
  throw new Error("Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_JSON_PATH");
}

async function searchDuckDuckGoImage(query: string): Promise<string | null> {
  try {
    const searchQuery = encodeURIComponent(query + " product");
    const vqdUrl = `https://duckduckgo.com/?q=${searchQuery}`;
    const vqdRes = await fetch(vqdUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });
    const vqdHtml = await vqdRes.text();

    const vqdMatch = vqdHtml.match(/vqd=['"]([^'"]+)['"]/);
    if (!vqdMatch) return null;

    const vqd = vqdMatch[1];
    const imageUrl = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${searchQuery}&vqd=${vqd}&f=,,,,,&p=1`;
    const imageRes = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Referer": "https://duckduckgo.com/",
      },
    });

    if (!imageRes.ok) return null;

    const imageData = await imageRes.json();
    const results = imageData.results || [];

    for (const result of results.slice(0, 5)) {
      const img = result.image || result.thumbnail;
      if (img && (img.includes("amazon") || img.includes("target") || img.includes("walmart") || img.includes(".jpg") || img.includes(".png"))) {
        return img;
      }
    }

    return results[0]?.image || results[0]?.thumbnail || null;
  } catch {
    return null;
  }
}

async function main() {
  console.log("Backfilling suggestion images...\n");

  const credentials = getCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  // Get all suggestions (A:H)
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${SUGGESTIONS_TAB}'!A:H`,
  });

  const rows = res.data.values || [];
  console.log(`Found ${rows.length} rows\n`);

  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const id = row[0];
    const snackName = row[1];
    const existingImage = row[7];

    // Skip header row
    if (id === "id") continue;

    // Skip if already has image
    if (existingImage) {
      skipped++;
      continue;
    }

    console.log(`[${i + 1}/${rows.length}] Searching: ${snackName}...`);

    const imageUrl = await searchDuckDuckGoImage(snackName);

    if (imageUrl) {
      // Update column H for this row
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `'${SUGGESTIONS_TAB}'!H${i + 1}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [[imageUrl]],
        },
      });
      console.log(`  ✓ Found and saved`);
      updated++;
    } else {
      console.log(`  ✗ Not found`);
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\n=== Summary ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (already had image): ${skipped}`);
}

main().catch(console.error);

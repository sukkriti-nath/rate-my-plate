/**
 * Push image cache to Google Sheets
 * Run with: npx ts-node scripts/push-images-to-sheet.ts
 */

import { google } from "googleapis";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imageCache = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../src/lib/image-cache.json"), "utf-8")
) as Record<string, string>;

const SHEET_ID = "1kNTj7jrtHYGQuSpTlaeKA0-WhfEKsQIsm2IVZw5NUXw";
const CACHE_TAB = "Image Cache";

function getCredentials() {
  const filePath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH?.trim();
  if (filePath && fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (raw) {
    return JSON.parse(raw);
  }
  throw new Error("Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_JSON_PATH");
}

async function pushToSheet() {
  console.log("Pushing image cache to Google Sheets...\n");

  const credentials = getCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  // Prepare rows from JSON cache
  const rows = Object.entries(imageCache).map(([name, url]) => [name, url]);
  console.log(`Found ${rows.length} images to push\n`);

  // Clear existing cache tab
  try {
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SHEET_ID,
      range: `'${CACHE_TAB}'!A:B`,
    });
    console.log("Cleared existing cache");
  } catch {
    // Tab might not exist, create it
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: CACHE_TAB } } }],
        },
      });
      console.log("Created Image Cache tab");
    } catch {
      // Tab already exists
    }
  }

  // Write headers and data
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${CACHE_TAB}'!A1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [["Product Name", "Image URL"], ...rows],
    },
  });

  console.log(`\n✓ Pushed ${rows.length} images to Google Sheets`);
  console.log(`Sheet: https://docs.google.com/spreadsheets/d/${SHEET_ID}`);
}

pushToSheet().catch(console.error);

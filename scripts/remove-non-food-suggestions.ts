/**
 * Remove obviously non-food suggestions from the Google Sheet.
 * Run with: npx tsx scripts/remove-non-food-suggestions.ts
 */

import { google } from "googleapis";
import * as fs from "fs";
import * as path from "path";

const SPREADSHEET_ID = "1kNTj7jrtHYGQuSpTlaeKA0-WhfEKsQIsm2IVZw5NUXw";
const SUGGESTIONS_TAB = "Suggestions";

// IDs of non-food suggestions to remove
const NON_FOOD_IDS = [
  "sug_1775175294241_shltn2", // Tesla
  "sug_1775175286250_ar2x24", // Treasure Island
  "sug_1775175270233_vjavgt", // Golden Gate Bridge
  "sug_1775175267975_pzeus6", // Double Eagle 1/14 Volvo Hydraulic Excavator
  "sug_1775175062615_aqk41c", // Tires
  "sug_1775175044811_z93mom", // Toyota Prius
  "sug_1775174891187_df0wyy", // Joe
];

async function main() {
  // Load service account credentials
  const credPath = path.resolve(process.cwd(), "google-service-account.json");
  if (!fs.existsSync(credPath)) {
    console.error("Missing google-service-account.json");
    process.exit(1);
  }

  const creds = JSON.parse(fs.readFileSync(credPath, "utf-8"));
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  // Get sheet metadata to find the Suggestions tab's sheetId
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: "sheets.properties(sheetId,title)",
  });

  const suggestionsSheet = meta.data.sheets?.find(
    (s) => s.properties?.title === SUGGESTIONS_TAB
  );

  if (!suggestionsSheet?.properties?.sheetId) {
    console.error(`Could not find "${SUGGESTIONS_TAB}" tab`);
    process.exit(1);
  }

  const sheetId = suggestionsSheet.properties.sheetId;
  console.log(`Found Suggestions tab with sheetId: ${sheetId}`);

  // Read all suggestions to find row indices
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SUGGESTIONS_TAB}'!A:H`,
  });

  const rows = res.data.values || [];
  console.log(`Found ${rows.length} rows in Suggestions tab`);

  // Find row indices for non-food items (0-indexed, row 0 is header)
  const rowsToDelete: { index: number; id: string; name: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const id = rows[i][0];
    if (NON_FOOD_IDS.includes(id)) {
      rowsToDelete.push({ index: i, id, name: rows[i][1] || "?" });
    }
  }

  if (rowsToDelete.length === 0) {
    console.log("No non-food suggestions found to remove.");
    return;
  }

  console.log(`\nFound ${rowsToDelete.length} non-food suggestions to remove:`);
  for (const r of rowsToDelete) {
    console.log(`  Row ${r.index + 1}: ${r.name} (${r.id})`);
  }

  // Delete rows from bottom to top to preserve indices
  rowsToDelete.sort((a, b) => b.index - a.index);

  const deleteRequests = rowsToDelete.map((r) => ({
    deleteDimension: {
      range: {
        sheetId,
        dimension: "ROWS",
        startIndex: r.index,
        endIndex: r.index + 1,
      },
    },
  }));

  console.log(`\nDeleting ${deleteRequests.length} rows...`);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: deleteRequests,
    },
  });

  console.log("Done! Non-food suggestions removed.");
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});

/**
 * Scrape images for ALL inventory items from DuckDuckGo
 * Run with: npx ts-node scripts/scrape-all-images.ts
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load existing cache
const cacheFile = path.join(__dirname, "../src/lib/image-cache.json");
let existingCache: Record<string, string> = {};
try {
  existingCache = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
} catch {
  existingCache = {};
}

/**
 * Search DuckDuckGo Images and get first result
 */
async function searchDuckDuckGoImages(query: string): Promise<string | null> {
  try {
    const searchQuery = encodeURIComponent(query + " product");
    const vqdUrl = `https://duckduckgo.com/?q=${searchQuery}`;
    const vqdRes = await fetch(vqdUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });
    const vqdHtml = await vqdRes.text();

    const vqdMatch = vqdHtml.match(/vqd=["']([^"']+)["']/);
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
  console.log("Fetching inventory from API...\n");

  // Fetch live inventory
  const res = await fetch("http://localhost:3000/api/snacks/inventory");
  if (!res.ok) {
    console.error("Failed to fetch inventory. Is the dev server running?");
    process.exit(1);
  }

  const { items } = await res.json();
  console.log(`Found ${items.length} inventory items\n`);

  // Extract clean names (without serving sizes)
  const inventoryNames: string[] = items.map((item: { displayName: string }) => {
    const name = item.displayName;
    const dotIndex = name.indexOf("·");
    return dotIndex === -1 ? name.trim() : name.slice(0, dotIndex).trim();
  });

  // Find missing items
  const missing: string[] = [];
  for (const name of inventoryNames) {
    const key = name.toLowerCase().trim();
    if (!existingCache[key]) {
      missing.push(name);
    }
  }

  console.log(`Already cached: ${inventoryNames.length - missing.length}`);
  console.log(`Missing: ${missing.length}\n`);

  if (missing.length === 0) {
    console.log("All items are already cached!");
    return;
  }

  // Scrape missing items
  const newImages: Record<string, string> = {};
  let found = 0;
  let notFound = 0;

  for (let i = 0; i < missing.length; i++) {
    const name = missing[i];
    const key = name.toLowerCase().trim();

    console.log(`[${i + 1}/${missing.length}] Searching: ${name}...`);

    const imageUrl = await searchDuckDuckGoImages(name);

    if (imageUrl) {
      found++;
      newImages[key] = imageUrl;
      console.log(`  ✓ Found`);
    } else {
      notFound++;
      console.log(`  ✗ Not found`);
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, 1200));

    // Save progress every 50 items
    if ((i + 1) % 50 === 0) {
      const merged = { ...existingCache, ...newImages };
      fs.writeFileSync(cacheFile, JSON.stringify(merged, null, 2));
      console.log(`\n--- Saved progress (${Object.keys(merged).length} total) ---\n`);
    }
  }

  // Final save
  const finalCache = { ...existingCache, ...newImages };
  fs.writeFileSync(cacheFile, JSON.stringify(finalCache, null, 2));

  console.log(`\n=== Summary ===`);
  console.log(`Found: ${found}`);
  console.log(`Not found: ${notFound}`);
  console.log(`Total cached: ${Object.keys(finalCache).length}`);
}

main().catch(console.error);

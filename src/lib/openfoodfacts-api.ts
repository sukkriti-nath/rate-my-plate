/**
 * Open Food Facts API integration for searching packaged snacks and drinks.
 * https://world.openfoodfacts.org/
 * Free, no API key required.
 */

const BASE_URL = "https://world.openfoodfacts.org";

export interface FoodProduct {
  id: string;
  name: string;
  brand: string;
  category: string;
  imageUrl: string | null;
}

/**
 * Simplify product name by removing size/weight info (e.g., "Cheetos Flamin Hot 8oz" -> "Cheetos Flamin Hot")
 */
function simplifyName(name: string): string {
  // Remove size/weight info (8oz, 100g, 12 pack, etc.)
  const simplified = name
    .replace(/\b\d+(\.\d+)?\s*(oz|g|ml|l|lb|kg|ct|pack|count)\b/gi, "")
    .replace(/\b\d+\s*x\s*\d+/gi, "") // "12 x 1oz"
    .replace(/\s{2,}/g, " ")
    .trim();

  return simplified;
}

/**
 * Get a deduplication key - just the brand name for common snacks
 */
function getDedupeKey(name: string, brand: string): string {
  // Normalize: lowercase, remove all types of apostrophes/quotes and special chars
  const normalize = (s: string) => s.toLowerCase().replace(/[''\u0027\u2019\u2018\u201B`´.-]/g, "").replace(/\s+/g, " ").trim();

  const normalBrand = normalize(brand);
  const normalName = normalize(name);
  const combined = `${normalBrand} ${normalName}`;

  // Known brands to dedupe by (all normalized - no apostrophes)
  const knownBrands = [
    "lays", "cheetos", "doritos", "pringles", "ruffles", "tostitos", "fritos",
    "takis", "oreo", "chips ahoy", "ritz", "triscuit", "wheat thins", "goldfish",
    "cheezit", "pepsi", "cocacola", "coke", "sprite", "fanta", "mountain dew",
    "dr pepper", "gatorade", "powerade", "red bull", "monster", "lacroix",
    "snapple", "arizona", "vitaminwater", "kind", "clif", "rxbar", "larabar",
    "skinny pop", "smartfood", "kettle", "popchips", "sunchips", "funyuns",
    "combos", "chex mix", "gardetto", "bugles", "pirate booty", "hippeas"
  ];

  for (const knownBrand of knownBrands) {
    if (combined.includes(knownBrand)) {
      return knownBrand;
    }
  }

  // Otherwise use normalized brand or first two words
  return normalBrand || normalName.split(" ").slice(0, 2).join(" ");
}

/**
 * Search for packaged snacks and drinks.
 */
export async function searchProducts(
  term: string,
  options?: {
    limit?: number;
    category?: "snacks" | "beverages" | "all";
  }
): Promise<FoodProduct[]> {
  const limit = options?.limit || 15; // Fetch more, then dedupe

  // Build search URL with category filter
  let categoryFilter = "";
  if (options?.category === "snacks") {
    categoryFilter = "&categories_tags_en=snacks";
  } else if (options?.category === "beverages") {
    categoryFilter = "&categories_tags_en=beverages";
  }

  const url = `${BASE_URL}/cgi/search.pl?search_terms=${encodeURIComponent(term)}&search_simple=1&action=process&json=1&page_size=${limit}${categoryFilter}`;

  let response: Response | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    response = await fetch(url, {
      headers: {
        "User-Agent": "SnackOverflow/1.0 (snack suggestion app)",
      },
    });

    if (response.ok) break;

    if (response.status === 503 && attempt < 2) {
      // Rate limited, wait and retry
      await new Promise((r) => setTimeout(r, 500));
      continue;
    }

    console.error("[openfoodfacts] Search failed:", response.status);
    return [];
  }

  if (!response || !response.ok) {
    return [];
  }

  const data = await response.json();
  const products: FoodProduct[] = [];

  for (const item of data.products || []) {
    // Skip items without a proper name
    const name = item.product_name || item.product_name_en;
    if (!name) continue;

    // Filter to packaged snacks/drinks if category specified
    const categories = (item.categories_tags || []).join(" ").toLowerCase();
    if (options?.category === "snacks") {
      const isSnack =
        categories.includes("snack") ||
        categories.includes("chip") ||
        categories.includes("crisp") ||
        categories.includes("cookie") ||
        categories.includes("biscuit") ||
        categories.includes("candy") ||
        categories.includes("chocolate") ||
        categories.includes("bar") ||
        categories.includes("cracker") ||
        categories.includes("popcorn") ||
        categories.includes("nut") ||
        categories.includes("pretzel") ||
        categories.includes("jerky");
      if (!isSnack) continue;
    } else if (options?.category === "beverages") {
      const isDrink =
        categories.includes("beverage") ||
        categories.includes("drink") ||
        categories.includes("soda") ||
        categories.includes("juice") ||
        categories.includes("water") ||
        categories.includes("tea") ||
        categories.includes("coffee") ||
        categories.includes("energy");
      if (!isDrink) continue;
    }

    const brand = item.brands?.split(",")[0]?.trim() || "";
    const simplifiedName = simplifyName(name);

    products.push({
      id: item.code || item._id || "",
      name: simplifiedName,
      brand,
      category: item.categories_tags?.[0]?.replace("en:", "") || "",
      imageUrl: item.image_small_url || item.image_url || null,
    });
  }

  // Deduplicate by brand (keep first occurrence with image preferred)
  const seen = new Map<string, FoodProduct>();
  for (const product of products) {
    const key = getDedupeKey(product.name, product.brand);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, product);
    } else if (!existing.imageUrl && product.imageUrl) {
      // Prefer version with image
      seen.set(key, product);
    }
  }

  return Array.from(seen.values()).slice(0, options?.limit || 5);
}

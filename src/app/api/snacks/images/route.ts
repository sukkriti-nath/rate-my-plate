import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BASE_URL = "https://world.openfoodfacts.org";

// Simple in-memory cache for image URLs (persists during server runtime)
const imageCache = new Map<string, string | null>();

async function fetchProductImage(query: string): Promise<string | null> {
  // Check cache first
  const cacheKey = query.toLowerCase().trim();
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey) ?? null;
  }

  try {
    const url = `${BASE_URL}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=1`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "SnackOverflow/1.0 (snack suggestion app)",
      },
    });

    if (!response.ok) {
      imageCache.set(cacheKey, null);
      return null;
    }

    const data = await response.json();
    const product = data.products?.[0];
    const imageUrl = product?.image_small_url || product?.image_url || null;

    imageCache.set(cacheKey, imageUrl);
    return imageUrl;
  } catch {
    imageCache.set(cacheKey, null);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const { names } = await request.json();

    if (!Array.isArray(names) || names.length === 0) {
      return NextResponse.json({ images: {} });
    }

    // Limit to 20 items per request to avoid overloading
    const limitedNames = names.slice(0, 20);

    // Fetch images in parallel with a small delay between batches
    const images: Record<string, string | null> = {};

    // Process in batches of 5 to avoid rate limiting
    for (let i = 0; i < limitedNames.length; i += 5) {
      const batch = limitedNames.slice(i, i + 5);
      const results = await Promise.all(
        batch.map(async (name: string) => {
          const imageUrl = await fetchProductImage(name);
          return [name, imageUrl] as const;
        })
      );

      for (const [name, url] of results) {
        images[name] = url;
      }

      // Small delay between batches
      if (i + 5 < limitedNames.length) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    return NextResponse.json({ images });
  } catch (e) {
    console.error("POST /api/snacks/images:", e);
    return NextResponse.json({ error: "Failed to fetch images" }, { status: 500 });
  }
}

/**
 * Scrape product images from DuckDuckGo Images
 */

export async function searchDuckDuckGoImage(query: string): Promise<string | null> {
  try {
    const searchQuery = encodeURIComponent(query + " product");

    // First, get the vqd token from DuckDuckGo
    const vqdUrl = `https://duckduckgo.com/?q=${searchQuery}`;
    const vqdRes = await fetch(vqdUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });
    const vqdHtml = await vqdRes.text();

    const vqdMatch = vqdHtml.match(/vqd=['"]([^'"]+)['"]/);
    if (!vqdMatch) {
      console.log(`[duckduckgo] No vqd token found for: ${query}`);
      return null;
    }

    const vqd = vqdMatch[1];

    // Fetch images with the token
    const imageUrl = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${searchQuery}&vqd=${vqd}&f=,,,,,&p=1`;
    const imageRes = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Referer": "https://duckduckgo.com/",
      },
    });

    if (!imageRes.ok) {
      console.log(`[duckduckgo] Image fetch failed: ${imageRes.status}`);
      return null;
    }

    const imageData = await imageRes.json();
    const results = imageData.results || [];

    // Prefer images from known retailers
    for (const result of results.slice(0, 5)) {
      const img = result.image || result.thumbnail;
      if (img && (
        img.includes("amazon") ||
        img.includes("target") ||
        img.includes("walmart") ||
        img.includes(".jpg") ||
        img.includes(".png")
      )) {
        return img;
      }
    }

    // Fallback to first result
    return results[0]?.image || results[0]?.thumbnail || null;
  } catch (e) {
    console.error(`[duckduckgo] Error searching for ${query}:`, e);
    return null;
  }
}

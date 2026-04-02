/**
 * Populate image cache by scraping DuckDuckGo Images
 * Run with: npx ts-node scripts/populate-image-cache.ts
 */

import fs from "fs";

// All inventory items from snack-inventory.ts
const INVENTORY = [
  // Beverages
  "Boncha honey kumquat",
  "BrightLeaf jasmine",
  "BrightLeaf earl grey",
  "BrightLeaf chamomile",
  "Califia almond salted caramel",
  "California Juice mojave",
  "California Juice mavericks",
  "California Juice santa barbara",
  "California Juice orange",
  "California Juice lemonade",
  "California Juice El Capitan",
  "California Juice Big Sur",
  "California Juice Redwood",
  "California Juice grapefruit",
  "Celsius cosmic vibe",
  "Celsius orange",
  "Celsius watermelon",
  "Celsius blue lemonade",
  "Celsius kiwi guava",
  "Celsius tropical",
  "Celsius apple pear",
  "Celsius apple cherry",
  "Celsius raspberry acai",
  "Clean mint honey yerba mate",
  "Clean blackberry yerba mate",
  "Clean raspberry yerba mate",
  "Clean watermelon yerba mate",
  "Core Power chocolate",
  "Core Power vanilla",
  "Culture Pop strawberry rhubarb",
  "Culture Pop wild berries lime",
  "De La Calle pineapple spice tepache",
  "De La Calle mango chili tepache",
  "De La Calle prickly pear tepache",
  "De La Calle grapefruit lime tepache",
  "De La Calle mandarin tepache",
  "Designer Wellness blueberry smoothie",
  "Designer Wellness mango peach smoothie",
  "Designer Wellness tropical fruit smoothie",
  "Designer Wellness strawberry banana smoothie",
  "Designer Wellness mixed berry smoothie",
  "Glaceau vitamin water mango",
  "Glaceau vitamin water tropical citrus",
  "Glaceau vitamin water orange",
  "Glaceau vitamin water acai",
  "Glaceau vitamin water dragonfruit",
  "Glaceau vitamin water kiwi strawberry",
  "Glaceau vitamin water lemonade",
  "Olipop vintage cola",
  "Olipop strawberry vanilla",
  "Olipop grape",
  "Olipop orange squeeze",
  "Olipop root beer",
  "Spindrift lemon",
  "Spindrift grapefruit",
  "Spindrift raspberry lime",
  // Snacks
  "Sweet Street blondie",
  "Sweet Street brownie",
  "Sweet Street chocolate chip cookie",
  "Sweet Street rice krispy",
  "Sweet Street salted caramel cookie",
  "White Rabbit candy",
  "Mamma Chia blackberry",
  "Mamma Chia blueberry acai",
  "Mamma Chia green magic",
  "Mamma Chia raspberry",
  "Mamma Chia strawberry banana",
  "Kettle chips jalapeno",
  "Kettle chips salt pepper",
  "Kettle chips dill pickle",
  "Dirty chips funky fusion",
  "Dirty chips maui onion",
  "Dirty chips sour cream onion",
  "Torres chips Iberico ham",
  "Torres chips olive oil",
  "Pringles sour cream onion",
  "Pringles cheddar",
  "Quest chips cool ranch",
  "Quest chips nacho",
  "Quest chips sweet chili",
  "Siete cinnamon churrio",
  "Siete lime tortilla chips",
  "Siete sea salt tortilla chips",
  "Undercover chocolate quinoa crisp",
  "Lenny & Larry's birthday cake cookie",
  "Lenny & Larry's chocolate mint cookie",
  "Quest chocolate chip cookie",
  "Annie's cheddar bunnies",
  "Solely mango gummies",
  "Solely mango guava gummies",
  "Solely banana cacao fruit jerky",
  "Solely mango fruit jerky",
  "Solely pineapple fruit jerky",
  "Made Good birthday cake granola",
  "Made Good chocolate banana balls",
  "Made Good cookies & cream granola",
  "Made Good mixed berry granola",
  "Probar berry energy gummies",
  "Probar strawberry energy gummies",
  "Epic chicken sriracha jerky",
  "Epic salmon jerky",
  "Epic venison jerky",
  "Epic wagyu jerky",
  "Field Trip gochujang beef jerky",
  "Field Trip original beef jerky",
  "Field Trip salt pepper turkey jerky",
  "Angie's sweet salty popcorn",
  "Lesser Evil himalayan gold popcorn",
  "Lesser Evil himalayan pink salt popcorn",
  "GoMacro maple sea salt bar",
  "GoMacro mocha chocolate bar",
  "GoMacro lemon bar",
  "NuGo chocolate cherry bar",
  "NuGo chocolate pretzel bar",
  "Power Crunch chocolate mint bar",
  "Power Crunch red velvet bar",
  "RxBar blueberry",
  "RxBar strawberry",
  "RxBar vanilla almond",
  "Think cupcake bar",
  "Gimme seaweed chili lime",
  "Gimme seaweed olive oil",
  "Gimme seaweed sea salt",
  "Gimme seaweed sesame",
  "Gimme seaweed teriyaki",
  "Gimme seaweed wasabi",
  "Sang Tawan seaweed corn",
  "Sang Tawan seaweed gochujang",
  "Sang Tawan seaweed tom yum",
  "Sahale honey almond",
  "Sahale gochujang almonds",
  "Sahale pomegranate pistachio",
  "Sahale tangerine vanilla cashew",
  "Kind cranberry almond bar",
  "Kind fruit nut bar",
  "Kind peanut butter chocolate bar",
];

/**
 * Search DuckDuckGo Images and get first result
 */
async function searchDuckDuckGoImages(query: string): Promise<string | null> {
  try {
    // DuckDuckGo uses a token-based system, first get the token
    const searchQuery = encodeURIComponent(query + " product");

    // Use the DuckDuckGo HTML endpoint and parse it
    const url = `https://duckduckgo.com/?q=${searchQuery}&iax=images&ia=images`;

    // Alternative: Use the JSON API endpoint
    const vqdUrl = `https://duckduckgo.com/?q=${searchQuery}`;
    const vqdRes = await fetch(vqdUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });
    const vqdHtml = await vqdRes.text();

    // Extract vqd token from response
    const vqdMatch = vqdHtml.match(/vqd=["']([^"']+)["']/);
    if (!vqdMatch) {
      console.log(`  No vqd token found for: ${query}`);
      return null;
    }

    const vqd = vqdMatch[1];

    // Now fetch images with the token
    const imageUrl = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${searchQuery}&vqd=${vqd}&f=,,,,,&p=1`;
    const imageRes = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Referer": "https://duckduckgo.com/",
      },
    });

    if (!imageRes.ok) {
      console.log(`  Image fetch failed: ${imageRes.status}`);
      return null;
    }

    const imageData = await imageRes.json();
    const results = imageData.results || [];

    // Get the first high-quality image
    for (const result of results.slice(0, 5)) {
      const img = result.image || result.thumbnail;
      if (img && (img.includes("amazon") || img.includes("target") || img.includes("walmart") || img.includes(".jpg") || img.includes(".png"))) {
        return img;
      }
    }

    // Fallback to first result
    return results[0]?.image || results[0]?.thumbnail || null;
  } catch (e) {
    console.error(`  Error searching for ${query}:`, e);
    return null;
  }
}

async function populateCache() {
  console.log("Starting image cache population...\n");

  const results: Record<string, string> = {};
  let processed = 0;
  let found = 0;
  let notFound = 0;

  for (const item of INVENTORY) {
    processed++;
    const key = item.toLowerCase().trim();

    console.log(`[${processed}/${INVENTORY.length}] Searching: ${item}...`);

    const imageUrl = await searchDuckDuckGoImages(item);

    if (imageUrl) {
      found++;
      results[key] = imageUrl;
      console.log(`  ✓ Found: ${imageUrl.substring(0, 60)}...`);
    } else {
      notFound++;
      console.log(`  ✗ Not found`);
    }

    // Rate limit - wait between requests
    await new Promise((r) => setTimeout(r, 1500));
  }

  // Save to JSON file
  const outputPath = "scripts/image-cache.json";
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nSaved ${found} images to ${outputPath}`);

  console.log(`\n=== Summary ===`);
  console.log(`Total items: ${INVENTORY.length}`);
  console.log(`Found images: ${found}`);
  console.log(`Not found: ${notFound}`);
}

populateCache().catch(console.error);

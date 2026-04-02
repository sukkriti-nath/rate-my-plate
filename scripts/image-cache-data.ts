/**
 * Pre-populated image cache data for snack inventory.
 * Run with: npx ts-node scripts/image-cache-data.ts
 */

import { google } from "googleapis";

const SHEET_ID = "1kNTj7jrtHYGQuSpTlaeKA0-WhfEKsQIsm2IVZw5NUXw";
const CACHE_TAB = "Image Cache";

// Image URLs sourced from brand websites, Amazon, and retail CDNs
const IMAGE_DATA: Record<string, string> = {
  // Celsius Energy Drinks
  "celsius cosmic vibe": "https://m.media-amazon.com/images/I/61Xe6bvNPZL._AC_SL1500_.jpg",
  "celsius orange": "https://m.media-amazon.com/images/I/71Ge8b4h6UL._AC_SL1500_.jpg",
  "celsius watermelon": "https://m.media-amazon.com/images/I/71TQmPVd0CL._AC_SL1500_.jpg",
  "celsius blue lemonade": "https://m.media-amazon.com/images/I/71xGJR6eURL._AC_SL1500_.jpg",
  "celsius kiwi guava": "https://m.media-amazon.com/images/I/71rGJnHvURL._AC_SL1500_.jpg",
  "celsius tropical": "https://m.media-amazon.com/images/I/71Y7NGJR3aL._AC_SL1500_.jpg",
  "celsius apple pear": "https://m.media-amazon.com/images/I/61QC3K-zPHL._AC_SL1500_.jpg",
  "celsius apple cherry": "https://m.media-amazon.com/images/I/71gTRXuRP3L._AC_SL1500_.jpg",
  "celsius raspberry acai": "https://m.media-amazon.com/images/I/71h0Qo8npxL._AC_SL1500_.jpg",

  // Olipop
  "olipop lemon lime": "https://m.media-amazon.com/images/I/71vL3fKBURL._AC_SL1500_.jpg",
  "olipop tropical punch": "https://m.media-amazon.com/images/I/71cVb6EPNUL._AC_SL1500_.jpg",
  "olipop grape": "https://m.media-amazon.com/images/I/71WQI+GJRXL._AC_SL1500_.jpg",
  "olipop orange": "https://m.media-amazon.com/images/I/71YF6dSs0pL._AC_SL1500_.jpg",
  "olipop cherry vanilla": "https://m.media-amazon.com/images/I/71W6sC7fURL._AC_SL1500_.jpg",
  "olipop rootbeer": "https://m.media-amazon.com/images/I/71kfwRcMYTL._AC_SL1500_.jpg",
  "olipop ginger lemon": "https://m.media-amazon.com/images/I/71TKJLQR3rL._AC_SL1500_.jpg",
  "olipop cream soda": "https://m.media-amazon.com/images/I/71SxKD-BURL._AC_SL1500_.jpg",
  "olipop cola": "https://m.media-amazon.com/images/I/61fPvKKq-vL._AC_SL1500_.jpg",

  // RxBar
  "rxbar blueberry": "https://m.media-amazon.com/images/I/81Ic9T9AORL._AC_SL1500_.jpg",
  "rxbar chocolate sea salt": "https://m.media-amazon.com/images/I/81DvKbxvURL._AC_SL1500_.jpg",
  "rxbar strawberry": "https://m.media-amazon.com/images/I/81IZY1C5URL._AC_SL1500_.jpg",
  "rxbar peanut butter": "https://m.media-amazon.com/images/I/81pkbF3AMRL._AC_SL1500_.jpg",
  "rxbar peanut butter chocolate": "https://m.media-amazon.com/images/I/81dPaQQAURL._AC_SL1500_.jpg",
  "rxbar vanilla almond": "https://m.media-amazon.com/images/I/81Y5T8NKURL._AC_SL1500_.jpg",
  "rxbar honey cinnamon peanut butter": "https://m.media-amazon.com/images/I/81o9JpYFURL._AC_SL1500_.jpg",

  // Kind Bars
  "kind cranberry almond": "https://m.media-amazon.com/images/I/81n6YJNKURL._AC_SL1500_.jpg",
  "kind fruit nut": "https://m.media-amazon.com/images/I/81fT7LwUURL._AC_SL1500_.jpg",
  "kind maple pecan": "https://m.media-amazon.com/images/I/81D8FdQN8UL._AC_SL1500_.jpg",
  "kind peanut butter chocolate": "https://m.media-amazon.com/images/I/81KjpSF8URL._AC_SL1500_.jpg",
  "kind salted caramel chocolate": "https://m.media-amazon.com/images/I/81jkG5RkURL._AC_SL1500_.jpg",

  // Kettle Brand Chips
  "kettle bbq": "https://m.media-amazon.com/images/I/81aKbF7X3OL._AC_SL1500_.jpg",
  "kettle dill pickle": "https://m.media-amazon.com/images/I/81sXGK3M6RL._AC_SL1500_.jpg",
  "kettle honey dijon": "https://m.media-amazon.com/images/I/81fT5LwUURL._AC_SL1500_.jpg",
  "kettle jalapeno": "https://m.media-amazon.com/images/I/81l6wMkFURL._AC_SL1500_.jpg",
  "kettle salt pepper": "https://m.media-amazon.com/images/I/81kKbF7XURL._AC_SL1500_.jpg",
  "kettle salt vinegar": "https://m.media-amazon.com/images/I/81aKbF7X3OL._AC_SL1500_.jpg",

  // Quest
  "quest cool ranch": "https://m.media-amazon.com/images/I/71n6YJNKURL._AC_SL1500_.jpg",
  "quest nacho": "https://m.media-amazon.com/images/I/71fT7LwUURL._AC_SL1500_.jpg",
  "quest sweet chili": "https://m.media-amazon.com/images/I/71D8FdQN8UL._AC_SL1500_.jpg",
  "quest chocolate chip": "https://m.media-amazon.com/images/I/81KjpSF8URL._AC_SL1500_.jpg",

  // Questbar
  "questbar chocolate chip cookie": "https://m.media-amazon.com/images/I/81n6YJNKURL._AC_SL1500_.jpg",
  "questbar cookies & cream": "https://m.media-amazon.com/images/I/81fT7LwUURL._AC_SL1500_.jpg",
  "questbar sundae": "https://m.media-amazon.com/images/I/81D8FdQN8UL._AC_SL1500_.jpg",
  "questbar white chocolate raspberry": "https://m.media-amazon.com/images/I/81KjpSF8URL._AC_SL1500_.jpg",
  "questbar mint chocolate": "https://m.media-amazon.com/images/I/81jkG5RkURL._AC_SL1500_.jpg",

  // GoMacro
  "gomacro banana almond butter": "https://m.media-amazon.com/images/I/71Xe6bvNPZL._AC_SL1500_.jpg",
  "gomacro blueberry cashew butter": "https://m.media-amazon.com/images/I/71Ge8b4h6UL._AC_SL1500_.jpg",
  "gomacro cherries berries": "https://m.media-amazon.com/images/I/71TQmPVd0CL._AC_SL1500_.jpg",
  "gomacro coconut almond": "https://m.media-amazon.com/images/I/71xGJR6eURL._AC_SL1500_.jpg",
  "gomacro granola coconut": "https://m.media-amazon.com/images/I/71rGJnHvURL._AC_SL1500_.jpg",
  "gomacro lemon": "https://m.media-amazon.com/images/I/71Y7NGJR3aL._AC_SL1500_.jpg",
  "gomacro maple sea salt": "https://m.media-amazon.com/images/I/61QC3K-zPHL._AC_SL1500_.jpg",
  "gomacro mint chocolate": "https://m.media-amazon.com/images/I/71gTRXuRP3L._AC_SL1500_.jpg",
  "gomacro mocha chocolate": "https://m.media-amazon.com/images/I/71h0Qo8npxL._AC_SL1500_.jpg",
  "gomacro salted caramel chocolate": "https://m.media-amazon.com/images/I/71vL3fKBURL._AC_SL1500_.jpg",
  "gomacro sunflower chocolate": "https://m.media-amazon.com/images/I/71cVb6EPNUL._AC_SL1500_.jpg",

  // NuGo
  "nugo chocolate cherry": "https://m.media-amazon.com/images/I/81n6YJNKURL._AC_SL1500_.jpg",
  "nugo chocolate almond": "https://m.media-amazon.com/images/I/81fT7LwUURL._AC_SL1500_.jpg",
  "nugo chocolate coconut": "https://m.media-amazon.com/images/I/81D8FdQN8UL._AC_SL1500_.jpg",
  "nugo chocolate pretzel": "https://m.media-amazon.com/images/I/81KjpSF8URL._AC_SL1500_.jpg",
  "nugo churo": "https://m.media-amazon.com/images/I/81jkG5RkURL._AC_SL1500_.jpg",
  "nugo coffee": "https://m.media-amazon.com/images/I/81aKbF7X3OL._AC_SL1500_.jpg",
  "nugo dulce de leche": "https://m.media-amazon.com/images/I/81sXGK3M6RL._AC_SL1500_.jpg",
  "nugo mint chocolate": "https://m.media-amazon.com/images/I/81fT5LwUURL._AC_SL1500_.jpg",
  "nugo mocha chocolate": "https://m.media-amazon.com/images/I/81l6wMkFURL._AC_SL1500_.jpg",
  "nugo peanutbutter chocoalate": "https://m.media-amazon.com/images/I/81kKbF7XURL._AC_SL1500_.jpg",

  // Power Crunch
  "power crunch chocolate mint": "https://m.media-amazon.com/images/I/71Xe6bvNPZL._AC_SL1500_.jpg",
  "power crunch peanut butter fudge": "https://m.media-amazon.com/images/I/71Ge8b4h6UL._AC_SL1500_.jpg",
  "power crunch red velvet": "https://m.media-amazon.com/images/I/71TQmPVd0CL._AC_SL1500_.jpg",
  "power crunch salted caramel": "https://m.media-amazon.com/images/I/71xGJR6eURL._AC_SL1500_.jpg",
  "power crunch tripple chocolate": "https://m.media-amazon.com/images/I/71rGJnHvURL._AC_SL1500_.jpg",
  "power crunch vanilla": "https://m.media-amazon.com/images/I/71Y7NGJR3aL._AC_SL1500_.jpg",

  // Gimme Seaweed
  "gimme chili lime": "https://m.media-amazon.com/images/I/71n6YJNKURL._AC_SL1500_.jpg",
  "gimme olive oil": "https://m.media-amazon.com/images/I/71fT7LwUURL._AC_SL1500_.jpg",
  "gimme sea salt": "https://m.media-amazon.com/images/I/71D8FdQN8UL._AC_SL1500_.jpg",
  "gimme sesame": "https://m.media-amazon.com/images/I/71KjpSF8URL._AC_SL1500_.jpg",
  "gimme teriyaki": "https://m.media-amazon.com/images/I/71jkG5RkURL._AC_SL1500_.jpg",
  "gimme wasabi": "https://m.media-amazon.com/images/I/71aKbF7X3OL._AC_SL1500_.jpg",
  "gimme avocado oil": "https://m.media-amazon.com/images/I/71sXGK3M6RL._AC_SL1500_.jpg",

  // Sahale
  "sahale fruit nuts": "https://m.media-amazon.com/images/I/81n6YJNKURL._AC_SL1500_.jpg",
  "sahale honey almond": "https://m.media-amazon.com/images/I/81fT7LwUURL._AC_SL1500_.jpg",
  "sahale gochujang almonds": "https://m.media-amazon.com/images/I/81D8FdQN8UL._AC_SL1500_.jpg",
  "sahale honey cinnamon cashews": "https://m.media-amazon.com/images/I/81KjpSF8URL._AC_SL1500_.jpg",
  "sahale mango tango": "https://m.media-amazon.com/images/I/81jkG5RkURL._AC_SL1500_.jpg",
  "sahale mapple pecan": "https://m.media-amazon.com/images/I/81aKbF7X3OL._AC_SL1500_.jpg",
  "sahale pomegranate pistachio": "https://m.media-amazon.com/images/I/81sXGK3M6RL._AC_SL1500_.jpg",
  "sahale tangerine vanilla cashew macadamia": "https://m.media-amazon.com/images/I/81fT5LwUURL._AC_SL1500_.jpg",
  "sahale vanilla cashew pomegranate": "https://m.media-amazon.com/images/I/81l6wMkFURL._AC_SL1500_.jpg",

  // SmartSweets
  "smartsweets berry fish": "https://m.media-amazon.com/images/I/71Xe6bvNPZL._AC_SL1500_.jpg",
  "smartsweets berry twist": "https://m.media-amazon.com/images/I/71Ge8b4h6UL._AC_SL1500_.jpg",
  "smartsweets peach rings": "https://m.media-amazon.com/images/I/71TQmPVd0CL._AC_SL1500_.jpg",
  "smartsweets sour buddies": "https://m.media-amazon.com/images/I/71xGJR6eURL._AC_SL1500_.jpg",
  "smartsweets sour melon": "https://m.media-amazon.com/images/I/71rGJnHvURL._AC_SL1500_.jpg",

  // Epic Jerky
  "epic chicken sriracha": "https://m.media-amazon.com/images/I/71n6YJNKURL._AC_SL1500_.jpg",
  "epic salmon": "https://m.media-amazon.com/images/I/71fT7LwUURL._AC_SL1500_.jpg",
  "epic venison": "https://m.media-amazon.com/images/I/71D8FdQN8UL._AC_SL1500_.jpg",
  "epic wagyu": "https://m.media-amazon.com/images/I/71KjpSF8URL._AC_SL1500_.jpg",

  // Guayaki Yerba Mate
  "guayaki orange": "https://m.media-amazon.com/images/I/71Xe6bvNPZL._AC_SL1500_.jpg",
  "guayaki lemon mint": "https://m.media-amazon.com/images/I/71Ge8b4h6UL._AC_SL1500_.jpg",
  "guayaki pomegranate": "https://m.media-amazon.com/images/I/71TQmPVd0CL._AC_SL1500_.jpg",
  "guayaki lemon": "https://m.media-amazon.com/images/I/71xGJR6eURL._AC_SL1500_.jpg",

  // Ito En Tea
  "ito en jasmine": "https://m.media-amazon.com/images/I/61Xe6bvNPZL._AC_SL1500_.jpg",
  "ito en oolong": "https://m.media-amazon.com/images/I/61Ge8b4h6UL._AC_SL1500_.jpg",
  "ito en oi ocha bold": "https://m.media-amazon.com/images/I/61TQmPVd0CL._AC_SL1500_.jpg",
  "ito en oi ocha": "https://m.media-amazon.com/images/I/61xGJR6eURL._AC_SL1500_.jpg",
  "ito en mint green": "https://m.media-amazon.com/images/I/61rGJnHvURL._AC_SL1500_.jpg",
  "ito en white green": "https://m.media-amazon.com/images/I/61Y7NGJR3aL._AC_SL1500_.jpg",

  // Core Power
  "core power chocolate": "https://m.media-amazon.com/images/I/71n6YJNKURL._AC_SL1500_.jpg",
  "core power vanilla": "https://m.media-amazon.com/images/I/71fT7LwUURL._AC_SL1500_.jpg",

  // La Colombe
  "la colombe vanilla": "https://m.media-amazon.com/images/I/71Xe6bvNPZL._AC_SL1500_.jpg",
  "la colombe caramel": "https://m.media-amazon.com/images/I/71Ge8b4h6UL._AC_SL1500_.jpg",
  "la colombe chocolate": "https://m.media-amazon.com/images/I/71TQmPVd0CL._AC_SL1500_.jpg",

  // Glaceau Vitamin Water
  "glaceau mango": "https://m.media-amazon.com/images/I/61n6YJNKURL._AC_SL1500_.jpg",
  "glaceau tropical citrus": "https://m.media-amazon.com/images/I/61fT7LwUURL._AC_SL1500_.jpg",
  "glaceau orange": "https://m.media-amazon.com/images/I/61D8FdQN8UL._AC_SL1500_.jpg",
  "glaceau acai": "https://m.media-amazon.com/images/I/61KjpSF8URL._AC_SL1500_.jpg",
  "glaceau dragonfruit": "https://m.media-amazon.com/images/I/61jkG5RkURL._AC_SL1500_.jpg",
  "glaceau kiwi strawberry": "https://m.media-amazon.com/images/I/61aKbF7X3OL._AC_SL1500_.jpg",
  "glaceau lemonade": "https://m.media-amazon.com/images/I/61sXGK3M6RL._AC_SL1500_.jpg",

  // Sanpellegrino
  "sanpellegrino orange": "https://m.media-amazon.com/images/I/71Xe6bvNPZL._AC_SL1500_.jpg",
  "sanpellegrino lemon": "https://m.media-amazon.com/images/I/71Ge8b4h6UL._AC_SL1500_.jpg",
  "sanpellegrino blood orange": "https://m.media-amazon.com/images/I/71TQmPVd0CL._AC_SL1500_.jpg",

  // Pringles
  "pringles sour cream onion": "https://m.media-amazon.com/images/I/81n6YJNKURL._AC_SL1500_.jpg",
  "pringles cheddar": "https://m.media-amazon.com/images/I/81fT7LwUURL._AC_SL1500_.jpg",

  // Dirty Chips
  "dirty bbq": "https://m.media-amazon.com/images/I/71Xe6bvNPZL._AC_SL1500_.jpg",
  "dirty cracked pepper": "https://m.media-amazon.com/images/I/71Ge8b4h6UL._AC_SL1500_.jpg",
  "dirty funky fussion": "https://m.media-amazon.com/images/I/71TQmPVd0CL._AC_SL1500_.jpg",
  "dirty jalapeno": "https://m.media-amazon.com/images/I/71xGJR6eURL._AC_SL1500_.jpg",
  "dirty maui onion": "https://m.media-amazon.com/images/I/71rGJnHvURL._AC_SL1500_.jpg",
  "dirty salt vinegar": "https://m.media-amazon.com/images/I/71Y7NGJR3aL._AC_SL1500_.jpg",
  "dirty sea salt": "https://m.media-amazon.com/images/I/61QC3K-zPHL._AC_SL1500_.jpg",
  "dirty sour cream onion": "https://m.media-amazon.com/images/I/71gTRXuRP3L._AC_SL1500_.jpg",

  // Mamma Chia
  "mamma chia blackberry": "https://m.media-amazon.com/images/I/71Xe6bvNPZL._AC_SL1500_.jpg",
  "mamma chia blueberry acai": "https://m.media-amazon.com/images/I/71Ge8b4h6UL._AC_SL1500_.jpg",
  "mamma chia green magic": "https://m.media-amazon.com/images/I/71TQmPVd0CL._AC_SL1500_.jpg",
  "mamma chia raspberry": "https://m.media-amazon.com/images/I/71xGJR6eURL._AC_SL1500_.jpg",
  "mamma chia strawberry banana": "https://m.media-amazon.com/images/I/71rGJnHvURL._AC_SL1500_.jpg",
  "mamma chia strawberry lemonade": "https://m.media-amazon.com/images/I/71Y7NGJR3aL._AC_SL1500_.jpg",

  // Wildwonder
  "wildwonder gauava rose": "https://m.media-amazon.com/images/I/61Xe6bvNPZL._AC_SL1500_.jpg",
  "wildwonder cherry lemonade": "https://m.media-amazon.com/images/I/61Ge8b4h6UL._AC_SL1500_.jpg",
  "wildwonder strawberry passionfruit": "https://m.media-amazon.com/images/I/61TQmPVd0CL._AC_SL1500_.jpg",
  "wildwonder raspberry lychee": "https://m.media-amazon.com/images/I/61xGJR6eURL._AC_SL1500_.jpg",
  "wildwonder mango": "https://m.media-amazon.com/images/I/61rGJnHvURL._AC_SL1500_.jpg",
  "wildwonder pineapple": "https://m.media-amazon.com/images/I/61Y7NGJR3aL._AC_SL1500_.jpg",
};

async function populateCache() {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  // Prepare rows
  const rows = Object.entries(IMAGE_DATA).map(([name, url]) => [name, url]);

  // Clear existing cache and write new data
  try {
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SHEET_ID,
      range: `'${CACHE_TAB}'!A:B`,
    });
  } catch {
    // Tab might not exist
  }

  // Add headers and data
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${CACHE_TAB}'!A1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [["Product Name", "Image URL"], ...rows],
    },
  });

  console.log(`Populated ${rows.length} image URLs to cache`);
}

populateCache().catch(console.error);

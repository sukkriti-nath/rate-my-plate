// Snack and Beverage Inventory
// Embedded from CSV files for simplicity

export interface InventoryItem {
  category: string;
  brand: string;
  flavor: string;
}

// Drink categories for token allocation (100 tokens total)
export const DRINK_CATEGORIES = [
  { emoji: "☕", name: "Coffee & Lattes" },
  { emoji: "🍵", name: "Tea" },
  { emoji: "🧉", name: "Yerba Mate" },
  { emoji: "🧃", name: "Juice" },
  { emoji: "⚡", name: "Energy Drinks" },
  { emoji: "🥤", name: "Sparkling & Soda" },
  { emoji: "💧", name: "Water" },
  { emoji: "🥛", name: "Milk Tea" },
  { emoji: "💪", name: "Protein Drinks" },
  { emoji: "🌿", name: "Wellness Shots" },
] as const;

// Snack categories for token allocation (100 tokens total)
export const SNACK_CATEGORIES = [
  { emoji: "🍪", name: "Baked Goods" },
  { emoji: "🍫", name: "Chocolate & Candy" },
  { emoji: "🥜", name: "Chips" },
  { emoji: "🍿", name: "Popcorn & Crackers" },
  { emoji: "💪", name: "Protein Bars" },
  { emoji: "🥗", name: "Granola & Oatmeal" },
  { emoji: "🍎", name: "Fruit Snacks" },
  { emoji: "🥩", name: "Jerky" },
  { emoji: "🌊", name: "Seaweed" },
  { emoji: "🥾", name: "Trail Mix & Nuts" },
] as const;

export const TOKENS_PER_CLICK = 10;
export const MAX_TOKENS = 100;

// Beverages inventory
export const BEVERAGES: InventoryItem[] = [
  { category: "Cold Brew Tea", brand: "Boncha", flavor: "honey kumquat" },
  { category: "Sparkling Tea", brand: "BrightLeaf", flavor: "jasmine" },
  { category: "Sparkling Tea", brand: "BrightLeaf", flavor: "earl grey" },
  { category: "Sparkling Tea", brand: "BrightLeaf", flavor: "chamomile" },
  { category: "Cold Brew Latte Alternative", brand: "Califia", flavor: "almond salted caramel" },
  { category: "Juice", brand: "California Juice", flavor: "mojave" },
  { category: "Juice", brand: "California Juice", flavor: "mavericks" },
  { category: "Juice", brand: "California Juice", flavor: "santa barbara" },
  { category: "Juice", brand: "California Juice", flavor: "orange" },
  { category: "Juice", brand: "California Juice", flavor: "lemonade" },
  { category: "Juice", brand: "California Juice", flavor: "El Capitan" },
  { category: "Juice", brand: "California Juice", flavor: "Big Sur" },
  { category: "Juice", brand: "California Juice", flavor: "Redwood" },
  { category: "Juice", brand: "California Juice", flavor: "grapefruit" },
  { category: "Energy Drink", brand: "Celsius", flavor: "cosmic vibe" },
  { category: "Energy Drink", brand: "Celsius", flavor: "orange" },
  { category: "Energy Drink", brand: "Celsius", flavor: "watermelon" },
  { category: "Energy Drink", brand: "Celsius", flavor: "blue lemonade" },
  { category: "Energy Drink", brand: "Celsius", flavor: "kiwi guava" },
  { category: "Energy Drink", brand: "Celsius", flavor: "tropical" },
  { category: "Energy Drink", brand: "Celsius", flavor: "apple pear" },
  { category: "Energy Drink", brand: "Celsius", flavor: "apple cherry" },
  { category: "Energy Drink", brand: "Celsius", flavor: "raspberry acai" },
  { category: "Yerba Mate", brand: "Clean", flavor: "mint honey" },
  { category: "Yerba Mate", brand: "Clean", flavor: "blackberry" },
  { category: "Yerba Mate", brand: "Clean", flavor: "raspberry" },
  { category: "Yerba Mate", brand: "Clean", flavor: "watermelon" },
  { category: "Protein Shake", brand: "Core Power", flavor: "chocolate" },
  { category: "Protein Shake", brand: "Core Power", flavor: "vanilla" },
  { category: "Probiotic Soda", brand: "Culture Pop", flavor: "strawberry rhubarb" },
  { category: "Probiotic Soda", brand: "Culture Pop", flavor: "wild berries lime" },
  { category: "Tepache", brand: "De La Calle", flavor: "pineapple spice" },
  { category: "Tepache", brand: "De La Calle", flavor: "mango chili" },
  { category: "Tepache", brand: "De La Calle", flavor: "prickly pear" },
  { category: "Tepache", brand: "De La Calle", flavor: "grapefruit lime" },
  { category: "Tepache", brand: "De La Calle", flavor: "mandarin" },
  { category: "Protein Smoothie", brand: "Designer Wellness", flavor: "blueberry" },
  { category: "Protein Smoothie", brand: "Designer Wellness", flavor: "mango peach" },
  { category: "Protein Smoothie", brand: "Designer Wellness", flavor: "tropical fruit" },
  { category: "Protein Smoothie", brand: "Designer Wellness", flavor: "strawberry banana" },
  { category: "Protein Smoothie", brand: "Designer Wellness", flavor: "mixed berry" },
  { category: "Water Vitamin", brand: "Glaceau", flavor: "mango" },
  { category: "Water Vitamin", brand: "Glaceau", flavor: "tropical citrus" },
  { category: "Water Vitamin", brand: "Glaceau", flavor: "orange" },
  { category: "Water Vitamin", brand: "Glaceau", flavor: "acai" },
  { category: "Water Vitamin", brand: "Glaceau", flavor: "dragonfruit" },
  { category: "Water Vitamin", brand: "Glaceau", flavor: "kiwi strawberry" },
  { category: "Water Vitamin", brand: "Glaceau", flavor: "lemonade" },
  { category: "Probiotic Soda", brand: "Olipop", flavor: "vintage cola" },
  { category: "Probiotic Soda", brand: "Olipop", flavor: "strawberry vanilla" },
  { category: "Probiotic Soda", brand: "Olipop", flavor: "grape" },
  { category: "Probiotic Soda", brand: "Olipop", flavor: "orange squeeze" },
  { category: "Probiotic Soda", brand: "Olipop", flavor: "root beer" },
  { category: "Sparkling Water", brand: "Spindrift", flavor: "lemon" },
  { category: "Sparkling Water", brand: "Spindrift", flavor: "grapefruit" },
  { category: "Sparkling Water", brand: "Spindrift", flavor: "raspberry lime" },
];

// Snacks inventory
export const SNACKS: InventoryItem[] = [
  { category: "Baked Goods", brand: "Sweet Street", flavor: "blondie" },
  { category: "Baked Goods", brand: "Sweet Street", flavor: "brownie" },
  { category: "Baked Goods", brand: "Sweet Street", flavor: "chocolate chip cookie" },
  { category: "Baked Goods", brand: "Sweet Street", flavor: "rice krispy" },
  { category: "Baked Goods", brand: "Sweet Street", flavor: "salted caramel cookie" },
  { category: "Candy", brand: "White Rabbit", flavor: "original" },
  { category: "Chia Pouches", brand: "Mamma Chia", flavor: "blackberry" },
  { category: "Chia Pouches", brand: "Mamma Chia", flavor: "blueberry acai" },
  { category: "Chia Pouches", brand: "Mamma Chia", flavor: "green magic" },
  { category: "Chia Pouches", brand: "Mamma Chia", flavor: "raspberry" },
  { category: "Chia Pouches", brand: "Mamma Chia", flavor: "strawberry banana" },
  { category: "Chips Potato", brand: "Kettle", flavor: "jalapeno" },
  { category: "Chips Potato", brand: "Kettle", flavor: "salt pepper" },
  { category: "Chips Potato", brand: "Kettle", flavor: "dill pickle" },
  { category: "Chips Potato", brand: "Dirty", flavor: "funky fusion" },
  { category: "Chips Potato", brand: "Dirty", flavor: "maui onion" },
  { category: "Chips Potato", brand: "Dirty", flavor: "sour cream onion" },
  { category: "Chips Potato", brand: "Torres", flavor: "Iberico ham" },
  { category: "Chips Potato", brand: "Torres", flavor: "olive oil" },
  { category: "Chips Potato", brand: "Pringles", flavor: "sour cream onion" },
  { category: "Chips Potato", brand: "Pringles", flavor: "cheddar" },
  { category: "Chips Tortilla", brand: "Quest", flavor: "cool ranch" },
  { category: "Chips Tortilla", brand: "Quest", flavor: "nacho" },
  { category: "Chips Tortilla", brand: "Quest", flavor: "sweet chili" },
  { category: "Chips Tortilla", brand: "Siete", flavor: "cinnamon churrio" },
  { category: "Chips Tortilla", brand: "Siete", flavor: "lime" },
  { category: "Chips Tortilla", brand: "Siete", flavor: "sea salt" },
  { category: "Chocolate", brand: "Undercover", flavor: "chocolate quinoa crisp" },
  { category: "Cookies Protein", brand: "Lenny & Larry's", flavor: "birthday cake" },
  { category: "Cookies Protein", brand: "Lenny & Larry's", flavor: "chocolate mint" },
  { category: "Cookies Protein", brand: "Quest", flavor: "chocolate chip" },
  { category: "Crackers", brand: "Annie's", flavor: "cheddar bunnies" },
  { category: "Fruit Gummies", brand: "Solely", flavor: "mango" },
  { category: "Fruit Gummies", brand: "Solely", flavor: "mango guava" },
  { category: "Fruit Jerky", brand: "Solely", flavor: "banana w/ cacao" },
  { category: "Fruit Jerky", brand: "Solely", flavor: "mango" },
  { category: "Fruit Jerky", brand: "Solely", flavor: "pineapple" },
  { category: "Granola", brand: "Made Good", flavor: "birthday cake" },
  { category: "Granola", brand: "Made Good", flavor: "chocolate banana balls" },
  { category: "Granola", brand: "Made Good", flavor: "cookies & cream" },
  { category: "Granola", brand: "Made Good", flavor: "mixed berry" },
  { category: "Gummies Energy", brand: "Probar", flavor: "berry" },
  { category: "Gummies Energy", brand: "Probar", flavor: "strawberry" },
  { category: "Meat Jerky", brand: "Epic", flavor: "chicken sriracha" },
  { category: "Meat Jerky", brand: "Epic", flavor: "salmon" },
  { category: "Meat Jerky", brand: "Epic", flavor: "venison" },
  { category: "Meat Jerky", brand: "Epic", flavor: "wagyu" },
  { category: "Meat Jerky", brand: "Field Trip", flavor: "gochujang beef" },
  { category: "Meat Jerky", brand: "Field Trip", flavor: "original beef" },
  { category: "Meat Jerky", brand: "Field Trip", flavor: "salt & pepper turkey" },
  { category: "Popcorn", brand: "Angie's", flavor: "sweet salty" },
  { category: "Popcorn", brand: "Lesser Evil", flavor: "himalayan gold" },
  { category: "Popcorn", brand: "Lesser Evil", flavor: "himalayan pink salt" },
  { category: "Protein Bar", brand: "GoMacro", flavor: "maple sea salt" },
  { category: "Protein Bar", brand: "GoMacro", flavor: "mocha chocolate" },
  { category: "Protein Bar", brand: "GoMacro", flavor: "lemon" },
  { category: "Protein Bar", brand: "NuGo", flavor: "chocolate cherry" },
  { category: "Protein Bar", brand: "NuGo", flavor: "chocolate pretzel" },
  { category: "Protein Bar", brand: "Power Crunch", flavor: "chocolate mint" },
  { category: "Protein Bar", brand: "Power Crunch", flavor: "red velvet" },
  { category: "Protein Bar", brand: "RxBar", flavor: "blueberry" },
  { category: "Protein Bar", brand: "RxBar", flavor: "strawberry" },
  { category: "Protein Bar", brand: "RxBar", flavor: "vanilla almond" },
  { category: "Protein Bar", brand: "Think", flavor: "cupcake" },
  { category: "Seaweed", brand: "Gimme", flavor: "chili lime" },
  { category: "Seaweed", brand: "Gimme", flavor: "olive oil" },
  { category: "Seaweed", brand: "Gimme", flavor: "sea salt" },
  { category: "Seaweed", brand: "Gimme", flavor: "sesame" },
  { category: "Seaweed", brand: "Gimme", flavor: "teriyaki" },
  { category: "Seaweed", brand: "Gimme", flavor: "wasabi" },
  { category: "Seaweed", brand: "Sang Tawan", flavor: "corn" },
  { category: "Seaweed", brand: "Sang Tawan", flavor: "gochujang" },
  { category: "Seaweed", brand: "Sang Tawan", flavor: "tom yum" },
  { category: "Trail Mix", brand: "Sahale", flavor: "honey almond" },
  { category: "Trail Mix", brand: "Sahale", flavor: "gochujang almonds" },
  { category: "Trail Mix", brand: "Sahale", flavor: "pomegranate pistachio" },
  { category: "Trail Mix", brand: "Sahale", flavor: "tangerine vanilla cashew" },
  { category: "Snack Bar", brand: "Kind", flavor: "cranberry almond" },
  { category: "Snack Bar", brand: "Kind", flavor: "fruit nut" },
  { category: "Snack Bar", brand: "Kind", flavor: "peanut butter chocolate" },
];

// Combined inventory
export const ALL_INVENTORY: InventoryItem[] = [...BEVERAGES, ...SNACKS];

// Get full item name
export function getItemName(item: InventoryItem): string {
  return `${item.brand} ${item.flavor}`.trim();
}

// Get inventory grouped by category
export function getInventoryByCategory(): Record<string, InventoryItem[]> {
  const grouped: Record<string, InventoryItem[]> = {};
  for (const item of ALL_INVENTORY) {
    if (!grouped[item.category]) {
      grouped[item.category] = [];
    }
    grouped[item.category].push(item);
  }
  return grouped;
}

// Search inventory
export function searchInventory(query: string): InventoryItem[] {
  const q = query.toLowerCase();
  return ALL_INVENTORY.filter(
    (item) =>
      item.brand.toLowerCase().includes(q) ||
      item.flavor.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
  );
}

// Get items for dropdown (Slack format)
export function getItemOptionsForSlack(): { label: string; options: { text: string; value: string }[] }[] {
  const grouped = getInventoryByCategory();
  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, items]) => ({
      label: category,
      options: items
        .map((item) => ({
          text: getItemName(item),
          value: getItemName(item),
        }))
        .sort((a, b) => a.text.localeCompare(b.text)),
    }));
}

import { NextResponse } from "next/server";
import {
  getAllProfiles,
  getSuggestions,
  getLeaderboard,
  getCategoryDemand,
  getMostWantedItems,
} from "@/lib/snack-sheets-sync";
import { getInventoryStructuredRows } from "@/lib/snack-sheet";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [profiles, suggestions, leaderboard, categoryDemand, mostWanted, inventory] =
      await Promise.all([
        getAllProfiles(),
        getSuggestions(),
        getLeaderboard(1000),
        getCategoryDemand(),
        getMostWantedItems(50),
        getInventoryStructuredRows(),
      ]);

    // --- Engagement stats ---
    const profileCount = profiles.length;
    const suggestionCount = suggestions.length;
    const totalUpvotes = suggestions.reduce((s, sg) => s + sg.upvotes, 0);

    // Profiles created per month
    const profilesByMonth: Record<string, number> = {};
    for (const p of profiles) {
      if (p.createdAt) {
        const d = new Date(p.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        profilesByMonth[key] = (profilesByMonth[key] || 0) + 1;
      }
    }

    // Suggestions per month
    const suggestionsByMonth: Record<string, number> = {};
    for (const s of suggestions) {
      if (s.createdAt) {
        const d = new Date(s.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        suggestionsByMonth[key] = (suggestionsByMonth[key] || 0) + 1;
      }
    }

    // --- Beverage vs Snack allocation split ---
    let totalDrinkTokens = 0;
    let totalSnackTokens = 0;
    const drinkCategoryDemand: Record<string, number> = {};
    const snackCategoryDemand: Record<string, number> = {};

    for (const p of profiles) {
      for (const [cat, tokens] of Object.entries(p.drinksAllocation)) {
        totalDrinkTokens += tokens;
        drinkCategoryDemand[cat] = (drinkCategoryDemand[cat] || 0) + tokens;
      }
      for (const [cat, tokens] of Object.entries(p.snacksAllocation)) {
        totalSnackTokens += tokens;
        snackCategoryDemand[cat] = (snackCategoryDemand[cat] || 0) + tokens;
      }
    }

    const drinkCategories = Object.entries(drinkCategoryDemand)
      .map(([category, tokens]) => ({ category, tokens, percent: 0 }))
      .sort((a, b) => b.tokens - a.tokens);
    const drinkTotal = drinkCategories.reduce((s, c) => s + c.tokens, 0) || 1;
    drinkCategories.forEach((c) => (c.percent = Math.round((c.tokens / drinkTotal) * 100)));

    const snackCategories = Object.entries(snackCategoryDemand)
      .map(([category, tokens]) => ({ category, tokens, percent: 0 }))
      .sort((a, b) => b.tokens - a.tokens);
    const snackTotal = snackCategories.reduce((s, c) => s + c.tokens, 0) || 1;
    snackCategories.forEach((c) => (c.percent = Math.round((c.tokens / snackTotal) * 100)));

    // --- Most wanted beverages vs snacks ---
    const drinkFavorites: Record<string, number> = {};
    const snackFavorites: Record<string, number> = {};
    for (const p of profiles) {
      for (let i = 0; i < p.favoriteDrinks.length; i++) {
        const score = (5 - i) * 3;
        drinkFavorites[p.favoriteDrinks[i]] = (drinkFavorites[p.favoriteDrinks[i]] || 0) + score;
      }
      for (let i = 0; i < p.favoriteSnacks.length; i++) {
        const score = (5 - i) * 3;
        snackFavorites[p.favoriteSnacks[i]] = (snackFavorites[p.favoriteSnacks[i]] || 0) + score;
      }
    }

    const topDrinks = Object.entries(drinkFavorites)
      .map(([item, score]) => ({ item, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);

    const topSnacks = Object.entries(snackFavorites)
      .map(([item, score]) => ({ item, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);

    // --- Inventory summary ---
    const inventoryByTab: Record<string, number> = {};
    const inventoryCategoryCount: Record<string, number> = {};
    for (const row of inventory) {
      inventoryByTab[row.tab] = (inventoryByTab[row.tab] || 0) + 1;
      const cat = `${row.tab}:${row.category}`;
      inventoryCategoryCount[cat] = (inventoryCategoryCount[cat] || 0) + 1;
    }

    // --- Top suggestions (by net votes) ---
    const topSuggestions = [...suggestions]
      .sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes))
      .slice(0, 10)
      .map((s) => ({
        name: s.snackName,
        submittedBy: s.submittedByName,
        upvotes: s.upvotes,
        downvotes: s.downvotes,
        net: s.upvotes - s.downvotes,
      }));

    return NextResponse.json({
      engagement: {
        profileCount,
        suggestionCount,
        totalUpvotes,
        profilesByMonth,
        suggestionsByMonth,
      },
      allocation: {
        totalDrinkTokens,
        totalSnackTokens,
        drinkCategories,
        snackCategories,
        combined: categoryDemand,
      },
      favorites: {
        topDrinks,
        topSnacks,
        topOverall: mostWanted,
      },
      inventory: {
        totalBeverages: inventoryByTab["beverages"] || 0,
        totalSnacks: inventoryByTab["snacks"] || 0,
        byCategory: inventoryCategoryCount,
      },
      topSuggestions,
    });
  } catch (error) {
    console.error("Error generating snack report:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}

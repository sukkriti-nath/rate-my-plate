import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SPOONACULAR_API_KEY = "72c9992860c34c468ad4e3e657f5ba3b";

interface SpoonacularProduct {
  id: number;
  title: string;
  image: string;
  imageType: string;
}

interface SpoonacularSearchResponse {
  products: SpoonacularProduct[];
  totalProducts: number;
  type: string;
  offset: number;
  number: number;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query || query.length < 2) {
    return NextResponse.json({ products: [] });
  }

  try {
    const url = new URL("https://api.spoonacular.com/food/products/search");
    url.searchParams.set("query", query);
    url.searchParams.set("number", "8"); // Limit results to save API quota
    url.searchParams.set("apiKey", SPOONACULAR_API_KEY);

    const res = await fetch(url.toString());

    if (!res.ok) {
      console.error("Spoonacular API error:", res.status, await res.text());
      return NextResponse.json({ products: [] });
    }

    const data: SpoonacularSearchResponse = await res.json();

    return NextResponse.json({
      products: data.products.map((p) => ({
        id: String(p.id),
        name: p.title,
        brand: "",
        category: "",
        imageUrl: p.image || null,
      })),
    });
  } catch (e) {
    console.error("GET /api/snacks/search:", e);
    return NextResponse.json(
      { error: "Failed to search products" },
      { status: 500 }
    );
  }
}

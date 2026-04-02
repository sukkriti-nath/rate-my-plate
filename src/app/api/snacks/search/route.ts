import { NextResponse } from "next/server";
import { searchProducts } from "@/lib/openfoodfacts-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const category = searchParams.get("category") as "snacks" | "beverages" | "all" | null;

  if (!query || query.length < 2) {
    return NextResponse.json({ products: [] });
  }

  try {
    const products = await searchProducts(query, {
      limit: 5,
      category: category || "all",
    });

    return NextResponse.json({
      products: products.map((p) => ({
        id: p.id,
        name: p.brand ? `${p.brand} ${p.name}` : p.name,
        brand: p.brand,
        category: p.category,
        imageUrl: p.imageUrl,
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

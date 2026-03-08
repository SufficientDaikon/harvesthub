import type { Product } from "../src/types/product.js";

/**
 * Generate N deterministic test products for E2E seeding.
 */
export function makeTestProducts(count: number): Product[] {
  const brands = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"];
  const categories = [
    "Electronics",
    "Clothing",
    "Home & Garden",
    "Sports",
    "Books",
  ];
  const avails: Product["availability"][] = [
    "in_stock",
    "out_of_stock",
    "in_stock",
    "in_stock",
    "unknown",
  ];

  const products: Product[] = [];
  for (let i = 1; i <= count; i++) {
    const brandIdx = (i - 1) % brands.length;
    const brand = brands[brandIdx]!;
    const category = categories[brandIdx]!;
    const availability = avails[brandIdx]!;
    const price = Math.round((10 + i * 7.5) * 100) / 100;
    const oldPrice =
      Math.round((price + (i % 3 === 0 ? 10 : i % 3 === 1 ? -5 : 0)) * 100) /
      100;

    products.push({
      id: `test-${String(i).padStart(3, "0")}`,
      sourceUrl: `https://example.com/product/${i}`,
      scrapedAt: new Date(Date.now() - i * 3600_000).toISOString(),
      title: `${brand} Product ${i}`,
      price,
      currency: "USD",
      description: `Test product ${i} from ${brand}`,
      images: [],
      availability,
      brand,
      sku: `SKU-${i}`,
      mpn: null,
      gtin: null,
      category,
      rating: 3.5 + (i % 15) / 10,
      reviewCount: i * 10,
      specifications: {},
      seller: null,
      shipping: null,
      alternativePrices: [],
      confidenceScores: { title: 90, price: 85 },
      overallConfidence: 70 + (i % 30),
      extractionMethod: "adaptive",
      metadata: {},
      priceHistory: [
        {
          price: oldPrice,
          currency: "USD",
          recordedAt: new Date(Date.now() - 30 * 86400_000).toISOString(),
        },
        {
          price: Math.round(((oldPrice + price) / 2) * 100) / 100,
          currency: "USD",
          recordedAt: new Date(Date.now() - 15 * 86400_000).toISOString(),
        },
      ],
    });
  }
  return products;
}

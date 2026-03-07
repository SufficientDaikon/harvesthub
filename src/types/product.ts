export type Availability =
  | "in_stock"
  | "out_of_stock"
  | "pre_order"
  | "unknown";

export type ExtractionMethod = "adaptive" | "template" | "ai_fallback";

export interface ConfidenceScores {
  title: number;
  price: number;
  currency: number;
  description: number;
  images: number;
  availability: number;
  brand: number;
  sku: number;
  mpn: number;
  gtin: number;
  category: number;
  rating: number;
  reviewCount: number;
  specifications: number;
  seller: number;
  shipping: number;
}

export interface Product {
  id: string;
  sourceUrl: string;
  scrapedAt: string;
  title: string;
  price: number;
  currency: string;
  description: string | null;
  images: string[];
  availability: Availability;
  brand: string | null;
  sku: string | null;
  mpn: string | null;
  gtin: string | null;
  category: string | null;
  rating: number | null;
  reviewCount: number | null;
  specifications: Record<string, string>;
  seller: string | null;
  shipping: string | null;
  alternativePrices: Array<{ price: number; currency: string }>;
  confidenceScores: Partial<ConfidenceScores>;
  overallConfidence: number;
  extractionMethod: ExtractionMethod;
  metadata: Record<string, unknown>;
  priceHistory?: Array<{ price: number; currency: string; recordedAt: string }>;
}

export interface ProductChangeRecord {
  id: string;
  productId: string;
  field: keyof Product;
  oldValue: unknown;
  newValue: unknown;
  detectedAt: string;
}

import type { Product, Availability } from "../types/index.js";

const CURRENCY_SYMBOLS: Record<string, string> = {
  $: "USD",
  "€": "EUR",
  "£": "GBP",
  "¥": "JPY",
  "₹": "INR",
  "₺": "TRY",
  "₽": "RUB",
  "₩": "KRW",
  R$: "BRL",
  "₫": "VND",
  SAR: "SAR",
  AED: "AED",
  EGP: "EGP",
  QAR: "QAR",
  KWD: "KWD",
  BHD: "BHD",
  OMR: "OMR",
  JOD: "JOD",
};

export function normalizePrice(
  raw: string | number | null | undefined,
): { price: number; currency: string } | null {
  if (raw == null) return null;

  let str = String(raw).trim();
  if (!str) return null;

  let currency = "";
  for (const [symbol, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (str.includes(symbol)) {
      currency = code;
      str = str.replace(
        new RegExp(symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
        "",
      );
      break;
    }
  }

  str = str.replace(/[^\d.,\-]/g, "").trim();
  if (!str) return null;

  // EU format: 1.234,56 → 1234.56
  if (/^\d{1,3}(\.\d{3})*(,\d{1,2})?$/.test(str)) {
    str = str.replace(/\./g, "").replace(",", ".");
  }
  // US format: 1,234.56 → 1234.56
  else if (/^\d{1,3}(,\d{3})*(\.\d{1,2})?$/.test(str)) {
    str = str.replace(/,/g, "");
  }
  // Simple comma decimal: 123,45 → 123.45
  else if (/^\d+(,\d{1,2})$/.test(str)) {
    str = str.replace(",", ".");
  }

  const price = parseFloat(str);
  if (isNaN(price) || price < 0) return null;

  return { price: Math.round(price * 100) / 100, currency };
}

export function normalizeAvailability(
  raw: string | null | undefined,
): Availability {
  if (!raw) return "unknown";
  const lower = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (lower.includes("instock") || lower.includes("available"))
    return "in_stock";
  if (
    lower.includes("outofstock") ||
    lower.includes("soldout") ||
    lower.includes("unavailable")
  )
    return "out_of_stock";
  if (lower.includes("preorder") || lower.includes("comingsoon"))
    return "pre_order";
  return "unknown";
}

export function resolveUrl(
  url: string | null | undefined,
  baseUrl: string,
): string | null {
  if (!url) return null;
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return null;
  }
}

export function sanitizeText(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw
    .replace(/<[^>]*>/g, "") // strip HTML tags
    .replace(/&[a-z]+;/gi, " ") // strip HTML entities
    .replace(/\s+/g, " ") // collapse whitespace
    .trim()
    .slice(0, 10000); // max 10k chars
}

export function normalizeProduct(
  raw: Partial<Product>,
  sourceUrl: string,
): Partial<Product> {
  const priceResult = normalizePrice(raw.price);

  const images = (raw.images ?? [])
    .map((img) => resolveUrl(img, sourceUrl))
    .filter((img): img is string => img !== null);

  return {
    ...raw,
    sourceUrl,
    title: sanitizeText(raw.title) ?? "",
    price: priceResult?.price ?? 0,
    currency: raw.currency || priceResult?.currency || "",
    description: sanitizeText(raw.description),
    images,
    availability: normalizeAvailability(raw.availability as string),
    brand: sanitizeText(raw.brand),
    sku: raw.sku?.trim() ?? null,
    mpn: raw.mpn?.trim() ?? null,
    gtin: raw.gtin?.trim() ?? null,
    category: sanitizeText(raw.category),
  };
}

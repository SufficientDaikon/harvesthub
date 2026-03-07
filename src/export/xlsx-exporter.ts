import ExcelJS from "exceljs";
import { resolve } from "node:path";
import type { Product } from "../types/index.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("xlsx-exporter");

const HEADER_BG = "FF1A1A2E";
const HEADER_FG = "FFFFFFFF";
const ALT_ROW_BG = "FFF8F9FA";
const IN_STOCK_BG = "FFE2EFDA";
const OUT_STOCK_BG = "FFFCE4EC";

const PRODUCT_COLUMNS: Array<{
  header: string;
  key: keyof Product | string;
  width: number;
}> = [
  { header: "ID", key: "id", width: 12 },
  { header: "Title", key: "title", width: 40 },
  { header: "Price", key: "price", width: 14 },
  { header: "Currency", key: "currency", width: 10 },
  { header: "Availability", key: "availability", width: 14 },
  { header: "Brand", key: "brand", width: 16 },
  { header: "SKU", key: "sku", width: 18 },
  { header: "MPN", key: "mpn", width: 18 },
  { header: "GTIN", key: "gtin", width: 18 },
  { header: "Category", key: "category", width: 28 },
  { header: "Description", key: "description", width: 50 },
  { header: "Rating", key: "rating", width: 10 },
  { header: "Reviews", key: "reviewCount", width: 10 },
  { header: "Images", key: "imageCount", width: 10 },
  { header: "Confidence", key: "overallConfidence", width: 12 },
  { header: "Source URL", key: "sourceUrl", width: 45 },
  { header: "Scraped At", key: "scrapedAt", width: 20 },
];

export async function exportXlsx(
  products: Product[],
  outputPath: string,
): Promise<string> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "HarvestHub";
  wb.created = new Date();

  // --- Summary Sheet ---
  const summary = wb.addWorksheet("Summary", {
    properties: { tabColor: { argb: "FF1A1A2E" } },
  });
  const summaryData: Array<[string, string | number]> = [
    ["HarvestHub Export Report", ""],
    ["", ""],
    ["Total Products", products.length],
    ["In Stock", products.filter((p) => p.availability === "in_stock").length],
    [
      "Out of Stock",
      products.filter((p) => p.availability === "out_of_stock").length,
    ],
    [
      "Average Price",
      products.length
        ? Math.round(
            (products.reduce((s, p) => s + p.price, 0) / products.length) * 100,
          ) / 100
        : 0,
    ],
    [
      "Average Confidence",
      products.length
        ? Math.round(
            products.reduce((s, p) => s + p.overallConfidence, 0) /
              products.length,
          )
        : 0,
    ],
    [
      "Unique Brands",
      new Set(products.map((p) => p.brand).filter(Boolean)).size,
    ],
    [
      "Unique Categories",
      new Set(products.map((p) => p.category).filter(Boolean)).size,
    ],
    ["Export Date", new Date().toISOString()],
  ];

  summaryData.forEach(([label, value], i) => {
    const row = summary.getRow(i + 1);
    row.getCell(1).value = label;
    row.getCell(2).value = value;

    if (i === 0) {
      row.getCell(1).font = {
        bold: true,
        size: 16,
        color: { argb: "FF1A1A2E" },
      };
      row.height = 30;
    } else if (i >= 2) {
      row.getCell(1).font = { bold: true, size: 11 };
      row.getCell(2).font = { size: 11 };
      row.getCell(2).alignment = { horizontal: "right" };
    }
  });

  summary.getColumn(1).width = 25;
  summary.getColumn(2).width = 20;

  // --- Products Sheet ---
  const ws = wb.addWorksheet("Products", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  ws.columns = PRODUCT_COLUMNS.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width,
  }));

  // Style header row
  const headerRow = ws.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_FG }, size: 11 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_BG },
    };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    cell.border = {
      bottom: { style: "medium", color: { argb: "FF1A1A2E" } },
    };
  });

  // Add data rows
  for (const product of products) {
    const row = ws.addRow({
      id: product.id,
      title: product.title,
      price: product.price,
      currency: product.currency,
      availability: product.availability,
      brand: product.brand ?? "",
      sku: product.sku ?? "",
      mpn: product.mpn ?? "",
      gtin: product.gtin ?? "",
      category: product.category ?? "",
      description: (product.description ?? "").slice(0, 300),
      rating: product.rating ?? "",
      reviewCount: product.reviewCount ?? "",
      imageCount: product.images.length,
      overallConfidence: product.overallConfidence,
      sourceUrl: product.sourceUrl,
      scrapedAt: product.scrapedAt,
    });

    row.eachCell((cell) => {
      cell.alignment = { vertical: "top", wrapText: true };
      cell.font = { size: 10 };
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
      };
    });

    // Alternating row colors
    if (row.number % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: ALT_ROW_BG },
        };
      });
    }

    // Availability highlighting
    const availCell = row.getCell("availability");
    if (product.availability === "in_stock") {
      availCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: IN_STOCK_BG },
      };
    } else if (product.availability === "out_of_stock") {
      availCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: OUT_STOCK_BG },
      };
    }

    // Hyperlink on source URL
    const urlCell = row.getCell("sourceUrl");
    if (product.sourceUrl) {
      urlCell.value = {
        text: product.sourceUrl,
        hyperlink: product.sourceUrl,
      } as ExcelJS.CellHyperlinkValue;
      urlCell.font = { size: 10, color: { argb: "FF0563C1" }, underline: true };
    }

    // Confidence color
    const confCell = row.getCell("overallConfidence");
    if (product.overallConfidence >= 80) {
      confCell.font = { size: 10, bold: true, color: { argb: "FF28A745" } };
    } else if (product.overallConfidence >= 50) {
      confCell.font = { size: 10, color: { argb: "FFFFC107" } };
    } else {
      confCell.font = { size: 10, bold: true, color: { argb: "FFDC3545" } };
    }

    // Price formatting
    const priceCell = row.getCell("price");
    priceCell.numFmt = "#,##0.00";
  }

  // Auto-filter
  ws.autoFilter = { from: "A1", to: `Q${products.length + 1}` };

  const fullPath = resolve(outputPath);
  await wb.xlsx.writeFile(fullPath);
  log.info({ path: fullPath, count: products.length }, "XLSX export complete");
  return fullPath;
}

#!/usr/bin/env python3
"""
HarvestHub Scraping Engine — Adaptive product data extraction using Scrapling.

Protocol: Reads JSON from stdin, writes JSON to stdout.
Schema (in):  { "url": str, "timeout": int, "user_agent": str, "use_stealth": bool }
Schema (out): { "success": bool, "product": {...}, "error": str?, "error_type": str?, "http_status": int?, "elapsed_ms": int?, "is_product_page": bool }
"""
import sys
import json
import time
import traceback
import warnings
import logging

# Suppress Scrapling deprecation warnings and info logs from polluting stdout
warnings.filterwarnings("ignore")
logging.disable(logging.CRITICAL)

try:
    import orjson
    def dumps(obj): return orjson.dumps(obj).decode()
    def loads(s): return orjson.loads(s)
except ImportError:
    dumps = lambda obj: json.dumps(obj, ensure_ascii=False)
    loads = json.loads

# ---------------------------------------------------------------------------
# Scrapling compatibility helpers
# ---------------------------------------------------------------------------

def css_first(page, selector):
    """Scrapling Response.css() returns a list; this returns first or None."""
    results = page.css(selector)
    return results[0] if results else None


# ---------------------------------------------------------------------------
# Extraction helpers
# ---------------------------------------------------------------------------

def extract_jsonld(page):
    """Extract product data from JSON-LD structured data (highest confidence)."""
    scripts = page.css('script[type="application/ld+json"]')
    for script in scripts:
        try:
            raw = script.text
            if not raw:
                continue
            data = json.loads(raw)
            items = data if isinstance(data, list) else [data]
            for item in items:
                if isinstance(item, dict) and item.get("@type", "").lower() in ("product", "offer", "indivproduct"):
                    return parse_jsonld_product(item)
                # Check @graph
                if isinstance(item, dict) and "@graph" in item:
                    for node in item["@graph"]:
                        if isinstance(node, dict) and node.get("@type", "").lower() in ("product",):
                            return parse_jsonld_product(node)
        except (json.JSONDecodeError, TypeError):
            continue
    return None


def parse_jsonld_product(data):
    """Parse a JSON-LD Product object into our schema."""
    offers = data.get("offers", {})
    if isinstance(offers, list):
        offers = offers[0] if offers else {}

    price = offers.get("price") or data.get("price")
    currency = offers.get("priceCurrency") or data.get("priceCurrency") or ""
    availability = offers.get("availability", "")

    images = data.get("image", [])
    if isinstance(images, str):
        images = [images]
    elif isinstance(images, dict):
        images = [images.get("url", "")]
    elif isinstance(images, list):
        images = [img if isinstance(img, str) else img.get("url", "") for img in images]

    rating_data = data.get("aggregateRating", {})
    return {
        "title": data.get("name", ""),
        "price": safe_float(price),
        "currency": currency,
        "description": data.get("description", ""),
        "images": [img for img in images if img],
        "availability": normalize_availability(availability),
        "brand": extract_brand(data.get("brand")),
        "sku": data.get("sku", "") or "",
        "mpn": data.get("mpn", "") or "",
        "gtin": data.get("gtin13") or data.get("gtin12") or data.get("gtin", "") or "",
        "category": data.get("category", "") or "",
        "rating": safe_float(rating_data.get("ratingValue")) if rating_data else None,
        "reviewCount": safe_int(rating_data.get("reviewCount")) if rating_data else None,
        "specifications": {},
        "seller": offers.get("seller", {}).get("name") if isinstance(offers.get("seller"), dict) else None,
        "shipping": None,
        "confidence_method": "json-ld",
        "overall_confidence": 95,
    }


def extract_microdata(page):
    """Extract product data from itemprop microdata attributes."""
    title_el = css_first(page, '[itemprop="name"]')
    price_el = css_first(page, '[itemprop="price"]')
    if not title_el and not price_el:
        return None

    images = []
    for img in page.css('[itemprop="image"]'):
        src = img.attrib.get("src") or img.attrib.get("content") or ""
        if src:
            images.append(src)

    desc_el = css_first(page, '[itemprop="description"]')
    brand_el = css_first(page, '[itemprop="brand"]')
    sku_el = css_first(page, '[itemprop="sku"]')
    avail_el = css_first(page, '[itemprop="availability"]')
    currency_el = css_first(page, '[itemprop="priceCurrency"]')

    return {
        "title": title_el.text.strip() if title_el else "",
        "price": safe_float(price_el.attrib.get("content") or price_el.text if price_el else None),
        "currency": currency_el.attrib.get("content") if currency_el else "",
        "description": desc_el.text.strip() if desc_el and desc_el.text else "",
        "images": images,
        "availability": normalize_availability(avail_el.attrib.get("href", "") if avail_el else ""),
        "brand": brand_el.text.strip() if brand_el and brand_el.text else (brand_el.attrib.get("content", "") if brand_el else ""),
        "sku": sku_el.text.strip() if sku_el and sku_el.text else (sku_el.attrib.get("content", "") if sku_el else ""),
        "mpn": "",
        "gtin": "",
        "category": "",
        "rating": None,
        "reviewCount": None,
        "specifications": {},
        "seller": None,
        "shipping": None,
        "confidence_method": "microdata",
        "overall_confidence": 80,
    }


def extract_css_heuristic(page):
    """Fallback: extract product data using common CSS selectors."""
    title = ""
    for sel in ["h1.product-title", "h1.product_title", "h1.product-name", ".product-title h1", "h1[class*='product']", "h1[class*='title']", "#productTitle", "h1"]:
        el = css_first(page, sel)
        if el and el.text and len(el.text.strip()) > 3:
            title = el.text.strip()
            break

    price = None
    for sel in [".price .amount", ".product-price", "[class*='price'] [class*='current']", ".price", "[class*='price']", "span[class*='price']", ".woocommerce-Price-amount"]:
        el = css_first(page, sel)
        if el and el.text:
            p = safe_float(el.text)
            if p and p > 0:
                price = p
                break

    description = ""
    for sel in [".product-description", "#product-description", "#product_description ~ p", "[class*='description']", ".woocommerce-product-details__short-description"]:
        el = css_first(page, sel)
        if el and el.text and len(el.text.strip()) > 10:
            description = el.text.strip()[:2000]
            break

    images = []
    for sel in [".product-gallery img", "#product_gallery img", ".woocommerce-product-gallery img", "[class*='product'] img[src]", ".product-image img", ".thumbnail img", ".item img"]:
        for img in page.css(sel):
            src = img.attrib.get("data-src") or img.attrib.get("src") or ""
            if src and "placeholder" not in src.lower():
                images.append(src)
        if images:
            break

    if not title:
        return None

    return {
        "title": title,
        "price": price,
        "currency": "",
        "description": description,
        "images": images[:10],
        "availability": "unknown",
        "brand": "",
        "sku": "",
        "mpn": "",
        "gtin": "",
        "category": "",
        "rating": None,
        "reviewCount": None,
        "specifications": {},
        "seller": None,
        "shipping": None,
        "confidence_method": "css-heuristic",
        "overall_confidence": 55,
    }


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def safe_float(val):
    if val is None:
        return None
    try:
        cleaned = str(val).replace(",", "").replace(" ", "")
        # Remove currency symbols
        for ch in "$€£¥₹₺₽¢SAR AED EGP KWD QAR BHD OMR JOD":
            cleaned = cleaned.replace(ch, "")
        cleaned = cleaned.strip()
        return float(cleaned) if cleaned else None
    except (ValueError, TypeError):
        return None


def safe_int(val):
    if val is None:
        return None
    try:
        return int(float(str(val).replace(",", "")))
    except (ValueError, TypeError):
        return None


def extract_brand(brand_data):
    if not brand_data:
        return ""
    if isinstance(brand_data, str):
        return brand_data
    if isinstance(brand_data, dict):
        return brand_data.get("name", "")
    return ""


def normalize_availability(raw):
    raw = str(raw).lower()
    if "instock" in raw or "in_stock" in raw or "in stock" in raw:
        return "in_stock"
    if "outofstock" in raw or "out_of_stock" in raw or "out of stock" in raw:
        return "out_of_stock"
    if "preorder" in raw or "pre_order" in raw:
        return "pre_order"
    return "unknown"


def is_product_page(page, url):
    """Heuristic check: does this page look like a product page?"""
    signals = 0
    if css_first(page, 'script[type="application/ld+json"]'):
        signals += 1
    if css_first(page, '[itemprop="price"]'):
        signals += 2
    if css_first(page, '[class*="add-to-cart"], [class*="add_to_cart"], button[name="add-to-cart"]'):
        signals += 2
    if any(kw in url.lower() for kw in ("/product/", "/item/", "/p/", "/dp/", "/pd/", "/catalogue/")):
        signals += 1
    if css_first(page, '.product-price, .price, [class*="price"]'):
        signals += 1
    if css_first(page, 'h1'):
        signals += 1
    return signals >= 2


# ---------------------------------------------------------------------------
# Main scraping function
# ---------------------------------------------------------------------------

def scrape(request):
    url = request["url"]
    timeout = request.get("timeout", 30)
    user_agent = request.get("user_agent", "")
    use_stealth = request.get("use_stealth", False)

    start = time.time()

    try:
        if use_stealth:
            from scrapling import StealthyFetcher
            fetcher = StealthyFetcher()
        else:
            from scrapling import Fetcher
            fetcher = Fetcher()

        page = fetcher.get(url, timeout=timeout)

        elapsed_ms = int((time.time() - start) * 1000)

        if not is_product_page(page, url):
            return {
                "success": True,
                "is_product_page": False,
                "product": None,
                "elapsed_ms": elapsed_ms,
            }

        # Try extraction methods in order of confidence
        product = extract_jsonld(page)
        if not product:
            product = extract_microdata(page)
        if not product:
            product = extract_css_heuristic(page)

        if not product:
            return {
                "success": True,
                "is_product_page": True,
                "product": None,
                "error": "Could not extract product data from page",
                "elapsed_ms": elapsed_ms,
            }

        product["sourceUrl"] = url
        return {
            "success": True,
            "is_product_page": True,
            "product": product,
            "elapsed_ms": elapsed_ms,
        }

    except Exception as e:
        elapsed_ms = int((time.time() - start) * 1000)
        err_str = str(e).lower()
        error_type = "transient"
        http_status = None

        if "404" in err_str or "not found" in err_str:
            error_type = "permanent"
            http_status = 404
        elif "403" in err_str or "forbidden" in err_str:
            error_type = "blocked"
            http_status = 403
        elif "429" in err_str or "rate" in err_str:
            error_type = "blocked"
            http_status = 429
        elif "captcha" in err_str or "cloudflare" in err_str:
            error_type = "blocked"
        elif "timeout" in err_str or "timed out" in err_str:
            error_type = "transient"
            http_status = 408

        return {
            "success": False,
            "error": str(e)[:500],
            "error_type": error_type,
            "http_status": http_status,
            "elapsed_ms": elapsed_ms,
            "is_product_page": None,
        }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            print(dumps({"success": False, "error": "Empty stdin", "error_type": "permanent"}))
            sys.exit(1)

        request = loads(raw)
        result = scrape(request)
        print(dumps(result))
    except Exception as e:
        print(dumps({
            "success": False,
            "error": f"Engine crash: {traceback.format_exc()[:500]}",
            "error_type": "transient",
        }))
        sys.exit(1)

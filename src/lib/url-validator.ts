export interface UrlValidationResult {
  valid: string[];
  invalid: Array<{ url: string; reason: string }>;
  duplicatesRemoved: number;
}

const VALID_SCHEMES = new Set(["http:", "https:"]);

export function validateUrl(
  raw: string,
): { ok: true; url: string } | { ok: false; reason: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "Empty URL" };

  try {
    const parsed = new URL(trimmed);
    if (!VALID_SCHEMES.has(parsed.protocol)) {
      return { ok: false, reason: `Invalid scheme: ${parsed.protocol}` };
    }
    if (!parsed.hostname || !parsed.hostname.includes(".")) {
      return { ok: false, reason: `Invalid hostname: ${parsed.hostname}` };
    }
    return { ok: true, url: parsed.href };
  } catch {
    return { ok: false, reason: "Malformed URL — could not parse" };
  }
}

export function validateAndDeduplicateUrls(
  rawUrls: string[],
): UrlValidationResult {
  const valid: string[] = [];
  const invalid: Array<{ url: string; reason: string }> = [];
  const seen = new Set<string>();
  let duplicatesRemoved = 0;

  for (const raw of rawUrls) {
    const result = validateUrl(raw);
    if (!result.ok) {
      invalid.push({ url: raw, reason: result.reason });
      continue;
    }
    if (seen.has(result.url)) {
      duplicatesRemoved++;
      continue;
    }
    seen.add(result.url);
    valid.push(result.url);
  }

  return { valid, invalid, duplicatesRemoved };
}

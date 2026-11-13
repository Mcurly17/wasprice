// Strict price parser, the exact mirror of _parse_cents in contracts/was_price.py.
// An identical copy lives in frontend/lib/price.ts (a test keeps both files equal).
// Pure: no import, so `node --test` loads it directly.

const PRICE_RE = /^[0-9]{1,7}\.[0-9]{2}$/;

/** "39.90" -> 3990. Anything else (39,90, 39.9, -1.00, 1e3, " 39.90") -> null. */
export function parseCents(value: unknown): number | null {
  if (typeof value !== "string" || !PRICE_RE.test(value)) return null;
  const [euros, cents] = value.split(".");
  return Number(euros) * 100 + Number(cents);
}

export function centsToString(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

/** Round half up of (was - promo) * 100 / was, in integers, as the contract computes it. */
export function expectedPct(wasCents: number, promoCents: number): number {
  return Math.floor((200 * (wasCents - promoCents) + wasCents) / (2 * wasCents));
}

/** 0 means "no % shown"; otherwise within 1 point of the computed discount. */
export function pctOk(wasCents: number, promoCents: number, pct: number): boolean {
  return pct === 0 || Math.abs(pct - expectedPct(wasCents, promoCents)) <= 1;
}

/** Explains why a price was refused, with the PowerShell pitfall for "39,90". */
export function priceHelp(raw: string): string {
  if (/^[0-9]+,[0-9]{2}$/.test(raw) || /^[0-9]+ [0-9]{2}$/.test(raw)) {
    return `Write ${raw.replace(/[, ]/, ".")}, not ${raw}: prices use a dot. In PowerShell an unquoted 39,90 is an array (39 90).`;
  }
  return `Price must look like 39.90 (digits, a dot, two decimals), got: ${raw}`;
}

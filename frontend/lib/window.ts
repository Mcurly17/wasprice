// The Omnibus 30-day window and Wayback timestamps, mirrored from contracts/was_price.py.
// An identical copy lives in frontend/lib/window.ts (a test keeps both files equal).
// Pure: no import, so `node --test` loads it directly.

export const DAY = 86400;
export const PRIOR_WINDOW = 30 * DAY;

const TS14_RE = /^([0-9]{4})([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})$/;
const ISO_RE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})Z$/;
const WAYBACK_RE = /^https?:\/\/web\.archive\.org\/web\/([0-9]{14})(?:[a-z]{2}_)?\/(\S+)$/i;

function utc(parts: string[]): number | null {
  const [y, mo, d, h, mi, s] = parts.map(Number);
  const t = Date.UTC(y, mo - 1, d, h, mi, s);
  const back = new Date(t);
  const same =
    back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d &&
    back.getUTCHours() === h && back.getUTCMinutes() === mi && back.getUTCSeconds() === s;
  return same && y >= 1 ? t / 1000 : null;
}

/** "20261105100000" -> unix seconds, or null when malformed or not a real date. */
export function ts14ToUnix(ts: string): number | null {
  const m = TS14_RE.exec(ts);
  return m ? utc(m.slice(1)) : null;
}

/** "2026-11-13T12:00:00Z" -> unix seconds, strict format only. */
export function isoToUnix(iso: string): number | null {
  const m = ISO_RE.exec(iso);
  return m ? utc(m.slice(1)) : null;
}

export function unixToIso(t: number): string {
  return new Date(t * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function unixToTs14(t: number): string {
  return unixToIso(t).replace(/[-:TZ]/g, "");
}

/** Window [promo_start - 30 days, promo_start), as 14-digit Wayback timestamps. */
export function windowOf(promoStart: number): { fromTs: string; toTs: string } {
  return { fromTs: unixToTs14(promoStart - PRIOR_WINDOW), toTs: unixToTs14(promoStart) };
}

export function waybackCalendar(promoStart: number, productUrl: string): string {
  return `https://web.archive.org/web/${windowOf(promoStart).fromTs}*/${productUrl}`;
}

/** "" when snapshot_ts may be filed now, else the contract's [EXPECTED] message. */
export function checkSnapshot(ts: string, promoStart: number, now: number): string {
  const t = ts14ToUnix(ts);
  if (t === null) return "[EXPECTED] snapshot_ts must be a valid 14-digit UTC time (YYYYMMDDhhmmss)";
  if (t > now) return "[EXPECTED] snapshot_ts is in the future";
  const { fromTs, toTs } = windowOf(promoStart);
  if (t < promoStart - PRIOR_WINDOW) return `[EXPECTED] snapshot_ts is before the 30-day window (from ${fromTs})`;
  if (t >= promoStart) return `[EXPECTED] snapshot_ts must be before promo_start (${toTs})`;
  return "";
}

/** Timestamp and page URL of a Wayback link (https://web.archive.org/web/<ts>[id_]/<url>). */
export function parseWaybackUrl(link: string): { ts: string; url: string } | null {
  const m = WAYBACK_RE.exec(link.trim());
  return m && ts14ToUnix(m[1]) !== null ? { ts: m[1], url: m[2] } : null;
}

export function archiveUrl(ts: string, url: string): string {
  return `https://web.archive.org/web/${ts}id_/${url}`;
}

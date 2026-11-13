// Display helpers. Pure: tested with node:test.

const WEI = 10n ** 18n;

/** "100000000000000000" -> "0.1 GEN" (no float on the way). */
export function formatGen(wei: string | bigint, symbol = "GEN"): string {
  const v = typeof wei === "bigint" ? wei : /^\d+$/.test(wei) ? BigInt(wei) : 0n;
  const frac = (v % WEI).toString().padStart(18, "0").replace(/0+$/, "");
  return `${v / WEI}${frac ? `.${frac}` : ""} ${symbol}`;
}

/** "0.01" GEN -> wei, or null when not a GEN decimal. */
export function parseGenInput(text: string): bigint | null {
  const m = /^(\d+)(?:\.(\d{1,18}))?$/.exec(text.trim());
  return m ? BigInt(m[1]) * WEI + BigInt((m[2] ?? "").padEnd(18, "0") || "0") : null;
}

export function shortAddress(address: string): string {
  return /^0x[0-9a-fA-F]{40}$/.test(address) ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

/** "20261105100000" -> "2026-11-05 10:00:00 UTC". */
export function formatTs14(ts: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(ts);
  return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]} UTC` : ts;
}

/** The archived page as people see it (with the Wayback toolbar). */
export function waybackView(ts: string, url: string): string {
  return `https://web.archive.org/web/${ts}/${url}`;
}

/** The PowerShell lines that recompute a stored SHA-256 from the archived bytes. */
export function verifyCommand(ts: string, url: string): string {
  return `curl.exe -s -o page.bin "https://web.archive.org/web/${ts}id_/${url}"\nGet-FileHash page.bin -Algorithm SHA256`;
}

/** HTML snippet a merchant can paste to link its public standing. */
export function badgeSnippet(siteUrl: string, merchant: string): string {
  return `<a href="${siteUrl}/merchant/?addr=${merchant}" rel="noopener">Bonded honest discounts – WasPrice</a>`;
}

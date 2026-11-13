// --value handling and polling budgets for scripts/wasprice.ts. Pure: no SDK import.

/** Commands that attach a message value. */
const PAYABLE = new Set(["pledge", "top-up", "challenge", "challenge-image"]);
const SLOW = new Set(["resolve", "wait"]);

export const WAIT_INTERVAL_MS = 3000;
export const WAIT_RETRIES = 200;
export const SLOW_WAIT_RETRIES = 400;

export function isPayable(command: string): boolean {
  return PAYABLE.has(command);
}

export function waitRetries(command: string): number {
  return SLOW.has(command) ? SLOW_WAIT_RETRIES : WAIT_RETRIES;
}

export function parseGen(text: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,18}))?$/.exec(text.trim());
  if (!match) {
    throw new Error("Amount must be a GEN decimal with at most 18 fractional digits.");
  }
  const frac = (match[2] ?? "").padEnd(18, "0");
  return BigInt(match[1]) * 10n ** 18n + BigInt(frac || "0");
}

export function formatGen(wei: bigint): string {
  const whole = wei / 10n ** 18n;
  const frac = (wei % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return frac === "" ? whole.toString() : `${whole}.${frac}`;
}

export function splitValueFlag(argv: string[]): { args: string[]; value?: string } {
  const args: string[] = [];
  let value: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--private-key" || token.startsWith("--private-key=") || token === "--password" || token.startsWith("--password=")) {
      throw new Error("Do not pass a private key or a keystore password on the command line.");
    }
    if (token === "--value") {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("-")) {
        throw new Error("--value needs a GEN amount, for example 0.01.");
      }
      if (value !== undefined) throw new Error("--value was given twice.");
      value = next;
      i++;
      continue;
    }
    if (token.startsWith("--value=")) {
      const next = token.slice("--value=".length);
      if (!next) throw new Error("--value needs a GEN amount, for example 0.01.");
      if (value !== undefined) throw new Error("--value was given twice.");
      value = next;
      continue;
    }
    args.push(token);
  }
  return value === undefined ? { args } : { args, value };
}

/** Amounts come only from --value: a trailing positional number is never read as GEN. */
export function payableWei(command: string, flag: string | undefined): bigint {
  if (!PAYABLE.has(command)) {
    if (flag !== undefined) throw new Error("--value applies to pledge, top-up, challenge and challenge-image only.");
    return 0n;
  }
  if (flag === undefined || flag === "") throw new Error(`${command} needs --value <GEN>.`);
  const wei = parseGen(flag);
  if (wei <= 0n) throw new Error("--value must be greater than 0.");
  return wei;
}

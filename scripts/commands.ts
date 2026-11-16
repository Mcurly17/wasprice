// Command-line parsing for scripts/wasprice.ts. Pure: no SDK, no network, no keystore, so
// scripts/commands.test.ts checks every mapping offline. Addresses, prices and timestamps
// are always passed to the contract as strings.
import { expectedPct, parseCents, priceHelp } from "./price.ts";
import { isoToUnix, ts14ToUnix, unixToIso } from "./window.ts";
import { parseGen, payableWei, splitValueFlag } from "./value.ts";

export type CallArg = string | number | bigint;
/** Replaced by the signer's address at run time, before anything is signed. */
export const SIGNER = "<signer>";

export type Precheck =
  | { kind: "preview"; functionName: string; args: CallArg[] }
  | { kind: "window"; promoId: number; ts: string; preview: { functionName: string; args: CallArg[] } }
  | { kind: "top-up" | "close"; pledgeId: number }
  | { kind: "resolve" | "expire"; challengeId: number }
  | { kind: "withdraw" };

export type Plan =
  | { kind: "help" }
  | { kind: "config" }
  | { kind: "deploy"; minChallengeMinutes: number }
  | { kind: "window"; promoId: number }
  | { kind: "wait"; hash: `0x${string}` }
  | { kind: "price-check"; raw: string; cents: number }
  | { kind: "read"; functionName: string; args: CallArg[] }
  | { kind: "snapshot"; url: string; ts: string; promoId?: number }
  | {
      kind: "write"; command: string; functionName: string; args: CallArg[]; value: bigint; precheck: Precheck; notes: string[];
      /** Demo evidence: send a call the contract refuses, with no value, to record the refusal on-chain. */
      expectRefusal: boolean;
    };

export interface PlanEnv {
  now: Date;
  readText: (path: string) => string;
}

export const USAGE = `Usage: node --env-file-if-exists=.env scripts/wasprice.ts <command> [args...]

Reads (no account, no password):
  help | config | stats
  pledge-info <pledge_id> | promo <promo_id> | promos <pledge_id> | window <promo_id>
  challenge-info <challenge_id> | challenges <promo_id>
  standing <address> | credit <address> | wait <txhash>
  snapshot <url> <ts14> [--promo <promo_id>]   one Wayback id_ GET, redirects not followed
  price-check <price>                          local strict parser (39.90 only)

Writes (signed with the active genlayer CLI account; the keystore password is typed here):
  deploy [--min-challenge-minutes <n>]           default 10080 (7 days); 10 to 129600
  pledge <name> <domain> <payout_gen> <days> --value <bond_GEN>
  top-up <pledge_id> --value <GEN>
  declare <pledge_id> <product_url> <was> <promo> <start_iso|now> --challenge-minutes <n> [--pct <n>] [--variant-file <file>]
  challenge <promo_id> <ts14> --value <stake_GEN>
  challenge-image <promo_id> <ts14> <image_url> --value <stake_GEN>
  resolve <challenge_id> | expire <challenge_id> | close <pledge_id> | withdraw

Every write is checked first (its preview_* view, or a read of the current state) and is not
sent if the contract would refuse it: on Studionet a refused payable call keeps its value.
--expect-refusal (close, challenge, challenge-image) does the opposite, to record a refusal
on-chain as evidence: it sends only a call the check refuses, and never with a value.
Amounts are GEN decimals read only from --value. Prices are written 39.90 (in PowerShell an
unquoted 39,90 is an array). Select the signer with: npx genlayer account use <name>
env: GENLAYER_NETWORK (studionet or localnet), WASPRICE_CONTRACT`;

const HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const TS14_RE = /^[0-9]{14}$/;
/** Challenge period bounds of the contract, in minutes; deploy uses 7 days unless told otherwise. */
export const CHALLENGE_MINUTES = { min: 10, max: 90 * 1440, deployDefault: 7 * 1440 };
/** Writes whose refusal can be recorded on-chain: no value is ever attached to them. */
const REFUSABLE = new Set(["close", "challenge", "challenge-image"]);

function int(value: string, what: string): number {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error(`${what} must be a non-negative integer, got: ${value}`);
  }
  return Number(value);
}

function expect(command: string, args: string[], count: number, shape: string): void {
  if (args.length !== count) throw new Error(`${command} expects ${count} argument(s): ${command} ${shape}`);
}

function address(value: string, command: string): string {
  if (!ADDRESS_RE.test(value)) throw new Error(`${command} expects a 0x-prefixed 20-byte address.`);
  return value;
}

function ts14(value: string): string {
  if (!TS14_RE.test(value) || ts14ToUnix(value) === null) {
    throw new Error(`Snapshot timestamp must be 14 digits (YYYYMMDDhhmmss) and a real UTC time, got: ${value}`);
  }
  return value;
}

function price(raw: string, what: string): string {
  if (parseCents(raw) === null) throw new Error(`${what}: ${priceHelp(raw)}`);
  return raw;
}

/** Pulls `--name value` options out of argv; unknown `--` options are refused. */
function takeOptions(argv: string[], names: string[]): { args: string[]; options: Record<string, string> } {
  const args: string[] = [];
  const options: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      args.push(token);
      continue;
    }
    const name = token.slice(2);
    if (!names.includes(name)) throw new Error(`Unknown option ${token}.`);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) throw new Error(`${token} needs a value.`);
    if (name in options) throw new Error(`${token} was given twice.`);
    options[name] = next;
    i++;
  }
  return { args, options };
}

function minutes(value: string, what: string): number {
  const n = int(value, what);
  if (n < CHALLENGE_MINUTES.min || n > CHALLENGE_MINUTES.max) {
    throw new Error(`${what} must be between ${CHALLENGE_MINUTES.min} and ${CHALLENGE_MINUTES.max} minutes, got: ${value}`);
  }
  return n;
}

function read(command: string, args: string[], functionName: string, shape: string, map: (a: string[]) => CallArg[]): Plan {
  expect(command, args, shape === "" ? 0 : shape.split(" ").length, shape);
  return { kind: "read", functionName, args: map(args) };
}

export function planCommand(argv: string[], env: PlanEnv): Plan {
  const [command, ...rest] = argv;
  if (!command || command === "help" || command === "--help" || command === "-h") return { kind: "help" };

  const refusals = rest.filter((a) => a === "--expect-refusal").length;
  const split = splitValueFlag(rest.filter((a) => a !== "--expect-refusal"));
  const expectRefusal = refusals > 0;
  if (refusals > 1) throw new Error("--expect-refusal was given twice.");
  if (expectRefusal && !REFUSABLE.has(command)) throw new Error(`--expect-refusal applies to ${[...REFUSABLE].join(", ")} only.`);
  if (expectRefusal && split.value !== undefined) throw new Error("--expect-refusal never sends a value: drop --value.");
  const value = expectRefusal ? 0n : payableWei(command, split.value);
  const allowed =
    command === "declare" ? ["pct", "variant-file", "challenge-minutes"]
      : command === "snapshot" ? ["promo"]
        : command === "deploy" ? ["min-challenge-minutes"] : [];
  const { args, options } = takeOptions(split.args, allowed);
  const write = (functionName: string, callArgs: CallArg[], precheck: Precheck, notes: string[] = []): Plan => ({
    kind: "write", command, functionName, args: callArgs, value, precheck, notes, expectRefusal,
  });

  switch (command) {
    case "config":
      expect(command, args, 0, "");
      return { kind: "config" };
    case "stats":
      return read(command, args, "get_stats", "", () => []);
    case "pledge-info":
      return read(command, args, "get_pledge", "<pledge_id>", (a) => [int(a[0], "pledge_id")]);
    case "promo":
      return read(command, args, "get_promo", "<promo_id>", (a) => [int(a[0], "promo_id")]);
    case "promos":
      return read(command, args, "list_promos", "<pledge_id>", (a) => [int(a[0], "pledge_id"), 0, 50]);
    case "window":
      expect(command, args, 1, "<promo_id>");
      return { kind: "window", promoId: int(args[0], "promo_id") };
    case "challenge-info":
      return read(command, args, "get_challenge", "<challenge_id>", (a) => [int(a[0], "challenge_id")]);
    case "challenges":
      return read(command, args, "list_challenges", "<promo_id>", (a) => [int(a[0], "promo_id")]);
    case "standing":
      return read(command, args, "standing", "<address>", (a) => [address(a[0], command)]);
    case "credit":
      return read(command, args, "get_credit", "<address>", (a) => [address(a[0], command)]);
    case "wait":
      expect(command, args, 1, "<txhash>");
      if (!HASH_RE.test(args[0])) throw new Error("wait expects a 0x-prefixed 32-byte transaction hash.");
      return { kind: "wait", hash: args[0] as `0x${string}` };
    case "snapshot": {
      expect(command, args, 2, "<url> <ts14> [--promo <promo_id>]");
      if (!/^https?:\/\/\S+$/.test(args[0])) throw new Error("snapshot expects the page URL first, then the 14-digit timestamp.");
      const plan: Plan = { kind: "snapshot", url: args[0], ts: ts14(args[1]) };
      return options.promo === undefined ? plan : { ...plan, promoId: int(options.promo, "--promo") };
    }
    case "price-check": {
      expect(command, args, 1, "<price>");
      const cents = parseCents(args[0]);
      if (cents === null) throw new Error(priceHelp(args[0]));
      return { kind: "price-check", raw: args[0], cents };
    }
    case "deploy": {
      expect(command, args, 0, "[--min-challenge-minutes <n>]");
      const m = options["min-challenge-minutes"];
      return { kind: "deploy", minChallengeMinutes: m === undefined ? CHALLENGE_MINUTES.deployDefault : minutes(m, "--min-challenge-minutes") };
    }
    case "pledge": {
      expect(command, args, 4, "<name> <domain> <payout_gen> <days> --value <bond_GEN>");
      const [name, domain, payoutGen, days] = args;
      const payout = parseGen(payoutGen);
      const d = int(days, "days");
      return write("create_pledge", [name, domain, payout, d],
        { kind: "preview", functionName: "preview_pledge", args: [SIGNER, name, domain, payout.toString(), d, value.toString()] });
    }
    case "top-up": {
      expect(command, args, 1, "<pledge_id> --value <GEN>");
      const pledgeId = int(args[0], "pledge_id");
      return write("top_up", [pledgeId], { kind: "top-up", pledgeId });
    }
    case "declare": {
      expect(command, args, 5, "<pledge_id> <product_url> <was> <promo> <start_iso|now> --challenge-minutes <n> [--pct <n>] [--variant-file <file>]");
      const pledgeId = int(args[0], "pledge_id");
      const url = args[1];
      const was = price(args[2], "was price");
      const promo = price(args[3], "promo price");
      const notes: string[] = [];
      let start = args[4];
      if (start === "now") {
        start = unixToIso(Math.floor(env.now.getTime() / 1000));
        notes.push(`promo_start = now = ${start}`);
      } else if (isoToUnix(start) === null) {
        throw new Error(`promo_start must be now or ISO 8601 UTC like 2026-11-13T12:00:00Z, got: ${start}`);
      }
      const computed = expectedPct(parseCents(was)!, parseCents(promo)!);
      let pct = 0;
      if (options.pct === undefined) {
        notes.push(`Computed discount: ${computed} %. Declared without a percentage; add --pct ${computed} to declare it.`);
      } else {
        pct = int(options.pct, "--pct");
      }
      let variant = "";
      if (options["variant-file"] !== undefined) {
        variant = env.readText(options["variant-file"]).replace(/^﻿/, "").trim();
      }
      if (options["challenge-minutes"] === undefined) {
        throw new Error("declare needs --challenge-minutes <n>: how long the promo can be challenged (stats shows the contract minimum).");
      }
      const period = minutes(options["challenge-minutes"], "--challenge-minutes");
      const callArgs: CallArg[] = [pledgeId, url, variant, was, promo, pct, start, period];
      return write("declare_promo", callArgs, { kind: "preview", functionName: "preview_declare", args: [SIGNER, ...callArgs] }, notes);
    }
    case "challenge":
    case "challenge-image": {
      const image = command === "challenge-image";
      expect(command, args, image ? 3 : 2, image ? "<promo_id> <ts14> <image_url> --value <stake_GEN>" : "<promo_id> <ts14> --value <stake_GEN>");
      const promoId = int(args[0], "promo_id");
      const ts = ts14(args[1]);
      const callArgs: CallArg[] = image ? [promoId, ts, args[2]] : [promoId, ts];
      return write(image ? "challenge_image" : "challenge", callArgs, {
        kind: "window", promoId, ts,
        preview: { functionName: image ? "preview_challenge_image" : "preview_challenge", args: [...callArgs, SIGNER, value.toString()] },
      });
    }
    case "resolve":
    case "expire": {
      expect(command, args, 1, "<challenge_id>");
      const challengeId = int(args[0], "challenge_id");
      return write(command, [challengeId], { kind: command, challengeId });
    }
    case "close": {
      expect(command, args, 1, "<pledge_id>");
      const pledgeId = int(args[0], "pledge_id");
      return write("close_pledge", [pledgeId], { kind: "close", pledgeId });
    }
    case "withdraw":
      expect(command, args, 0, "");
      return write("withdraw", [], { kind: "withdraw" });
    default:
      throw new Error(`Unknown command: ${command}. Run: node scripts/wasprice.ts help`);
  }
}

/** Replaces SIGNER with the signer's address. */
export function withSigner(args: CallArg[], signer: string): CallArg[] {
  return args.map((a) => (a === SIGNER ? signer : a));
}

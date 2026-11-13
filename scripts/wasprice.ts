// Calls WasPrice methods, including the payable ones: the genlayer CLI cannot attach a
// message value to `write`.
//
//   node --env-file-if-exists=.env scripts/wasprice.ts <command> [args...] [--value <GEN>]
//
// Reads need no account. Writes sign with the account selected in the genlayer CLI
// (`npx genlayer account use <name>`): the script reads that encrypted keystore and asks for
// its password with hidden input, 3 attempts. It never reads a key from .env or from an
// argument. Every write is checked first (preview_* view or a read of the current state).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Address, GenLayerChain, TransactionHash } from "genlayer-js/types";
import { planCommand, USAGE, withSigner, type CallArg, type Plan, type Precheck } from "./commands.ts";
import { decryptKeystore, KeystoreError, promptPassword, readActiveKeystore } from "./keystore.ts";
import { interpretReceipt, isDecidedStatus, receiptStatus } from "./receipt.ts";
import { formatGen, WAIT_INTERVAL_MS, waitRetries } from "./value.ts";
import { archiveUrl, checkSnapshot, isoToUnix, ts14ToUnix, windowOf } from "./window.ts";

const CONTRACT_PATH = "contracts/was_price.py";
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const NETWORKS: Record<string, string> = { studionet: "studionet", localnet: "localnet" };

class CliError extends Error {}

function print(value: unknown): void {
  console.log(JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));
}

function contractAddress(): Address {
  const value = process.env.WASPRICE_CONTRACT ?? "";
  if (!ADDRESS_RE.test(value)) {
    throw new CliError("WASPRICE_CONTRACT is not set to a 0x address. Put the deployed contract address in .env (see .env.example).");
  }
  return value as Address;
}

function networkName(): string {
  const name = process.env.GENLAYER_NETWORK || "studionet";
  if (!NETWORKS[name]) throw new CliError(`Unknown GENLAYER_NETWORK: ${name} (${Object.keys(NETWORKS).join(", ")})`);
  return name;
}

async function sdk() {
  const { createAccount, createClient } = await import("genlayer-js");
  const chains = (await import("genlayer-js/chains")) as unknown as Record<string, GenLayerChain>;
  return { createAccount, createClient, chain: chains[NETWORKS[networkName()]] };
}

async function readClient() {
  const { createClient, chain } = await sdk();
  return createClient({ chain });
}

async function call(functionName: string, args: CallArg[]): Promise<unknown> {
  const client = await readClient();
  return client.readContract({ address: contractAddress(), functionName, args, jsonSafeReturn: true });
}

/** Views return JSON in a str (Studio's read decoder mishandles dicts). */
async function readJson(functionName: string, args: CallArg[]): Promise<any> {
  const raw = await call(functionName, args);
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** Unlocks the active CLI keystore with a hidden password prompt and checks its address. */
async function signingClient() {
  const { createAccount, createClient, chain } = await sdk();
  const stored = readActiveKeystore();
  for (let attempt = 1; attempt <= 3; attempt++) {
    const password = await promptPassword(`Keystore password for ${stored.name}: `);
    try {
      const account = createAccount(decryptKeystore(stored.json, password));
      if (account.address.toLowerCase() !== stored.address) {
        throw new KeystoreError("The unlocked key does not match the keystore address.");
      }
      return createClient({ chain, account });
    } catch (err) {
      const wrong = err instanceof KeystoreError && err.message === "Wrong keystore password.";
      if (!wrong || attempt === 3) throw err;
      console.error(`${err.message} (${3 - attempt} attempt(s) left)`);
    }
  }
  throw new KeystoreError("Wrong keystore password.");
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/**
 * Polls an already sent transaction until it reaches a final state. It only reads: a gateway
 * error or a not-yet-indexed hash is retried, the transaction is never re-sent. Success means
 * ACCEPTED or FINALIZED, MAJORITY_AGREE and SUCCESS.
 */
async function settle(hash: TransactionHash, command: string): Promise<Record<string, any> | null> {
  console.log(`Transaction: ${hash}\nExplorer: https://explorer-studio.genlayer.com/tx/${hash}`);
  const client = await readClient();
  for (let attempt = 0; attempt < waitRetries(command); attempt++) {
    try {
      const tx = await client.getTransaction({ hash });
      if (isDecidedStatus(receiptStatus(tx))) {
        const outcome = interpretReceipt(tx);
        print({
          hash,
          status: outcome.status,
          consensus: outcome.consensus,
          execution: outcome.execution,
          result: outcome.returnValue,
          ...(outcome.message ? { message: outcome.message } : {}),
          ...(outcome.keptValue ? { keptValueWei: outcome.keptValue } : {}),
        });
        if (outcome.kind !== "success") process.exitCode = 1;
        return tx as Record<string, any>;
      }
    } catch {
      // Not indexed yet or a gateway hiccup: keep polling the same hash.
    }
    await sleep(WAIT_INTERVAL_MS);
  }
  process.exitCode = 1;
  console.error(`No final result yet for ${hash}. Nothing was re-sent. Re-run with: wait ${hash}`);
  return null;
}

const now = () => Math.floor(Date.now() / 1000);

/** Throws when the contract would refuse the write right now; prints what it checked. */
async function precheck(check: Precheck, signer: string, name: string): Promise<void> {
  const refuse = (msg: string) => {
    throw new CliError(`Not sent: the contract would refuse this call for ${name} ${signer}: ${msg}`);
  };
  switch (check.kind) {
    case "preview": {
      const msg = await call(check.functionName, withSigner(check.args, signer));
      if (msg !== "") refuse(String(msg));
      return;
    }
    case "window": {
      const promo = await readJson("get_promo", [check.promoId]);
      const start = isoToUnix(String(promo.promo_start));
      if (start === null) refuse("unreadable promo_start");
      const w = windowOf(start!);
      console.log(`Promo ${check.promoId}: ${promo.product_url} was ${promo.was_price} ${promo.currency}`);
      console.log(`Window: [${w.fromTs}, ${w.toTs}) (30 days before promo_start ${promo.promo_start})`);
      const local = checkSnapshot(check.ts, start!, now());
      if (local !== "") refuse(local);
      const msg = await call(check.preview.functionName, withSigner(check.preview.args, signer));
      if (msg !== "") refuse(String(msg));
      return;
    }
    case "top-up":
    case "close": {
      const p = await readJson("get_pledge", [check.pledgeId]);
      if (String(p.merchant).toLowerCase() !== signer.toLowerCase()) refuse(`only the merchant ${p.merchant} can ${check.kind} this pledge`);
      if (p.active !== true) refuse("pledge is not active");
      if (check.kind === "close" && isoToUnix(p.ends_at)! > now()) refuse(`coverage has not ended (ends_at ${p.ends_at})`);
      if (check.kind === "close" && p.reserved !== "0") refuse("a challenge is still open on this pledge");
      return;
    }
    case "resolve":
    case "expire": {
      const c = await readJson("get_challenge", [check.challengeId]);
      if (c.status !== "OPEN") refuse(`challenge is ${c.status}`);
      const late = now() >= isoToUnix(c.resolve_deadline)!;
      if (check.kind === "resolve" && late) refuse(`resolution window closed at ${c.resolve_deadline}, call expire`);
      if (check.kind === "expire" && !late) refuse(`resolution window still open until ${c.resolve_deadline}`);
      return;
    }
    case "withdraw": {
      const credit = await readJson("get_credit", [signer]);
      if (credit.credit === "0") refuse("nothing to withdraw");
      console.log(`Credit: ${formatGen(BigInt(credit.credit))} GEN`);
      return;
    }
  }
}

async function snapshot(url: string, ts: string, promoId?: number): Promise<void> {
  const target = archiveUrl(ts, url);
  const res = await fetch(target, { redirect: "manual" });
  const location = res.headers.get("location");
  const out: Record<string, unknown> = { request: target, status: res.status };
  let finalTs = ts;
  if (location) {
    out.location = location;
    const m = /\/web\/([0-9]{14})id_\//.exec(location);
    if (m) finalTs = m[1];
  }
  out.final_ts = finalTs;
  if (res.status === 200) {
    const body = Buffer.from(await res.arrayBuffer());
    out.bytes = body.length;
    out.sha256 = createHash("sha256").update(body).digest("hex");
  }
  if (promoId !== undefined) {
    const promo = await readJson("get_promo", [promoId]);
    const start = isoToUnix(String(promo.promo_start))!;
    const w = windowOf(start);
    const t = ts14ToUnix(finalTs)!;
    out.window = `[${w.fromTs}, ${w.toTs})`;
    out.in_window = t >= start - 30 * 86400 && t < start;
  }
  print(out);
}

async function run(plan: Plan): Promise<void> {
  switch (plan.kind) {
    case "help":
      console.log(USAGE);
      return;
    case "config": {
      const network = networkName();
      let account = "none (select one with: npx genlayer account use <name>)";
      try {
        const stored = readActiveKeystore();
        account = `${stored.name} ${stored.address}`;
      } catch {
        // No active CLI account: reads still work.
      }
      print({ network, contract: process.env.WASPRICE_CONTRACT || "(unset)", account });
      return;
    }
    case "price-check":
      print({ input: plan.raw, cents: plan.cents, ok: true });
      return;
    case "read":
      print(await readJson(plan.functionName, plan.args));
      return;
    case "snapshot":
      await snapshot(plan.url, plan.ts, plan.promoId);
      return;
    case "wait":
      await settle(plan.hash as TransactionHash, "wait");
      return;
    case "deploy": {
      const stored = readActiveKeystore();
      console.log(`From ${stored.name} ${stored.address}`);
      const client = await signingClient();
      const hash = (await client.deployContract({ code: new Uint8Array(readFileSync(CONTRACT_PATH)), args: [] })) as TransactionHash;
      const tx = await settle(hash, "deploy");
      if (!tx || process.exitCode === 1) return;
      // Studio fills data.contract_address; genlayer-js 1.1.8 leaves txDataDecoded empty there.
      const address = tx.data?.contract_address ?? tx.txDataDecoded?.contractAddress;
      if (typeof address !== "string" || !ADDRESS_RE.test(address)) {
        throw new CliError(`Deployed (${hash}), but the receipt holds no contract address. Check the transaction in the explorer.`);
      }
      console.log(`Contract: ${address}\nAdd WASPRICE_CONTRACT=${address} to .env.`);
      return;
    }
    case "write": {
      const address = contractAddress();
      const stored = readActiveKeystore();
      console.log(`From ${stored.name} ${stored.address}`);
      for (const note of plan.notes) console.log(note);
      if (plan.value > 0n) console.log(`Value: ${formatGen(plan.value)} GEN`);
      await precheck(plan.precheck, stored.address, stored.name);
      console.log("Check passed: the contract would accept this call now.");
      const client = await signingClient();
      const hash = (await client.writeContract({ address, functionName: plan.functionName, args: plan.args, value: plan.value })) as TransactionHash;
      await settle(hash, plan.command);
      return;
    }
  }
}

async function main(): Promise<void> {
  let plan: Plan;
  try {
    plan = planCommand(process.argv.slice(2), { now: new Date(), readText: (p) => readFileSync(p, "utf8") });
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    console.error("Run: node scripts/wasprice.ts help");
    process.exitCode = 1;
    return;
  }
  await run(plan);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});

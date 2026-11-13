import assert from "node:assert/strict";
import test from "node:test";
import { planCommand, SIGNER, USAGE, withSigner, type Plan } from "./commands.ts";

const GEN = 10n ** 18n;
const ENV = { now: new Date("2026-11-13T12:00:07.250Z"), readText: (p: string) => (p === "variant.txt" ? "﻿1,7 L, inox\r\n" : "") };
const plan = (...argv: string[]) => planCommand(argv, ENV);
const BASE = "https://mcurly17.github.io/wasprice/demo/";
const A = "0xf5Fe96d62733d40f25822b20C5E46A0E17483dFF";

function write(p: Plan) {
  assert.equal(p.kind, "write");
  if (p.kind !== "write") throw new Error("not a write");
  return p;
}

test("no command, help, --help and -h print the usage", () => {
  for (const argv of [[], ["help"], ["--help"], ["-h"]]) assert.deepEqual(planCommand(argv, ENV), { kind: "help" });
  for (const cmd of ["snapshot <url> <ts14>", "price-check <price>", "declare <pledge_id>", "challenge-image <promo_id>", "PowerShell"]) {
    assert.ok(USAGE.includes(cmd), cmd);
  }
});

test("reads map to views with int ids and string addresses", () => {
  assert.deepEqual(plan("stats"), { kind: "read", functionName: "get_stats", args: [] });
  assert.deepEqual(plan("pledge-info", "0"), { kind: "read", functionName: "get_pledge", args: [0] });
  assert.deepEqual(plan("promo", "3"), { kind: "read", functionName: "get_promo", args: [3] });
  assert.deepEqual(plan("promos", "0"), { kind: "read", functionName: "list_promos", args: [0, 0, 50] });
  assert.deepEqual(plan("window", "2"), { kind: "read", functionName: "promo_window", args: [2] });
  assert.deepEqual(plan("challenge-info", "1"), { kind: "read", functionName: "get_challenge", args: [1] });
  assert.deepEqual(plan("challenges", "1"), { kind: "read", functionName: "list_challenges", args: [1] });
  assert.deepEqual(plan("standing", A), { kind: "read", functionName: "standing", args: [A] });
  assert.deepEqual(plan("credit", A), { kind: "read", functionName: "get_credit", args: [A] });
  assert.throws(() => plan("standing", "0x12"), /20-byte address/);
  assert.throws(() => plan("promo", "-1"), /non-negative integer/);
  assert.deepEqual(plan("config"), { kind: "config" });
});

test("pledge previews with the signer, the payout and the bond in wei strings", () => {
  const p = write(plan("pledge", "DemoMaison", "mcurly17.github.io", "0.1", "30", "--value", "0.5"));
  assert.equal(p.functionName, "create_pledge");
  assert.deepEqual(p.args, ["DemoMaison", "mcurly17.github.io", GEN / 10n, 30]);
  assert.equal(p.value, GEN / 2n);
  assert.deepEqual(p.precheck, {
    kind: "preview", functionName: "preview_pledge",
    args: [SIGNER, "DemoMaison", "mcurly17.github.io", (GEN / 10n).toString(), 30, (GEN / 2n).toString()],
  });
  assert.deepEqual(withSigner((p.precheck as { args: unknown[] }).args as never, A)[0], A);
  assert.throws(() => plan("pledge", "D", "d.example", "0.1", "30"), /needs --value/);
});

test("declare: now becomes ISO UTC, prices stay strings, --pct and --variant-file", () => {
  const p = write(plan("declare", "0", `${BASE}bouilloire.html`, "39.90", "34.90", "now", "--pct", "13", "--variant-file", "variant.txt"));
  assert.equal(p.functionName, "declare_promo");
  assert.deepEqual(p.args, [0, `${BASE}bouilloire.html`, "1,7 L, inox", "39.90", "34.90", 13, "2026-11-13T12:00:07Z"]);
  assert.equal(p.value, 0n);
  assert.deepEqual(p.precheck, { kind: "preview", functionName: "preview_declare", args: [SIGNER, ...p.args] });
  assert.ok(p.notes.includes("promo_start = now = 2026-11-13T12:00:07Z"));
});

test("declare without --pct proposes the computed percentage and sends 0", () => {
  const p = write(plan("declare", "0", `${BASE}theiere.html`, "39.90", "31.90", "2026-11-13T12:00:00Z"));
  assert.equal(p.args[5], 0);
  assert.ok(p.notes.some((n) => n.includes("--pct 20")));
});

test("declare refuses 39,90 with the PowerShell hint, and bad dates", () => {
  assert.throws(() => plan("declare", "0", `${BASE}a.html`, "39,90", "34.90", "now"), /Write 39\.90, not 39,90.*array/);
  assert.throws(() => plan("declare", "0", `${BASE}a.html`, "39", "90", "34.90", "now"), /expects 5 argument/);
  assert.throws(() => plan("declare", "0", `${BASE}a.html`, "39.90", "34.9", "now"), /promo price/);
  assert.throws(() => plan("declare", "0", `${BASE}a.html`, "39.90", "34.90", "2026-11-13"), /ISO 8601 UTC/);
  assert.throws(() => plan("declare", "0", `${BASE}a.html`, "39.90", "34.90", "now", "--value", "1"), /applies to pledge/);
  assert.throws(() => plan("declare", "0", `${BASE}a.html`, "39.90", "34.90", "now", "--bogus", "1"), /Unknown option --bogus/);
});

test("challenge and challenge-image check the window, then their preview", () => {
  const c = write(plan("challenge", "0", "20261105100000", "--value", "0.01"));
  assert.equal(c.functionName, "challenge");
  assert.deepEqual(c.args, [0, "20261105100000"]);
  assert.equal(c.value, GEN / 100n);
  assert.deepEqual(c.precheck, {
    kind: "window", promoId: 0, ts: "20261105100000",
    preview: { functionName: "preview_challenge", args: [0, "20261105100000", SIGNER, (GEN / 100n).toString()] },
  });
  const img = `${BASE}img/radio-prix.png`;
  const i = write(plan("challenge-image", "4", "20261105100000", img, "--value", "0.01"));
  assert.deepEqual(i.args, [4, "20261105100000", img]);
  assert.equal((i.precheck as { preview: { functionName: string } }).preview.functionName, "preview_challenge_image");
  assert.throws(() => plan("challenge", "0", "2026110510000", "--value", "0.01"), /14 digits/);
  assert.throws(() => plan("challenge", "0", "20261399100000", "--value", "0.01"), /real UTC time/);
  assert.throws(() => plan("challenge", "0", "20261105100000"), /needs --value/);
});

test("non-payable writes read the state first", () => {
  assert.deepEqual(write(plan("resolve", "2")).precheck, { kind: "resolve", challengeId: 2 });
  assert.deepEqual(write(plan("expire", "2")).precheck, { kind: "expire", challengeId: 2 });
  assert.deepEqual(write(plan("close", "0")).precheck, { kind: "close", pledgeId: 0 });
  assert.equal(write(plan("close", "0")).functionName, "close_pledge");
  assert.deepEqual(write(plan("withdraw")).precheck, { kind: "withdraw" });
  assert.deepEqual(write(plan("top-up", "0", "--value", "0.1")).precheck, { kind: "top-up", pledgeId: 0 });
  assert.throws(() => plan("resolve", "2", "--value", "0.01"), /applies to pledge/);
});

test("snapshot, price-check and wait", () => {
  assert.deepEqual(plan("snapshot", `${BASE}mug.html`, "20261113115900", "--promo", "2"), {
    kind: "snapshot", url: `${BASE}mug.html`, ts: "20261113115900", promoId: 2,
  });
  assert.deepEqual(plan("snapshot", `${BASE}mug.html`, "20261113115900"), { kind: "snapshot", url: `${BASE}mug.html`, ts: "20261113115900" });
  assert.throws(() => plan("snapshot", "20261113115900", `${BASE}mug.html`), /page URL first/);
  assert.deepEqual(plan("price-check", "39.90"), { kind: "price-check", raw: "39.90", cents: 3990 });
  assert.throws(() => plan("price-check", "39,90"), /array/);
  const hash = "0x" + "ab".repeat(32);
  assert.deepEqual(plan("wait", hash), { kind: "wait", hash });
  assert.throws(() => plan("wait", "0x12"), /32-byte/);
});

test("keys and passwords are refused before any parsing", () => {
  assert.throws(() => plan("withdraw", "--password", "x"), /command line/);
  assert.throws(() => plan("nope"), /Unknown command/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buttonState, captureTs, samePage } from "../lib/actions.ts";
import { badgeSnippet, formatGen, formatTs14, parseGenInput, shortAddress, verifyCommand, waybackView } from "../lib/format.ts";
import { centsToString, expectedPct, parseCents, pctOk } from "../lib/price.ts";
import { RULE_TEXT } from "../lib/rules.ts";
import { periodNote, statusLabel, statusMeaning, statusTone } from "../lib/status.ts";
import { checkSnapshot, isoToUnix, parseWaybackUrl, windowOf } from "../lib/window.ts";

const ROOT = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, ROOT), "utf8");
const CASES = JSON.parse(read("tests/fixtures/price-cases.json")) as { valid: Record<string, number>; invalid: string[] };
const URL_A = "https://mcurly17.github.io/wasprice/demo/bouilloire.html";

test("lib/price.ts, lib/window.ts and lib/contracts/receipt.ts are byte copies of scripts/", () => {
  assert.equal(read("frontend/lib/price.ts"), read("scripts/price.ts"));
  assert.equal(read("frontend/lib/window.ts"), read("scripts/window.ts"));
  assert.equal(read("frontend/lib/contracts/receipt.ts"), read("scripts/receipt.ts"));
});

test("the price parser follows the shared cases of the contract", () => {
  for (const [text, cents] of Object.entries(CASES.valid)) {
    assert.equal(parseCents(text), cents, text);
    assert.equal(centsToString(cents), text);
  }
  for (const text of CASES.invalid) assert.equal(parseCents(text), null, JSON.stringify(text));
});

test("the % is computed on the struck price (Aldi Süd), with one point of tolerance", () => {
  assert.equal(expectedPct(3990, 3490), 13);
  assert.equal(pctOk(3990, 3490, 13), true);
  assert.equal(pctOk(3990, 3490, 15), false);
  assert.equal(pctOk(3990, 3490, 0), true);
});

test("the window and the pasted Wayback link", () => {
  const start = isoToUnix("2026-11-13T12:00:00Z")!;
  assert.deepEqual(windowOf(start), { fromTs: "20261014120000", toTs: "20261113120000" });
  assert.equal(checkSnapshot("20261105100000", start, start + 3600), "");
  assert.match(checkSnapshot("20261113115900", start, start - 3600), /in the future/);
  const link = `https://web.archive.org/web/20261105100000/${URL_A}`;
  assert.equal(captureTs(link, parseWaybackUrl), "20261105100000");
  assert.equal(captureTs(" 20261105100000 ", parseWaybackUrl), "20261105100000");
  assert.equal(samePage(`${parseWaybackUrl(link)!.url}/`, URL_A), true);
  assert.equal(samePage("https://MCURLY17.github.io/wasprice/demo/bouilloire.html", URL_A), true);
  assert.equal(samePage("https://mcurly17.github.io/wasprice/demo/mug.html", URL_A), false);
});

test("status labels and tones", () => {
  assert.equal(statusLabel("EVIDENCE_NOT_FOUND"), "Evidence not found");
  assert.equal(statusLabel("UPHELD"), "Upheld");
  assert.equal(statusLabel("DEBUNKED"), "Debunked");
  assert.equal(statusLabel("LIVE"), "Live");
  assert.equal(statusTone("UPHELD"), "bad");
  assert.equal(statusTone("REJECTED"), "good");
  assert.match(statusMeaning("EXPIRED"), /refunded/);
  assert.equal(statusLabel("SOMETHING"), "SOMETHING");
  assert.equal(statusLabel("CLOSED"), "Closed");
  assert.equal(statusTone("CLOSED"), "neutral");
});

test("the period note never calls a closed promo open", () => {
  const until = "2026-11-16T12:10:00Z";
  assert.match(periodNote({ status: "CLOSED", open_challenge: false, challenge_until: until }), /ended at 2026-11-16T12:10:00Z.*no longer/);
  assert.match(periodNote({ status: "LIVE", open_challenge: false, challenge_until: until }), /^Open to challenges until 2026-11-16T12:10:00Z/);
  assert.match(periodNote({ status: "LIVE", open_challenge: true, challenge_until: until }), /filed in time is open/);
  assert.match(periodNote({ status: "DEBUNKED", open_challenge: false, challenge_until: until }), /debunked/);
});

test("the write button waits for an empty preview", () => {
  const ok = { connected: true, busy: false, localError: "", preview: "" };
  assert.deepEqual(buttonState(ok), { enabled: true, reason: "" });
  assert.equal(buttonState({ ...ok, connected: false }).enabled, false);
  assert.equal(buttonState({ ...ok, busy: true }).enabled, false);
  assert.equal(buttonState({ ...ok, preview: undefined }).reason, "Asking the contract…");
  assert.equal(buttonState({ ...ok, previewFailed: true }).enabled, false);
  const refused = buttonState({ ...ok, preview: "[EXPECTED] stake below minimum (10000000000000000 wei)" });
  assert.equal(refused.enabled, false);
  assert.match(refused.reason, /stake below minimum/);
  assert.equal(buttonState({ ...ok, localError: "Choose a promo." }).reason, "Choose a promo.");
});

test("formatting: GEN without float, timestamps, links, badge", () => {
  assert.equal(formatGen("100000000000000000"), "0.1 GEN");
  assert.equal(formatGen("220000000000000000"), "0.22 GEN");
  assert.equal(formatGen("0"), "0 GEN");
  assert.equal(parseGenInput("0.01"), 10n ** 16n);
  assert.equal(parseGenInput("0,01"), null);
  assert.equal(formatTs14("20261105100000"), "2026-11-05 10:00:00 UTC");
  assert.equal(shortAddress("0xf5Fe96d62733d40f25822b20C5E46A0E17483dFF"), "0xf5Fe…3dFF");
  assert.equal(waybackView("20261105100000", URL_A), `https://web.archive.org/web/20261105100000/${URL_A}`);
  assert.match(verifyCommand("20261105100000", URL_A), /20261105100000id_\/.*\nGet-FileHash page\.bin -Algorithm SHA256$/);
  assert.match(badgeSnippet("https://mcurly17.github.io/wasprice", "0xabc"), /merchant\/\?addr=0xabc.*Bonded honest discounts – WasPrice/);
});

test("the rules page shows the contract's RULE_TEXT verbatim", () => {
  const source = read("contracts/was_price.py");
  const block = /RULE_TEXT = \(\n([\s\S]*?)\n\)/.exec(source)![1];
  const fromContract = [...block.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\"/g, '"')).join("");
  assert.equal(RULE_TEXT, fromContract);
});

test("no external font, script or tracker in the app sources", () => {
  for (const file of ["frontend/app/layout.tsx", "frontend/app/globals.css"]) {
    const text = read(file);
    assert.doesNotMatch(text, /fonts\.googleapis|<script|googletagmanager|analytics/i, file);
  }
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { centsToString, expectedPct, parseCents, pctOk, priceHelp } from "./price.ts";

// The same cases drive tests/direct/test_repo.py against the contract's _parse_cents.
const CASES = JSON.parse(readFileSync(new URL("../tests/fixtures/price-cases.json", import.meta.url), "utf8")) as {
  valid: Record<string, number>;
  invalid: string[];
};

test("valid prices parse to exact cents", () => {
  for (const [text, cents] of Object.entries(CASES.valid)) {
    assert.equal(parseCents(text), cents, text);
    assert.equal(centsToString(cents), text, text);
  }
});

test("everything else is refused, including 39,90 and 39.9", () => {
  for (const text of CASES.invalid) assert.equal(parseCents(text), null, JSON.stringify(text));
  assert.equal(parseCents(39.9), null);
  assert.equal(parseCents(undefined), null);
});

test("percentages are computed on the declared was price, rounded half up", () => {
  assert.equal(expectedPct(3990, 3490), 13);
  assert.equal(expectedPct(3990, 3190), 20);
  assert.equal(expectedPct(1290, 990), 23);
  assert.equal(expectedPct(3990, 2990), 25);
  assert.equal(expectedPct(3490, 2990), 14);
  assert.equal(expectedPct(1000, 950), 5);
  assert.equal(expectedPct(200, 199), 1); // 0.5 % rounds up
  for (const pct of [0, 12, 13, 14]) assert.equal(pctOk(3990, 3490, pct), true, String(pct));
  for (const pct of [11, 15, 50]) assert.equal(pctOk(3990, 3490, pct), false, String(pct));
});

test("the help names the PowerShell array pitfall", () => {
  assert.match(priceHelp("39,90"), /Write 39\.90, not 39,90/);
  assert.match(priceHelp("39 90"), /array/);
  assert.match(priceHelp("abc"), /must look like 39\.90/);
});

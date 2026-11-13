import assert from "node:assert/strict";
import test from "node:test";
import {
  archiveUrl, checkSnapshot, isoToUnix, parseWaybackUrl, ts14ToUnix, unixToIso, unixToTs14, waybackCalendar, windowOf,
} from "./window.ts";

const START = isoToUnix("2026-11-13T12:00:00Z")!;
const NOW = isoToUnix("2026-11-13T13:00:00Z")!;
const URL_C = "https://mcurly17.github.io/wasprice/demo/mug.html";

test("ISO and 14-digit timestamps round-trip in UTC", () => {
  assert.equal(unixToIso(START), "2026-11-13T12:00:00Z");
  assert.equal(unixToTs14(START), "20261113120000");
  assert.equal(ts14ToUnix("20261113120000"), START);
});

test("malformed or impossible timestamps are refused", () => {
  for (const ts of ["2026111312000", "202611131200000", "20261301120000", "20260230120000", "20261113246000", "2026-11-13T12"]) {
    assert.equal(ts14ToUnix(ts), null, ts);
  }
  for (const iso of ["2026-11-13 12:00:00", "2026-11-13T12:00:00", "2026-02-30T12:00:00Z", "2026-11-13T12:00:00.000Z"]) {
    assert.equal(isoToUnix(iso), null, iso);
  }
});

test("the window is [promo_start - 30 days, promo_start)", () => {
  assert.deepEqual(windowOf(START), { fromTs: "20261014120000", toTs: "20261113120000" });
  assert.equal(waybackCalendar(START, URL_C), `https://web.archive.org/web/20261014120000*/${URL_C}`);
});

test("snapshot checks give the contract's exact messages", () => {
  assert.equal(checkSnapshot("20261014120000", START, NOW), "");
  assert.equal(checkSnapshot("20261113115900", START, NOW), "");
  assert.equal(checkSnapshot("20261014115959", START, NOW), "[EXPECTED] snapshot_ts is before the 30-day window (from 20261014120000)");
  assert.equal(checkSnapshot("20261113120000", START, NOW), "[EXPECTED] snapshot_ts must be before promo_start (20261113120000)");
  assert.equal(checkSnapshot("20261113130001", START, NOW), "[EXPECTED] snapshot_ts is in the future");
  assert.match(checkSnapshot("2026111312", START, NOW), /valid 14-digit UTC time/);
});

test("a pasted Wayback link gives its timestamp and page", () => {
  assert.deepEqual(parseWaybackUrl(`https://web.archive.org/web/20261105100000/${URL_C}`), { ts: "20261105100000", url: URL_C });
  assert.deepEqual(parseWaybackUrl(`https://web.archive.org/web/20261105100000id_/${URL_C}`), { ts: "20261105100000", url: URL_C });
  assert.deepEqual(parseWaybackUrl(` http://web.archive.org/web/20261105100000im_/${URL_C} `), { ts: "20261105100000", url: URL_C });
  assert.equal(parseWaybackUrl(`https://web.archive.org/web/2026*/${URL_C}`), null);
  assert.equal(parseWaybackUrl(`https://example.org/web/20261105100000/${URL_C}`), null);
  assert.equal(parseWaybackUrl(`https://web.archive.org/web/20261399100000/${URL_C}`), null);
  assert.equal(archiveUrl("20261105100000", URL_C), `https://web.archive.org/web/20261105100000id_/${URL_C}`);
});

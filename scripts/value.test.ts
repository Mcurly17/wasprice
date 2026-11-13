import assert from "node:assert/strict";
import test from "node:test";
import { SLOW_WAIT_RETRIES, WAIT_INTERVAL_MS, formatGen, isPayable, parseGen, payableWei, splitValueFlag, waitRetries } from "./value.ts";

test("resolve and wait poll for 20 minutes", () => {
  assert.equal(waitRetries("resolve"), SLOW_WAIT_RETRIES);
  assert.equal(waitRetries("wait"), SLOW_WAIT_RETRIES);
  assert.equal(waitRetries("challenge"), 200);
  assert.equal(SLOW_WAIT_RETRIES * WAIT_INTERVAL_MS, 20 * 60 * 1000);
});

test("0.01 GEN is 10^16 wei", () => {
  assert.equal(parseGen("0.01"), 10n ** 16n);
  assert.equal(parseGen(" 0.01 "), 10n ** 16n);
});

test("whole GEN and 18-digit fractions", () => {
  assert.equal(parseGen("1"), 10n ** 18n);
  assert.equal(parseGen("0.1"), 10n ** 17n);
  assert.equal(parseGen("0.000000000000000001"), 1n);
});

test("formatGen is the inverse of parseGen", () => {
  for (const text of ["0", "1", "0.01", "0.22", "0.000000000000000001", "12.5"]) {
    assert.equal(formatGen(parseGen(text)), text);
  }
});

test("rejects amounts that are not a GEN decimal", () => {
  for (const text of ["", "1.", ".1", "-1", "1e18", "0,01", "0.0000000000000000001", "GEN"]) {
    assert.throws(() => parseGen(text), /GEN decimal/);
  }
});

test("--value supplies the amount of every payable command", () => {
  const flag = splitValueFlag(["--value", "0.01"]);
  assert.equal(flag.value, "0.01");
  for (const command of ["pledge", "top-up", "challenge", "challenge-image"]) {
    assert.equal(payableWei(command, flag.value), 10n ** 16n, command);
    assert.equal(isPayable(command), true, command);
  }
  assert.equal(splitValueFlag(["0", "--value=0.4"]).value, "0.4");
});

test("amounts come only from --value, never from a positional number", () => {
  assert.throws(() => payableWei("top-up", undefined), /needs --value/);
  assert.throws(() => payableWei("challenge", undefined), /needs --value/);
  assert.deepEqual(splitValueFlag(["0", "0.05"]).args, ["0", "0.05"]);
});

test("--value is rejected where nothing is paid", () => {
  for (const command of ["declare", "resolve", "expire", "close", "withdraw", "deploy", "wait", "stats"]) {
    assert.equal(isPayable(command), false, command);
    assert.throws(() => payableWei(command, "0.01"), /applies to pledge/, command);
    assert.equal(payableWei(command, undefined), 0n);
  }
  assert.throws(() => payableWei("top-up", "0"), /greater than 0/);
  assert.throws(() => splitValueFlag(["--value", "0.1", "--value", "0.2"]), /twice/);
});

test("private keys and passwords are refused as options", () => {
  assert.throws(() => splitValueFlag(["--private-key", "0xabc"]), /command line/);
  assert.throws(() => splitValueFlag(["--password", "secret"]), /command line/);
  assert.throws(() => splitValueFlag(["--password=secret"]), /command line/);
  assert.throws(() => splitValueFlag(["--value"]), /needs a GEN amount/);
});

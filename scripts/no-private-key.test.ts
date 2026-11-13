// Fails if any file in scripts/ reads or accepts a raw private key. Signing goes through
// the encrypted genlayer CLI keystore only. Allowed mentions: the refusal of the
// --private-key option in value.ts, and test lines asserting that refusal.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const SELF = "no-private-key.test.ts";
const REFUSAL = 'token === "--private-key" || token.startsWith("--private-key=")';
const REFUSAL_TEST = /^\s*assert\.throws\(.*"--private-key".*\/command line\/\);\s*$/gm;
const DIR = new URL("./", import.meta.url);

test("scripts/ never reads PRIVATE_KEY nor accepts --private-key", () => {
  const files = readdirSync(DIR).filter((name) => name !== SELF && /\.(ts|mjs|js|py)$/.test(name));
  assert.ok(files.includes("value.ts") && files.includes("wasprice.ts"));
  let refusals = 0;
  for (const name of files) {
    let source = readFileSync(new URL(name, DIR), "utf8");
    if (name === "value.ts") {
      refusals = source.split(REFUSAL).length - 1;
      source = source.split(REFUSAL).join("");
    }
    if (name.endsWith(".test.ts")) source = source.replace(REFUSAL_TEST, "");
    assert.doesNotMatch(source, /private_key/i, `${name} mentions PRIVATE_KEY`);
    assert.doesNotMatch(source, /--private-key/i, `${name} mentions --private-key`);
  }
  assert.equal(refusals, 1, "value.ts must still refuse --private-key");
});

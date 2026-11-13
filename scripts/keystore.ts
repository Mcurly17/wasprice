import { createDecipheriv, scryptSync, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { keccak256 } from "viem";

export class KeystoreError extends Error {}

interface KdfParams {
  salt: string;
  n: number;
  r: number;
  p: number;
  dklen: number;
}

interface KeystoreCrypto {
  cipher: string;
  ciphertext: string;
  cipherparams: { iv: string };
  kdf: string;
  kdfparams: KdfParams;
  mac: string;
}

export function decryptKeystore(json: string, password: string): `0x${string}` {
  let parsed: { crypto?: KeystoreCrypto; Crypto?: KeystoreCrypto };
  try {
    parsed = JSON.parse(json) as { crypto?: KeystoreCrypto; Crypto?: KeystoreCrypto };
  } catch {
    throw new KeystoreError("The keystore file is not valid JSON.");
  }
  const crypto = parsed.crypto ?? parsed.Crypto;
  if (!crypto || crypto.kdf !== "scrypt" || crypto.cipher !== "aes-128-ctr") {
    throw new KeystoreError("Unsupported keystore. Expected Web3 scrypt and aes-128-ctr.");
  }
  const { n, r, p, dklen, salt } = crypto.kdfparams;
  if (!Number.isInteger(n) || n < 2 || n > 2 ** 20 || !Number.isInteger(r) || r < 1 || !Number.isInteger(p) || p < 1 || dklen !== 32) {
    throw new KeystoreError("Unsupported scrypt parameters.");
  }
  const derived = scryptSync(Buffer.from(password, "utf8"), Buffer.from(salt, "hex"), dklen, {
    N: n,
    r,
    p,
    maxmem: 128 * n * r * 2,
  });
  const ciphertext = Buffer.from(crypto.ciphertext, "hex");
  const mac = Buffer.from(keccak256(new Uint8Array(Buffer.concat([derived.subarray(16, 32), ciphertext]))).slice(2), "hex");
  const expected = Buffer.from(crypto.mac, "hex");
  if (mac.length !== expected.length || !timingSafeEqual(mac, expected)) {
    throw new KeystoreError("Wrong keystore password.");
  }
  const decipher = createDecipheriv("aes-128-ctr", derived.subarray(0, 16), Buffer.from(crypto.cipherparams.iv, "hex"));
  const secret = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return `0x${secret.toString("hex")}`;
}

export function readActiveKeystore(): { name: string; json: string; address: `0x${string}` } {
  const configPath = path.join(homedir(), ".genlayer", "genlayer-config.json");
  let name = "";
  try {
    const config = JSON.parse(readFileSync(configPath, "utf8")) as { activeAccount?: unknown };
    if (typeof config.activeAccount === "string") name = config.activeAccount;
  } catch {
    throw new KeystoreError("No genlayer CLI config. Select an account with: npx genlayer account use <name>");
  }
  if (!/^[A-Za-z0-9._-]+$/.test(name)) {
    throw new KeystoreError("No active genlayer account. Select one with: npx genlayer account use <name>");
  }
  const file = path.join(homedir(), ".genlayer", "keystores", `${name}.json`);
  let json = "";
  try {
    json = readFileSync(file, "utf8");
  } catch {
    throw new KeystoreError(`No keystore for the active account '${name}'.`);
  }
  let raw = "";
  try {
    const parsed = JSON.parse(json) as { address?: unknown };
    if (typeof parsed.address === "string") raw = parsed.address.replace(/^0x/, "");
  } catch {
    throw new KeystoreError("The keystore file is not valid JSON.");
  }
  if (!/^[0-9a-fA-F]{40}$/.test(raw)) throw new KeystoreError("The keystore has no address.");
  return { name, json, address: `0x${raw.toLowerCase()}` };
}

export function promptPassword(message: string): Promise<string> {
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    return Promise.reject(new KeystoreError("Type the keystore password in a terminal. It is not read from a file or an argument."));
  }
  return new Promise((resolve) => {
    process.stderr.write(message);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let password = "";
    const stop = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
    };
    const onData = (chunk: string) => {
      if (chunk === "\u0003") {
        stop();
        process.stderr.write("\n");
        process.exit(130);
      }
      if (chunk === "\r" || chunk === "\n" || chunk === "\r\n") {
        stop();
        process.stderr.write("\n");
        resolve(password);
        return;
      }
      if (chunk === "\u007f" || chunk === "\b") {
        password = password.slice(0, -1);
        return;
      }
      if (chunk.startsWith("\u001b")) return;
      password += chunk;
    };
    stdin.on("data", onData);
  });
}

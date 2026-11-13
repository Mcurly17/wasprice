import assert from "node:assert/strict";
import test from "node:test";
import { privateKeyToAccount } from "viem/accounts";
import { decryptKeystore, KeystoreError } from "./keystore.ts";

const FIXTURE = {
  crypto: {
    cipher: "aes-128-ctr",
    cipherparams: { iv: "0102030405060708090a0b0c0d0e0f10" },
    ciphertext: "4d41a62bdc69dd5deea6d8e9ab75cc5417eb08a518ba00236d2698eccbc1a66f",
    kdf: "scrypt",
    kdfparams: {
      dklen: 32,
      n: 1024,
      r: 8,
      p: 1,
      salt: "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
    },
    mac: "f2007dca18501e7f4e00ccf3e7596e54bb096d506b4e9a686b4b0cc89ab859e0",
  },
  version: 3,
};

test("a Web3 scrypt keystore unlocks to the fixture address", () => {
  const key = decryptKeystore(JSON.stringify(FIXTURE), "test-password");
  assert.equal(privateKeyToAccount(key).address, "0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A");
});

test("a wrong password is rejected", () => {
  assert.throws(() => decryptKeystore(JSON.stringify(FIXTURE), "nope"), KeystoreError);
});

// The only module that reads environment variables. Next.js inlines each
// `process.env.NEXT_PUBLIC_*` at build time, so every access stays literal.

export const BASE_PATH = "/wasprice";
export const SITE_URL = "https://mcurly17.github.io/wasprice";
export const REPO_URL = "https://github.com/Mcurly17/wasprice";
export const EXPLORER_URL = "https://explorer-studio.genlayer.com";

const DEFAULT_RPC = "https://studio.genlayer.com/api";
const DEFAULT_CHAIN_ID = 61999;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

const rawAddress = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "").trim();
const rawRpc = (process.env.NEXT_PUBLIC_GENLAYER_RPC_URL ?? "").trim();
const rawChainId = (process.env.NEXT_PUBLIC_GENLAYER_CHAIN_ID ?? "").trim();

function rpc(raw: string): string {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? raw : DEFAULT_RPC;
  } catch {
    return DEFAULT_RPC;
  }
}

const chainId = /^\d+$/.test(rawChainId) && Number(rawChainId) > 0 ? Number(rawChainId) : DEFAULT_CHAIN_ID;

export const CONFIG = {
  contractAddress: ADDRESS_RE.test(rawAddress) ? (rawAddress as `0x${string}`) : null,
  rpcUrl: rawRpc === "" ? DEFAULT_RPC : rpc(rawRpc),
  chainId,
  chainIdHex: `0x${chainId.toString(16)}`,
  chainName: "GenLayer Studio",
  symbol: "GEN",
} as const;

export const CONFIG_ISSUE: string | null = CONFIG.contractAddress
  ? null
  : "No contract configured: NEXT_PUBLIC_CONTRACT_ADDRESS is empty or not a 0x address.";

/** Prefixes a path served from public/ with the export base path. */
export function asset(path: string): string {
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}

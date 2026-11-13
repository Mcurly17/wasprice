"use client";

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import type { GenLayerChain } from "genlayer-js/types";
import { CONFIG, EXPLORER_URL } from "@/lib/config";

/** Any EIP-1193 provider injected by a browser wallet. No wallet brand is checked. */
export interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<any>;
  on?: (event: string, handler: (...args: any[]) => void) => void;
  removeListener?: (event: string, handler: (...args: any[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export const NO_WALLET_MESSAGE = "No browser wallet found. Install a wallet extension, then reload this page.";

export function getEthereumProvider(): EthereumProvider | null {
  return typeof window === "undefined" ? null : window.ethereum ?? null;
}

export async function getAccounts(): Promise<string[]> {
  const provider = getEthereumProvider();
  if (!provider) return [];
  try {
    return (await provider.request({ method: "eth_accounts" })) as string[];
  } catch {
    return [];
  }
}

export async function walletChainId(): Promise<string | null> {
  const provider = getEthereumProvider();
  if (!provider) return null;
  const id = await provider.request({ method: "eth_chainId" });
  return typeof id === "string" ? id.toLowerCase() : null;
}

/** Switches the wallet to the configured GenLayer chain, adding it when unknown. */
export async function switchToGenLayer(): Promise<void> {
  const provider = getEthereumProvider();
  if (!provider) throw new Error(NO_WALLET_MESSAGE);
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CONFIG.chainIdHex }] });
  } catch (err: any) {
    if (err?.code !== 4902) throw err;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: CONFIG.chainIdHex,
        chainName: CONFIG.chainName,
        nativeCurrency: { name: CONFIG.symbol, symbol: CONFIG.symbol, decimals: 18 },
        rpcUrls: [CONFIG.rpcUrl],
        blockExplorerUrls: [EXPLORER_URL],
      }],
    });
  }
}

export async function connectWallet(): Promise<string> {
  const provider = getEthereumProvider();
  if (!provider) throw new Error(NO_WALLET_MESSAGE);
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts?.length) throw new Error("No account selected in the wallet.");
  if ((await walletChainId()) !== CONFIG.chainIdHex) await switchToGenLayer();
  return accounts[0];
}

// genlayer-js 1.1.8 overwrites chain.rpcUrls when given an endpoint: each client gets a copy.
function configuredChain(): GenLayerChain {
  return {
    ...studionet,
    id: CONFIG.chainId,
    rpcUrls: { default: { http: [CONFIG.rpcUrl] } },
    blockExplorers: { default: { name: "GenLayer Studio Explorer", url: EXPLORER_URL } },
  };
}

/** A client on the configured RPC. With an address, signing goes to the injected wallet. */
export function createGenLayerClient(address?: `0x${string}`) {
  return createClient({ chain: configuredChain(), endpoint: CONFIG.rpcUrl, ...(address ? { account: address } : {}) });
}

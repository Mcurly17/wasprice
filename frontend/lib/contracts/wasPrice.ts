"use client";

// Reads (no wallet), previews and writes of the WasPrice contract.
// Every write is checked first (its preview_* view, or a read of the current state) and is
// not sent when the contract would refuse it: on Studionet a refused payable keeps its value.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TransactionHash } from "genlayer-js/types";
import { CONFIG } from "@/lib/config";
import { createGenLayerClient, getAccounts, getEthereumProvider, NO_WALLET_MESSAGE, switchToGenLayer, walletChainId } from "@/lib/genlayer/client";
import { interpretReceipt, isDecidedStatus, receiptStatus, type ReceiptOutcome } from "./receipt";
import type { ChallengeView, Credit, PledgeView, PromoView, ReadMethod, Standing, Stats, WriteMethod } from "./types";

const ROOT = "wasprice";
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

let reader: ReturnType<typeof createGenLayerClient> | null = null;

/** Calls a view; views return JSON inside a str, parsed here. */
export async function readWasPrice<T>(functionName: ReadMethod, args: (string | number)[] = []): Promise<T> {
  if (!CONFIG.contractAddress) throw new Error("No contract configured.");
  reader ??= createGenLayerClient();
  const raw = await reader.readContract({ address: CONFIG.contractAddress, functionName, args, jsonSafeReturn: true });
  if (typeof raw !== "string" || functionName.startsWith("preview_") || functionName === "promo_status") return raw as T;
  return JSON.parse(raw) as T;
}

function view<T>(functionName: ReadMethod, args: (string | number)[], enabled = true) {
  return {
    queryKey: [ROOT, CONFIG.contractAddress, functionName, ...args],
    queryFn: () => readWasPrice<T>(functionName, args),
    enabled: enabled && CONFIG.contractAddress !== null,
    retry: 1,
  };
}

const isId = (id: number | null): id is number => id !== null && Number.isSafeInteger(id) && id >= 0;

export const useStats = () => useQuery(view<Stats>("get_stats", []));
export const usePledge = (id: number | null) => useQuery(view<PledgeView>("get_pledge", [id ?? -1], isId(id)));
export const usePromo = (id: number | null) => useQuery(view<PromoView>("get_promo", [id ?? -1], isId(id)));
export const usePromos = (pledgeId: number | null) => useQuery(view<PromoView[]>("list_promos", [pledgeId ?? -1, 0, 50], isId(pledgeId)));
export const useChallenges = (promoId: number | null) => useQuery(view<ChallengeView[]>("list_challenges", [promoId ?? -1], isId(promoId)));
export const useStanding = (addr: string | null) => useQuery(view<Standing>("standing", [addr ?? ""], addr !== null && ADDRESS_RE.test(addr)));
export const useCredit = (addr: string | null) => useQuery(view<Credit>("get_credit", [addr ?? ""], addr !== null && ADDRESS_RE.test(addr)));

/** All pledges with their promos (no list view for pledges: read one by one). */
export function usePledgesWithPromos() {
  const stats = useStats();
  const total = stats.data?.pledges;
  return useQuery({
    queryKey: [ROOT, CONFIG.contractAddress, "pledges-with-promos", total ?? -1],
    enabled: typeof total === "number",
    queryFn: async () => {
      const out: { pledge: PledgeView; promos: PromoView[] }[] = [];
      for (let id = (total ?? 0) - 1; id >= 0; id--) {
        const pledge = await readWasPrice<PledgeView>("get_pledge", [id]);
        out.push({ pledge, promos: await readWasPrice<PromoView[]>("list_promos", [id, 0, 50]) });
      }
      return out;
    },
  });
}

/** preview_challenge / preview_challenge_image: "" when the call would pass right now. */
export function usePreview(functionName: "preview_challenge" | "preview_challenge_image", args: (string | number)[] | null) {
  return useQuery({
    queryKey: [ROOT, CONFIG.contractAddress, functionName, ...(args ?? [])],
    queryFn: () => readWasPrice<string>(functionName, args ?? []),
    enabled: args !== null && CONFIG.contractAddress !== null,
    staleTime: 0,
    retry: 1,
  });
}

export interface WriteInput {
  functionName: WriteMethod;
  args: (string | number)[];
  valueWei?: string;
  /** Run with the signer's address right before signing; a non-empty message stops the write. */
  check: (account: string) => Promise<string>;
}

export type Progress = "checking" | "signing" | "sent" | "consensus";

export class NotSentError extends Error {}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** Polls an already sent transaction; it never re-sends. */
export async function waitForOutcome(hash: string, timeoutMs = 15 * 60_000): Promise<ReceiptOutcome> {
  reader ??= createGenLayerClient();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const tx = await reader.getTransaction({ hash: hash as TransactionHash });
      if (isDecidedStatus(receiptStatus(tx))) return interpretReceipt(tx);
    } catch {
      // not indexed yet: keep polling the same hash
    }
    await sleep(3000);
  }
  return interpretReceipt(null);
}

export async function writeWasPrice(input: WriteInput, onProgress: (p: Progress, hash?: string) => void) {
  if (!CONFIG.contractAddress) throw new NotSentError("No contract configured.");
  if (!getEthereumProvider()) throw new NotSentError(NO_WALLET_MESSAGE);
  const [account] = await getAccounts();
  if (!account) throw new NotSentError("Connect your wallet first.");
  onProgress("checking");
  // genlayer-js 1.1.8 skips its chain check on Studio networks: check the wallet chain here.
  if ((await walletChainId()) !== CONFIG.chainIdHex) await switchToGenLayer();
  if ((await walletChainId()) !== CONFIG.chainIdHex) throw new NotSentError(`Switch your wallet to ${CONFIG.chainName} (chain ${CONFIG.chainId}).`);
  const refusal = await input.check(account);
  if (refusal !== "") throw new NotSentError(`Not sent: the contract would refuse this call. ${refusal}`);
  onProgress("signing");
  const client = createGenLayerClient(account as `0x${string}`);
  const hash = (await client.writeContract({
    address: CONFIG.contractAddress,
    functionName: input.functionName,
    args: input.args,
    value: BigInt(input.valueWei ?? "0"),
  })) as string;
  onProgress("sent", hash);
  onProgress("consensus", hash);
  const outcome = await waitForOutcome(hash);
  if (outcome.kind !== "success") {
    throw new Error(`${outcome.message ?? "The transaction did not succeed."} (tx ${hash})`);
  }
  return { hash, outcome };
}

/** One write at a time; every view is refreshed after a confirmed success. */
export function useWrite() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<{ phase: Progress; hash?: string } | null>(null);
  const mutation = useMutation({
    mutationFn: (input: WriteInput) => writeWasPrice(input, (phase, hash) => setProgress({ phase, hash })),
    onMutate: () => setProgress(null),
    onSettled: () => queryClient.invalidateQueries({ queryKey: [ROOT] }),
  });
  return { ...mutation, progress };
}

/** Pre-checks of the writes that have no preview view (they are not payable). */
export const checks = {
  async resolve(challengeId: number): Promise<string> {
    const c = await readWasPrice<ChallengeView>("get_challenge", [challengeId]);
    if (c.status !== "OPEN") return `challenge is ${c.status}`;
    return Date.now() / 1000 >= Date.parse(c.resolve_deadline) / 1000 ? "resolution window closed, call expire" : "";
  },
  async expire(challengeId: number): Promise<string> {
    const c = await readWasPrice<ChallengeView>("get_challenge", [challengeId]);
    if (c.status !== "OPEN") return `challenge is ${c.status}`;
    return Date.now() < Date.parse(c.resolve_deadline) ? "resolution window still open" : "";
  },
  async withdraw(account: string): Promise<string> {
    const c = await readWasPrice<Credit>("get_credit", [account]);
    return c.credit === "0" ? "nothing to withdraw" : "";
  },
};

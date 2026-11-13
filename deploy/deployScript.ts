import { readFileSync } from "fs";
import path from "path";
import { TransactionHash, TransactionStatus, GenLayerClient, DecodedDeployData, GenLayerChain } from "genlayer-js/types";
import { localnet, studionet } from "genlayer-js/chains";

// The demo deploys with `node --env-file-if-exists=.env scripts/wasprice.ts deploy`, which
// signs with the encrypted CLI keystore. This file is kept for `genlayer deploy` users and
// carries the same receipt fix.

const EXECUTION_OK = new Set(["SUCCESS", "FINISHED_WITH_RETURN"]);
const APPLIED = new Set(["ACCEPTED", "FINALIZED"]);

/** Run by `genlayer deploy` without --contract: deploys WasPrice with no constructor argument. */
export default async function main(client: GenLayerClient<any>) {
  const contractCode = new Uint8Array(readFileSync(path.resolve(process.cwd(), "contracts/was_price.py")));

  await client.initializeConsensusSmartContract();

  const hash = (await client.deployContract({ code: contractCode, args: [] })) as TransactionHash;
  console.log(`Deploy transaction: ${hash}`);

  const receipt = await client.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED, retries: 200 });

  // Studio receipts are snake_case and leave txExecutionResultName unset.
  const raw = receipt as Record<string, any>;
  const status: string | undefined = raw.statusName ?? raw.status_name;
  const execution: string | undefined = raw.txExecutionResultName ?? raw.consensus_data?.leader_receipt?.[0]?.execution_result;
  console.log(`Status: ${status ?? "unknown"}\nExecution: ${execution ?? "unknown"}`);
  if (!status || !APPLIED.has(status) || !execution || !EXECUTION_OK.has(execution)) {
    throw new Error(`Deployment failed (status ${status ?? "unknown"}, execution ${execution ?? "unknown"}).`);
  }

  // localnet and Studionet put the address in data.contract_address; genlayer-js 1.1.8
  // does not fill txDataDecoded there.
  const chainId = (client.chain as GenLayerChain).id;
  const studio = chainId === localnet.id || chainId === studionet.id;
  const address: string | undefined = studio
    ? raw.data?.contract_address
    : (receipt.txDataDecoded as DecodedDeployData | undefined)?.contractAddress;
  if (typeof address !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error(`Deployed (${hash}), but the receipt holds no contract address.`);
  }
  console.log(`Contract deployed at address: ${address}`);
}

// Pure receipt interpretation for scripts/wasprice.ts (and the web app, which keeps an
// identical copy). No SDK import, so `node --test` loads it directly.
// Studio receipts mix camelCase and snake_case and leave txExecutionResultName unset:
// every field is read in both forms, and only a fully confirmed result is a success:
// ACCEPTED or FINALIZED, MAJORITY_AGREE (or AGREE), and SUCCESS (or FINISHED_WITH_RETURN).

export type ContractErrorCode = "EXPECTED" | "EXTERNAL" | "TRANSIENT" | "LLM_ERROR";

const PREFIX_RE = /\[(EXPECTED|EXTERNAL|TRANSIENT|LLM_ERROR)\]/;

/** Decodes a GenVM result as Studio returns it in base64: one status byte, then the payload. */
export function decodeResultBase64(b64: string): { code: number; text: string } | null {
  try {
    const binary = atob(b64);
    if (binary.length === 0) return null;
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    return { code: bytes[0], text: new TextDecoder().decode(bytes.subarray(1)) };
  } catch {
    return null;
  }
}

export function contractErrorCode(message: string | null | undefined): ContractErrorCode | null {
  const m = message ? PREFIX_RE.exec(message) : null;
  return m ? (m[1] as ContractErrorCode) : null;
}

/** Returns the contract's own message ("[EXPECTED] ...") from a longer text, or null. */
export function extractContractMessage(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = PREFIX_RE.exec(text);
  return m ? text.slice(m.index).trim() : null;
}

/** Error text of a GenVM result: a base64 string, or `{ status: "rollback", payload, raw }`. */
export function resultErrorText(result: unknown): string | null {
  if (typeof result === "string") {
    const decoded = decodeResultBase64(result);
    return decoded && decoded.code !== 0 ? decoded.text : null;
  }
  if (result && typeof result === "object") {
    const r = result as { status?: unknown; payload?: unknown; raw?: unknown };
    if (r.status === "return") return null;
    if (typeof r.payload === "string" && r.payload !== "") return r.payload;
    if (typeof r.raw === "string") {
      const decoded = decodeResultBase64(r.raw);
      if (decoded && decoded.code !== 0) return decoded.text;
    }
  }
  return null;
}

export type ReceiptKind = "success" | "failed" | "unconfirmed";

export interface ReceiptOutcome {
  kind: ReceiptKind;
  /** Why a failure happened: the contract raised, or validators did not agree. */
  failure: "execution" | "consensus" | null;
  status: string | null;
  consensus: string | null;
  execution: string | null;
  /** Contract message ("[EXPECTED] ...") or a plain explanation; null on success. */
  message: string | null;
  errorCode: ContractErrorCode | null;
  /** Decoded return value of the call on success (e.g. the new pledge id). */
  returnValue: unknown;
  /**
   * Wei the receipt says were credited to the contract although the call failed.
   * Studionet credits the message value before execution and does not refund it.
   */
  keptValue: string | null;
}

const OK_EXECUTION = new Set(["SUCCESS", "FINISHED_WITH_RETURN"]);
const AGREED = new Set(["MAJORITY_AGREE", "AGREE"]);
const NO_CONSENSUS = new Set(["NO_MAJORITY", "MAJORITY_DISAGREE", "DISAGREE", "TIMEOUT", "DETERMINISTIC_VIOLATION"]);
const APPLIED_STATUS = new Set(["ACCEPTED", "FINALIZED"]);
const NOT_APPLIED_STATUS = new Set(["CANCELED", "UNDETERMINED", "LEADER_TIMEOUT", "VALIDATORS_TIMEOUT"]);

export const UNCONFIRMED_MESSAGE = "Result not confirmed. Check the transaction in the explorer.";
export const NO_CONSENSUS_MESSAGE = "Validators did not reach consensus. Nothing changed on-chain; you can retry.";

type Loose = Record<string, any>;

function name(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

export function receiptStatus(receipt: unknown): string | null {
  if (!receipt || typeof receipt !== "object") return null;
  const r = receipt as Loose;
  return name(r.statusName) ?? name(r.status_name) ?? name(r.status);
}

/** Final states: polling can stop. Anything else is still in progress. */
export function isDecidedStatus(status: string | null): boolean {
  return status !== null && (APPLIED_STATUS.has(status) || NOT_APPLIED_STATUS.has(status));
}

function leaderReceipt(r: Loose): Loose | null {
  const data = r.consensus_data ?? r.consensusData;
  const lr = data?.leader_receipt ?? data?.leaderReceipt;
  const first = Array.isArray(lr) ? lr[0] : lr;
  return first && typeof first === "object" ? (first as Loose) : null;
}

function decodeReturnValue(result: unknown): unknown {
  if (!result || typeof result !== "object") return undefined;
  const r = result as Loose;
  if (r.status !== "return") return undefined;
  const readable = r.payload?.readable;
  if (typeof readable !== "string") return undefined;
  try {
    return JSON.parse(readable);
  } catch {
    return readable;
  }
}

function creditedValue(r: Loose): string | null {
  if ((r.value_credited ?? r.valueCredited) !== true) return null;
  const v = r.value;
  const wei =
    typeof v === "bigint" ? v : typeof v === "number" && Number.isSafeInteger(v) ? BigInt(v) : typeof v === "string" && /^\d+$/.test(v) ? BigInt(v) : 0n;
  return wei > 0n ? wei.toString() : null;
}

function leaderErrorText(lr: Loose | null): string | null {
  if (!lr) return null;
  return (
    resultErrorText(lr.result) ??
    name(lr.error) ??
    name(lr.genvm_result?.error_description) ??
    null
  );
}

export function interpretReceipt(receipt: unknown): ReceiptOutcome {
  const base = {
    status: null as string | null,
    consensus: null as string | null,
    execution: null as string | null,
    errorCode: null as ContractErrorCode | null,
    returnValue: undefined as unknown,
    keptValue: null as string | null,
  };
  if (!receipt || typeof receipt !== "object") {
    return { ...base, kind: "unconfirmed", failure: null, message: UNCONFIRMED_MESSAGE };
  }

  const r = receipt as Loose;
  const lr = leaderReceipt(r);
  const status = receiptStatus(r);
  const consensus = name(r.resultName) ?? name(r.result_name) ?? name(r.result);
  const execution = name(r.txExecutionResultName) ?? name(lr?.execution_result);
  const errorText = leaderErrorText(lr);
  const contractMessage = extractContractMessage(errorText);
  const rolledBack = lr?.result && typeof lr.result === "object" && lr.result.status === "rollback";
  const fields = { ...base, status, consensus, execution, errorCode: contractErrorCode(contractMessage) };

  if (status !== null && !isDecidedStatus(status)) {
    return { ...fields, kind: "unconfirmed", failure: null, message: `Transaction still ${status}. ${UNCONFIRMED_MESSAGE}` };
  }

  // A leader SUCCESS is not enough: without agreement nothing was applied.
  const noConsensus =
    (consensus !== null && NO_CONSENSUS.has(consensus)) || (status !== null && NOT_APPLIED_STATUS.has(status));
  // The leader's own error, if any, stays in errorCode; the message is the same for every
  // consensus failure so it is never mistaken for the contract refusing the call.
  if (noConsensus) {
    return { ...fields, kind: "failed", failure: "consensus", message: NO_CONSENSUS_MESSAGE, keptValue: creditedValue(r) };
  }

  if ((execution !== null && !OK_EXECUTION.has(execution)) || rolledBack) {
    return {
      ...fields,
      kind: "failed",
      failure: "execution",
      keptValue: creditedValue(r),
      message: contractMessage ?? errorText ?? `The contract call failed (${execution ?? "rollback"}).`,
    };
  }

  const confirmed =
    execution !== null &&
    OK_EXECUTION.has(execution) &&
    consensus !== null &&
    AGREED.has(consensus) &&
    status !== null &&
    APPLIED_STATUS.has(status);
  if (confirmed) {
    return { ...fields, kind: "success", failure: null, message: null, returnValue: decodeReturnValue(lr?.result) };
  }

  return { ...fields, kind: "unconfirmed", failure: null, message: UNCONFIRMED_MESSAGE };
}

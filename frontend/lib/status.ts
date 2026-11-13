// Labels and tones of promo and challenge states. Pure: tested with node:test.

export type PromoStatus = "LIVE" | "DEBUNKED";
export type ChallengeStatus = "OPEN" | "UPHELD" | "REJECTED" | "EVIDENCE_NOT_FOUND" | "EXPIRED";
export type Tone = "neutral" | "good" | "bad" | "warn";

const LABELS: Record<string, string> = {
  LIVE: "Live",
  DEBUNKED: "Debunked",
  OPEN: "Open",
  UPHELD: "Upheld",
  REJECTED: "Rejected",
  EVIDENCE_NOT_FOUND: "Evidence not found",
  EXPIRED: "Expired",
};

const TONES: Record<string, Tone> = {
  LIVE: "good",
  DEBUNKED: "bad",
  OPEN: "warn",
  UPHELD: "bad",
  REJECTED: "good",
  EVIDENCE_NOT_FOUND: "neutral",
  EXPIRED: "neutral",
};

/** What each verdict means, in one sentence, for the promo page. */
const MEANINGS: Record<string, string> = {
  OPEN: "Filed; waiting for resolve, which anyone can call.",
  UPHELD: "A capture from the 30-day window shows a lower price than the struck price: the bond paid the challenger.",
  REJECTED: "The capture shows a price at or above the struck price: the stake went to the bond.",
  EVIDENCE_NOT_FOUND: "No usable price on a capture of this page inside the window: the stake went to the bond.",
  EXPIRED: "Not resolved within 3 days: the stake was refunded.",
};

export function statusLabel(status: string): string {
  return LABELS[status] ?? status;
}

export function statusTone(status: string): Tone {
  return TONES[status] ?? "neutral";
}

export function statusMeaning(status: string): string {
  return MEANINGS[status] ?? "";
}

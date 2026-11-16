// Shapes of the JSON returned by the WasPrice views (amounts are decimal wei strings).

export interface Stats {
  pledges: number;
  promos: number;
  challenges: number;
  total_credits: string;
  rule: string;
  min_challenge_minutes: number;
  max_challenge_minutes: number;
}

export interface PledgeView {
  id: number;
  merchant: string;
  name: string;
  domain: string;
  bond: string;
  reserved: string;
  payout: string;
  min_stake: string;
  created_at: string;
  ends_at: string;
  active: boolean;
  n_promos: number;
  /** The bond cannot be recovered before this time: the end of the latest challenge period. */
  locked_until: string;
}

export interface PromoView {
  id: number;
  pledge_id: number;
  product_url: string;
  variant: string;
  currency: string;
  was_price: string;
  promo_price: string;
  pct: number;
  promo_start: string;
  declared_at: string;
  /** End of the challenge period, fixed at declaration; no challenge can be filed from then on. */
  challenge_until: string;
  window_from_ts: string;
  window_to_ts: string;
  /** CLOSED: the challenge period has ended with no challenge open (derived by the contract). */
  status: "LIVE" | "DEBUNKED" | "CLOSED";
  open_challenge: boolean;
  n_challenges: number;
}

export interface ChallengeView {
  id: number;
  promo_id: number;
  kind: "TEXT" | "IMAGE";
  snapshot_ts: string;
  image_url: string;
  challenger: string;
  stake: string;
  status: "OPEN" | "UPHELD" | "REJECTED" | "EVIDENCE_NOT_FOUND" | "EXPIRED";
  judged_ts: string;
  page_sha256: string;
  image_ts: string;
  image_sha256: string;
  observed_price: string;
  observed_currency: string;
  struck_seen: string;
  reason: string;
  opened_at: string;
  resolve_deadline: string;
}

export interface Standing {
  merchant: string;
  pledges: number;
  promos: number;
  debunked: number;
  rejected: number;
  evidence_not_found: number;
  bonded_now: string;
}

export interface Credit {
  address: string;
  credit: string;
}

export type ReadMethod =
  | "get_stats" | "get_pledge" | "get_promo" | "get_challenge" | "list_promos" | "list_challenges"
  | "get_credit" | "standing" | "promo_status"
  | "preview_challenge" | "preview_challenge_image";

export type WriteMethod = "challenge" | "challenge_image" | "resolve" | "expire" | "withdraw";

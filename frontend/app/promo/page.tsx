"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Badge, Loading, WindowTimeline } from "@/components/ui";
import { checks, useChallenges, usePledge, usePromo, useWrite } from "@/lib/contracts/wasPrice";
import type { ChallengeView, PromoView } from "@/lib/contracts/types";
import { formatGen, formatTs14, shortAddress, verifyCommand, waybackView } from "@/lib/format";
import { statusMeaning } from "@/lib/status";
import { isoToUnix, waybackCalendar } from "@/lib/window";

function ChallengeRow({ c, promo }: { c: ChallengeView; promo: PromoView }) {
  const write = useWrite();
  const late = Date.now() >= Date.parse(c.resolve_deadline);
  return (
    <article className="card" aria-label={`Challenge ${c.id}`}>
      <p>
        <Badge status={c.status} /> Challenge {c.id} · {c.kind === "IMAGE" ? "price in an image" : "page text"} · by{" "}
        {shortAddress(c.challenger)} · stake {formatGen(c.stake)}
      </p>
      <p className="muted">{statusMeaning(c.status)}</p>
      <p>
        Capture filed: {formatTs14(c.snapshot_ts)}
        {c.judged_ts && (
          <> · capture read: <a href={waybackView(c.judged_ts, promo.product_url)}>{formatTs14(c.judged_ts)}</a></>
        )}
      </p>
      {c.observed_price && (
        <p className="prices">
          Observed {c.observed_price} {c.observed_currency} <span className="muted">vs struck</span> {promo.was_price} {promo.currency}
        </p>
      )}
      {c.reason && <p>Reason: {c.reason}</p>}
      {c.page_sha256 && (
        <details>
          <summary>Page SHA-256 <span className="mono">{c.page_sha256}</span> · verify</summary>
          <pre>{verifyCommand(c.judged_ts, promo.product_url)}</pre>
        </details>
      )}
      {c.image_sha256 && (
        <details>
          <summary>Image SHA-256 <span className="mono">{c.image_sha256}</span> · verify</summary>
          <pre>{verifyCommand(c.image_ts, c.image_url)}</pre>
        </details>
      )}
      {c.status === "OPEN" && (
        <p>
          <button type="button" disabled={write.isPending || late}
            onClick={() => write.mutate({ functionName: "resolve", args: [c.id], check: () => checks.resolve(c.id) })}>
            Resolve
          </button>{" "}
          <button type="button" className="secondary" disabled={write.isPending || !late}
            onClick={() => write.mutate({ functionName: "expire", args: [c.id], check: () => checks.expire(c.id) })}>
            Expire
          </button>{" "}
          <span className="hint">Anyone can resolve until {c.resolve_deadline}; after that, expire refunds the stake.</span>
        </p>
      )}
      {write.progress && write.isPending && <p role="status">Transaction: {write.progress.phase}{write.progress.hash ? ` (${write.progress.hash})` : ""}…</p>}
      {write.error && <p className="notice bad" role="alert">{write.error.message}</p>}
    </article>
  );
}

function PromoPage() {
  const id = Number(useSearchParams().get("id") ?? "");
  const valid = Number.isSafeInteger(id) && id >= 0;
  const promo = usePromo(valid ? id : null);
  const pledge = usePledge(promo.data ? promo.data.pledge_id : null);
  const challenges = useChallenges(valid ? id : null);
  if (!valid) return <p className="notice bad">Missing or invalid promo id.</p>;
  if (!promo.data) return <Loading what={`promo ${id}`} error={promo.error} retry={() => promo.refetch()} />;
  const p = promo.data;
  const start = isoToUnix(p.promo_start);
  return (
    <>
      <h1>
        Promo {p.id} <Badge status={p.status} />
      </h1>
      <p><a href={p.product_url}>{p.product_url}</a>{p.variant && <> · variant: {p.variant}</>}</p>
      <p className="prices">
        <s>{p.was_price}</s> {p.promo_price} {p.currency} {p.pct ? <span className="muted">(-{p.pct} %)</span> : null}
      </p>
      <p className="muted">
        Declared {p.declared_at} · promo start {p.promo_start}
        {pledge.data && <> · {pledge.data.name}, payout {formatGen(pledge.data.payout)}, minimum stake {formatGen(pledge.data.min_stake)}</>}
      </p>
      <h2>The 30-day window</h2>
      <WindowTimeline promoStart={p.promo_start} marks={(challenges.data ?? []).map((c) => ({ ts: c.judged_ts || c.snapshot_ts, status: c.status }))} />
      <p>
        A capture of this page taken in this window that shows a lower selling price than {p.was_price} {p.currency} makes the
        struck price unsupported.{" "}
        {start !== null && <a href={waybackCalendar(start, p.product_url)}>Open the Wayback calendar of the window</a>}
      </p>
      {p.status === "LIVE" && !p.open_challenge && (
        <p><Link className="button" href={`/challenge/?promo=${p.id}`}>Challenge</Link></p>
      )}
      {p.open_challenge && <p className="muted">A challenge is open on this promo; one at a time.</p>}
      <h2>Challenges</h2>
      {challenges.data === undefined ? (
        <Loading what="the challenges" error={challenges.error} retry={() => challenges.refetch()} />
      ) : challenges.data.length === 0 ? (
        <p className="muted">No challenge yet.</p>
      ) : (
        [...challenges.data].reverse().map((c) => <ChallengeRow key={c.id} c={c} promo={p} />)
      )}
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <PromoPage />
    </Suspense>
  );
}

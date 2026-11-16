"use client";

import Link from "next/link";
import { Badge, Loading } from "@/components/ui";
import { checks, useCredit, usePledgesWithPromos, useStats, useWrite } from "@/lib/contracts/wasPrice";
import { formatGen, shortAddress } from "@/lib/format";
import { useWallet } from "@/lib/genlayer/WalletProvider";

function YourCredit() {
  const { address } = useWallet();
  const credit = useCredit(address);
  const write = useWrite();
  if (!address || !credit.data || credit.data.credit === "0") return null;
  return (
    <section className="card" aria-label="Your credit">
      <p>
        Your credit: <strong>{formatGen(credit.data.credit)}</strong>{" "}
        <button type="button" disabled={write.isPending}
          onClick={() => write.mutate({ functionName: "withdraw", args: [], check: (account) => checks.withdraw(account) })}>
          Withdraw
        </button>
      </p>
      {write.error && <p className="notice bad" role="alert">{write.error.message}</p>}
      {write.data && <p className="notice good" role="status">Withdrawn (tx {write.data.hash}).</p>}
    </section>
  );
}

export default function Home() {
  const stats = useStats();
  const list = usePledgesWithPromos();
  return (
    <>
      <h1>Bonded honest discounts</h1>
      <p>
        A merchant posts a GEN bond and declares its promotions (&ldquo;was 39.90, now 34.90&rdquo;). EU law says the
        struck price must be the lowest price of the 30 days before the promotion. Anyone can challenge with one
        Wayback Machine capture of the product page from that window: GenLayer validators read the price on the
        archived bytes, and a lower price is paid from the bond. <Link href="/rules/">How it is judged</Link>.
      </p>
      <YourCredit />
      {stats.data && (
        <p className="muted">
          {stats.data.pledges} pledge(s), {stats.data.promos} promo(s), {stats.data.challenges} challenge(s).
        </p>
      )}
      <h2>Merchants under bond</h2>
      {list.isPending || list.error ? (
        <Loading what="the pledges" error={list.error ?? stats.error} retry={() => { stats.refetch(); list.refetch(); }} />
      ) : list.data.length === 0 ? (
        <p className="muted">No pledge yet.</p>
      ) : (
        list.data.map(({ pledge, promos }) => (
          <section className="card" key={pledge.id} aria-label={`Pledge ${pledge.id}`}>
            <h3>
              {pledge.name} <span className="muted">· {pledge.domain}</span>
            </h3>
            <p className="muted">
              Bond {formatGen(pledge.bond)} available, {formatGen(pledge.reserved)} reserved · payout {formatGen(pledge.payout)} per
              upheld challenge · until {pledge.ends_at} · bond locked until {pledge.locked_until} · merchant{" "}
              <Link href={`/merchant/?addr=${pledge.merchant}`}>{shortAddress(pledge.merchant)}</Link>
              {!pledge.active && " · closed"}
            </p>
            <table>
              <thead>
                <tr><th>Product page</th><th>Was → now</th><th>Status</th><th>Promo start</th><th>Challenges until</th></tr>
              </thead>
              <tbody>
                {promos.map((p) => (
                  <tr key={p.id}>
                    <td><Link href={`/promo/?id=${p.id}`}>{p.product_url.replace(/^https:\/\//, "")}</Link></td>
                    <td><s>{p.was_price}</s> {p.promo_price} {p.currency}{p.pct ? ` (-${p.pct} %)` : ""}</td>
                    <td><Badge status={p.status} /></td>
                    <td>{p.promo_start}</td>
                    <td>{p.challenge_until}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))
      )}
    </>
  );
}

"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { SITE_URL } from "@/lib/config";
import { useStanding } from "@/lib/contracts/wasPrice";
import { badgeSnippet, formatGen } from "@/lib/format";

function MerchantPage() {
  const addr = (useSearchParams().get("addr") ?? "").trim();
  const valid = /^0x[0-9a-fA-F]{40}$/.test(addr);
  const standing = useStanding(valid ? addr : null);
  if (!valid) return <p className="notice bad">Missing or invalid merchant address.</p>;
  if (!standing.data) return <Loading what="the standing" error={standing.error} retry={() => standing.refetch()} />;
  const s = standing.data;
  const snippet = badgeSnippet(SITE_URL, s.merchant);
  return (
    <>
      <h1>Merchant standing</h1>
      <p className="mono">{s.merchant}</p>
      <div className="grid">
        <div className="card"><strong>{formatGen(s.bonded_now)}</strong><br />bonded now</div>
        <div className="card"><strong>{s.pledges}</strong> pledge(s), <strong>{s.promos}</strong> promo(s)</div>
        <div className="card"><strong>{s.debunked}</strong> debunked promo(s)</div>
        <div className="card"><strong>{s.rejected}</strong> rejected, <strong>{s.evidence_not_found}</strong> without evidence</div>
      </div>
      <p className="muted">
        Counts of judged challenges on this merchant&rsquo;s promos. A merchant whose pages are not archived cannot be checked:
        the absence of debunked promos is not, by itself, a proof.
      </p>
      <h2>Badge</h2>
      <p>Paste this link on the shop to point to this page:</p>
      <pre>{snippet}</pre>
      <button type="button" className="secondary" onClick={() => navigator.clipboard?.writeText(snippet)}>Copy</button>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <MerchantPage />
    </Suspense>
  );
}

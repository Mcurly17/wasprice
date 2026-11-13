"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Badge, Loading } from "@/components/ui";
import { buttonState, captureTs, samePage } from "@/lib/actions";
import { readWasPrice, usePledge, usePreview, usePromo, useWrite } from "@/lib/contracts/wasPrice";
import { formatGen, formatTs14, parseGenInput } from "@/lib/format";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { checkSnapshot, isoToUnix, parseWaybackUrl, waybackCalendar, windowOf } from "@/lib/window";

function ChallengeForm() {
  const params = useSearchParams();
  const [promoInput, setPromoInput] = useState(params.get("promo") ?? "");
  const [capture, setCapture] = useState("");
  const [mode, setMode] = useState<"TEXT" | "IMAGE">("TEXT");
  const [imageUrl, setImageUrl] = useState("");
  const [stakeInput, setStakeInput] = useState("");
  const { address } = useWallet();

  const promoId = /^\d+$/.test(promoInput) ? Number(promoInput) : null;
  const promo = usePromo(promoId);
  const pledge = usePledge(promo.data ? promo.data.pledge_id : null);
  const write = useWrite();

  const ts = captureTs(capture, parseWaybackUrl);
  const link = parseWaybackUrl(capture);
  const start = promo.data ? isoToUnix(promo.data.promo_start) : null;
  const stakeWei = stakeInput === "" ? (pledge.data ? BigInt(pledge.data.min_stake) : null) : parseGenInput(stakeInput);

  let localError = "";
  if (!promo.data) localError = "Choose a promo.";
  else if (promo.data.status !== "LIVE") localError = "This promo is already debunked.";
  else if (ts === "") localError = "Paste a Wayback link or a 14-digit timestamp.";
  else if (start !== null) localError = checkSnapshot(ts, start, Math.floor(Date.now() / 1000));
  if (localError === "" && link && promo.data && !samePage(link.url, promo.data.product_url)) {
    localError = "This Wayback link is for another page than the declared product page.";
  }
  if (localError === "" && mode === "IMAGE" && !/^https:\/\/\S+$/.test(imageUrl.trim())) localError = "Enter the https URL of the image shown on the page.";
  if (localError === "" && stakeWei === null) localError = "Stake must be a GEN amount such as 0.01.";

  const previewArgs =
    localError === "" && address && promoId !== null && stakeWei !== null
      ? mode === "TEXT"
        ? [promoId, ts, address, stakeWei.toString()]
        : [promoId, ts, imageUrl.trim(), address, stakeWei.toString()]
      : null;
  const preview = usePreview(mode === "TEXT" ? "preview_challenge" : "preview_challenge_image", previewArgs);
  const button = buttonState({
    connected: address !== null,
    busy: write.isPending,
    localError,
    preview: preview.data,
    previewFailed: preview.isError,
  });

  function submit() {
    if (!button.enabled || promoId === null || stakeWei === null) return;
    const args = mode === "TEXT" ? [promoId, ts] : [promoId, ts, imageUrl.trim()];
    write.mutate({
      functionName: mode === "TEXT" ? "challenge" : "challenge_image",
      args,
      valueWei: stakeWei.toString(),
      // Asked again with the signing account right before the wallet prompt.
      check: (account) => readWasPrice<string>(mode === "TEXT" ? "preview_challenge" : "preview_challenge_image", [...args, account, stakeWei.toString()]),
    });
  }

  const w = start !== null ? windowOf(start) : null;
  return (
    <>
      <h1>Challenge a struck price</h1>
      <p>
        Find a capture of the product page in the Wayback Machine, taken in the 30 days before the promotion, that shows
        a lower selling price than the struck price. Filing makes no web or AI call: the capture is read when someone
        calls resolve.
      </p>
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
        <label htmlFor="promo">Promo id</label>
        <input id="promo" inputMode="numeric" value={promoInput} onChange={(e) => setPromoInput(e.target.value.trim())} />
        {promo.data ? (
          <p className="hint">
            <Badge status={promo.data.status} /> {promo.data.product_url} · was {promo.data.was_price} {promo.data.currency} · window{" "}
            {w && `${formatTs14(w.fromTs)} → ${formatTs14(w.toTs)} (excluded)`} ·{" "}
            {start !== null && <a href={waybackCalendar(start, promo.data.product_url)}>Wayback calendar</a>} ·{" "}
            <Link href={`/promo/?id=${promo.data.id}`}>promo page</Link>
          </p>
        ) : promoId !== null ? (
          <Loading what={`promo ${promoId}`} error={promo.error} />
        ) : null}

        <label htmlFor="capture">Wayback link or capture timestamp</label>
        <input id="capture" placeholder="https://web.archive.org/web/20261105100000/https://…" value={capture} onChange={(e) => setCapture(e.target.value)} aria-describedby="capture-hint" />
        <p className="hint" id="capture-hint">{ts !== "" && /^\d{14}$/.test(ts) ? `Capture ${formatTs14(ts)}` : "The timestamp is read from the link."}</p>

        <fieldset>
          <legend>Where is the price?</legend>
          <label><input type="radio" name="mode" checked={mode === "TEXT"} onChange={() => setMode("TEXT")} /> In the page text</label>
          <label><input type="radio" name="mode" checked={mode === "IMAGE"} onChange={() => setMode("IMAGE")} /> In an image of the page</label>
        </fieldset>
        {mode === "IMAGE" && (
          <>
            <label htmlFor="image">Image URL (as referenced by the page)</label>
            <input id="image" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…/price.png" />
          </>
        )}

        <label htmlFor="stake">Stake (GEN)</label>
        <input id="stake" inputMode="decimal" value={stakeInput} placeholder={pledge.data ? formatGen(pledge.data.min_stake).replace(" GEN", "") : "0.01"} onChange={(e) => setStakeInput(e.target.value)} />
        <p className="hint">
          Lost to the bond if the challenge is rejected or no evidence is found; returned with the payout
          {pledge.data && ` (${formatGen(pledge.data.payout)})`} if upheld.
        </p>

        <p role="status" className={button.enabled ? "notice good" : "hint"}>
          {button.enabled ? "The contract would accept this challenge now." : button.reason}
        </p>
        <button type="submit" disabled={!button.enabled}>File challenge</button>
      </form>
      {write.progress && write.isPending && <p role="status">Transaction: {write.progress.phase}{write.progress.hash ? ` (${write.progress.hash})` : ""}…</p>}
      {write.error && <p className="notice bad" role="alert">{write.error.message}</p>}
      {write.data && (
        <p className="notice good" role="status">
          Challenge filed (tx {write.data.hash}). Next: call resolve on the <Link href={`/promo/?id=${promoId}`}>promo page</Link>.
        </p>
      )}
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <ChallengeForm />
    </Suspense>
  );
}

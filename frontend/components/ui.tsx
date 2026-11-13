"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CONFIG_ISSUE, EXPLORER_URL, REPO_URL } from "@/lib/config";
import { formatTs14, shortAddress } from "@/lib/format";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { statusLabel, statusTone } from "@/lib/status";
import { windowOf, isoToUnix } from "@/lib/window";

export function Shell({ children }: { children: ReactNode }) {
  const { address, hasWallet, error, connect } = useWallet();
  return (
    <>
      <header className="top">
        <nav aria-label="Main">
          <Link href="/" className="brand">WasPrice</Link>
          <Link href="/challenge/">Challenge</Link>
          <Link href="/rules/">Rules</Link>
        </nav>
        <div className="wallet">
          {address ? (
            <Link href={`/merchant/?addr=${address}`} title={address}>{shortAddress(address)}</Link>
          ) : (
            <button type="button" onClick={connect} disabled={!hasWallet} title={hasWallet ? "" : "No browser wallet found"}>
              Connect wallet
            </button>
          )}
        </div>
      </header>
      {CONFIG_ISSUE && <p className="notice" role="status">{CONFIG_ISSUE}</p>}
      {error && <p className="notice bad" role="alert">{error}</p>}
      <main>{children}</main>
      <footer>
        <p>
          Studionet demo. Not legal advice. <a href={REPO_URL}>Source</a> · <a href={EXPLORER_URL}>Explorer</a>
        </p>
      </footer>
    </>
  );
}

export function Badge({ status }: { status: string }) {
  return <span className={`badge ${statusTone(status)}`}>{statusLabel(status)}</span>;
}

export function Loading({ what, error, retry }: { what: string; error?: unknown; retry?: () => void }) {
  if (error) {
    return (
      <p className="notice bad" role="alert">
        Could not read {what}: {error instanceof Error ? error.message : String(error)}{" "}
        {retry && <button type="button" onClick={retry}>Retry</button>}
      </p>
    );
  }
  return <p className="muted" role="status">Reading {what}…</p>;
}

/** The 30-day window [promo_start - 30 days, promo_start) with the judged captures. */
export function WindowTimeline({ promoStart, marks }: { promoStart: string; marks: { ts: string; status: string }[] }) {
  const start = isoToUnix(promoStart);
  if (start === null) return null;
  const { fromTs, toTs } = windowOf(start);
  const from = start - 30 * 86400;
  const pos = (ts: string) => {
    const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(ts);
    if (!m) return null;
    const t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) / 1000;
    return Math.max(0, Math.min(100, ((t - from) / (start - from)) * 100));
  };
  return (
    <figure className="timeline" aria-label={`Window from ${formatTs14(fromTs)} to ${formatTs14(toTs)}, excluded`}>
      <div className="bar">
        {marks.map((m, i) => {
          const p = pos(m.ts);
          return p === null ? null : (
            <span key={i} className={`mark ${statusTone(m.status)}`} style={{ left: `${p}%` }} title={`${formatTs14(m.ts)}: ${statusLabel(m.status)}`} />
          );
        })}
      </div>
      <figcaption>
        <span>{formatTs14(fromTs)}</span>
        <span>30 days before the promo</span>
        <span>{formatTs14(toTs)} (promo start, excluded)</span>
      </figcaption>
    </figure>
  );
}

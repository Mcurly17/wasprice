import type { Metadata } from "next";
import { ARTICLE_6A, LINKS, RULE_TEXT } from "@/lib/rules";

export const metadata: Metadata = { title: "Rules" };

export default function Rules() {
  return (
    <>
      <h1>The rule and how it is judged</h1>
      <h2>Article 6a of Directive 98/6/EC</h2>
      <p>Inserted by Directive (EU) 2019/2161 (the &ldquo;Omnibus&rdquo; directive):</p>
      <blockquote>{ARTICLE_6A.map((line) => <p key={line}>{line}</p>)}</blockquote>
      <p>
        In <a href={LINKS.aldi}>C-330/23 Aldi Süd</a> (26 September 2024), the Court of Justice held that a percentage
        reduction or a claim such as &ldquo;price highlight&rdquo; must be based on that prior price. A lower price applied
        for a few days inside the 30 days sets the reference.
      </p>
      <h2>The rule applied by the contract</h2>
      <blockquote className="mono">{RULE_TEXT}</blockquote>
      <ul>
        <li>One capture is enough: the lowest price of the window is at most the price it shows.</li>
        <li>Earlier promotions inside the window count, as in Aldi Süd.</li>
        <li>The comparison is strict and to the cent: observed &lt; struck price. No tolerance.</li>
        <li>A declared percentage must match the declared prices within one point (computed on the struck price).</li>
      </ul>
      <h2>What is judged, and how</h2>
      <ol>
        <li>Filing a challenge makes no web or AI call. The capture time must lie in [promo start − 30 days, promo start).</li>
        <li>
          On resolve, each validator fetches the archived bytes (<span className="mono">web.archive.org/web/&lt;ts&gt;id_/&lt;url&gt;</span>).
          A Wayback redirect is followed only to a capture of the same URL inside the window; otherwise the result is
          &ldquo;evidence not found&rdquo;, without any AI call.
        </li>
        <li>Hidden elements, scripts and comments are removed. Page text is neutralized and marked as data, never instructions.</li>
        <li>A language model reads the unconditional selling price of the declared product (VAT included; no shipping, instalments, member or coupon prices).</li>
        <li>Validators must agree on the capture, its SHA-256, the product match and the price to the cent. The reason text is never compared.</li>
        <li>The contract then decides with a plain comparison and settles: upheld pays stake + payout from the bond; rejected or no evidence adds the stake to the bond.</li>
      </ol>
      <h2>What is not judged</h2>
      <ul>
        <li>National exceptions (perishable goods, progressive reductions, products on sale for less than 30 days).</li>
        <li>Prices shown only by JavaScript, or that differ by country or session.</li>
        <li>Pages that the Wayback Machine did not archive.</li>
        <li>Currencies other than EUR (v1).</li>
      </ul>
      <h2>Appeals: protocol-level only</h2>
      <p>
        There is no appeal inside the contract in v1. A verdict can be contested through GenLayer&rsquo;s own appeal
        process while the transaction is not final. Persistent validator disagreement leaves the challenge open; after
        3 days, expire refunds the stake.
      </p>
      <h2>Not legal advice</h2>
      <p>
        The contract applies a simplified reading of Article 6a to archived evidence. It is not a court, does not state
        that anyone broke the law, and its verdicts are not legal advice. <a href={LINKS.directive}>Directive 98/6/EC</a> ·{" "}
        <a href={LINKS.omnibus}>Directive (EU) 2019/2161</a>.
      </p>
    </>
  );
}

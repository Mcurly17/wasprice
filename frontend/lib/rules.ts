// The rule as the contract states it (RULE_TEXT in contracts/was_price.py; a test keeps
// both equal) and the legal texts it simplifies.

export const RULE_TEXT =
  'OMNIBUS_PRIOR_PRICE. A promotion declared by the merchant shows a "was" (reference) ' +
  "price W. Under Article 6a(1)-(2) of Directive 98/6/EC as amended by Directive (EU) " +
  "2019/2161, and CJEU C-330/23 Aldi Süd, the reference price must be the lowest price the " +
  "trader applied during the 30 days before the reduction started. A challenge is UPHELD if " +
  "an archived capture of the product page, taken in [promo_start - 30 days, promo_start), " +
  "shows the same product offered for sale at an unconditional selling price strictly lower " +
  "than W.";

export const ARTICLE_6A = [
  "1. Any announcement of a price reduction shall indicate the prior price applied by the trader for a determined period of time prior to the application of the price reduction.",
  "2. The prior price means the lowest price applied by the trader during a period of time not shorter than 30 days prior to the application of the price reduction.",
];

export const LINKS = {
  directive: "https://eur-lex.europa.eu/eli/dir/1998/6/oj",
  omnibus: "https://eur-lex.europa.eu/eli/dir/2019/2161/oj",
  aldi: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A62023CJ0330",
  wayback: "https://web.archive.org/save",
};

# WasPrice web app

Next.js static export served by GitHub Pages under `/wasprice`. Reads need no wallet; writes go
through the injected browser wallet, after the contract's preview said the call would pass.

## Screens

- `/` merchants under bond, their promos with a LIVE or DEBUNKED badge, your credit and Withdraw.
- `/promo/?id=` declared prices and %, the 30-day window with the judged captures, a link to
  the Wayback calendar of the window, every challenge (capture read, observed price against the
  struck price, verdict, reason, SHA-256 with the PowerShell verify commands), Resolve and
  Expire buttons, and Challenge.
- `/challenge/` paste a Wayback link (the timestamp is read from it) or a timestamp, live window
  check, text or image mode, stake, preview. The button stays disabled until the contract's
  preview returns "".
- `/merchant/?addr=` standing and the HTML snippet of the "Bonded honest discounts – WasPrice" badge.
- `/rules/` Article 6a, *Aldi Süd*, the rule applied, what is and is not judged, appeals.

No external font, no tracker, no analytics.

## Commands

From the repository root (npm workspaces):

```powershell
npm ci
npm run lint            # tsc --noEmit
npm run test:frontend   # node:test on lib/
$env:NEXT_PUBLIC_CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000001"; npm run build
```

Build-time variables (public, see `.env.example`): `NEXT_PUBLIC_CONTRACT_ADDRESS`,
`NEXT_PUBLIC_GENLAYER_RPC_URL` (default `https://studio.genlayer.com/api`),
`NEXT_PUBLIC_GENLAYER_CHAIN_ID` (default 61999).

`lib/price.ts`, `lib/window.ts` and `lib/contracts/receipt.ts` are byte copies of the files in
`scripts/`; a test fails if they drift.

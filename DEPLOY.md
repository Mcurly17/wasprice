# Deployment and demo

Everything below runs in PowerShell from the repository root. The keystore password is always
typed in the terminal: no key or password is ever passed on the command line or stored in a
file.

## 1. Tools

```powershell
py -3.12 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt -r requirements-dev.txt
npm ci
```

## 2. Accounts (once, by the owner of the keys)

Import each Studionet test account yourself; the CLI asks for the key and a keystore password
with hidden input:

```powershell
npx genlayer account import --name timbre-a
npx genlayer account import --name timbre-b
npx genlayer network set studionet
npx genlayer account use timbre-a
```

Never pass a key or a keystore password as a CLI option. Fund the accounts at the Studionet faucet (about
0.6 GEN for the merchant, 0.1 GEN for the challenger, plus gas).

## 3. Calling the contract

```powershell
node --env-file-if-exists=.env scripts/wasprice.ts help
```

- Writes sign with the active CLI account (`npx genlayer account use <name>`); the script prints
  `From <name> 0x...` and asks for the keystore password.
- Payable amounts come only from `--value <GEN>`. Call `node` directly: `npm run` drops `--value`.
- Every write is checked first (its `preview_*` view, or a read of the state) and is not sent if
  the contract would refuse it: on Studionet a refused payable call keeps its value.
- `.env` (gitignored) holds `GENLAYER_NETWORK=studionet` and `WASPRICE_CONTRACT=0x...`; see
  `.env.example`. It holds no key.

PowerShell pitfalls: write prices `39.90` (an unquoted `39,90` is an array); no empty `""`
argument; no JSON on the command line (a variant goes through `--variant-file <file>`); never
`npx genlayer call --args` for `str` parameters.

## 4. GitHub Pages

Settings > Pages > Source = **GitHub Actions**. Settings > Secrets and variables > Actions >
Variables: `NEXT_PUBLIC_CONTRACT_ADDRESS` (after the deployment), optionally
`NEXT_PUBLIC_GENLAYER_RPC_URL` and `NEXT_PUBLIC_GENLAYER_CHAIN_ID`. The Pages workflow checks
`docs/demo/SHA256SUMS`, builds the web app and serves the demo shop under `/wasprice/demo/`.

## 5. Demo order (it creates the price history)

The demo shop pages are evidence for the Wayback Machine. Their order matters:

1. **v1 pages** (A, B, D before the promotion, C present, E with its price in an image) are
   committed and pushed; Pages serves them. Check that every URL answers 200 and that the served
   bytes match `docs/demo/SHA256SUMS`.
2. **Save Page Now** (<https://web.archive.org/save>) of `bouilloire.html`, `theiere.html`,
   `grille-pain.html`, `radio.html` and `img/radio-prix.png`. **Not** `mug.html`. Note the 5
   timestamps (T1). Check each one:
   `node --env-file-if-exists=.env scripts/wasprice.ts snapshot <url> <T1>` (200, SHA-256 equal
   to the file in the repository).
3. **v2 pages**: copy `tests/fixtures/v2/*.html` to `docs/demo/`, update `docs/demo/SHA256SUMS`,
   commit, push. Pages now shows the promotions (struck price, then promo price).
4. **Deploy** with timbre-a: `node --env-file-if-exists=.env scripts/wasprice.ts deploy`
   (minimum challenge period 7 days; add `--min-challenge-minutes 10` for a live demo of the
   period), then put `WASPRICE_CONTRACT=0x...` in `.env` and in the Pages variable.
5. **Pledge and declare** with timbre-a (`promo_start = now`, a 7-day challenge period each):

   ```powershell
   node --env-file-if-exists=.env scripts/wasprice.ts pledge DemoMaison mcurly17.github.io 0.1 30 --value 0.5
   node --env-file-if-exists=.env scripts/wasprice.ts declare 0 https://mcurly17.github.io/wasprice/demo/bouilloire.html 39.90 34.90 now --pct 13 --challenge-minutes 10080
   node --env-file-if-exists=.env scripts/wasprice.ts declare 0 https://mcurly17.github.io/wasprice/demo/theiere.html 39.90 31.90 now --pct 20 --challenge-minutes 10080
   node --env-file-if-exists=.env scripts/wasprice.ts declare 0 https://mcurly17.github.io/wasprice/demo/mug.html 12.90 9.90 now --pct 23 --challenge-minutes 10080
   node --env-file-if-exists=.env scripts/wasprice.ts declare 0 https://mcurly17.github.io/wasprice/demo/grille-pain.html 39.90 29.90 now --pct 25 --challenge-minutes 10080
   node --env-file-if-exists=.env scripts/wasprice.ts declare 0 https://mcurly17.github.io/wasprice/demo/radio.html 34.90 29.90 now --pct 14 --challenge-minutes 10080
   ```

6. **Save Page Now of `mug.html`**, after the declarations. Check that
   `snapshot https://mcurly17.github.io/wasprice/demo/mug.html <promo_start - 60 s> --promo 2`
   answers a 302 to a capture at or after promo_start (outside the window).
7. **Challenges** with timbre-b (`npx genlayer account use timbre-b`), each preceded by its preview:
   `challenge 0 <T1_A> --value 0.01` (expected UPHELD), `challenge 1 <T1_B> --value 0.01`
   (REJECTED), `challenge 2 <promo_start - 60 s> --value 0.01` (EVIDENCE_NOT_FOUND, no LLM call),
   `challenge 3 <T1_D> --value 0.01` (UPHELD despite the traps),
   `challenge-image 4 <T1_E> https://mcurly17.github.io/wasprice/demo/img/radio-prix.png --value 0.01`
   (UPHELD, read in the image). Then `resolve <id>` for each (any account). On a timeout use
   `wait <hash>`; on `[TRANSIENT]` resolve again later.
8. **Reads**: `challenge-info <id>`, `promo <id>`, `standing 0xf5Fe96d62733d40f25822b20C5E46A0E17483dFF`,
   `credit 0x74115084812fc662AaAE47B5Fd4Ef60cd5E7BC56`; then `withdraw` with timbre-b.
   `close` is possible once every challenge period of the pledge has ended (`locked_until` in
   `pledge-info`) and no challenge is open; `window <promo_id>` shows a promo's period.
   To record an expected refusal on-chain (no value attached), add `--expect-refusal` to
   `close`, `challenge` or `challenge-image`; the script sends only if its check refuses.

A verdict that differs from the expected one is recorded as it is in `docs/evidence.md`.

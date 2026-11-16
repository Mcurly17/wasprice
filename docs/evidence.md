# Studionet demo evidence (2026-11-13)

All amounts are Studionet test GEN. Every transaction was preceded by its preview (or a read
of the state) in `scripts/wasprice.ts`, and every receipt below is ACCEPTED, MAJORITY_AGREE,
SUCCESS. Verdicts are recorded as obtained, including the one that differs from the plan.

## Contract

- Address: `0x84be5FAC57FC0361fD9CE7e67E6661eDed7f3d40`
- Explorer: <https://explorer-studio.genlayer.com/address/0x84be5FAC57FC0361fD9CE7e67E6661eDed7f3d40>
- Studio: <https://studio.genlayer.com/?import-contract=0x84be5FAC57FC0361fD9CE7e67E6661eDed7f3d40>
- Source: `contracts/was_price.py` at tag `v1.0.0` (39,713 bytes), pinned runner
  `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`
- Merchant: timbre-a `0xf5Fe96d62733d40f25822b20C5E46A0E17483dFF`;
  challenger: timbre-b `0x74115084812fc662AaAE47B5Fd4Ef60cd5E7BC56`

## CI and Pages

- CI on `6185eaf` (v1.0.0): <https://github.com/Mcurly17/wasprice/actions/runs/43443990203> (green)
- CI on `5ca85d7` (demo v2): <https://github.com/Mcurly17/wasprice/actions/runs/43445694948> (green)
- Pages v1: <https://github.com/Mcurly17/wasprice/actions/runs/43444285515>;
  Pages v2: <https://github.com/Mcurly17/wasprice/actions/runs/43445694990>;
  Pages with the contract address: <https://github.com/Mcurly17/wasprice/actions/runs/43446657454>
  (the first Pages run, 43443990254, failed before Pages was enabled in the settings)

## Demo pages and Wayback captures

Served bytes were checked against `docs/demo/SHA256SUMS` after each Pages deployment.

| Page | v1 SHA-256 (captured before the promos) | v2 SHA-256 (promo shown) | Wayback capture |
|---|---|---|---|
| bouilloire.html (A) | `dfdbee0bc42bd4d43fd8951677c50b918373fc3068af2605724bd0c2434a7663` | `63067bf081daf676016a5209aab89615725afe8395d2de2cc50d865ada383676` | [20261113144011](https://web.archive.org/web/20261113144011/https://mcurly17.github.io/wasprice/demo/bouilloire.html) (v1) |
| theiere.html (B) | `cb3b00cb2d42b250cf652bb6125cf59157ca3bb42ebd91c885e726b2828fd9ad` | `5d5ddcb1032900397c1abaa14393cdc46e90faf76e506fcff7ef8e778b7e6321` | [20261113144032](https://web.archive.org/web/20261113144032/https://mcurly17.github.io/wasprice/demo/theiere.html) (v1) |
| mug.html (C) | `325b695388bd011ab1ae56c316fa4244834ecaf17804af4a6a33d4e998573896` (never captured) | `ba5f74e003a0bb39ca562a2f94b06d120bc8bd94a1f21be4e6f063dd49c83184` | [20261113172614](https://web.archive.org/web/20261113172614/https://mcurly17.github.io/wasprice/demo/mug.html) (v2, first and only capture, after promo_start) |
| grille-pain.html (D) | `9d13e6839d81b40f09bd87ed69e62e3d26692911c408c17e9d880d3d9c05a2e3` | `34f173097481592d820bc606fe5e2f3ba7f3e9182537472442f15b99b506d7d5` | [20261113144107](https://web.archive.org/web/20261113144107/https://mcurly17.github.io/wasprice/demo/grille-pain.html) (v1, with the traps) |
| radio.html (E) | `c6aa62e63cebead9efebcf8216a74f714473c96b4a4bd709794e3078a295b1df` | `54990e1476746ba3be2d2d9a19cba006a6037fcd4da36620173c88880cc4ab67` | [20261113144128](https://web.archive.org/web/20261113144128/https://mcurly17.github.io/wasprice/demo/radio.html) (v1) |
| img/radio-prix.png (E) | `3a57b093313c5b4e8f9b9fa133327cd949a34b2c7145e5c2ecf45ff4dc8d30bc` | unchanged | [20261113144128](https://web.archive.org/web/20261113144128/https://mcurly17.github.io/wasprice/demo/img/radio-prix.png) |

Each v1 capture was read in `id_` mode before the challenges: 200, same SHA-256 as the file
in the repository. A request for `mug.html` at `20261113145825id_` (promo_start - 60 s)
answers `302` to `20261113172614id_`, outside the window `[20261014145925, 20261113145925)`.

## Transactions

| Step | Transaction | What it shows |
|---|---|---|
| Deploy | [0xe594928c…7ecf](https://explorer-studio.genlayer.com/tx/0xe594928cb6dfd7efae678613504ffddd9ca22cfadeb108c9db1e4147dded7ecf) | WasPrice deployed by timbre-a |
| Pledge 0 | [0xe3b53c43…1d3b](https://explorer-studio.genlayer.com/tx/0xe3b53c43f4e88c4eb69ab7ec94635f0ebdef520042fe3293ba49c9d18c851d3b) | "DemoMaison", domain mcurly17.github.io, bond 0.5 GEN, payout 0.1, 30 days |
| Promo 0 (A) | [0x09e11db7…c0df](https://explorer-studio.genlayer.com/tx/0x09e11db722f9de5be523156f5cdc12b8511f9b2c8fae1078f52cf0bca70fc0df) | bouilloire 39.90 → 34.90, 13 %, start 2026-11-13T14:52:03Z |
| Promo 1 (B) | [0xbe32aaa1…108f](https://explorer-studio.genlayer.com/tx/0xbe32aaa1ebc4fa8181752c0bf1da56ac71bd79577316b20acda9c4640bdb108f) | theiere 39.90 → 31.90, 20 %, start 2026-11-13T14:57:07Z |
| Promo 2 (C) | [0x02245548…2a37](https://explorer-studio.genlayer.com/tx/0x0224554884f12594bda11638b3478d0c96479c94fa8dcadd744b2792b3582a37) | mug 12.90 → 9.90, 23 %, start 2026-11-13T14:59:25Z |
| Promo 3 (D) | [0xa10f1586…a6fa](https://explorer-studio.genlayer.com/tx/0xa10f1586bbb179ddc485db45a24a3281d8006764e2181d2babed10669fcaa6fa) | grille-pain 39.90 → 29.90, 25 %, start 2026-11-13T15:03:19Z |
| Promo 4 (E) | [0xdda9481d…843e](https://explorer-studio.genlayer.com/tx/0xdda9481df32a33374a004f1aa15d96c81be5fe79c7567934386d47226dad843e) | radio 34.90 → 29.90, 14 %, start 2026-11-13T15:12:17Z |
| Challenge 0 (A) | [0x7796dbe1…9642](https://explorer-studio.genlayer.com/tx/0x7796dbe10b4764b23193a4d4a2e1a06ce38b86f3be39d8c2d282ae1d95399642) | capture 20261113144011, stake 0.01 |
| Challenge 1 (B) | [0xa291caa2…66d9](https://explorer-studio.genlayer.com/tx/0xa291caa2da48be9ff59f2a738464a72edaa0e5f36c66be5417fd16ff591566d9) | capture 20261113144032, stake 0.01 |
| Challenge 2 (D) | [0xbfc3ecd1…36f5](https://explorer-studio.genlayer.com/tx/0xbfc3ecd131a948d3645c51d18d606d156d2529cd841a5c82cda4b02561e936f5) | capture 20261113144107, stake 0.01 |
| Challenge 3 (E) | [0x314d1d2f…c279](https://explorer-studio.genlayer.com/tx/0x314d1d2f89c53d3ab92b0b075ce8b810cbc1969e3863ba7ba5c5a02e9b6ac279) | image challenge, capture 20261113144128, stake 0.01 |
| Challenge 4 (C) | [0xe608af4c…248a](https://explorer-studio.genlayer.com/tx/0xe608af4ce7e708e27b22bbe7ca1e17f694a072799ed35e9150f45a2232f0248a) | snapshot_ts 20261113145825 (promo_start - 60 s), stake 0.01 |
| Resolve 0 (A) | [0x3e078bac…aff5](https://explorer-studio.genlayer.com/tx/0x3e078bac884903371f64c18c94ccad6db991f8a740b1e94d386517af93a2aff5) | UPHELD |
| Resolve 1 (B) | [0x496bbd1a…69f9](https://explorer-studio.genlayer.com/tx/0x496bbd1a3f88dfc7a6fbb3fb72e5ba57330f4dfe0ebef540ea04db9195a269f9) | REJECTED |
| Resolve 2 (D) | [0x705d839e…a767](https://explorer-studio.genlayer.com/tx/0x705d839efd0e8e3b757eeebd10cb874dd54927ff6e7e9aa5ca46fb795e22a767) | UPHELD, traps ignored |
| Resolve 3 (E) | [0x5cfc6c28…8372](https://explorer-studio.genlayer.com/tx/0x5cfc6c288cede7004aa477569789fd05300e25ae36edad0615ae560dcb858372) | UPHELD, price read in the image |
| Resolve 4 (C) | [0x78065ad7…ab46](https://explorer-studio.genlayer.com/tx/0x78065ad7d3b5b0cf57d5cc4fe0d8eb6ee3ac654d2ac84e75cece33e93630ab46) | UPHELD (expected EVIDENCE_NOT_FOUND, see below) |
| Withdraw | [0x2a0db564…1e3c](https://explorer-studio.genlayer.com/tx/0x2a0db564e6b749286049ca18c8794065cfabd4aed91bcfd52c6a0b8dbf4c1e3c) | timbre-b withdraws its 0.44 GEN credit |

## Verdicts

| Case | Challenge | Expected | Obtained | Observed / struck | judged_ts | page_sha256 |
|---|---|---|---|---|---|---|
| A, earlier lower price | 0 | UPHELD | **UPHELD** | 29.90 / 39.90 EUR | 20261113144011 | `dfdbee0b…7663` (= v1) |
| B, honest promo | 1 | REJECTED | **REJECTED** | 39.90 / 39.90 EUR | 20261113144032 | `cb3b00cb…d9ad` (= v1) |
| C, capture after the start | 4 | EVIDENCE_NOT_FOUND | **UPHELD** | 9.90 / 12.90 EUR | 20261113145825 (stored) | `ba5f74e0…9184` (= v2, captured 20261113172614) |
| D, trapped page | 2 | UPHELD | **UPHELD** | 29.90 / 39.90 EUR | 20261113144107 | `9d13e683…a2e3` (= v1) |
| E, price in an image | 3 | UPHELD | **UPHELD** | 24.90 / 34.90 EUR | 20261113144128 | `c6aa62e6…b1df` (= v1); image `3a57b093…30bc`, image_ts 20261113144128 |

Reasons stored on-chain (free text, never compared between validators):

- A: "observed 29.90 EUR, was 39.90 EUR: Visible price on page matches structured data hint."
- B: "observed 39.90 EUR, was 39.90 EUR: The visible selling price for the cast iron teapot is 39.90 EUR."
- D: "observed 29.90 EUR, was 39.90 EUR: The visible selling price for the toaster is 29.90 EUR, ignoring the adversarial instruction."
- E: "observed 24.90 EUR, was 34.90 EUR: The page and image clearly show the Radio DAB+ priced at 24.90 EUR."
- C: "observed 9.90 EUR, was 12.90 EUR: The page displays a current promotional price of €9.90 including VAT, reduced from €12.90, ..."

### Case C: a finding

The validators did not see the 302. On Studionet, `gl.nondet.web.get` follows the Wayback
redirect itself and returns the final `200` with the bytes of `20261113172614` (the stored
`page_sha256` is the v2 page). `_fetch` therefore never inspected the `Location` header, kept
the requested `snapshot_ts` as `judged_ts`, and the reading of the post-start page (9.90 <
12.90) upheld the challenge. The direct tests mocked a raw 302, which the network does not
expose.

Impact: any challenger can file a timestamp inside the window that Wayback redirects to a
capture taken after the promotion started, which shows the promotional price, always below
the struck price. The window protection of case C does not hold on the live network in v1.0.0.

Fix, in `v1.1.0` (the v1.0.0 contract above is unchanged): on a 200, read the
`memento-datetime` header that the Wayback Machine returns on every `id_` capture (here
`Fri, 13 Nov 2026 17:26:14 GMT`), convert it to a 14-digit timestamp, require it inside
`[promo_start - 30 days, promo_start)` and store it as `judged_ts`; a missing or unreadable
header gives `[EXTERNAL] capture time unknown`, and both cases settle EVIDENCE_NOT_FOUND
without an LLM call. The same check applies to the image capture. Covered by the direct tests
with a followed redirect, and replayed on Studionet below.

## Final state

- Pledge 0: bond 0.11 GEN available, 0 reserved (0.5 - 4 × 0.1 payouts + 0.01 lost stake of B).
- `standing(timbre-a)`: 1 pledge, 5 promos, 4 debunked, 1 rejected, 0 evidence_not_found,
  bonded_now 0.11 GEN.
- Promos: 0, 2, 3, 4 DEBUNKED; 1 LIVE.
- timbre-b credit before withdrawal: 0.44 GEN (4 × (0.01 + 0.1)); withdrawn in full (0.44 GEN), credit now 0, `total_credits` 0.
- Solvency: 0.5 bond + 0.05 stakes = 0.11 bond + 0.44 credits.

## v1.1.0 replay (cases A and C)

- Address: `0x8FE01BfEeA15590B563b14A6357d0753ADAA9DD8`
- Explorer: <https://explorer-studio.genlayer.com/address/0x8FE01BfEeA15590B563b14A6357d0753ADAA9DD8>
- Studio: <https://studio.genlayer.com/?import-contract=0x8FE01BfEeA15590B563b14A6357d0753ADAA9DD8>
- Source: `contracts/was_price.py` at tag `v1.1.0` (39,907 bytes), same pinned runner
- CI on `0064a54` (v1.1.0): <https://github.com/Mcurly17/wasprice/actions/runs/43490590595> (green);
  Pages: <https://github.com/Mcurly17/wasprice/actions/runs/43490590526>; Pages with the
  v1.1.0 contract address (the web app now reads this contract):
  <https://github.com/Mcurly17/wasprice/actions/runs/43580886847>

Same accounts, same demo pages and captures. The promos keep their original `promo_start`, so
the only capture of `mug.html` (20261113172614) still falls after the start of promo C. Before
the challenges, `snapshot` read `mug.html` at `20261113145825id_`: `302` to `20261113172614id_`,
whose `memento-datetime` is `Fri, 13 Nov 2026 17:26:14 GMT`; `bouilloire.html` at
`20261113144011id_`: 200, SHA-256 `dfdbee0b…7663` (v1).

| Step | Transaction | What it shows |
|---|---|---|
| Deploy | [0x8dd1a51a…4fcc](https://explorer-studio.genlayer.com/tx/0x8dd1a51aa02a0916a11f25d03b5d70597d4cd35bae95799fabc06abd04274fcc) | WasPrice v1.1.0 deployed by timbre-a |
| Pledge 0 | [0x2e0e01db…e40d](https://explorer-studio.genlayer.com/tx/0x2e0e01dbd701644ee715d435aa34920d6f0b506b41473c7743b74a46bcd1e40d) | "DemoMaison", domain mcurly17.github.io, bond 0.2 GEN, payout 0.1, 30 days |
| Promo 0 (A) | [0x13a43509…7549](https://explorer-studio.genlayer.com/tx/0x13a435096c5f085c1a6e1236a94fdaa2527d970c2f4076f6b8cad5d21fea7549) | bouilloire 39.90 → 34.90, 13 %, start 2026-11-13T14:52:03Z |
| Promo 1 (C) | [0xf0d36824…1851](https://explorer-studio.genlayer.com/tx/0xf0d36824b0d93aa3fec3732b85eb1fcf0e71f9f993a2afc5b8d6f97e74bf1851) | mug 12.90 → 9.90, 23 %, start 2026-11-13T14:59:25Z |
| Challenge 0 (A) | [0x2120a178…f22d](https://explorer-studio.genlayer.com/tx/0x2120a17884486e2d376156b8dc7c52aae9c625ff041b9fb8d42b8d8cfebef22d) | capture 20261113144011, stake 0.01 |
| Challenge 1 (C) | [0x211490ee…6754](https://explorer-studio.genlayer.com/tx/0x211490eee9790d4a72ef0bc4ca59ad38bcaac281c33bf0039b03fed087c86754) | snapshot_ts 20261113145825 (promo_start - 60 s), stake 0.01 |
| Resolve 0 (A) | [0xb0008a65…20ad](https://explorer-studio.genlayer.com/tx/0xb0008a6571fdc1477c2a42ecd7e24843bc13f932ad8b3f3342fd1ff9dea920ad) | UPHELD |
| Resolve 1 (C) | [0x68631cca…d7c0](https://explorer-studio.genlayer.com/tx/0x68631cca87e7106c4018034172e14918ce1846cc9847b6ee63c176265f71d7c0) | EVIDENCE_NOT_FOUND |
| Withdraw | [0xf5821478…fa93](https://explorer-studio.genlayer.com/tx/0xf582147833aa9f87c2f42d4d9a820d4836c4d18448f09d49998721dff9bbfa93) | timbre-b withdraws its 0.11 GEN credit |

Every receipt is ACCEPTED, MAJORITY_AGREE, SUCCESS.

| Case | Challenge | Expected | Obtained | Observed / struck | judged_ts | page_sha256 | Reason |
|---|---|---|---|---|---|---|---|
| A, earlier lower price | 0 | UPHELD | **UPHELD** | 29.90 / 39.90 EUR | 20261113144011 (memento) | `dfdbee0b…7663` (= v1) | "observed 29.90 EUR, was 39.90 EUR: The declared kettle displays an unconditional price of €29.90 including VAT, ..." |
| C, capture after the start | 1 | EVIDENCE_NOT_FOUND | **EVIDENCE_NOT_FOUND** | none | none | none | `[EXTERNAL] capture not in window` |

Case C now holds: the node still followed the redirect, but the contract read the capture
time of the page it received (17:26:14, after the promo start of 14:59:25), rejected it before
any LLM call, and stored no reading. The challenger's stake went to the bond and promo C
stays LIVE.

Final state of the v1.1.0 contract:

- Pledge 0: bond 0.11 GEN available, 0 reserved (0.2 - 0.1 payout of A + 0.01 lost stake of C).
- `standing(timbre-a)`: 1 pledge, 2 promos, 1 debunked, 0 rejected, 1 evidence_not_found,
  bonded_now 0.11 GEN.
- timbre-b credit 0.11 GEN (0.01 + 0.1), withdrawn in full; `total_credits` 0.
- Solvency: 0.2 bond + 0.02 stakes = 0.11 bond + 0.11 withdrawn.

## v1.2.0: challenge periods and bond lock (2026-11-16)

- Address: `0xb0530d4E845D79354Df3c0200272EFed6b2A1A25`
- Explorer: <https://explorer-studio.genlayer.com/address/0xb0530d4E845D79354Df3c0200272EFed6b2A1A25>
- Studio: <https://studio.genlayer.com/?import-contract=0xb0530d4E845D79354Df3c0200272EFed6b2A1A25>
- Source: `contracts/was_price.py` at tag `v1.2.0` (39,904 bytes), same pinned runner, deployed
  with `min_challenge_minutes = 10` (the floor, used so the whole period can be shown live; the
  script's default is 7 days). `get_stats`: `min_challenge_minutes` 10, `max_challenge_minutes` 129600.
- CI on `669b84d` (v1.2.0): <https://github.com/Mcurly17/wasprice/actions/runs/43891985267> (green);
  Pages: <https://github.com/Mcurly17/wasprice/actions/runs/43891985298>

Plan: one pledge, promo A (case A, 15-minute period) and promo B (honest teapot promo,
10-minute period); a bond recovery attempt during the periods; case A challenged and resolved
inside its period; a challenge on B after its period; B shown CLOSED; then the pledge closed
and both credits withdrawn. The two refusals were sent on purpose with no value
(`--expect-refusal`), after the script's check had predicted them, so that they are recorded
on-chain.

| Step | Transaction | Result |
|---|---|---|
| Deploy | [0x861a78ee…9093](https://explorer-studio.genlayer.com/tx/0x861a78ee9d05f0d20a85cfb3d6e988f7a90d05aea54b70d47583fad5037a9093) | WasPrice v1.2.0 deployed by timbre-a, minimum period 10 minutes |
| Pledge 0 | [0xbb73024c…fa7c](https://explorer-studio.genlayer.com/tx/0xbb73024c85c4e948abb66a4fa44ebc586a337d227b9cf47cca8365175c77fa7c) | "DemoMaison", bond 0.2 GEN, payout 0.1, 7 days (ends 2026-11-23T15:06:04Z) |
| Promo 0 (A) | [0x3ce6351c…cf45](https://explorer-studio.genlayer.com/tx/0x3ce6351c53d6cee241ecff7ef1441fe340f8f1d60d516283a6280b826b01cf45) | bouilloire 39.90 → 34.90, 13 %, start 2026-11-13T14:52:03Z, declared 15:06:21Z, 15 minutes: `challenge_until` 2026-11-16T15:21:21Z |
| Promo 1 (B) | [0xa5940395…2448](https://explorer-studio.genlayer.com/tx/0xa5940395364660f7c176cc8344a7b7b9bf2d97cae39a4c6c216c0f54e80d2448) | theiere 39.90 → 31.90, 20 %, start 2026-11-16T15:06:29Z, declared 15:06:39Z, 10 minutes: `challenge_until` 2026-11-16T15:16:39Z; pledge `locked_until` 15:21:21Z |
| close_pledge during the periods (expected failure) | [0x8f97ef90…3564](https://explorer-studio.genlayer.com/tx/0x8f97ef90632c8956412343b53391f479d579ef6c77eaf56773415f38272d3564) | **ERROR** `[EXPECTED] a promo challenge period is open until 2026-11-16T15:21:21Z`; bond unchanged |
| Challenge 0 (A), in the period | [0x9d61bf94…3278](https://explorer-studio.genlayer.com/tx/0x9d61bf94ea499b36b46284469fbe6970a6f786206dfbee779c9b93d2638d3278) | capture 20261113144011, stake 0.01, filed 15:07:21Z |
| Resolve 0 (A) | [0x0d0a88ab…5bc0](https://explorer-studio.genlayer.com/tx/0x0d0a88abb71bcbf2a94f1a57b326d93a603254ef5515d9b07175618f82425bc0) | **UPHELD**: observed 29.90 EUR, was 39.90; `judged_ts` 20261113144011, `page_sha256` `dfdbee0b…7663` (v1); promo 0 DEBUNKED |
| Challenge on B after its period (expected failure) | [0x16e95da1…4ce8](https://explorer-studio.genlayer.com/tx/0x16e95da1c8b21791a3d79620453a2ccb6223426b78a0ea6205ab049cfab44ce8) | **ERROR** `[EXPECTED] challenge period ended (2026-11-16T15:16:39Z)`; capture 20261113144032, no value attached |
| Withdraw (timbre-b) | [0xa751c0c2…12db](https://explorer-studio.genlayer.com/tx/0xa751c0c2c5fdfa57fea8cff87e4b46e924d331b7df36658f5a1d460651e212db) | 0.11 GEN (stake 0.01 + payout 0.1) |
| close_pledge after the periods | [0xc6bb4c80…85d4](https://explorer-studio.genlayer.com/tx/0xc6bb4c803574e3ae8948dccc92f5cca765929c6cd881143d98d154f9641585d4) | SUCCESS: 0.1 GEN credited to the merchant, pledge inactive (before `ends_at`, after `locked_until`) |
| Withdraw (timbre-a) | [0xab0837c6…8b15](https://explorer-studio.genlayer.com/tx/0xab0837c673c10a5e8d217993b25f947d0fb5c4a991468fc6afa2d709aff58b15) | 0.1 GEN |

Every receipt is MAJORITY_AGREE; the two expected failures end with execution ERROR and the
exact `[EXPECTED]` message that the script's check predicted, every other one with SUCCESS.

Reads after the periods (`promo`, `promos 0`, `window 1`):

- promo 1 (B): `status` **CLOSED**, `challenge_until` 2026-11-16T15:16:39Z, no challenge; the
  script's `window 1` reports `challenge_open_now: false`. No view returns LIVE for it.
- promo 0 (A): `status` DEBUNKED (an upheld promo stays debunked after its period).

Final state of the v1.2.0 contract: pledge 0 inactive, bond 0, reserved 0, `total_credits` 0,
both credits withdrawn. Solvency: 0.2 bond + 0.01 stake = 0.11 (timbre-b) + 0.1 (timbre-a).

The steps between the declarations (15:06Z) and the late challenge (20:27Z) were spaced by
the operator's availability, not by the contract: the late challenge came about five hours
after B's period had ended, and the close about five hours after A's.

## Verify a judged capture

```powershell
curl.exe -s -o page.bin "https://web.archive.org/web/20261113144011id_/https://mcurly17.github.io/wasprice/demo/bouilloire.html"
Get-FileHash page.bin -Algorithm SHA256
```

Expected: `DFDBEE0BC42BD4D43FD8951677C50B918373FC3068AF2605724BD0C2434A7663` (Get-FileHash prints
uppercase).

## Screenshots to take

- Promo page A on the web app (`/promo/?id=0`): DEBUNKED badge, capture link, 29.90 against 39.90.
- Promo page D (`/promo/?id=3`): reason mentioning the ignored instruction, SHA-256 with "verify".
- Challenge form (`/challenge/?promo=1`): window check and preview message.
- Promo page C (`/promo/?id=2`): the case C finding, for the write-up.

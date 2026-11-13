# Working rules for this repository

These rules apply to every automated contributor in this repository, for the whole
project. The specification lives in `SPEC.md` (local only, gitignored).

## Commits
- Author and committer: `Mcurly17 <9095525+Mcurly17@users.noreply.github.com>`. Check
  `git config user.name` and `git config user.email` before committing; if they differ,
  pass `--author="Mcurly17 <9095525+Mcurly17@users.noreply.github.com>"`.
- NEVER add a `Co-Authored-By` trailer, a "Generated with ..." line, a `Claude-Session`
  trailer, an emoji, or any mention of an AI tool, model or vendor in commit messages,
  tags, code or docs. The local `.git/hooks/commit-msg` hook refuses such messages.
- One local commit per step, message in English, imperative mood, subject <= 72 chars.
  Show `git log -1 --format=fuller` after each commit.
- Never amend, rebase or force anything that already exists.

## Never without my explicit OK in the chat (gates)
- P1: creating the GitHub repository (`gh repo create`), any `git push` (tags included).
- P2: any contract deployment (`npx genlayer deploy`, `genlayer deploy`,
  `npm run deploy`, `scripts/wasprice.ts deploy`).
- P3: any on-chain write (`npx genlayer write`, `scripts/wasprice.ts` pledge, top-up,
  declare, challenge, challenge-image, resolve, expire, close, withdraw).
- At a gate: give ONE exact PowerShell command, say in one line what it does and what I
  should see, then wait for me to paste the output. Check it before the next one. The
  keystore password prompt needs a real terminal, so I run writes myself. If I explicitly
  allow one precise write, run it ONCE in the Terminal panel; on a timeout use
  `wait <hash>`, never re-send.
- Reads are fine without asking: the script's read commands, `snapshot`, `curl.exe -I`.

## Secrets
- Never use, suggest, write or log `--private-key`, `--password`, a private key, a seed or
  a keystore password, in a file, a log or the chat.
- Never read `.env`, `.env.*` (except `.env.example`) or `~/.genlayer/`.
- Signing goes only through the encrypted CLI keystore (`npx genlayer account use <name>`)
  with a password I type myself. Studionet test accounts:
  - timbre-a `0xf5Fe96d62733d40f25822b20C5E46A0E17483dFF` (merchant)
  - timbre-b `0x74115084812fc662AaAE47B5Fd4Ef60cd5E7BC56` (challenger)

## Windows / PowerShell
- Commands for me are PowerShell. No empty `""` argument and no inner quotes; prefer
  flags and files for texts; never JSON on the command line.
- Prices are written `39.90`. Unquoted `39,90` becomes an array in PowerShell.
- Payable calls: `node --env-file-if-exists=.env scripts/wasprice.ts ... --value <GEN>`
  (`npm run` drops `--value`).
- NEVER use `npx genlayer call --args` for `str` parameters: it turns `0x...` into an
  address object and long digit strings into integers. Use the script.
- Python: `.venv\Scripts\activate`, then `$env:PYTHONIOENCODING = "utf-8"` before
  `genvm-lint`.

## GenLayer
- Read `.cursor/rules/*.md` (write-contract, direct-tests, genvm-lint, CLI) before touching
  the contract or its tests.
- Line 1 of `contracts/was_price.py` is the pinned runner:
  `# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }`.
  No migration to SDK v0.3. genlayer-js is pinned to exactly 1.1.8.
- Reuse the validated GreenClaim Bond logic (Wayback `id_`, redirects, HTML to text,
  `_neutralize`, images, error classes).
- No invented API: if unsure, check docs.genlayer.com or write `TODO(verify)` and report it.
- On Studionet a refused payable call keeps its value: every write is preceded by its
  `preview_*` view, and the script refuses to send when the preview returns an error.
- Never store a page or an image on-chain: only URLs, capture timestamps and hashes.

## Demo pages
- `docs/demo/` pages are Wayback evidence. Never modify them after a push, except for the
  single planned v1 -> v2 switch (SPEC.md section 4), and keep `docs/demo/SHA256SUMS` in sync.

## Definition of done for every step
1. `$env:PYTHONIOENCODING = "utf-8"; genvm-lint check contracts/was_price.py`: 0 errors.
2. `pytest tests/direct -v`.
3. `npm run test:scripts`; once `frontend/` exists: `npm run lint`, `npm run test:frontend`,
   `npm run build` (with `NEXT_PUBLIC_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000001`).
4. `(Get-Item contracts\was_price.py).Length` < 40000 bytes (a margin target, not an
   official limit; otherwise apply the SPEC.md section 3.11 cuts in order and note them).
5. `git grep -n -i "private_key\|--private-key"`: only the refusal and its test.
6. `git log --format=%B | Select-String -Pattern "co-authored|claude|generated|anthropic"`: empty.
7. Local commit, then `git log -1 --format=fuller` (author and committer = Mcurly17) and a
   short report: changes, test summary, `git diff --stat HEAD~1`, hash.

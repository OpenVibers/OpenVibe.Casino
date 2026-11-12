# AGENTS.md — OpenVibe.Casino

## Project overview

"Learn it, play it, never pay it." Every casino game with its insides showing: the rules, the exact
odds and what each bet costs, tables playable with chips worth nothing, and a simulator that runs a
million rounds in the browser. Node.js/Express, PostgreSQL (optional identity state), CommonJS, no
build step.

- Origin `https://openvibe.casino`, port `5210`, service id `casino`, env prefix `CASINO`, unit
  `openvibe-casino.service`, release root `/opt/openvibe.casino`.
- **No real money, ever.** Play chips are free (1,000 a day), live in the player's browser, and cannot
  be bought, sold, won as anything or cashed out. No operator listings and no affiliate links until the
  owner's legal review. The tables sit behind a self-declared 18+ gate, remind a player every 30
  minutes, and every page carries one calm line pointing at free help (1-800-GAMBLER, BeGambleAware,
  Gamblers Anonymous).

## What it owns

- The pure, deterministic game engines in [engine/](engine/): `blackjack.js` (6 decks, S17, DAS, split
  to 4, split aces one card, peek, insurance, 3:2), `roulette.js` (European/American, every layout
  bet), `baccarat.js` (punto banco, third-card tableau, 5% commission), `craps.js` (pass/don't pass,
  3-4-5x odds, place, field), `slots.js` (three 24-stop reels, a paytable). `engine/rng.js` is a seeded
  mulberry32; `engine/games.js` is the catalogue every page and the API read.
- Every edge/odds figure on the site and in the API, computed from the engines — no edge is typed in.
- The pages and API: `/`, `/play`, `/play/:game`, `/learn`, `/learn/:game`, `/simulate`, `/s/:id`
  (shared run, noindex), `/safe`, `/developers`, `GET /api/v1/*` (open, no key), `/engine/*` (the UMD
  files).
- The simulator ([server/sims.js](server/sims.js) for shared runs; `public/js/sim-worker.js` in the
  browser), the 18+ gate, contrast/`prefers-reduced-motion` behaviour and the safe-play copy.
- Account-data receipts and telemetry; a small PostgreSQL database for shared runs and receipts.

Not owned: money, balances, purchases, cashouts (Billing owns money and this product must never touch
it), any gambling operator's listing, identity (Network).

## Who calls it, and whom it calls

- Callers: people in the browser; the open API and the shared-run pages; sites linking to `/learn`;
  OpenVibe's launcher/discovery.
- Depends on: **Network** for optional SSO (OAuth client `casino`, PKCE) and account export/deletion
  events; PostgreSQL and Valkey for shared runs/limits; `openvibe-shared` for the Frame, legal, SEO and
  `/shared/*`. It does **not** call Billing, Live, AI or any gaming provider.
- The API is open and keyless by design (the README says so); it serves probabilities and simulations,
  never a player's balance.

## Repository map

- **Entry:** [server/index.js](server/index.js) — `createApp()`, listen, key warm-up, graceful stop.
- **App:** [server/app.js](server/app.js) — helmet/CSP, `/auth`, `/internal/events`, `/shared`,
  `/engine`, `/api/v1`, pages, machine endpoints.
- **Config/db:** [server/config.js](server/config.js), [server/db.js](server/db.js).
- **Sims and storage:** [server/sims.js](server/sims.js), [server/db.js](server/db.js).
- **HTTP:** [server/http/api.js](server/http/api.js), `pages.js`, `principal.js`, `discovery.js`,
  `router.js`; views [server/views/index.js](server/views/index.js), `server/render/`.
- **Engines:** [engine/](engine/) — `rng.js`, `blackjack.js`, `roulette.js`, `baccarat.js`, `craps.js`,
  `slots.js`, `games.js`; UMD so the same file runs on the server, at the table and in the worker.
- **Browser:** [public/js/table.js](public/js/table.js), `casino.js` (the chips), `simulate.js`,
  `sim-worker.js`; [public/css/casino.css](public/css/casino.css).
- **Deploy:** [deploy/systemd/openvibe-casino.service](deploy/systemd/openvibe-casino.service),
  [deploy/nginx/openvibe.casino.conf](deploy/nginx/openvibe.casino.conf).

## Commands

```bash
npm install
npm run dev                # NODE_ENV=development node server/index.js
npm start                  # node server/index.js, http://127.0.0.1:5210
npm test                   # test/run.js, PGlite, mock Network, fixture games
npm run test:pg            # same on PostgreSQL (CASINO_TEST_STORE=pg)
npm test -- engines        # filter by file name; --strict makes a skip fail
ov test                    # the harness's sharded run of what the change reaches
```

## Database and migrations

One migration ([migrations/0001_initial.sql](migrations/0001_initial.sql)) for shared simulations and
account-data receipts; PGlite in development/tests, PostgreSQL in production through
`openvibe-sdk/db`/`DATABASE_URL`. Play chips are **not** in the database — they live in the player's
browser. Never edit an applied migration; add a new number. No table stores a real balance.

## Auth and the 18+ gate

- The games and `/api/v1` are open and need no account; a signed-in person is only used for shared
  runs and account export/deletion. Network SSO is optional (OAuth client `casino`, PKCE).
- The 18+ gate is self-declared and stored in the browser; it is not an age verification. The 30-minute
  reminder and the help line are product requirements, not decoration.
- Service tokens, if added, need a `casino.*` capability from `openvibe-contracts`; today there is no
  money or account operation to authorize.

## Frontend loading model

Server-rendered pages plus plain browser modules: [public/js/table.js](public/js/table.js) plays,
[public/js/casino.js](public/js/casino.js) holds the chips, [public/js/simulate.js](public/js/simulate.js)
with `public/js/sim-worker.js` simulates in a Web Worker. The engines are UMD and shared by server,
page and worker, so a rule cannot drift between the demonstration and the simulator. No SPA, bundler
or transpiler; `openvibe-shared` supplies the Frame/legal/SEO and `/shared/*`.

## Deploy

Unit [deploy/systemd/openvibe-casino.service](deploy/systemd/openvibe-casino.service) runs
`/opt/openvibe.casino/server/index.js` on `127.0.0.1:5210`, env `/etc/openvibe/casino.env`; vhost
[deploy/nginx/openvibe.casino.conf](deploy/nginx/openvibe.casino.conf). The README records the deploy
files, not a live `ovhost` command; use the host's own installer. A change is frontend + server only;
there is no money migration to run.

## Tests

`npm test` runs each `test/*.test.js` in its own process with a temp PGlite and a mock Network.
`test/engines.test.js` checks **every published edge/RTP** against Wizard of Odds (basic-strategy
0.40%, roulette 2.70/5.26/7.89%, baccarat 1.06/1.24/14.36%, slots 93.63%); `test/contrast.test.js`
pins readable colours; `test/account-data.test.js` the export/deletion; `test/agent-*.test.js` the
agent descriptor/twins. `ov test` runs the same.

## Conventions

- CommonJS on the server, UMD in `engine/`; 4-space indent, single quotes, semicolons; factories with
  injectable config/clock/fetch/log.
- Numbers that a player might rely on are **computed by the engine** and tested against a published
  source; never hard-code an edge in a page or in `server/`.
- Copy is calm, short and honest: "Expiry unknown" style rules apply to odds too — an unstated number
  is not guessed.
- Accessibility: contrast, focus and reduced motion are part of the product; the 18+ gate must be
  reachable by keyboard.

## Pitfalls

- **No real money and no affiliate/operator links** until the owner's legal review; adding a purchase,
  balance, cashout or referral path is out of bounds and Billing is not a dependency.
- **Do not type an edge or RTP into a view.** It comes from `engine/games.js`/the engines and is
  checked by `test/engines.test.js`; a copied figure will drift.
- **Play chips never leave the browser.** Do not add a server balance, leaderboard prize or transfer.
- **The 18+ gate, the 30-minute reminder and the help line are required** on every play page; a new
  table that omits them is a bug.
- **Keep the engines deterministic from a seed** and free of browser/Node globals in their core; the
  same file must run in the worker and on the server.
- **Shared runs are noindex** (`/s/:id`) and contain no personal data.
- **Do not use a dark pattern** (fake urgency, "hot" streaks) — the product is a teaching tool.

## Documentation

- [README.md](README.md) — the engines and their edges, pages, API, data and deploy files.
- [STATUS.json](STATUS.json) — what works and what does not.
- The new-domains plan §5.14 is the product brief; `openvibe-contracts` holds any `casino.*` shapes.

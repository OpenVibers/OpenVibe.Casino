# OpenVibe.Casino

> Learn it, play it, never pay it.

**Domain:** `openvibe.casino` · **Port:** 5210 · **Service id:** `casino` · **Env prefix:** `CASINO`

Every casino game with its insides showing: the rules, the exact odds and what each bet costs, tables you can play with
chips worth nothing, and a simulator that plays a million rounds in your browser. Plan: the new-domains plan, §5.14.

**No real money, ever.** Play chips are free, a fresh 1,000 arrive each day, they live in the player's browser, and they
cannot be bought, sold, won as anything or cashed out. No operator listings and no affiliate links: those wait for the
owner's legal review. The tables sit behind a self-declared 18+ gate, remind a player every 30 minutes, and every page
carries one calm line pointing at free help (1-800-GAMBLER, BeGambleAware, Gamblers Anonymous).

## The engines (`engine/`)

Pure JavaScript, deterministic from a seed (`rng.js`, mulberry32), UMD so the same file runs on the server, at the table
and in the simulator's Web Worker.

| Engine | What it plays | How the edge is known |
|---|---|---|
| `blackjack.js` | 6 decks, S17, DAS, split to 4, split aces one card, peek, insurance, 3:2; basic strategy, "like the dealer", "never bust" | simulation; basic strategy checked against the published 0.40% |
| `roulette.js` | European and American, every layout bet | exact: 2.70%, 5.26%, top line 7.89% |
| `baccarat.js` | punto banco, 8 decks, the third-card tableau, 5% commission | exact, every six-card path weighted: 1.06 / 1.24 / 14.36% |
| `craps.js` | pass, don't pass, odds (3-4-5x), place, field | exact from the 36 dice outcomes |
| `slots.js` | three 24-stop reels, a paytable | exact over all 13,824 stops: RTP 93.63% |

`engine/games.js` is the catalogue every page and the API read; no edge in it is typed in.
`test/engines.test.js` checks every figure against Wizard of Odds' published one.

## Pages

| Path | What |
|---|---|
| `/` | every bet's cost on one ladder, a real bankroll chart, what you can do, questions |
| `/play`, `/play/:game` | the tables (`public/js/table.js`), the 18+ gate, the chips (`public/js/casino.js`) |
| `/learn`, `/learn/:game` | the rules and each bet's edge, with the engine's own tables (basic strategy, the tableau, the strips) |
| `/simulate` | the simulator (`public/js/simulate.js`, `public/js/sim-worker.js`) |
| `/s/:id` | a shared run (noindex) |
| `/safe`, `/developers` | play safe; the API |

## API (`/api/v1`, open, no key)

- `GET /games`, `GET /games/:id`: rules, each bet's edge, how it is known and the published source.
- `POST /simulate` `{ game, choice, rounds, seed?, share? }`: a bounded run on the server (`CASINO_SIM_MAX_ROUNDS`,
  default 200,000; `CASINO_SIM_PER_MINUTE` per address, default 6). With `share`, the run is kept and its link answered.
- `GET /sims/:id`: a shared run. `GET /openapi.json`: OpenAPI 3.1.

## Data

One table, `casino_sims` (a shared run: game, params with the seed, result). No column names a person. Casino keeps
nothing about anyone, so an account export says so and a deletion has nothing to erase (`server/identity/account-data.js`).

## The service

Express, server-rendered through `openvibe-shared/shell` and the room kit (`rooms.js` id `casino`). Sign-in through
OpenVibe.Network (OAuth client `casino`, PKCE). PostgreSQL through `openvibe-sdk/db` (`migrations/`), PGlite in
development and tests. Deploy files: `deploy/systemd/openvibe-casino.service`, `deploy/nginx/openvibe.casino.conf`
(Meme's, renamed). Env: `.env.example`.

```bash
npm install
npm run dev        # http://localhost:5210
npm test           # node test/run.js on PGlite
```

AGPL-3.0-only.

<!-- versions:start -->
- openvibe-contracts: v0.338.0
- openvibe-sdk: v0.117.0
- openvibe-shared: v4.172.0
<!-- versions:end -->

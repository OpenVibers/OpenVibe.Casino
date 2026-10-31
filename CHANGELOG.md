# Changelog

## 0.1.0 — 2026-10-31

The first version: learn it, play it, never pay it.

- **Engines** for blackjack, roulette, baccarat, craps and slots, deterministic from a seed and the same files on the
  server, at the tables and in the simulator. Every house edge is computed (exactly, or by simulation for blackjack
  strategies) and checked against the published figure.
- **Tables** for every game, with a fresh 1,000 play chips a day kept in the browser, worth nothing; an 18+ gate; a
  reminder every 30 minutes.
- **Learn**: the rules and each bet's cost, with the engine's own basic-strategy charts, the baccarat tableau, the dice
  odds and the slot machine's strips.
- **Simulate**: up to a million rounds in a Web Worker, charted against the exact edge, and shareable.
- **API**: `/api/v1/games`, `/api/v1/simulate`, `/api/v1/sims/:id`, OpenAPI.
- **Play safe** everywhere: one calm line on every page, and a page with free, confidential help.

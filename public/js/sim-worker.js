/* The simulator's worker: loads the engines (the same files the server and the tables run) and plays one game for the
 * rounds asked, posting the house's share so far about 200 times a run, then the result. Nothing leaves the browser. */
/* global importScripts, OpenVibeBlackjack, OpenVibeRoulette, OpenVibeBaccarat, OpenVibeCraps, OpenVibeSlots */
'use strict';
importScripts('/engine/rng.js', '/engine/cards.js', '/engine/blackjack.js', '/engine/roulette.js', '/engine/baccarat.js', '/engine/craps.js', '/engine/slots.js');

// The same game and choice names as the server's POST /api/v1/simulate (server/sims.js), so a run can be shared.
var RUN = {
    blackjack: function (c, n, seed, p) { return OpenVibeBlackjack.houseEdge({ strategy: c, hands: n, seed: seed, onProgress: p }); },
    roulette: function (c, n, seed, p) {
        var parts = c.split('-');
        var bet = parts[1] === 'straight' ? { type: 'straight', numbers: ['17'] } : { type: parts[1] };
        return OpenVibeRoulette.houseEdge({ wheel: parts[0], bet: bet, spins: n, seed: seed, onProgress: p });
    },
    baccarat: function (c, n, seed, p) { return OpenVibeBaccarat.houseEdge({ bet: c, coups: n, seed: seed, onProgress: p }); },
    craps: function (c, n, seed, p) { return OpenVibeCraps.houseEdge({ bet: c === 'pass-odds' ? 'pass' : c, withOdds: c === 'pass-odds', decisions: n, seed: seed, onProgress: p }); },
    slots: function (c, n, seed, p) { return OpenVibeSlots.houseEdge({ spins: n, seed: seed, onProgress: p }); },
};

self.onmessage = function (e) {
    var m = e.data || {};
    if (!RUN[m.game]) { self.postMessage({ type: 'error', message: 'no such game' }); return; }
    var t = Date.now();
    var r = RUN[m.game](m.choice, m.rounds, m.seed >>> 0, function (done, edge) { self.postMessage({ type: 'progress', done: done, edge: edge }); });
    self.postMessage({ type: 'done', result: { rounds: m.rounds, seed: m.seed >>> 0, edge_percent: Math.round(r.percent * 1000) / 1000, stderr_percent: Math.round(r.stderr * 1000) / 1000, ms: Date.now() - t } });
};

'use strict';

/**
 * Roulette, European (one zero, 37 pockets) and American (0 and 00, 38 pockets), with every bet on the layout: straight,
 * split, street, corner, six line, the first four or the top line, column, dozen, red, black, odd, even, low and high.
 * A bet covering n numbers pays 36/n − 1 to one, so the house edge is exactly the share of the zeros: 1/37 = 2.70% and
 * 2/38 = 5.26%. The American top line (0, 00, 1, 2, 3) pays 6 to 1 for five numbers and costs 7.89%.
 */
(function (root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) { module.exports = api; return; }
    root.OpenVibeRoulette = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    const rngLib = (typeof module === 'object' && module.exports) ? require('./rng') : root.OpenVibeRng;
    const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
    const WHEELS = {
        european: { name: 'European', pockets: ['0', ...range(1, 36)], order: [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26].map(String) },
        american: { name: 'American', pockets: ['0', '00', ...range(1, 36)], order: [0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, '00', 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2].map(String) },
    };
    function range(a, b) { const out = []; for (let i = a; i <= b; i += 1) out.push(String(i)); return out; }
    const colour = (p) => (p === '0' || p === '00' ? 'green' : RED.has(Number(p)) ? 'red' : 'black');

    /** The numbers a bet covers, or null when the bet is not one on this wheel's layout. */
    function covers(bet, wheel = 'european') {
        const t = bet.type; const n = (bet.numbers || []).map(String);
        const nums = (list) => list.map(String);
        const valid = (p) => WHEELS[wheel].pockets.includes(p);
        if (t === 'red' || t === 'black') return range(1, 36).filter((p) => colour(p) === t);
        if (t === 'odd') return range(1, 36).filter((p) => Number(p) % 2 === 1);
        if (t === 'even') return range(1, 36).filter((p) => Number(p) % 2 === 0);
        if (t === 'low') return range(1, 18);
        if (t === 'high') return range(19, 36);
        if (t === 'dozen') { const d = Number(bet.which); return d >= 1 && d <= 3 ? range(d * 12 - 11, d * 12) : null; }
        if (t === 'column') { const c = Number(bet.which); return c >= 1 && c <= 3 ? range(1, 36).filter((p) => (Number(p) - c) % 3 === 0) : null; }
        if (t === 'top') return wheel === 'american' ? nums(['0', '00', 1, 2, 3]) : nums(['0', 1, 2, 3]);
        const sizes = { straight: 1, split: 2, street: 3, corner: 4, line: 6 };
        if (!sizes[t] || n.length !== sizes[t] || !n.every(valid) || new Set(n).size !== n.length) return null;
        return n;
    }

    /** What a bet pays to one when it wins. */
    function payout(bet, wheel = 'european') {
        const c = covers(bet, wheel);
        if (!c) return null;
        if (bet.type === 'top' && wheel === 'american') return 6;
        return 36 / c.length - 1;
    }

    /** The exact house edge of a bet, as a fraction of the stake. */
    function edge(bet, wheel = 'european') {
        const c = covers(bet, wheel);
        if (!c) return null;
        const p = c.length / WHEELS[wheel].pockets.length;
        return 1 - p * (payout(bet, wheel) + 1);
    }

    function spin(rng, wheel = 'european') { const order = WHEELS[wheel].order; return order[rng.int(order.length)]; }

    /** Settle a list of bets ({ type, numbers?, which?, amount }) on a pocket: each bet's net and the total. */
    function settle(bets, pocket, wheel = 'european') {
        const results = bets.map((b) => {
            const c = covers(b, wheel);
            if (!c) return { ...b, net: 0, error: 'not a bet on this layout' };
            const win = c.includes(String(pocket));
            return { ...b, win, net: win ? b.amount * payout(b, wheel) : -b.amount };
        });
        return { pocket: String(pocket), colour: colour(String(pocket)), results, net: results.reduce((a, r) => a + r.net, 0) };
    }

    function createGame({ wheel = 'european', seed = 1, rng = null } = {}) {
        const g = rng || rngLib.createRng(seed);
        return { wheel, spin: (bets) => settle(bets, spin(g, wheel), wheel) };
    }

    /** Spin the same bet many times: what the house kept, measured, next to the exact edge. */
    function houseEdge({ wheel = 'european', bet = { type: 'red' }, spins = 200000, seed = 20261031, onProgress = null } = {}) {
        const every = Math.max(100, Math.floor(spins / 200));   // about 200 progress points a run
        const g = rngLib.createRng(seed);
        const stake = { ...bet, amount: 1 };
        let sum = 0; let squares = 0;
        for (let i = 0; i < spins; i += 1) {
            const net = settle([stake], spin(g, wheel), wheel).net;
            sum += net; squares += net * net;
            if (onProgress && (i + 1) % every === 0) onProgress(i + 1, -sum / (i + 1));
        }
        const mean = sum / spins;
        const sd = Math.sqrt(Math.max(0, squares / spins - mean * mean));
        return { game: 'roulette', wheel, bet: bet.type, spins, edge: -mean, percent: -mean * 100, stderr: (sd / Math.sqrt(spins)) * 100, exact: edge(stake, wheel) * 100 };
    }

    return { WHEELS, RED, colour, covers, payout, edge, spin, settle, createGame, houseEdge };
});

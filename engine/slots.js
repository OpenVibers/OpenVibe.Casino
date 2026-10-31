'use strict';

/**
 * A slot machine you can see inside: three reels with their strips printed, a paytable, and the maths a real machine
 * hides. Every reel stop is equally likely, so the return to player (RTP), the hit rate and the volatility are worked
 * out exactly by walking all stops (24 × 24 × 24 = 13,824 spins), and spinning many times only shows the same numbers
 * arriving slowly. The house edge is 1 − RTP.
 */
(function (root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) { module.exports = api; return; }
    root.OpenVibeSlots = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    const rngLib = (typeof module === 'object' && module.exports) ? require('./rng') : root.OpenVibeRng;

    // Symbols, rarest first. Each reel strip has 24 stops.
    const SYMBOLS = ['seven', 'bell', 'star', 'plum', 'lemon', 'cherry', 'blank'];
    const COUNTS = [
        { seven: 1, bell: 2, star: 3, plum: 4, lemon: 4, cherry: 2, blank: 8 },
        { seven: 1, bell: 2, star: 3, plum: 4, lemon: 4, cherry: 2, blank: 8 },
        { seven: 1, bell: 2, star: 3, plum: 4, lemon: 4, cherry: 2, blank: 8 },
    ];
    // Three of a kind pays the first column; one or two cherries anywhere pay the cherry rows.
    const PAYTABLE = { seven: 800, bell: 120, star: 45, plum: 18, lemon: 18, cherryThree: 34, cherryTwo: 6, cherryOne: 2 };

    /** The strips: each reel's symbols spread out so the same symbol rarely sits next to itself. */
    function strips() {
        return COUNTS.map((c, reel) => {
            const out = [];
            const left = { ...c };
            const order = SYMBOLS.slice();
            while (out.length < 24) {
                for (const s of order) if (left[s] > 0 && out.length < 24) { out.push(s); left[s] -= 1; }
                order.push(order.shift());
            }
            for (let i = 0; i < reel; i += 1) out.push(out.shift());      // each reel starts at a different place
            return out;
        });
    }
    const STRIPS = strips();

    function pays(line) {
        const [a, b, c] = line;
        if (a === b && b === c) return a === 'cherry' ? PAYTABLE.cherryThree : a === 'blank' ? 0 : PAYTABLE[a];
        const cherries = line.filter((s) => s === 'cherry').length;
        return cherries === 2 ? PAYTABLE.cherryTwo : cherries === 1 ? PAYTABLE.cherryOne : 0;
    }

    /** The exact maths: RTP, hit rate, the share of what comes back from each win, and the volatility (one spin's SD). */
    function exact() {
        const n = STRIPS[0].length * STRIPS[1].length * STRIPS[2].length;
        let sum = 0; let squares = 0; let hits = 0;
        const byWin = {};
        for (const a of STRIPS[0]) for (const b of STRIPS[1]) for (const c of STRIPS[2]) {
            const w = pays([a, b, c]);
            sum += w; squares += w * w;
            if (w > 0) { hits += 1; byWin[w] = (byWin[w] || 0) + 1; }
        }
        const rtp = sum / n;
        return { spins: n, rtp, edge: 1 - rtp, hitRate: hits / n, volatility: Math.sqrt(squares / n - rtp * rtp), wins: Object.entries(byWin).map(([pay, count]) => ({ pay: Number(pay), chance: count / n })).sort((x, y) => y.pay - x.pay) };
    }

    function createGame({ seed = 1, rng = null } = {}) {
        const g = rng || rngLib.createRng(seed);
        return {
            spin(bet = 1) {
                const stops = STRIPS.map((s) => g.int(s.length));
                const line = stops.map((i, reel) => STRIPS[reel][i]);
                const win = pays(line) * bet;
                return { stops, line, win, net: win - bet };
            },
        };
    }

    function houseEdge({ spins = 200000, seed = 20261031, onProgress = null } = {}) {
        const every = Math.max(100, Math.floor(spins / 200));   // about 200 progress points a run
        const game = createGame({ seed });
        let sum = 0; let squares = 0;
        for (let i = 0; i < spins; i += 1) {
            const n = game.spin(1).net;
            sum += n; squares += n * n;
            if (onProgress && (i + 1) % every === 0) onProgress(i + 1, -sum / (i + 1));
        }
        const mean = sum / spins;
        const sd = Math.sqrt(Math.max(0, squares / spins - mean * mean));
        return { game: 'slots', spins, edge: -mean, percent: -mean * 100, stderr: (sd / Math.sqrt(spins)) * 100 };
    }

    return { SYMBOLS, COUNTS, PAYTABLE, STRIPS, pays, exact, createGame, houseEdge };
});

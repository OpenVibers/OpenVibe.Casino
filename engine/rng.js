'use strict';

/**
 * The seeded random source every game engine uses. One generator, one seed, the same cards in the same order on
 * the server, in the browser and in a Web Worker: mulberry32 (a 32-bit state, no platform maths, identical in
 * Node and in a browser).
 *
 * A seed is a 32-bit unsigned integer. The same seed always gives the same stream, so a hand can be replayed,
 * a bug can be found again, and a test can assert on the exact cards.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) { module.exports = api; return; }
    root.OpenVibeRng = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    /** A seed from a string, so "blackjack-42" is a stable seed too. */
    function seedFrom(text) {
        const s = String(text == null ? '' : text);
        let h = 2166136261 >>> 0;
        for (let i = 0; i < s.length; i += 1) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619) >>> 0;
        }
        return h >>> 0;
    }

    /** mulberry32: 32-bit state, uniform in [0, 1). */
    function createRng(seed) {
        let a = (Number(seed) >>> 0) || 0x9e3779b9;
        const next = () => {
            a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        return {
            /** The next float in [0, 1). */
            next,
            /** The next integer in [0, n). */
            int(n) { const k = Math.floor(n); return k > 0 ? Math.floor(next() * k) : 0; },
            /** The next float in [lo, hi). */
            range(lo, hi) { return lo + next() * (hi - lo); },
            /** A copy of the array, shuffled (Fisher-Yates, from the top down). */
            shuffle(list) {
                const out = Array.isArray(list) ? list.slice() : Array.from(list);
                for (let i = out.length - 1; i > 0; i -= 1) {
                    const j = Math.floor(next() * (i + 1));
                    const t = out[i]; out[i] = out[j]; out[j] = t;
                }
                return out;
            },
            /** The state, so a run can be continued from where it stopped. */
            get state() { return a >>> 0; },
            set state(v) { a = (Number(v) >>> 0) || 0x9e3779b9; },
        };
    }

    return { createRng, seedFrom };
});

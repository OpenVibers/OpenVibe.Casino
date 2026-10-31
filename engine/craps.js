'use strict';

/**
 * Craps with the bets people learn first: pass and don't pass (bar 12), come and don't come, free odds behind a pass or
 * come bet (3-4-5x), place bets on 4, 5, 6, 8, 9 and 10 (9:5, 7:5, 7:6), and the one-roll field (2 and 12 pay double).
 * exactEdges() works every edge out from the 36 ways two dice fall: pass 1.41%, don't pass 1.36%, odds 0%, place 6 and 8
 * 1.52%, place 5 and 9 4.00%, place 4 and 10 6.67%, field 5.56%.
 */
(function (root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) { module.exports = api; return; }
    root.OpenVibeCraps = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    const rngLib = (typeof module === 'object' && module.exports) ? require('./rng') : root.OpenVibeRng;
    const WAYS = [0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1];      // ways to roll each total out of 36
    const POINTS = [4, 5, 6, 8, 9, 10];
    const PLACE_PAYS = { 4: 9 / 5, 10: 9 / 5, 5: 7 / 5, 9: 7 / 5, 6: 7 / 6, 8: 7 / 6 };
    const ODDS_PAYS = { 4: 2, 10: 2, 5: 3 / 2, 9: 3 / 2, 6: 6 / 5, 8: 6 / 5 };
    const ODDS_MAX = { 4: 3, 10: 3, 5: 4, 9: 4, 6: 5, 8: 5 };   // 3-4-5x odds
    const p = (t) => WAYS[t] / 36;
    // The chance of making a point before a seven.
    const make = (pt) => WAYS[pt] / (WAYS[pt] + 6);

    function exactEdges() {
        const pass = p(7) + p(11) + POINTS.reduce((a, pt) => a + p(pt) * make(pt), 0);
        const passEdge = 1 - 2 * pass;
        // Don't pass: wins on 2 or 3, pushes on 12, loses on 7 or 11, then wins when the seven comes first.
        const dpWin = p(2) + p(3) + POINTS.reduce((a, pt) => a + p(pt) * (1 - make(pt)), 0);
        const dpLose = p(7) + p(11) + POINTS.reduce((a, pt) => a + p(pt) * make(pt), 0);
        const dontPassEdge = dpLose - dpWin;
        const place = {};
        for (const pt of POINTS) place[pt] = 1 - make(pt) * (PLACE_PAYS[pt] + 1);
        const fieldWin = [2, 3, 4, 9, 10, 11, 12].reduce((a, t) => a + p(t) * (t === 2 || t === 12 ? 2 : 1), 0);
        const fieldLose = [5, 6, 7, 8].reduce((a, t) => a + p(t), 0);
        const odds = {};
        for (const pt of POINTS) odds[pt] = 1 - make(pt) * (ODDS_PAYS[pt] + 1);
        return { pass: passEdge, dontPass: dontPassEdge, come: passEdge, dontCome: dontPassEdge, place, field: fieldLose - fieldWin, odds };
    }

    function roll(rng) { const a = 1 + rng.int(6); const b = 1 + rng.int(6); return { dice: [a, b], total: a + b }; }

    /**
     * A table: bets live between rolls. bet(type, amount, point?) places one; roll() throws the dice and settles what the
     * roll decides. Types: pass, dontPass, odds (behind the pass line, once there is a point), place (point), field.
     */
    function createGame({ seed = 1, rng = null } = {}) {
        const g = rng || rngLib.createRng(seed);
        let point = null;
        let bets = [];
        function bet(type, amount, at = null) {
            const a = Math.max(1, Math.floor(Number(amount) || 0));
            if (type === 'pass' || type === 'dontPass') { if (point) return { ok: false, error: 'a line bet is made before the point' }; }
            else if (type === 'odds') {
                const line = bets.find((b) => b.type === 'pass');
                if (!point || !line) return { ok: false, error: 'odds go behind a pass bet once there is a point' };
                const already = bets.filter((b) => b.type === 'odds').reduce((s, b) => s + b.amount, 0);
                if (already + a > line.amount * ODDS_MAX[point]) return { ok: false, error: `at most ${ODDS_MAX[point]}x odds on ${point}` };
            } else if (type === 'place') { if (!POINTS.includes(Number(at))) return { ok: false, error: 'place bets go on 4, 5, 6, 8, 9 or 10' }; }
            else if (type !== 'field') return { ok: false, error: 'not a bet here' };
            bets.push({ type, amount: a, at: type === 'place' ? Number(at) : type === 'odds' ? point : null });
            return { ok: true };
        }
        function throwDice() {
            const r = roll(g);
            const t = r.total;
            const settled = []; const keep = [];
            for (const b of bets) {
                let net = null;
                if (b.type === 'field') net = [2, 3, 4, 9, 10, 11, 12].includes(t) ? b.amount * (t === 2 || t === 12 ? 2 : 1) : -b.amount;
                else if (b.type === 'place') net = t === b.at ? b.amount * PLACE_PAYS[b.at] : t === 7 ? -b.amount : null;
                else if (b.type === 'odds') net = t === b.at ? b.amount * ODDS_PAYS[b.at] : t === 7 ? -b.amount : null;
                else if (b.type === 'pass') {
                    if (!point) net = t === 7 || t === 11 ? b.amount : [2, 3, 12].includes(t) ? -b.amount : null;
                    else net = t === point ? b.amount : t === 7 ? -b.amount : null;
                } else if (b.type === 'dontPass') {
                    if (!point) net = t === 2 || t === 3 ? b.amount : t === 12 ? 0 : t === 7 || t === 11 ? -b.amount : null;
                    else net = t === 7 ? b.amount : t === point ? -b.amount : null;
                }
                if (net == null) keep.push(b); else settled.push({ ...b, net });
            }
            bets = keep;
            const before = point;
            if (!point) { if (POINTS.includes(t)) point = t; } else if (t === point || t === 7) point = null;
            return { ...r, pointBefore: before, point, settled, net: settled.reduce((a, b) => a + b.net, 0), open: bets.slice() };
        }
        return { bet, roll: throwDice, get point() { return point; }, get bets() { return bets.slice(); } };
    }

    /** Play pass line (optionally with full odds) for many decisions and measure the edge per unit of the line bet. */
    function houseEdge({ bet = 'pass', withOdds = false, decisions = 200000, seed = 20261031, onProgress = null } = {}) {
        const every = Math.max(100, Math.floor(decisions / 200));   // about 200 progress points a run
        const game = createGame({ seed });
        let sum = 0; let squares = 0; let done = 0;
        while (done < decisions) {
            if (bet === 'place') {
                game.bet('place', 6, 6);
                let net = 0;
                for (;;) { const r = game.roll(); const s = r.settled.find((x) => x.type === 'place'); if (s) { net = s.net / 6; break; } }
                sum += net; squares += net * net; done += 1;
            } else {
                game.bet(bet, 1);
                let net = 0;
                for (;;) {
                    const r = game.roll();
                    if (withOdds && bet === 'pass' && !r.pointBefore && r.point) game.bet('odds', ODDS_MAX[r.point], null);
                    net += r.net;
                    if (!game.bets.some((b) => b.type === bet)) break;
                }
                sum += net; squares += net * net; done += 1;
            }
            if (onProgress && done % every === 0) onProgress(done, -sum / done);
        }
        const mean = sum / decisions;
        const sd = Math.sqrt(Math.max(0, squares / decisions - mean * mean));
        return { game: 'craps', bet, withOdds, decisions, edge: -mean, percent: -mean * 100, stderr: (sd / Math.sqrt(decisions)) * 100 };
    }

    return { WAYS, POINTS, PLACE_PAYS, ODDS_PAYS, ODDS_MAX, exactEdges, roll, createGame, houseEdge };
});

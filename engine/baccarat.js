'use strict';

/**
 * Baccarat (punto banco) from an eight-deck shoe: the player and the banker get two cards, a natural 8 or 9 stands, the
 * player draws on 0 to 5, and the banker's third card follows the tableau below. Bets: player (1:1), banker (1:1 less a
 * 5% commission) and tie (8:1; player and banker bets push on a tie).
 *
 * exactEdges() works the edges out exactly by walking every way the six cards can fall from the shoe (card values only,
 * so 10^6 paths), weighting each by its probability without replacement: banker 1.06%, player 1.24%, tie 14.36%.
 */
(function (root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) { module.exports = api; return; }
    root.OpenVibeBaccarat = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    const node = typeof module === 'object' && module.exports;
    const rngLib = node ? require('./rng') : root.OpenVibeRng;
    const cardsLib = node ? require('./cards') : root.OpenVibeCards;

    const PAYS = Object.freeze({ player: 1, banker: 0.95, tie: 8 });
    const value = (card) => (card.rank >= 10 ? 0 : card.rank);
    const total = (vals) => vals.reduce((a, v) => a + v, 0) % 10;

    /** Does the banker draw, given its total and the player's third card value (null when the player stood)? */
    function bankerDraws(bankerTotal, playerThird) {
        if (playerThird == null) return bankerTotal <= 5;
        if (bankerTotal <= 2) return true;
        if (bankerTotal === 3) return playerThird !== 8;
        if (bankerTotal === 4) return playerThird >= 2 && playerThird <= 7;
        if (bankerTotal === 5) return playerThird >= 4 && playerThird <= 7;
        if (bankerTotal === 6) return playerThird === 6 || playerThird === 7;
        return false;
    }

    /** Play a coup from six card values in deal order (p1, b1, p2, b2, then the thirds as needed). */
    function coup(next) {
        const p = [next(), 0]; const b = [next(), 0];
        p[1] = next(); b[1] = next();
        let pt = total(p); let bt = total(b);
        let playerThird = null;
        if (pt < 8 && bt < 8) {
            if (pt <= 5) { playerThird = next(); p.push(playerThird); pt = total(p); }
            if (bankerDraws(bt, playerThird)) { b.push(next()); bt = total(b); }
        }
        return { player: p, banker: b, playerTotal: pt, bankerTotal: bt, winner: pt > bt ? 'player' : bt > pt ? 'banker' : 'tie' };
    }

    function net(bet, winner, amount = 1) {
        if (bet === 'tie') return winner === 'tie' ? amount * PAYS.tie : -amount;
        if (winner === 'tie') return 0;
        return winner === bet ? amount * PAYS[bet] : -amount;
    }

    /** The exact edges for a fresh shoe of `decks` decks (Wizard of Odds lists 1.06 / 1.24 / 14.36 for eight). */
    function exactEdges(decks = 8) {
        const counts = [16 * decks, 4 * decks, 4 * decks, 4 * decks, 4 * decks, 4 * decks, 4 * decks, 4 * decks, 4 * decks, 4 * decks];
        let left = 52 * decks;
        const odds = { player: 0, banker: 0, tie: 0 };
        // Depth-first over card values; a coup never needs more than six cards.
        function walk(drawn, prob) {
            let i = 0;
            const seq = drawn;
            const next = () => { const v = seq[i]; i += 1; return v; };
            const need = needed(seq);
            if (need === 0) { const c = coup(next); odds[c.winner] += prob; return; }
            for (let v = 0; v < 10; v += 1) {
                if (!counts[v]) continue;
                const p = prob * counts[v] / left;
                counts[v] -= 1; left -= 1;
                walk(seq.concat(v), p);
                counts[v] += 1; left += 1;
            }
        }
        // How many more cards the coup needs given the values drawn so far (0 when it is complete).
        function needed(seq) {
            if (seq.length < 4) return 4 - seq.length;
            const pt = (seq[0] + seq[2]) % 10; const bt = (seq[1] + seq[3]) % 10;
            if (pt >= 8 || bt >= 8) return 0;
            if (pt <= 5) {
                if (seq.length < 5) return 1;
                return bankerDraws(bt, seq[4]) && seq.length < 6 ? 1 : 0;
            }
            return bankerDraws(bt, null) && seq.length < 5 ? 1 : 0;
        }
        walk([], 1);
        const edge = (bet) => -(['player', 'banker', 'tie'].reduce((a, w) => a + odds[w] * net(bet, w), 0));
        return { odds, edges: { player: edge('player'), banker: edge('banker'), tie: edge('tie') } };
    }

    function createGame({ decks = 8, seed = 1, rng = null } = {}) {
        const g = rng || rngLib.createRng(seed);
        let shoe = [];
        const draw = () => { if (shoe.length < 14) shoe = g.shuffle(cardsLib.makeShoe(decks)); return shoe.pop(); };
        return {
            /** Deal one coup and settle the bets ({ bet: player|banker|tie, amount }). */
            deal(bets = []) {
                const cards = [];
                const c = coup(() => { const card = draw(); cards.push(card); return value(card); });
                // Put the real cards back on their hands in deal order: p1 b1 p2 b2, then the player's third, the banker's.
                const p = [cards[0], cards[2]]; const b = [cards[1], cards[3]];
                let k = 4;
                if (c.player.length === 3) { p.push(cards[k]); k += 1; }
                if (c.banker.length === 3) b.push(cards[k]);
                const results = bets.map((x) => ({ ...x, net: net(x.bet, c.winner, x.amount) }));
                return { ...c, playerCards: p, bankerCards: b, results, net: results.reduce((a, x) => a + x.net, 0) };
            },
        };
    }

    function houseEdge({ bet = 'banker', coups = 200000, seed = 20261031, onProgress = null } = {}) {
        const every = Math.max(100, Math.floor(coups / 200));   // about 200 progress points a run
        const game = createGame({ seed });
        let sum = 0; let squares = 0;
        for (let i = 0; i < coups; i += 1) {
            const n = game.deal([{ bet, amount: 1 }]).net;
            sum += n; squares += n * n;
            if (onProgress && (i + 1) % every === 0) onProgress(i + 1, -sum / (i + 1));
        }
        const mean = sum / coups;
        const sd = Math.sqrt(Math.max(0, squares / coups - mean * mean));
        return { game: 'baccarat', bet, coups, edge: -mean, percent: -mean * 100, stderr: (sd / Math.sqrt(coups)) * 100 };
    }

    return { PAYS, bankerDraws, coup, net, exactEdges, createGame, houseEdge, value };
});

'use strict';

/**
 * Blackjack: a six-deck shoe, the dealer stands on soft 17 (a table rule; hitting soft 17 is the other), double on any
 * two cards and after a split, split up to four hands, split aces take one card each, the dealer peeks under an ace or
 * a ten, insurance pays 2:1 and a blackjack 3:2. Pure: it takes a seeded generator and returns state, so the same seed
 * deals the same cards on the server, in the browser and in a Web Worker.
 *
 * strategies: basic (the multi-deck chart, S17, double after split), dealer (hit below 17, as the dealer does) and
 * never-bust (stand on any hard 12 or more). houseEdge() plays one of them for many hands and measures what the house
 * keeps; test/engines.test.js checks basic strategy against the published figure for these rules.
 */
(function (root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) { module.exports = api; return; }
    root.OpenVibeBlackjack = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    const node = typeof module === 'object' && module.exports;
    const cardsLib = node ? require('./cards') : root.OpenVibeCards;
    const rngLib = node ? require('./rng') : root.OpenVibeRng;
    const { handValue, isBlackjack } = cardsLib;

    const DEFAULT_RULES = Object.freeze({ decks: 6, dealerHitsSoft17: false, doubleAfterSplit: true, maxHands: 4, blackjackPays: 1.5, penetration: 0.75 });

    // The published figure for these rules: 6 decks, S17, DAS, no surrender, 3:2, peek.
    const PUBLISHED = Object.freeze({ percent: 0.40, source: 'Wizard of Odds, blackjack house edge calculator', url: 'https://wizardofodds.com/games/blackjack/calculator/' });

    // Basic strategy for 4 to 8 decks, dealer stands on soft 17, double after split (the standard chart).
    // Dealer up card as 2..11 (11 is the ace). H hit, S stand, D double else hit, Ds double else stand, P split.
    function chart(cards, dealerUp, canSplit) {
        const v = handValue(cards);
        const d = dealerUp;
        const in_ = (lo, hi) => d >= lo && d <= hi;
        if (canSplit && cards.length === 2 && rankValue(cards[0]) === rankValue(cards[1])) {
            const p = rankValue(cards[0]);
            if (p === 11 || p === 8) return 'P';
            if ((p === 2 || p === 3 || p === 7) && in_(2, 7)) return 'P';
            if (p === 4 && in_(5, 6)) return 'P';
            if (p === 6 && in_(2, 6)) return 'P';
            if (p === 9 && (in_(2, 6) || in_(8, 9))) return 'P';
        }
        if (v.soft && cards.length >= 2) {
            const t = v.total;
            if (t >= 19) return 'S';
            if (t === 18) return in_(3, 6) ? 'Ds' : in_(2, 8) ? 'S' : 'H';
            if (t === 17) return in_(3, 6) ? 'D' : 'H';
            if (t === 15 || t === 16) return in_(4, 6) ? 'D' : 'H';
            if (t === 13 || t === 14) return in_(5, 6) ? 'D' : 'H';
            return 'H';
        }
        const t = v.total;
        if (t >= 17) return 'S';
        if (t >= 13) return in_(2, 6) ? 'S' : 'H';
        if (t === 12) return in_(4, 6) ? 'S' : 'H';
        if (t === 11) return d === 11 ? 'H' : 'D';
        if (t === 10) return in_(2, 9) ? 'D' : 'H';
        if (t === 9) return in_(3, 6) ? 'D' : 'H';
        return 'H';
    }
    const rankValue = (c) => (c.rank === 1 ? 11 : Math.min(10, c.rank));

    /** The chart's move as one of the actions the table offers now. */
    function basicMove(cards, dealerUp, options) {
        const code = chart(cards, dealerUp, options.includes('split'));
        if (code === 'P') return 'split';
        if (code === 'D') return options.includes('double') ? 'double' : 'hit';
        if (code === 'Ds') return options.includes('double') ? 'double' : 'stand';
        return code === 'S' ? 'stand' : 'hit';
    }

    const STRATEGIES = {
        basic: { name: 'Basic strategy', move: basicMove },
        dealer: { name: 'Play like the dealer', move: (cards) => (handValue(cards).total < 17 ? 'hit' : 'stand') },
        'never-bust': { name: 'Never bust', move: (cards) => { const v = handValue(cards); return v.total <= 11 || (v.soft && v.total < 18) ? 'hit' : 'stand'; } },
    };

    function createGame({ rules = DEFAULT_RULES, seed = 1, rng = null } = {}) {
        const r = { ...DEFAULT_RULES, ...(rules || {}) };
        const g = rng || rngLib.createRng(seed);
        const shoeSize = r.decks * 52;
        let shoe = [];
        let hands = [];
        let dealer = [];
        let current = 0;
        let phase = 'idle';            // idle | insurance | player | done
        let insurance = 0;             // the insurance stake (half the bet) when taken
        let outcome = null;

        const draw = () => {
            if (shoe.length < shoeSize * (1 - r.penetration)) shoe = g.shuffle(cardsLib.makeShoe(r.decks));
            return shoe.pop();
        };
        const upCard = () => dealer[0];
        const dealerUpValue = () => rankValue(upCard());

        function start(bet = 1) {
            if (phase === 'player' || phase === 'insurance') throw new Error('a hand is in play');
            const stake = Math.max(1, Math.floor(Number(bet) || 1));
            hands = [{ cards: [draw()], bet: stake, done: false, split: false, splitAces: false }];
            dealer = [draw()];
            hands[0].cards.push(draw());
            dealer.push(draw());
            current = 0;
            insurance = 0;
            outcome = null;
            if (upCard().rank === 1) { phase = 'insurance'; return state(); }
            return afterPeek();
        }

        function afterPeek() {
            const up10 = upCard().rank === 1 || upCard().rank >= 10;
            if ((up10 && isBlackjack(dealer)) || isBlackjack(hands[0].cards)) return finish();
            phase = 'player';
            return state();
        }

        function available() {
            if (phase === 'insurance') return ['insure', 'no-insurance'];
            if (phase !== 'player') return [];
            const h = hands[current];
            const out = ['hit', 'stand'];
            const two = h.cards.length === 2;
            if (two && (!h.split || r.doubleAfterSplit)) out.push('double');
            if (two && rankValue(h.cards[0]) === rankValue(h.cards[1]) && hands.length < r.maxHands && !h.splitAces) out.push('split');
            return out;
        }

        function act(action) {
            const options = available();
            if (!options.includes(action)) return { ok: false, error: `not now: ${action}`, state: state() };
            if (phase === 'insurance') {
                if (action === 'insure') insurance = hands[0].bet / 2;
                return { ok: true, state: afterPeek() };
            }
            const h = hands[current];
            if (action === 'hit') {
                h.cards.push(draw());
                if (handValue(h.cards).total >= 21) h.done = true;
            } else if (action === 'stand') {
                h.done = true;
            } else if (action === 'double') {
                h.bet *= 2;
                h.cards.push(draw());
                h.done = true;
            } else if (action === 'split') {
                const aces = h.cards[0].rank === 1;
                const second = { cards: [h.cards.pop(), draw()], bet: h.bet, done: false, split: true, splitAces: aces };
                h.cards.push(draw());
                h.split = true;
                h.splitAces = aces;
                hands.splice(current + 1, 0, second);
                if (aces) { h.done = true; second.done = true; }
                else if (handValue(h.cards).total === 21) h.done = true;
            }
            while (current < hands.length && hands[current].done) current += 1;
            if (current < hands.length && handValue(hands[current].cards).total === 21) { hands[current].done = true; current += 1; }
            if (current >= hands.length) finish();
            return { ok: true, state: state() };
        }

        function dealerPlays() {
            if (hands.every((h) => handValue(h.cards).bust)) return;
            for (;;) {
                const v = handValue(dealer);
                if (v.total < 17 || (v.total === 17 && v.soft && r.dealerHitsSoft17)) dealer.push(draw());
                else break;
            }
        }

        function finish() {
            const natural = hands.length === 1 && isBlackjack(hands[0].cards) && !hands[0].split;
            const dealerNatural = isBlackjack(dealer);
            if (!natural && !dealerNatural) dealerPlays();
            const dv = handValue(dealer);
            const results = hands.map((h) => {
                const v = handValue(h.cards);
                let result; let net;
                if (natural && !dealerNatural) { result = 'blackjack'; net = h.bet * r.blackjackPays; }
                else if (natural && dealerNatural) { result = 'push'; net = 0; }
                else if (dealerNatural) { result = 'lose'; net = -h.bet; }
                else if (v.bust) { result = 'bust'; net = -h.bet; }
                else if (dv.bust || v.total > dv.total) { result = 'win'; net = h.bet; }
                else if (v.total < dv.total) { result = 'lose'; net = -h.bet; }
                else { result = 'push'; net = 0; }
                return { result, net, bet: h.bet, total: v.total };
            });
            const insuranceNet = insurance ? (dealerNatural ? insurance * 2 : -insurance) : 0;
            outcome = { results, insurance: insuranceNet, net: results.reduce((a, x) => a + x.net, 0) + insuranceNet, dealer: dv.total, dealerBust: dv.bust, dealerBlackjack: dealerNatural };
            phase = 'done';
            return state();
        }

        function hint() {
            const options = available();
            if (phase === 'insurance') return 'no-insurance';
            if (phase !== 'player') return null;
            return basicMove(hands[current].cards, dealerUpValue(), options);
        }

        function state() {
            return {
                phase,
                current,
                hands: hands.map((h) => ({ cards: h.cards.slice(), bet: h.bet, total: handValue(h.cards).total, soft: handValue(h.cards).soft, done: h.done })),
                dealer: phase === 'done' ? dealer.slice() : [dealer[0]],
                dealerTotal: phase === 'done' ? handValue(dealer).total : null,
                insurance,
                outcome,
            };
        }

        return { start, act, available, hint, state, get phase() { return phase; }, get outcome() { return outcome; }, rules: r };
    }

    /** Play one strategy for many hands; the house edge is what the player loses per unit first bet. */
    function houseEdge({ rules = DEFAULT_RULES, hands = 200000, seed = 20261031, strategy = 'basic', onProgress = null } = {}) {
        const every = Math.max(100, Math.floor(hands / 200));   // about 200 progress points a run
        const game = createGame({ rules, seed });
        const plan = STRATEGIES[strategy] || STRATEGIES.basic;
        let sum = 0; let squares = 0;
        for (let i = 0; i < hands; i += 1) {
            game.start(1);
            if (game.phase === 'insurance') game.act('no-insurance');
            while (game.phase === 'player') {
                const s = game.state();
                const options = game.available();
                const move = plan.move(s.hands[s.current].cards, rankValue(s.dealer[0]), options);
                game.act(options.includes(move) ? move : 'stand');
            }
            const net = game.outcome.net;
            sum += net; squares += net * net;
            if (onProgress && (i + 1) % every === 0) onProgress(i + 1, -sum / (i + 1));
        }
        const mean = sum / hands;
        const sd = Math.sqrt(Math.max(0, squares / hands - mean * mean));
        return { game: 'blackjack', strategy, hands, edge: -mean, percent: -mean * 100, stderr: (sd / Math.sqrt(hands)) * 100 };
    }

    return { DEFAULT_RULES, PUBLISHED, STRATEGIES, createGame, houseEdge, chart, basicMove };
});

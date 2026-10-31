'use strict';
/**
 * The engines against the published figures (Wizard of Odds, each game's page): every exact edge to the digit the
 * figure is published to, the blackjack basic-strategy simulation within its margin of error, and the rules that make
 * those numbers true (the third-card tableau, the craps line, the roulette layout, the slot strips). A seed always
 * deals the same cards.
 */
const assert = require('assert');
const { check, done } = require('./helpers/boot');
const blackjack = require('../engine/blackjack');
const roulette = require('../engine/roulette');
const baccarat = require('../engine/baccarat');
const craps = require('../engine/craps');
const slots = require('../engine/slots');
const games = require('../engine/games');

const near = (actual, expected, tol, what) => assert.ok(Math.abs(actual - expected) <= tol, `${what}: ${actual} is not within ${tol} of ${expected}`);

(async () => {
    await check('roulette: every bet costs the zeros, exactly; the American top line costs 7.89%', () => {
        near(roulette.edge({ type: 'red' }, 'european') * 100, 2.70, 0.005, 'European');
        near(roulette.edge({ type: 'straight', numbers: ['17'] }, 'american') * 100, 5.26, 0.005, 'American');
        near(roulette.edge({ type: 'top' }, 'american') * 100, 7.89, 0.005, 'top line');
        assert.strictEqual(roulette.covers({ type: 'red' }).length, 18);
        assert.strictEqual(roulette.covers({ type: 'column', which: 1 }).join(','), '1,4,7,10,13,16,19,22,25,28,31,34');
        assert.strictEqual(roulette.covers({ type: 'straight', numbers: ['00'] }, 'european'), null, 'no 00 on a European wheel');
        assert.strictEqual(roulette.payout({ type: 'corner', numbers: ['1', '2', '4', '5'] }), 8);
        const r = roulette.settle([{ type: 'red', amount: 10 }, { type: 'straight', numbers: ['3'], amount: 1 }], '3');
        assert.deepStrictEqual([r.colour, r.net], ['red', 10 + 35]);
    });

    await check('baccarat: the exact edges for eight decks are the published 1.06 / 1.24 / 14.36', () => {
        const e = baccarat.exactEdges(8).edges;
        near(e.banker * 100, 1.06, 0.005, 'banker');
        near(e.player * 100, 1.24, 0.005, 'player');
        near(e.tie * 100, 14.36, 0.005, 'tie');
        assert.strictEqual(baccarat.bankerDraws(3, 8), false, 'banker 3 stands on a player 8');
        assert.strictEqual(baccarat.bankerDraws(6, 7), true, 'banker 6 draws on a player 6 or 7');
        assert.strictEqual(baccarat.bankerDraws(5, null), true, 'with no player third card, the banker draws on 0-5');
        assert.strictEqual(baccarat.net('banker', 'banker', 100), 95);
        assert.strictEqual(baccarat.net('player', 'tie', 100), 0, 'a tie pushes the player and banker bets');
    });

    await check('craps: pass 1.41%, don\'t pass 1.36%, place 6 1.52%, odds 0%, field 5.56%', () => {
        const e = craps.exactEdges();
        near(e.pass * 100, 1.41, 0.005, 'pass');
        near(e.dontPass * 100, 1.36, 0.005, 'don\'t pass');
        near(e.place[6] * 100, 1.52, 0.005, 'place 6');
        near(e.place[5] * 100, 4.00, 0.005, 'place 5');
        near(e.place[4] * 100, 6.67, 0.005, 'place 4');
        near(e.field * 100, 5.56, 0.005, 'field');
        for (const pt of craps.POINTS) near(e.odds[pt], 0, 1e-12, `odds on ${pt}`);
        const t = craps.createGame({ seed: 3 });
        assert.strictEqual(t.bet('odds', 5).ok, false, 'no odds before a point');
        assert.strictEqual(t.bet('place', 5, 7).ok, false, 'no place bet on 7');
    });

    await check('slots: the RTP is counted over every stop, and spinning agrees', () => {
        const x = slots.exact();
        assert.strictEqual(x.spins, 24 ** 3);
        assert.ok(x.rtp > 0.85 && x.rtp < 0.99, `a believable machine returns 85-99%: ${x.rtp}`);
        near(x.edge, 1 - x.rtp, 1e-12, 'edge');
        const sim = slots.houseEdge({ spins: 300000, seed: 4 });
        near(sim.percent, x.edge * 100, 4 * sim.stderr, 'simulated edge');
    });

    await check('blackjack: basic strategy lands on the published 0.40% within its margin; naive play costs far more', () => {
        const r = blackjack.houseEdge({ hands: 600000, seed: 99 });
        near(r.percent, blackjack.PUBLISHED.percent, Math.max(0.25, 3 * r.stderr), 'basic strategy');
        const dealer = blackjack.houseEdge({ strategy: 'dealer', hands: 200000, seed: 5 });
        assert.ok(dealer.percent > 4 && dealer.percent < 7.5, `playing like the dealer costs about 5.5%: ${dealer.percent}`);
    });

    await check('blackjack: the chart says what every chart says, and a seed deals the same hand', () => {
        const c = (r) => ({ rank: r, suit: 0 });
        assert.strictEqual(blackjack.chart([c(10), c(6)], 10, false), 'H', '16 hits a ten');
        assert.strictEqual(blackjack.chart([c(10), c(2)], 4, false), 'S', '12 stands on a four');
        assert.strictEqual(blackjack.chart([c(6), c(5)], 10, false), 'D', '11 doubles on a ten');
        assert.strictEqual(blackjack.chart([c(8), c(8)], 10, true), 'P', 'always split eights');
        assert.strictEqual(blackjack.chart([c(1), c(7)], 9, false), 'H', 'soft 18 hits a nine');
        const a = blackjack.createGame({ seed: 42 }); const b = blackjack.createGame({ seed: 42 });
        assert.deepStrictEqual(a.start(10), b.start(10));
        const g = blackjack.createGame({ seed: 7 });
        g.start(10);
        if (g.phase === 'insurance') g.act('no-insurance');
        assert.strictEqual(g.act('nonsense').ok, false, 'an action the table does not offer is refused');
    });

    await check('the catalogue reads every edge from the engines, cheapest first per game', () => {
        for (const g of games.catalogue()) {
            assert.ok(g.bets.length && g.source && /^https:\/\//.test(g.source.url), g.id);
            for (const b of g.bets) assert.ok(Number.isFinite(b.edge) && b.edge >= 0 && b.edge < 20, `${g.id}/${b.id}`);
        }
        assert.strictEqual(games.lowest(games.get('craps')).id, 'odds');
    });
    done();
})().catch((e) => { console.error(e); process.exit(1); });

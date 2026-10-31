'use strict';

/**
 * The games and what each bet costs. Every edge here is computed by the engines (exactly where the maths allows, by the
 * blackjack simulation otherwise), never typed in, and each sits next to the published figure it is checked against
 * (test/engines.test.js). The API (GET /api/v1/games) and every page read this one list.
 */
const blackjack = require('./blackjack');
const roulette = require('./roulette');
const baccarat = require('./baccarat');
const craps = require('./craps');
const slots = require('./slots');

const WIZARD = 'https://wizardofodds.com/games/';
let cached = null;
// The blackjack strategies with no exact figure are measured once, on a fixed seed, so every page shows the same number.
const SIM_HANDS = 400000;
const measured = (strategy) => Math.round(blackjack.houseEdge({ strategy, hands: SIM_HANDS, seed: 20261031 }).percent * 100) / 100;

function catalogue() {
    if (cached) return cached;
    const pct = (x) => Math.round(x * 100000) / 1000;            // a fraction → percent, three decimals
    const bac = baccarat.exactEdges(8).edges;
    const cr = craps.exactEdges();
    const sl = slots.exact();
    const games = [
        {
            id: 'blackjack', name: 'Blackjack', line: 'Beat the dealer\'s hand without going over 21.',
            rules: 'Six decks, the dealer stands on soft 17, double on any two cards and after a split, blackjack pays 3:2.',
            bets: [
                { id: 'basic', name: 'Basic strategy', edge: blackjack.PUBLISHED.percent, how: 'published, and our simulation agrees' },
                { id: 'dealer', name: 'Playing like the dealer', edge: measured('dealer'), how: `simulation, ${SIM_HANDS.toLocaleString('en-US')} hands` },
                { id: 'never-bust', name: 'Never busting', edge: measured('never-bust'), how: `simulation, ${SIM_HANDS.toLocaleString('en-US')} hands` },
            ],
            best: 'basic', source: { name: 'Wizard of Odds, blackjack', url: `${WIZARD}blackjack/` },
        },
        {
            id: 'roulette', name: 'Roulette', line: 'One ball, 37 or 38 pockets, every bet the same price.',
            rules: 'European wheel: one zero. American wheel: 0 and 00. A bet on n numbers pays 36/n − 1 to one.',
            bets: [
                { id: 'european', name: 'Any bet, European wheel', edge: pct(roulette.edge({ type: 'red' }, 'european')), how: 'exact' },
                { id: 'american', name: 'Any bet, American wheel', edge: pct(roulette.edge({ type: 'red' }, 'american')), how: 'exact' },
                { id: 'american-top', name: 'The top line (0, 00, 1, 2, 3), American', edge: pct(roulette.edge({ type: 'top' }, 'american')), how: 'exact' },
            ],
            best: 'european', source: { name: 'Wizard of Odds, roulette', url: `${WIZARD}roulette/` },
        },
        {
            id: 'baccarat', name: 'Baccarat', line: 'Bet on the player, the banker or a tie; the cards decide everything.',
            rules: 'Eight decks. Naturals stand, the player draws on 0 to 5, the banker follows the tableau. Banker wins pay 0.95.',
            bets: [
                { id: 'banker', name: 'Banker', edge: pct(bac.banker), how: 'exact' },
                { id: 'player', name: 'Player', edge: pct(bac.player), how: 'exact' },
                { id: 'tie', name: 'Tie (8 to 1)', edge: pct(bac.tie), how: 'exact' },
            ],
            best: 'banker', source: { name: 'Wizard of Odds, baccarat', url: `${WIZARD}baccarat/` },
        },
        {
            id: 'craps', name: 'Craps', line: 'Two dice, one point, and the best-priced bet in the house.',
            rules: 'Pass wins on 7 or 11 and loses on 2, 3 or 12; any other total is the point, which must come before a 7. Odds behind the line pay true odds.',
            bets: [
                { id: 'odds', name: 'Free odds', edge: pct(cr.odds[6]), how: 'exact' },
                { id: 'dontPass', name: 'Don\'t pass', edge: pct(cr.dontPass), how: 'exact' },
                { id: 'pass', name: 'Pass line', edge: pct(cr.pass), how: 'exact' },
                { id: 'place6', name: 'Place 6 or 8', edge: pct(cr.place[6]), how: 'exact' },
                { id: 'place5', name: 'Place 5 or 9', edge: pct(cr.place[5]), how: 'exact' },
                { id: 'field', name: 'Field', edge: pct(cr.field), how: 'exact' },
                { id: 'place4', name: 'Place 4 or 10', edge: pct(cr.place[4]), how: 'exact' },
            ],
            best: 'pass', source: { name: 'Wizard of Odds, craps', url: `${WIZARD}craps/` },
        },
        {
            id: 'slots', name: 'Slots', line: 'A machine with its insides printed on the front.',
            rules: `Three reels of 24 stops, a paytable, and every stop equally likely. Return to player ${pct(sl.rtp)}%, a win on ${Math.round(sl.hitRate * 100)}% of spins.`,
            bets: [{ id: 'spin', name: 'One spin', edge: pct(sl.edge), how: 'exact' }],
            best: 'spin', rtp: pct(sl.rtp), hitRate: sl.hitRate, volatility: sl.volatility,
            source: { name: 'How slot machines work (the maths here is this machine\'s own)', url: `${WIZARD}slots/` },
        },
    ];
    cached = games;
    return games;
}

const get = (id) => catalogue().find((g) => g.id === id) || null;
const lowest = (g) => g.bets.reduce((a, b) => (b.edge < a.edge ? b : a), g.bets[0]);

module.exports = { catalogue, get, lowest, engines: { blackjack, roulette, baccarat, craps, slots } };

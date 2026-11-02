'use strict';

/**
 * Casino's pages (plan 2026-10-28 §5.14: learn it, play it, never pay it). Every number on them comes from the engines
 * (engine/games.js), and every page reads whole without JavaScript; the tables and the simulator are the parts that
 * need it, and say so.
 *
 *   home()            the motif, every bet's house edge on one ladder, a real bankroll chart, what you can do, questions
 *   playIndex()       every table
 *   table({ game })   one table's shell (public/js/casino.js deals the cards)
 *   learnIndex(), learn({ game })   the rules, the odds and each bet's edge, with the engine's own tables
 *   simulate({ game, choice })      the simulator (a Web Worker runs the engines)
 *   shared({ sim })   a shared simulation
 *   safe()            play safe: what this is, and where to get help
 *   developers(), notFound()
 */
const sc = require('openvibe-shared/showcase');
const kit = require('openvibe-shared/kit');
const { esc } = require('../render/html');
const games = require('../../engine/games');

const HELP = [
    { name: '1-800-GAMBLER', where: 'United States, free and confidential, any hour', href: 'https://www.1800gambler.net/' },
    { name: 'BeGambleAware', where: 'United Kingdom: support, tools and the National Gambling Helpline', href: 'https://www.begambleaware.org/' },
    { name: 'Gamblers Anonymous', where: 'meetings worldwide', href: 'https://www.gamblersanonymous.org/' },
];
const GAME_TONE = { blackjack: '#2f9e5b', roulette: '#c2410c', baccarat: '#7c3aed', craps: '#0e7490', slots: '#b45309' };
const pct = (x, d = 2) => `${Number(x).toFixed(d)}%`;

/** A calm line under every table and on the home: what this is, and where help is. */
function safeLine() {
    return `<p class="cs-safe-line">${kit.icon('heart')}<span>Play chips are free and worth nothing. Real gambling costs real money; if it stops being fun, <a href="/safe">help is one call away</a>.</span></p>`;
}

/** The room's motif: a fan of cards, a short stack of chips, and the probability curve drawing beneath them. */
function motif() {
    const card = (rank, suit, red, n) => `<span class="cs-mc cs-mc-${n}${red ? ' is-red' : ''}"><b>${rank}</b><i>${suit}</i></span>`;
    return `<div class="cs-motif" aria-hidden="true">
<div class="cs-fan">${card('A', '♠', false, 1)}${card('K', '♥', true, 2)}${card('Q', '♦', true, 3)}${card('J', '♣', false, 4)}</div>
<div class="cs-chips"><span></span><span></span><span></span><span></span></div>
<svg class="cs-curve" viewBox="0 0 300 80" preserveAspectRatio="none"><path d="M0 76 C 60 74, 90 70, 120 50 S 160 6, 180 6 S 220 40, 250 66 S 290 76, 300 76" fill="none" stroke="currentColor" stroke-width="2.5" pathLength="100"/></svg>
</div>`;
}

/** Every bet of every game on one ladder, cheapest first: the page's real content, straight from the engines. */
function edgeLadder() {
    const rows = [];
    for (const g of games.catalogue()) for (const b of g.bets) rows.push({ game: g, bet: b });
    rows.sort((a, b) => a.bet.edge - b.bet.edge);
    const max = Math.max(...rows.map((r) => r.bet.edge));
    return `<section class="cs-section" id="cs-ladder" aria-labelledby="cs-ladder-h">
<div class="cs-head"><h2 id="cs-ladder-h">What each bet costs</h2><p>What the house keeps from every 100 chips bet, over the long run. Worked out by the engines this site plays with; the published figures agree.</p></div>
<ol class="cs-ladder">${rows.map(({ game, bet }) => `<li style="--tone:${GAME_TONE[game.id]};--w:${Math.max(0.6, (bet.edge / max) * 100).toFixed(1)}%"><a href="/learn/${game.id}"><span class="cs-l-game">${esc(game.name)}</span><span class="cs-l-bet"><span class="cs-l-g2">${esc(game.name)} · </span>${esc(bet.name)}</span><span class="cs-l-bar"><i></i></span><b class="cs-l-edge">${pct(bet.edge)}</b></a></li>`).join('')}</ol>
<p class="cs-fine">Blackjack's figure assumes perfect basic strategy; every other figure is exact. ${games.catalogue().map((g) => `<a href="${esc(g.source.url)}" rel="noopener">${esc(g.source.name)}</a>`).join(' · ')}.</p>
</section>`;
}

/** Five real bankroll paths: basic-strategy blackjack, 1,000 chips, 400 hands of 10 each, one seed per path. */
function bankrollChart() {
    const { blackjack } = games.engines;
    const W = 320; const H = 150; const HANDS = 400; const START = 1000; const BET = 10;
    const paths = [];
    let lo = START; let hi = START;
    for (let p = 0; p < 5; p += 1) {
        const game = blackjack.createGame({ seed: 1031 + p * 7919 });
        let bank = START; const pts = [bank];
        for (let i = 0; i < HANDS; i += 1) {
            game.start(BET);
            if (game.phase === 'insurance') game.act('no-insurance');
            while (game.phase === 'player') game.act(game.hint());
            bank += game.outcome.net; pts.push(bank);
        }
        lo = Math.min(lo, ...pts); hi = Math.max(hi, ...pts);
        paths.push(pts);
    }
    const y = (v) => (H - 8 - ((v - lo) / Math.max(1, hi - lo)) * (H - 16)).toFixed(1);
    const line = (pts) => pts.map((v, i) => `${i ? 'L' : 'M'}${((i / HANDS) * W).toFixed(1)} ${y(v)}`).join(' ');
    const ends = paths.map((p) => p[p.length - 1]);
    return `<figure class="cs-bank" role="img" aria-label="Five players' chips over 400 hands of blackjack with basic strategy: they end at ${ends.join(', ')} of 1,000">
<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><line x1="0" x2="${W}" y1="${y(START)}" y2="${y(START)}" class="cs-bank-start"/>${paths.map((p, i) => `<path d="${line(p)}" class="cs-bank-p cs-bank-p${i}" pathLength="100"/>`).join('')}</svg>
<figcaption>Five players, 400 hands of basic strategy, 1,000 chips each. They end at ${ends.map((v) => v.toLocaleString('en-US')).join(', ')}.</figcaption>
</figure>`;
}

function chipStack() {
    return `<div class="cs-stack" aria-hidden="true"><span class="c1">5</span><span class="c2">25</span><span class="c3">100</span><span class="c4">500</span><b>1,000 chips a day · worth nothing</b></div>`;
}

/** The engine's own basic-strategy chart for hard totals: the cell the player should learn first. */
function hardChart({ compact = false } = {}) {
    const { blackjack } = games.engines;
    const ups = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const card = (r) => ({ rank: r, suit: 0 });
    const totals = compact ? [9, 10, 11, 12, 13, 16] : [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
    const handFor = (t) => (t <= 10 ? [card(2), card(t - 2)] : t <= 19 ? [card(10), card(t - 10)] : [card(10), card(10)]);
    const label = { H: 'H', S: 'S', D: 'D', Ds: 'D', P: 'P' };
    return `<div class="cs-chart-wrap" tabindex="0" role="region" aria-label="Basic strategy chart"><table class="cs-chart"><caption>Hard totals: what basic strategy says against the dealer's card</caption><thead><tr><th scope="col">You</th>${ups.map((u) => `<th scope="col">${u === 11 ? 'A' : u}</th>`).join('')}</tr></thead><tbody>${totals.map((t) => `<tr><th scope="row">${t}</th>${ups.map((u) => { const c = blackjack.chart(handFor(t), u, false); return `<td class="is-${label[c]}">${label[c]}</td>`; }).join('')}</tr>`).join('')}</tbody></table><p class="cs-fine">H hit · S stand · D double (hit when you cannot)</p></div>`;
}

function home({ sims = 0 } = {}) {
    const bj = games.get('blackjack'); const bac = games.get('baccarat'); const rou = games.get('roulette');
    const room = sc.room({
        room: 'casino',
        hero: {
            title: 'Learn it, play it, never pay it',
            lede: 'Every casino game with its insides showing: the rules, the exact odds, and what each bet really costs. Play with chips worth nothing, and watch a million hands play out in seconds.',
            start: { href: '/play', label: 'Pick a table' },
            chips: [{ label: 'Learn the odds', href: '/learn' }, { label: 'Simulate', href: '/simulate' }, { label: 'Play safe', href: '/safe' }],
            motif: motif(),
        },
        // Real numbers only (the room kit leaves a zero out): what the cheapest bets cost, from the engines.
        proof: [
            { value: pct(bj.bets[0].edge), label: 'blackjack, basic strategy' },
            { value: pct(bac.bets[0].edge), label: 'baccarat, banker' },
            { value: pct(rou.bets[0].edge), label: 'European roulette' },
            ...(sims ? [{ value: sims, label: sims === 1 ? 'shared run' : 'shared runs' }] : []),
        ],
        scenes: [
            { title: 'Play with nothing at stake', text: 'A thousand play chips every day, free, gone at midnight. They cannot be bought, won as anything, or cashed out, so the only thing on the table is learning how the game works.', html: chipStack(), action: { href: '/play', label: 'Pick a table' } },
            { title: 'Watch the house edge happen', text: 'Run a million hands in your browser and see what the house keeps, measured, next to the exact figure. Short runs swing wildly; long ones never miss.', html: bankrollChart(), action: { href: '/simulate', label: 'Run a simulation' } },
            { title: 'Learn the move, not a superstition', text: 'Basic strategy is a table worked out from the cards, not a feeling. The table plays it as a hint when you want one, and Learn shows why each cell is what it is.', html: hardChart({ compact: true }), action: { href: '/learn/blackjack', label: 'Learn blackjack' } },
        ],
        faq: { items: [
            ['Is this gambling?', 'No. Play chips cannot be bought, sold, won as anything or cashed out, and a fresh stack arrives each day. This is a place to learn how the games work and what they cost.'],
            ['Where do the numbers come from?', 'From the same engines the tables play with. Roulette, baccarat, craps and the slot machine are worked out exactly; blackjack strategy is simulated. Each figure sits next to the published one it is checked against.'],
            ['Is there a way to win in the long run?', 'Not with these bets: every one of them has a house edge, and the simulator shows it arriving. The free odds bet in craps is the only one at 0%, and it is only allowed next to a bet that is not.'],
            ['What if gambling is a problem for me?', 'Call 1-800-GAMBLER in the United States, or see BeGambleAware in the United Kingdom. Both are free and confidential. The Play safe page has more.'],
        ] },
    });
    const at = room.indexOf('<section class="sc-room-scenes"');
    const page = at < 0 ? edgeLadder() + room : room.slice(0, at) + edgeLadder() + room.slice(at);
    return `<div class="cs-wrap cs-home" id="cs-home">${page}${safeLine()}</div>`;
}

function gameCard(g, href) {
    const best = games.lowest(g);
    return `<li class="cs-game" style="--tone:${GAME_TONE[g.id]}"><a href="${href}"><span class="cs-game-name">${esc(g.name)}</span><span class="cs-game-line">${esc(g.line)}</span><span class="cs-game-edge">From <b>${pct(best.edge)}</b> house edge</span></a></li>`;
}

function playIndex() {
    return `<div class="cs-wrap cs-page" id="cs-play">
<header class="cs-page-h"><p class="cs-kicker">Play</p><h1>Pick a table</h1><p>Every table deals from the same engine Learn and the simulator use. A thousand play chips a day, worth nothing.</p></header>
<ul class="cs-games">${games.catalogue().map((g) => gameCard(g, `/play/${g.id}`)).join('')}</ul>
${safeLine()}</div>`;
}

function table({ game }) {
    const g = games.get(game);
    const best = games.lowest(g);
    return `<div class="cs-wrap cs-page cs-table-page" id="cs-table" data-game="${esc(g.id)}">
<header class="cs-page-h cs-table-h"><div><p class="cs-kicker">Play · ${esc(g.name)}</p><h1>${esc(g.name)}</h1><p>${esc(g.rules)}</p></div>
<div class="cs-wallet" data-cs-wallet><span>Play chips</span><b data-cs-chips>1,000</b><small data-cs-reset>A fresh 1,000 each day</small></div></header>
<div class="cs-felt" data-cs-felt style="--tone:${GAME_TONE[g.id]}">
<noscript><p class="cs-noscript">The table deals with JavaScript. Everything about ${esc(g.name)}, its odds and each bet's cost is on <a href="/learn/${esc(g.id)}">Learn</a>, without it.</p></noscript>
</div>
<aside class="cs-table-side">
<p class="cs-edge-now">Cheapest bet here: <b>${esc(best.name)}</b>, ${pct(best.edge)} house edge. <a href="/learn/${esc(g.id)}">Why</a> · <a href="/simulate?game=${esc(g.id)}">Simulate it</a></p>
<p class="cs-session" data-cs-session hidden></p>
</aside>
${safeLine()}
<div class="cs-gate" data-cs-gate hidden role="dialog" aria-modal="true" aria-labelledby="cs-gate-h"><div class="cs-gate-box">
<h2 id="cs-gate-h">For adults, and for learning</h2>
<p>The tables are for people 18 or older. The chips are free and worth nothing; this is a place to learn how the games work and what they cost.</p>
<div class="cs-gate-go"><button type="button" class="cs-btn" data-cs-adult>I am 18 or older</button><a class="cs-btn is-quiet" href="/learn/${esc(g.id)}">Learn instead</a></div>
</div></div>
</div>`;
}

function edgeTable(g) {
    return `<div class="cs-chart-wrap" tabindex="0" role="region" aria-label="What each bet costs"><table class="cs-bets"><caption>What each bet costs</caption><thead><tr><th scope="col">Bet</th><th scope="col">House edge</th><th scope="col">How we know</th></tr></thead><tbody>${g.bets.slice().sort((a, b) => a.edge - b.edge).map((b) => `<tr><th scope="row">${esc(b.name)}</th><td>${pct(b.edge, 3)}</td><td>${esc(b.how)}</td></tr>`).join('')}</tbody></table></div>`;
}

const LEARN = {
    blackjack: () => {
        const { blackjack } = games.engines;
        const soft = [13, 14, 15, 16, 17, 18, 19];
        const ups = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
        const lab = { H: 'H', S: 'S', D: 'D', Ds: 'Ds', P: 'P' };
        const softTable = `<div class="cs-chart-wrap" tabindex="0" role="region" aria-label="Soft totals chart"><table class="cs-chart"><caption>Soft totals (an ace counted as 11)</caption><thead><tr><th scope="col">You</th>${ups.map((u) => `<th scope="col">${u === 11 ? 'A' : u}</th>`).join('')}</tr></thead><tbody>${soft.map((t) => `<tr><th scope="row">A,${t - 11}</th>${ups.map((u) => { const c = blackjack.chart([{ rank: 1, suit: 0 }, { rank: t - 11, suit: 0 }], u, false); return `<td class="is-${c === 'Ds' ? 'D' : c}">${lab[c]}</td>`; }).join('')}</tr>`).join('')}</tbody></table><p class="cs-fine">Ds double, or stand when you cannot</p></div>`;
        const pairs = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
        const pairTable = `<div class="cs-chart-wrap" tabindex="0" role="region" aria-label="Pairs chart"><table class="cs-chart"><caption>Pairs: split or not</caption><thead><tr><th scope="col">Pair</th>${ups.map((u) => `<th scope="col">${u === 11 ? 'A' : u}</th>`).join('')}</tr></thead><tbody>${pairs.map((p) => { const r = p === 11 ? 1 : p; return `<tr><th scope="row">${p === 11 ? 'A,A' : `${p},${p}`}</th>${ups.map((u) => { const c = blackjack.chart([{ rank: r, suit: 0 }, { rank: r, suit: 1 }], u, true); return `<td class="is-${c === 'P' ? 'P' : '-'}">${c === 'P' ? 'P' : ''}</td>`; }).join('')}</tr>`; }).join('')}</tbody></table><p class="cs-fine">P split; an empty cell plays the hand as a total</p></div>`;
        return `<h2>The rules here</h2><p>You and the dealer each get two cards; one of the dealer's is face down. Closest to 21 without going over wins. Face cards count 10, an ace 1 or 11. The dealer must draw to 16 and stand on 17. A blackjack, an ace and a ten, pays 3 to 2.</p>
<h2>Basic strategy</h2><p>For every hand you can hold against every card the dealer can show, one move loses least over time. These tables come from the engine the tables play with; the hint at the table shows the same move.</p>${hardChart()}${softTable}${pairTable}`;
    },
    roulette: () => `<h2>One price for everything</h2><p>A bet on n numbers pays 36 ÷ n − 1 to one, as if there were only 36 pockets. The zeros are what the house keeps: 1 pocket in 37 on a European wheel (2.70%), 2 in 38 on an American one (5.26%). The American top line, 0, 00, 1, 2 and 3, pays 6 to 1 for five numbers and costs 7.89%.</p>
<h2>What a bet covers and pays</h2><div class="cs-chart-wrap" tabindex="0" role="region" aria-label="What a bet covers and pays"><table class="cs-bets"><thead><tr><th scope="col">Bet</th><th scope="col">Numbers</th><th scope="col">Pays</th><th scope="col">Wins on a European wheel</th></tr></thead><tbody>${[['Straight', 1], ['Split', 2], ['Street', 3], ['Corner', 4], ['Six line', 6], ['Dozen or column', 12], ['Red, black, odd, even, low, high', 18]].map(([n, k]) => `<tr><th scope="row">${n}</th><td>${k}</td><td>${36 / k - 1} to 1</td><td>${(k / 37 * 100).toFixed(2)}%</td></tr>`).join('')}</tbody></table></div>`,
    baccarat: () => `<h2>Nothing to decide but the bet</h2><p>Two hands, the player and the banker, get two cards each; only the last digit of the total counts. An 8 or 9 is a natural and stands. Otherwise the player draws on 0 to 5, and the banker draws by the tableau below. The banker bet wins a little more often, so it pays 0.95 to 1.</p>
<div class="cs-chart-wrap" tabindex="0" role="region" aria-label="When the banker draws"><table class="cs-chart"><caption>When the banker draws, by the player's third card</caption><thead><tr><th scope="col">Banker</th>${['none', 0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((v) => `<th scope="col">${v}</th>`).join('')}</tr></thead><tbody>${[0, 1, 2, 3, 4, 5, 6, 7].map((b) => `<tr><th scope="row">${b}</th>${[null, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((p) => { const d = games.engines.baccarat.bankerDraws(b, p); return `<td class="is-${d ? 'H' : 'S'}">${d ? 'Draw' : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`,
    craps: () => { const { WAYS } = games.engines.craps; return `<h2>Two dice, 36 ways</h2><p>Seven is the most likely total, six ways in 36. The pass line wins at once on 7 or 11 and loses on 2, 3 or 12; any other total becomes the point, and the point must come again before a 7. Free odds behind the line pay exactly the true odds, so they cost nothing.</p>
<div class="cs-dice-odds">${[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((t) => `<span style="--h:${WAYS[t]}"><i></i><b>${t}</b><small>${WAYS[t]}/36</small></span>`).join('')}</div>`; },
    slots: () => { const sl = games.engines.slots; const x = sl.exact(); return `<h2>The machine, opened</h2><p>Three reels of 24 stops, every stop equally likely, so every one of the 13,824 spins can be counted. This one pays back ${(x.rtp * 100).toFixed(2)}% of what goes in over time and wins something on ${(x.hitRate * 100).toFixed(1)}% of spins; most of those wins are smaller than the bet.</p>
<div class="cs-chart-wrap" tabindex="0" role="region" aria-label="The paytable"><table class="cs-bets"><caption>The paytable and how often each win comes</caption><thead><tr><th scope="col">Pays</th><th scope="col">Chance on a spin</th><th scope="col">About once every</th></tr></thead><tbody>${x.wins.map((w) => `<tr><th scope="row">${w.pay} to 1</th><td>${(w.chance * 100).toFixed(3)}%</td><td>${Math.round(1 / w.chance).toLocaleString('en-US')} spins</td></tr>`).join('')}</tbody></table></div>
<div class="cs-reels">${sl.STRIPS.map((s, i) => `<div class="cs-reel"><b>Reel ${i + 1}</b><ol>${s.map((sym) => `<li class="sym-${sym}">${sym}</li>`).join('')}</ol></div>`).join('')}</div>`; },
};

function learnIndex() {
    return `<div class="cs-wrap cs-page" id="cs-learn">
<header class="cs-page-h"><p class="cs-kicker">Learn</p><h1>The rules, the odds, the cost</h1><p>Each game explained with its engine's own numbers: what every bet pays, how often it wins, and what the house keeps.</p></header>
<ul class="cs-games">${games.catalogue().map((g) => gameCard(g, `/learn/${g.id}`)).join('')}</ul>
${edgeLadder()}${safeLine()}</div>`;
}

function learn({ game }) {
    const g = games.get(game);
    return `<div class="cs-wrap cs-page cs-learn-page" id="cs-learn-game" data-game="${esc(g.id)}" style="--tone:${GAME_TONE[g.id]}">
<header class="cs-page-h"><p class="cs-kicker">Learn · ${esc(g.name)}</p><h1>${esc(g.name)}: the rules, the odds and the house edge</h1><p>${esc(g.line)}</p>
<div class="cs-acts"><a class="cs-btn" href="/play/${esc(g.id)}">Play ${esc(g.name)}</a><a class="cs-btn is-quiet" href="/simulate?game=${esc(g.id)}">Simulate it</a></div></header>
<div class="cs-prose">${edgeTable(g)}${LEARN[g.id]()}<p class="cs-fine">Checked against: <a href="${esc(g.source.url)}" rel="noopener">${esc(g.source.name)}</a>.</p></div>
${safeLine()}</div>`;
}

function simulate({ game = 'blackjack', choice = '', maxShare = 200000, plans = {}, meta = { labels: {}, refs: {} } } = {}) {
    const options = games.catalogue().map((g) => `<option value="${esc(g.id)}"${g.id === game ? ' selected' : ''}>${esc(g.name)}</option>`).join('');
    return `<div class="cs-wrap cs-page" id="cs-sim" data-max-share="${Number(maxShare)}" data-plans="${esc(JSON.stringify(plans))}" data-refs="${esc(JSON.stringify(meta.refs))}" data-labels="${esc(JSON.stringify(meta.labels))}">
<header class="cs-page-h"><p class="cs-kicker">Simulate</p><h1>Watch the house edge arrive</h1><p>Your browser plays the game with the same engine as the tables, as many rounds as you ask for, and shows what the house kept next to the exact figure.</p></header>
<form class="cs-sim-form" data-cs-sim action="/api/v1/simulate" method="post">
<label>Game<select name="game" data-cs-sim-game>${options}</select></label>
<label>Bet or strategy<select name="choice" data-cs-sim-choice data-initial="${esc(choice)}"></select></label>
<label>Rounds<select name="rounds"><option value="10000">10,000</option><option value="100000" selected>100,000</option><option value="1000000">1,000,000</option></select></label>
<label>Seed<input name="seed" inputmode="numeric" pattern="[0-9]*" placeholder="any number"></label>
<button class="cs-btn" type="submit">Run it</button>
</form>
<div class="cs-sim-out" data-cs-sim-out>
<div class="cs-progress" data-cs-progress hidden><i></i></div>
<canvas class="cs-sim-chart" data-cs-chart width="720" height="260" aria-label="The house's share of the money bet, as the rounds go by"></canvas>
<p class="cs-sim-result" data-cs-result aria-live="polite">Pick a game and run it. A short run swings; a long one settles on the edge.</p>
<button class="cs-btn is-quiet" type="button" data-cs-share hidden>Share this run</button>
</div>
<noscript><p class="cs-noscript">The simulator runs in your browser with JavaScript. Without it, the API runs a shorter one: POST /api/v1/simulate.</p></noscript>
${safeLine()}</div>`;
}

function shared({ sim }) {
    const g = games.get(sim.game);
    const r = sim.result;
    return `<div class="cs-wrap cs-page" id="cs-shared">
<header class="cs-page-h"><p class="cs-kicker">A shared run · ${esc(g.name)}</p><h1>Over ${Number(r.rounds).toLocaleString('en-US')} rounds the house kept ${pct(r.edge_percent)}</h1>
<p>${esc(g.name)}, ${esc(r.choice)}, seed ${esc(r.seed)}. The margin of error is about ±${pct(r.stderr_percent * 2)}. Run it again from the same seed and you get the same rounds.</p>
<div class="cs-acts"><a class="cs-btn" href="/simulate?game=${esc(g.id)}&amp;choice=${encodeURIComponent(r.choice)}">Run your own</a><a class="cs-btn is-quiet" href="/learn/${esc(g.id)}">Why it costs that</a></div></header>
${safeLine()}</div>`;
}

function safe() {
    return `<div class="cs-wrap cs-page cs-narrow" id="cs-safe">
<header class="cs-page-h"><p class="cs-kicker">Play safe</p><h1>This is for learning</h1><p>OpenVibe.Casino has no real money in it, and never will without saying so plainly first. Play chips are free, arrive fresh each day, and are worth nothing anywhere.</p></header>
<div class="cs-prose">
<h2>What the numbers mean for real money</h2>
<p>Every bet in a casino has a house edge, and over enough play it is what you lose. A 2.7% edge on 100 bets of $10 is about $27 gone on average, and some nights much more. Nothing here teaches a way around that, because there is none.</p>
<h2>Signs it may be time to stop</h2>
<ul><li>Playing to win back what you lost</li><li>Spending more time or money than you meant to</li><li>Hiding it, or borrowing for it</li><li>Feeling restless or low when you are not playing</li></ul>
<h2>Free, confidential help</h2>
<ul class="cs-help">${HELP.map((h) => `<li><a href="${esc(h.href)}" rel="noopener">${esc(h.name)}</a><span>${esc(h.where)}</span></li>`).join('')}</ul>
<p>The tables remind you how long you have been playing every 30 minutes.</p>
</div></div>`;
}

function developers() {
    return `<div class="cs-wrap cs-page cs-narrow" id="cs-dev">
<header class="cs-page-h"><p class="cs-kicker">Developers</p><h1>The OpenVibe.Casino API</h1><p>Open, no key: every game, its rules and each bet's house edge, and simulations from the same engines. <a href="/api/v1/openapi.json">OpenAPI</a>.</p></header>
<div class="cs-prose">
<h2>GET /api/v1/games</h2><p>Every game with its rules, each bet's edge in percent, how the figure was found (exact or simulated) and the published source it is checked against.</p>
<h2>POST /api/v1/simulate</h2><p><code>{ "game": "craps", "choice": "pass", "rounds": 100000, "seed": 42, "share": true }</code>: runs on the server, up to the configured number of rounds, a few a minute per address. With <code>share</code> it keeps the run and answers its link.</p>
<h2>The engines</h2><p>The same files the server, the tables and the simulator run: <code>/engine/rng.js</code>, <code>cards.js</code>, <code>blackjack.js</code>, <code>roulette.js</code>, <code>baccarat.js</code>, <code>craps.js</code>, <code>slots.js</code>. Each is deterministic from a seed. The source is AGPL-3.0 on GitHub.</p>
</div></div>`;
}

function notFound() {
    return `<div class="cs-wrap cs-page cs-narrow" id="cs-not-found"><header class="cs-page-h"><p class="cs-kicker">404</p><h1>No table here</h1><p>That address is not a page on OpenVibe.Casino.</p><div class="cs-acts"><a class="cs-btn" href="/">Back to the floor</a></div></header></div>`;
}

module.exports = { home, playIndex, table, learnIndex, learn, simulate, shared, safe, developers, notFound, edgeLadder, GAME_TONE, HELP };

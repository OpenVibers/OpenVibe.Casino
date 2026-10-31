'use strict';

/**
 * Simulations on the server (POST /api/v1/simulate): a game, a bet or strategy, a seed and a number of rounds, run by the
 * same engine the browser uses, bounded so one request cannot hold the process. A shared one is kept (casino_sims) so
 * its link (/s/<id>) opens at once and anyone can run it again from the same seed.
 */
const crypto = require('crypto');
const games = require('../engine/games');

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';
const newId = () => `sim_${Array.from(crypto.randomBytes(20), (b) => ALPHABET[b & 31]).join('')}`;

// What each game can simulate, and the engine call that does it.
const PLANS = {
    blackjack: { choices: ['basic', 'dealer', 'never-bust'], run: (e, c, n, seed) => e.blackjack.houseEdge({ strategy: c, hands: n, seed }) },
    roulette: { choices: ['european-red', 'american-red', 'european-straight', 'american-top'], run: (e, c, n, seed) => {
        const [wheel, bet] = c.split('-');
        const b = bet === 'straight' ? { type: 'straight', numbers: ['17'] } : { type: bet };
        return e.roulette.houseEdge({ wheel, bet: b, spins: n, seed });
    } },
    baccarat: { choices: ['banker', 'player', 'tie'], run: (e, c, n, seed) => e.baccarat.houseEdge({ bet: c, coups: n, seed }) },
    craps: { choices: ['pass', 'dontPass', 'pass-odds', 'place'], run: (e, c, n, seed) => e.craps.houseEdge({ bet: c === 'pass-odds' ? 'pass' : c, withOdds: c === 'pass-odds', decisions: n, seed }) },
    slots: { choices: ['spin'], run: (e, c, n, seed) => e.slots.houseEdge({ spins: n, seed }) },
};

// Each choice's name and the catalogue bet whose exact edge it should settle on (the simulator's reference line).
const CHOICE_META = {
    'blackjack:basic': ['Basic strategy', 'basic'], 'blackjack:dealer': ['Play like the dealer', 'dealer'], 'blackjack:never-bust': ['Never bust', 'never-bust'],
    'roulette:european-red': ['Red, European wheel', 'european'], 'roulette:american-red': ['Red, American wheel', 'american'],
    'roulette:european-straight': ['One number, European wheel', 'european'], 'roulette:american-top': ['The top line, American wheel', 'american-top'],
    'baccarat:banker': ['Banker', 'banker'], 'baccarat:player': ['Player', 'player'], 'baccarat:tie': ['Tie', 'tie'],
    'craps:pass': ['Pass line', 'pass'], 'craps:dontPass': ['Don\'t pass', 'dontPass'], 'craps:pass-odds': ['Pass line with full odds (per line bet)', 'pass'], 'craps:place': ['Place 6', 'place6'],
    'slots:spin': ['One spin', 'spin'],
};
/** { labels, refs } keyed "game:choice" for the simulator page. */
function simMeta() {
    const labels = {}; const refs = {};
    for (const [key, [label, betId]] of Object.entries(CHOICE_META)) {
        labels[key] = label;
        const g = games.get(key.split(':')[0]);
        const b = g && g.bets.find((x) => x.id === betId);
        if (b) refs[key] = b.edge;
    }
    return { labels, refs };
}

function createSims({ config, s }) {
    const max = config.simulate.maxRounds;

    /** Validate a request; returns { game, choice, rounds, seed } or throws { status, code, message }. */
    function parse(body = {}) {
        const fail = (message) => Object.assign(new Error(message), { status: 400, code: 'casino.invalid' });
        const game = String(body.game || '');
        const plan = PLANS[game];
        if (!plan) throw fail(`game is one of ${Object.keys(PLANS).join(', ')}`);
        const choice = String(body.choice || plan.choices[0]);
        if (!plan.choices.includes(choice)) throw fail(`choice for ${game} is one of ${plan.choices.join(', ')}`);
        const rounds = Math.floor(Number(body.rounds || 100000));
        if (!Number.isFinite(rounds) || rounds < 1000 || rounds > max) throw fail(`rounds is between 1,000 and ${max.toLocaleString('en-US')}`);
        const seed = body.seed == null ? crypto.randomInt(1, 2 ** 31) : Math.floor(Number(body.seed));
        if (!Number.isSafeInteger(seed) || seed < 0 || seed >= 2 ** 32) throw fail('seed is a whole number from 0 to 4294967295');
        return { game, choice, rounds, seed };
    }

    function run(p) {
        const r = PLANS[p.game].run(games.engines, p.choice, p.rounds, p.seed);
        const round = (x) => Math.round(x * 1000) / 1000;
        return { game: p.game, choice: p.choice, rounds: p.rounds, seed: p.seed, edge_percent: round(r.percent), stderr_percent: round(r.stderr) };
    }

    async function share(params, result) {
        const id = newId();
        await s.db.exec('INSERT INTO casino_sims (id, game, params, result) VALUES ($1, $2, $3::jsonb, $4::jsonb)', [id, params.game, JSON.stringify(params), JSON.stringify(result)]);
        return id;
    }

    async function get(id) {
        if (!/^sim_[a-z2-7]{20}$/.test(String(id || ''))) return null;
        const row = await s.db.maybe('SELECT id, game, params, result, created_at FROM casino_sims WHERE id = $1', [id]);
        return row ? { id: row.id, game: row.game, params: typeof row.params === 'string' ? JSON.parse(row.params) : row.params, result: typeof row.result === 'string' ? JSON.parse(row.result) : row.result, created_at: row.created_at } : null;
    }

    async function count() { return Number((await s.db.maybe('SELECT count(*)::int AS n FROM casino_sims')).n) || 0; }

    return { PLANS, parse, run, share, get, count, meta: simMeta };
}

module.exports = { createSims, PLANS, CHOICE_META, simMeta };

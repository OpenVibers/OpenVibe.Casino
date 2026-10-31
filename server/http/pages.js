'use strict';

/**
 * Casino's server-rendered pages. Public pages are served `public, max-age=300` with Vary: Cookie; a page drawn for a
 * signed-in person is `private, no-store` (layout.send).
 *
 *   /                   the floor: every bet's cost, a real bankroll chart, what you can do
 *   /play, /play/:game  the tables (public/js/casino.js deals)
 *   /learn, /learn/:game  the rules, the odds and the edges
 *   /simulate           the simulator (a Web Worker runs the engines)
 *   /s/:id              a shared simulation (noindex)
 *   /safe, /developers  play safe; the API
 */
const seo = require('openvibe-shared/seo');
const { asyncRouter } = require('./router');
const { createDiscoveryRoutes, homeJsonLd } = require('./discovery');
const { raw } = require('../render/html');
const { send } = require('../render/layout');
const games = require('../../engine/games');
const views = require('../views');

const PUBLIC_CACHE = 'public, max-age=300';
// What every table loads before its own engine: the seeded generator and the cards.
const ENGINE = ['/engine/rng.js', '/engine/cards.js'];

function createPageRoutes(ctx) {
    const { config, sims } = ctx;
    const r = asyncRouter();
    const base = () => String(config.baseUrl).replace(/\/+$/, '');
    const page = (req, res, o, status = 200) => send(res, status, { viewer: req.viewer, config, path: req.originalUrl, ...o });
    const webPage = (name, path, description) => seo.jsonLd.webPage({ name, url: `${base()}${path}`, description, siteUrl: base() });
    const ids = games.catalogue().map((g) => g.id);
    const plans = Object.fromEntries(Object.entries(sims.PLANS).map(([k, v]) => [k, v.choices]));

    r.get('/', async (req, res) => page(req, res, {
        index: true, cache: PUBLIC_CACHE,
        description: 'Learn casino games, play them with chips worth nothing, and see exactly what each bet costs: exact house edges from open engines, and a million hands simulated in your browser.',
        jsonLd: homeJsonLd(config),
        body: raw(views.home({ sims: await sims.count().catch(() => 0) })),
    }));

    r.get('/play', (req, res) => page(req, res, {
        index: true, cache: PUBLIC_CACHE, title: 'Play: every table',
        description: 'Blackjack, roulette, baccarat, craps and slots with free play chips worth nothing.',
        jsonLd: [webPage('Play', '/play', 'Every table, with play chips worth nothing.')],
        body: raw(views.playIndex()),
    }));

    r.get('/play/:game', (req, res, next) => {
        if (!ids.includes(req.params.game)) return next();
        const g = games.get(req.params.game);
        return page(req, res, {
            index: true, cache: PUBLIC_CACHE, title: `Play ${g.name}`,
            description: `${g.name} with free play chips: ${g.rules}`,
            jsonLd: [webPage(`Play ${g.name}`, `/play/${g.id}`, g.line)],
            scripts: [...ENGINE, `/engine/${g.id}.js`, 'js/table.js'],
            body: raw(views.table({ game: g.id })),
        });
    });

    r.get('/learn', (req, res) => page(req, res, {
        index: true, cache: PUBLIC_CACHE, title: 'Learn: the rules, the odds, the cost',
        description: 'The rules, the odds and the house edge of blackjack, roulette, baccarat, craps and slots, worked out by open engines.',
        jsonLd: [webPage('Learn', '/learn', 'The rules, the odds and the cost of every game.')],
        body: raw(views.learnIndex()),
    }));

    r.get('/learn/:game', (req, res, next) => {
        if (!ids.includes(req.params.game)) return next();
        const g = games.get(req.params.game);
        const best = games.lowest(g);
        const description = `${g.name} explained: ${g.rules} The cheapest bet, ${best.name}, has a ${best.edge}% house edge.`;
        return page(req, res, {
            index: true, cache: PUBLIC_CACHE, title: `${g.name}: rules, odds and the house edge`, description,
            jsonLd: [seo.jsonLd.article ? seo.jsonLd.article({ headline: `${g.name}: rules, odds and the house edge`, url: `${base()}/learn/${g.id}`, description }) : webPage(g.name, `/learn/${g.id}`, description)],
            body: raw(views.learn({ game: g.id })),
        });
    });

    r.get('/simulate', (req, res) => {
        const game = ids.includes(String(req.query.game || '')) ? String(req.query.game) : 'blackjack';
        return page(req, res, {
            index: true, cache: PUBLIC_CACHE, title: 'Simulate: watch the house edge arrive',
            description: 'Run up to a million rounds of any game in your browser and see what the house keeps, next to the exact figure.',
            jsonLd: [webPage('Simulate', '/simulate', 'A million rounds in your browser.')],
            scripts: ['js/simulate.js'],
            body: raw(views.simulate({ game, choice: String(req.query.choice || '').slice(0, 40), maxShare: config.simulate.maxRounds, plans, meta: sims.meta() })),
        });
    });

    r.get('/s/:id', async (req, res, next) => {
        const sim = await sims.get(req.params.id);
        if (!sim) return next();
        return page(req, res, { cache: PUBLIC_CACHE, title: 'A shared run', body: raw(views.shared({ sim })) });
    });

    r.get('/safe', (req, res) => page(req, res, {
        index: true, cache: PUBLIC_CACHE, title: 'Play safe',
        description: 'OpenVibe.Casino is for learning: no real money. What the house edge means for real money, the signs to stop, and free help.',
        jsonLd: [webPage('Play safe', '/safe', 'What this is, and where to get help.')],
        body: raw(views.safe()),
    }));

    r.get('/developers', (req, res) => page(req, res, {
        index: true, cache: PUBLIC_CACHE, title: 'The OpenVibe.Casino API',
        description: 'Games, house edges and simulations as JSON, and the engines as files.',
        jsonLd: [webPage('The OpenVibe.Casino API', '/developers', 'Games, house edges and simulations as JSON.')],
        body: raw(views.developers()),
    }));

    r.use(createDiscoveryRoutes(ctx));
    return r;
}

module.exports = { createPageRoutes };

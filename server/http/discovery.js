'use strict';

/**
 * Crawl artifacts for openvibe.casino: robots.txt, sitemap.xml, llms.txt and llms-full.txt. Every game's table and
 * explainer is for search engines and AI crawlers; sign-in, the API and the internal route are not.
 */
const fs = require('fs');
const path = require('path');
const seo = require('openvibe-shared/seo');
const cache = require('openvibe-shared/cache-policy');
const { asyncRouter } = require('./router');
const games = require('../../engine/games');

const SITE_NAME = 'OpenVibe.Casino';
const DESCRIPTION = 'OpenVibe.Casino: learn casino games, play them with chips worth nothing, and see exactly what each bet costs. Open engines, exact house edges, simulations in your browser. Never real money.';
const DISALLOW = ['/auth/', '/api/', '/internal', '/metrics', '/s/'];

function dayOf(ts) {
    const m = String(ts == null ? '' : ts).match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
}
function siteUpdated() {
    try { return dayOf(JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'STATUS.json'), 'utf8')).updated); } catch { return null; }
}

function homeJsonLd(config) {
    const site = String(config.baseUrl).replace(/\/+$/, '');
    return [
        seo.jsonLd.website({ name: SITE_NAME, url: site, description: DESCRIPTION }),
        seo.jsonLd.softwareApp({ name: SITE_NAME, url: site, description: DESCRIPTION, category: 'GameApplication', keywords: 'casino odds, house edge, blackjack basic strategy, roulette odds, baccarat, craps, slot machine RTP, gambling simulator, free casino games' }),
        seo.jsonLd.webPage({ name: SITE_NAME, url: `${site}/`, description: DESCRIPTION, siteUrl: site }),
    ];
}

function publicPages() {
    const list = games.catalogue();
    return [
        { path: '/', changefreq: 'weekly', priority: 1.0, title: 'OpenVibe.Casino', text: 'Learn it, play it, never pay it: every game and what each bet costs.' },
        { path: '/play', changefreq: 'monthly', priority: 0.8, title: 'Play', text: 'Every table, with play chips worth nothing.' },
        ...list.map((g) => ({ path: `/play/${g.id}`, changefreq: 'monthly', priority: 0.8, title: `Play ${g.name}`, text: g.line })),
        { path: '/learn', changefreq: 'monthly', priority: 0.8, title: 'Learn', text: 'The rules, the odds and the house edge of every game.' },
        ...list.map((g) => ({ path: `/learn/${g.id}`, changefreq: 'monthly', priority: 0.8, title: `${g.name}: rules, odds and the house edge`, text: g.rules })),
        { path: '/simulate', changefreq: 'monthly', priority: 0.7, title: 'Simulate', text: 'A million hands in your browser: what the house keeps, measured.' },
        { path: '/safe', changefreq: 'monthly', priority: 0.6, title: 'Play safe', text: 'Why this is for learning, and where to get help.' },
        { path: '/developers', changefreq: 'monthly', priority: 0.5, title: 'The OpenVibe.Casino API', text: 'Games, house edges and simulations as JSON.' },
    ];
}

function createDiscoveryRoutes(ctx) {
    const { config } = ctx;
    const r = asyncRouter();
    const site = String(config.baseUrl).replace(/\/+$/, '');
    const abs = (p) => `${site}${p}`;
    const TEXT = cache.htmlHeaders({ maxAge: 3600 });
    const pages = publicPages();

    r.get('/robots.txt', (_req, res) => {
        res.type('text/plain').set('Cache-Control', TEXT).send(
            '# openvibe.casino: every table and explainer is for search and AI crawlers; sign-in, the API and shared runs are not.\n'
            + seo.robotsTxt({ sitemaps: [abs('/sitemap.xml')], disallow: DISALLOW }));
    });

    r.get('/llms.txt', (_req, res) => {
        res.type('text/plain').set('Cache-Control', TEXT).send(seo.llmsTxt({
            name: SITE_NAME,
            summary: DESCRIPTION,
            details: 'GET /api/v1/games lists every game, its rules and each bet\'s house edge (exact where the maths allows, simulated for blackjack strategies) with the published source. POST /api/v1/simulate runs a bounded simulation. Play chips are free, reset daily and are worth nothing; nothing is bought or cashed out.',
            sections: [
                { title: 'Start here', links: pages.map((p) => ({ title: p.title, url: abs(p.path), note: p.text })) },
                { title: 'Machine-readable', links: [
                    { title: 'Games and house edges (JSON)', url: abs('/api/v1/games') },
                    { title: 'OpenAPI', url: abs('/api/v1/openapi.json') },
                    { title: 'Sitemap', url: abs('/sitemap.xml') },
                    { title: 'Full text for language models', url: abs('/llms-full.txt') },
                ] },
            ],
        }));
    });

    r.get('/llms-full.txt', (_req, res) => {
        const list = games.catalogue().map((g) => ({ url: `/learn/${g.id}`, title: g.name, text: `${g.rules} House edge by bet: ${g.bets.map((b) => `${b.name} ${b.edge}%`).join('; ')}. Source: ${g.source.name}.` }));
        res.type('text/plain').set('Cache-Control', TEXT).send(seo.llmsFull({
            site: SITE_NAME, summary: DESCRIPTION, base: site, maxBytes: 256 * 1024,
            sections: [{ title: 'Pages', pages: pages.map((p) => ({ url: p.path, title: p.title, text: p.text })) }, { title: 'Games', pages: list }],
        }));
    });

    r.get('/sitemap.xml', (_req, res) => {
        const lastmod = siteUpdated();
        res.type('application/xml').set('Cache-Control', TEXT).send(seo.sitemapXml(pages.map((e) => ({ loc: abs(e.path), ...(lastmod ? { lastmod } : {}), changefreq: e.changefreq, priority: e.priority }))));
    });

    return r;
}

module.exports = { createDiscoveryRoutes, homeJsonLd, publicPages, DESCRIPTION, SITE_NAME };

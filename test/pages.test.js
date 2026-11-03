'use strict';
/**
 * The pages and the API: the floor leads with every bet's cost from the engines (never an empty section), each table
 * loads its engines before its own code and puts the 18+ gate in front, Learn shows the engine's own tables, the
 * simulator knows every choice's exact edge, a run can be shared and opened, and the API is bounded and open.
 */
const assert = require('assert');
const { boot, check, done } = require('./helpers/boot');
const games = require('../engine/games');

(async () => {
    const t = await boot();
    try {
        await check('the floor: the edge ladder from the engines, a real bankroll chart, the safe line, public cache', async () => {
            const r = await t.get('/');
            assert.strictEqual(r.status, 200);
            assert.strictEqual(r.headers.get('cache-control'), 'public, max-age=300');
            const rungs = (r.text.match(/<li style="--tone:[^"]+"><a href="\/learn\//g) || []).length;
            assert.strictEqual(rungs, games.catalogue().reduce((a, g) => a + g.bets.length, 0), 'every bet on the ladder');
            assert.ok(r.text.indexOf('id="cs-ladder"') < r.text.indexOf('class="sc-room-scenes"'), 'the real data leads');
            assert.match(r.text, /<figure class="cs-bank" role="img"/);
            assert.match(r.text, /1-800-GAMBLER|help is one call away/);
            assert.ok(!/Nothing (is |has )?[^.<]{0,40}yet/.test(r.text), 'no empty section');
        });

        await check('a table: engines before its code, the gate, the cheapest bet named, a page for every game', async () => {
            for (const g of games.catalogue()) {
                const r = await t.get(`/play/${g.id}`);
                assert.strictEqual(r.status, 200, g.id);
                const at = (s) => r.text.indexOf(s);
                assert.ok(at('/engine/rng.js') > 0 && at('/engine/rng.js') < at(`/engine/${g.id}.js`) && at(`/engine/${g.id}.js`) < at('/js/table.js'), `${g.id}: engines load first`);
                assert.match(r.text, /data-cs-gate hidden role="dialog"/);
                assert.match(r.text, /<noscript><p class="cs-noscript">/);
                assert.match(r.text, new RegExp(`Cheapest bet here: <b>${games.lowest(g).name.replace(/[()]/g, '\\$&')}</b>`));
            }
            assert.strictEqual((await t.get('/play/poker')).status, 404);
        });

        await check('Learn: the engine\'s basic-strategy chart and the baccarat tableau', async () => {
            const bj = await t.get('/learn/blackjack');
            assert.match(bj.text, /<table class="cs-chart"><caption>Hard totals/);
            assert.match(bj.text, /Soft totals/);
            const bc = await t.get('/learn/baccarat');
            assert.match(bc.text, /When the banker draws/);
            assert.match(bc.text, /1\.058%/);
        });

        await check('the simulator knows every choice and its exact edge', async () => {
            const r = await t.get('/simulate?game=craps');
            const refs = JSON.parse(r.text.match(/data-refs="([^"]+)"/)[1].replace(/&quot;/g, '"'));
            assert.strictEqual(refs['craps:pass'], 1.414);
            assert.strictEqual(Object.keys(refs).length, 15);
            assert.match(r.text, /<option value="craps" selected>/);
        });

        await check('the API: games, a bounded simulation, a shared run that opens, problem+json errors', async () => {
            const list = (await t.get('/api/v1/games')).json();
            assert.strictEqual(list.games.length, 5);
            const sim = await t.get('/api/v1/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: 'roulette', choice: 'european-red', rounds: 50000, seed: 7, share: true }) });
            assert.strictEqual(sim.status, 201, sim.text);
            const body = sim.json();
            assert.match(body.id, /^sim_[a-z2-7]{20}$/);
            assert.ok(Math.abs(body.result.edge_percent - 2.703) < 1.5, 'a 50,000-spin run lands near 2.70%');
            const again = (await t.get('/api/v1/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: 'roulette', choice: 'european-red', rounds: 50000, seed: 7 }) })).json();
            assert.strictEqual(again.result.edge_percent, body.result.edge_percent, 'the same seed plays the same spins');
            const page = await t.get(`/s/${body.id}`);
            assert.strictEqual(page.status, 200);
            assert.match(page.text, /the house kept/);
            const tooMany = await t.get('/api/v1/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: 'craps', rounds: 99999999 }) });
            assert.strictEqual(tooMany.status, 400);
            assert.match(tooMany.headers.get('content-type'), /problem\+json/);
            assert.strictEqual((await t.get('/api/v1/sims/sim_nope')).status, 404);
            assert.strictEqual((await t.get('/api/v1/openapi.json')).json().openapi, '3.1.0');
        });

        await check('the engines are served as they are, and discovery lists every page', async () => {
            const e = await t.get('/engine/craps.js');
            assert.strictEqual(e.status, 200);
            assert.match(e.text, /OpenVibeCraps/);
            const map = await t.get('/sitemap.xml');
            for (const g of games.catalogue()) assert.ok(map.text.includes(`/learn/${g.id}</loc>`) && map.text.includes(`/play/${g.id}</loc>`), g.id);
            assert.match((await t.get('/robots.txt')).text, /Disallow: \/s\//);
            // AGT-5: llms.txt links each page at its Markdown twin, the API and files as they are, ## Optional last.
            const llms = (await t.get('/llms.txt')).text;
            assert.match(llms, /\(https?:\/\/[^)]*\/index\.md\)/, 'the home links its twin');
            assert.match(llms, /\(https?:\/\/[^)]*\/learn\/blackjack\.md\)/);
            assert.match(llms, /\(https?:\/\/[^)]*\/api\/v1\/openapi\.json\)/);
            assert.ok(llms.includes('\n## Optional\n') && llms.lastIndexOf('\n## ') === llms.indexOf('\n## Optional\n'), 'Optional is last');
            assert.strictEqual((await t.get('/learn/blackjack.md')).status, 200, 'a twin it links answers');
        });
    } finally { await t.close(); }
    done();
})().catch((e) => { console.error(e); process.exit(1); });

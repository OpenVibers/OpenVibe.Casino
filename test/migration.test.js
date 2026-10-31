'use strict';
/**
 * The expand migration applies in one pass and creates exactly Casino's table (shared simulations) plus the SDK's account
 * receipts and telemetry; its constraints refuse an id or a game it does not know.
 */
const assert = require('assert');
const { boot, check, done } = require('./helpers/boot');

(async () => {
    const t = await boot();
    try {
        await check('0001_initial.sql applies and creates the Casino tables', async () => {
            const names = (await t.ctx.s.db.many("SELECT table_name AS name FROM information_schema.tables WHERE table_schema = current_schema() ORDER BY table_name")).map((r) => r.name);
            for (const table of ['casino_sims', 'account_data_events', 'telemetry_samples']) assert.ok(names.includes(table), `missing ${table}`);
            const cols = (await t.ctx.s.db.many("SELECT column_name AS c FROM information_schema.columns WHERE table_name = 'casino_sims'")).map((r) => r.c);
            assert.ok(!cols.some((c) => /subject|user|person|ip/.test(c)), 'a shared simulation has no name on it');
        });

        await check('a simulation row refuses an unknown game and a malformed id', async () => {
            const db = t.ctx.s.db;
            await assert.rejects(db.exec("INSERT INTO casino_sims (id, game, params, result) VALUES ('sim_aaaaaaaaaaaaaaaaaaaa', 'poker', '{}', '{}')"), /casino_sims_game/);
            await assert.rejects(db.exec("INSERT INTO casino_sims (id, game, params, result) VALUES ('nope', 'craps', '{}', '{}')"), /casino_sims_id/);
            await db.exec("INSERT INTO casino_sims (id, game, params, result) VALUES ('sim_aaaaaaaaaaaaaaaaaaaa', 'craps', '{}', '{}')");
        });
    } finally {
        await t.close();
    }
    done();
})();

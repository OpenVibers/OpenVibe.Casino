'use strict';

/**
 * /api/v1 — OpenVibe.Casino's JSON API. Open to anyone: there is nothing personal here and no money.
 *
 *   GET    /ping                liveness for the API
 *   GET    /games               every game, its rules, each bet's house edge and where the figure comes from
 *   GET    /games/:id           one game
 *   POST   /simulate            { game, choice, rounds, seed?, share? } → the measured edge (and a share link)
 *   GET    /sims/:id            a shared simulation
 *   GET    /openapi.json        this API as OpenAPI 3.1
 *
 * Simulations are bounded (CASINO_SIM_MAX_ROUNDS rounds, CASINO_SIM_PER_MINUTE a minute per address) because they run in
 * this process. Errors are application/problem+json with a `code`.
 */
const express = require('express');
const { http } = require('openvibe-contracts');
const { asyncRouter } = require('./router');
const games = require('../../engine/games');

function createApi(ctx) {
    const { config, sims } = ctx;
    const r = asyncRouter();
    r.use(express.json({ limit: '4kb' }));
    const problem = (res, status, code, detail) => http.sendProblem(res, status, code, { detail });

    // The per-address budget for simulations: they spend CPU in this process.
    const recent = new Map();
    const allowed = (key) => {
        const now = Date.now();
        const list = (recent.get(key) || []).filter((t) => now - t < 60_000);
        if (list.length >= config.simulate.perMinute) { recent.set(key, list); return false; }
        list.push(now);
        recent.set(key, list);
        if (recent.size > 10_000) recent.clear();
        return true;
    };

    r.get('/ping', (_req, res) => res.json({ ok: true, service: 'casino' }));
    r.get('/games', (_req, res) => { res.set('Cache-Control', 'public, max-age=3600'); res.json({ games: games.catalogue() }); });
    r.get('/games/:id', (req, res) => {
        const g = games.get(req.params.id);
        if (!g) return problem(res, 404, 'casino.not_found', 'no such game');
        res.set('Cache-Control', 'public, max-age=3600');
        return res.json({ game: g });
    });

    r.post('/simulate', async (req, res) => {
        res.set('Cache-Control', 'no-store');
        if (!allowed(req.ip || 'unknown')) return problem(res, 429, 'casino.rate_limited', `at most ${config.simulate.perMinute} server simulations a minute; the simulator page runs them in your browser without a limit`);
        let p;
        try { p = sims.parse(req.body || {}); } catch (err) { return problem(res, err.status || 400, err.code || 'casino.invalid', err.message); }
        const result = sims.run(p);
        if (req.body && req.body.share === true) {
            const id = await sims.share(p, result);
            return res.status(201).json({ result, id, url: `${config.baseUrl}/s/${id}` });
        }
        return res.json({ result });
    });

    r.get('/sims/:id', async (req, res) => {
        const sim = await sims.get(req.params.id);
        if (!sim) return problem(res, 404, 'casino.not_found', 'no such simulation');
        res.set('Cache-Control', 'public, max-age=3600');
        return res.json({ sim });
    });

    r.get('/openapi.json', (_req, res) => res.json(openapi(config)));
    return r;
}

function openapi(config) {
    const json = (schema) => ({ content: { 'application/json': { schema } } });
    const problemRef = { description: 'Problem', ...json({ type: 'object', properties: { code: { type: 'string' }, detail: { type: 'string' } } }) };
    return {
        openapi: '3.1.0',
        info: { title: 'OpenVibe.Casino API', version: require('../../package.json').version, description: 'Casino games\' rules and house edges, worked out by open engines, and simulations of them. Play chips only: nothing here is money.' },
        servers: [{ url: `${config.baseUrl}/api/v1` }],
        paths: {
            '/games': { get: { summary: 'Every game, its rules and each bet\'s house edge', responses: { 200: { description: 'The games', ...json({ type: 'object', properties: { games: { type: 'array', items: { type: 'object' } } } }) } } } },
            '/games/{id}': { get: { summary: 'One game', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', enum: games.catalogue().map((g) => g.id) } }], responses: { 200: { description: 'The game' }, 404: problemRef } } },
            '/simulate': { post: {
                summary: 'Run a bounded simulation on the server',
                requestBody: { required: true, ...json({ type: 'object', required: ['game'], properties: { game: { type: 'string' }, choice: { type: 'string' }, rounds: { type: 'integer', minimum: 1000, maximum: config.simulate.maxRounds }, seed: { type: 'integer', minimum: 0, maximum: 4294967295 }, share: { type: 'boolean' } } }) },
                responses: { 200: { description: 'The measured edge' }, 201: { description: 'The measured edge and its share link' }, 400: problemRef, 429: problemRef },
            } },
            '/sims/{id}': { get: { summary: 'A shared simulation', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', pattern: '^sim_[a-z2-7]{20}$' } }], responses: { 200: { description: 'The simulation' }, 404: problemRef } } },
        },
    };
}

module.exports = { createApi, openapi };

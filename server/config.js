'use strict';

/**
 * OpenVibe.Casino configuration. Every value comes from the environment (production: /etc/openvibe/casino.env,
 * see .env.example). Only environment variable NAMES appear in code and docs; secrets are never logged.
 *
 * load(env) is pure so tests can build a config without touching process.env.
 */
require('dotenv').config();
const trim = (s) => String(s || '').replace(/\/+$/, '');
const int = (v, def) => (Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : def);

function load(env = process.env) {
    const nodeEnv = env.NODE_ENV || 'development';
    const isProduction = nodeEnv === 'production';
    const port = int(env.PORT, 5210);
    const baseUrl = trim(env.BASE_URL || (isProduction ? 'https://openvibe.casino' : `http://localhost:${port}`));
    const networkUrl = trim(env.OV_NETWORK_URL || 'https://openvibe.network');

    return {
        service: 'casino',
        port,
        host: env.HOST || '127.0.0.1',
        nodeEnv,
        isProduction,
        baseUrl,
        trustProxy: env.TRUST_PROXY != null ? Number(env.TRUST_PROXY) : 2,
        drill: env.CASINO_DRILL === '1' || env.CASINO_DRILL === 'true',
        limits: {
            minute: Math.max(1, int(env.CASINO_LIMITS_MINUTE, 120)),
            hour: Math.max(1, int(env.CASINO_LIMITS_HOUR, 3000)),
        },

        // PostgreSQL (ADR-035): DATABASE_URL serves (PgBouncer), DATABASE_DIRECT_URL migrates (owner role). In
        // development without DATABASE_URL an embedded PGlite database in data/pglite is used (CASINO_PGLITE_DIR
        // overrides the directory).
        db: { url: env.DATABASE_URL || '', directUrl: env.DATABASE_DIRECT_URL || '', pgliteDir: env.CASINO_PGLITE_DIR || '' },
        valkey: { url: env.VALKEY_URL || '', prefix: env.VALKEY_PREFIX || 'ov:casino:' },

        // OpenVibe.Network: SSO (OAuth2 authorization server with PKCE) and its JWKS.
        networkUrl,
        networkInternalUrl: trim(env.OV_NETWORK_INTERNAL_URL || 'http://127.0.0.1:4000'),
        networkIssuer: trim(env.OV_NETWORK_ISSUER || networkUrl),
        audience: env.CASINO_AUDIENCE || 'openvibe.casino',
        oauth: {
            clientId: env.OV_OAUTH_CLIENT_ID || 'casino',
            clientSecret: env.OV_OAUTH_CLIENT_SECRET || '',
            redirectUri: env.OV_OAUTH_REDIRECT_URI || `${baseUrl}/auth/callback`,
            scope: 'profile',
            sessionAudience: env.OV_SESSION_AUDIENCE || 'openvibe.network',
        },
        cookies: { secure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : isProduction },

        // OpenVibe.Events → this service's account export/deletion route. The secret signs a delivery
        // (comma-separated for rotation, 32+ characters each); unset turns POST /internal/events off (503).
        events: {
            secrets: String(env.CASINO_EVENTS_SECRET || '').split(',').map((x) => x.trim()).filter(Boolean),
            url: trim(env.CASINO_EVENTS_URL || env.EVENTS_URL || ''),
            endpoint: env.CASINO_EVENTS_ENDPOINT || '',
            intervalMs: Math.max(500, int(env.CASINO_EVENTS_INTERVAL_MS, 5000)),
            scope: env.CASINO_EVENTS_SCOPE || 'events.event.publish',
        },

        // Simulations run on the server (POST /api/v1/simulate): at most this many rounds each, and shared links kept.
        simulate: {
            maxRounds: Math.min(2_000_000, Math.max(1000, int(env.CASINO_SIM_MAX_ROUNDS, 200_000))),
            perMinute: Math.max(1, int(env.CASINO_SIM_PER_MINUTE, 6)),
        },
    };
}

module.exports = { load };

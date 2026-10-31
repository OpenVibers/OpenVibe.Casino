-- phase: expand
-- OpenVibe.Casino: learn it, play it, never pay it. Nothing here is money or a person: play chips live in the player's
-- browser, and a shared simulation is a seeded run of a game's engine with its result, with no name on it.

-- A simulation someone shared (POST /api/v1/simulate with share): the game, the strategy and the seed are enough to
-- run it again; the result is kept so the link opens at once. sim_ + 20 random base32 characters.
CREATE TABLE casino_sims (
    id          text COLLATE "C" PRIMARY KEY,
    game        text COLLATE "C" NOT NULL,
    params      jsonb NOT NULL,
    result      jsonb NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT casino_sims_id CHECK (id ~ '^sim_[a-z2-7]{20}$'),
    CONSTRAINT casino_sims_game CHECK (game IN ('blackjack', 'roulette', 'baccarat', 'craps', 'slots'))
);
CREATE INDEX casino_sims_created ON casino_sims (created_at);

-- openvibe-sdk/account-data keeps its own idempotency here (ADR-033): a redelivered export or deletion changes
-- nothing. It holds an export_id or deletion_id, the subject and the counts sent to Network; it is not a secret.
CREATE TABLE account_data_events (
    id         text PRIMARY KEY,
    kind       text NOT NULL,
    subject    text NOT NULL,
    outcome    jsonb,
    applied_at timestamptz NOT NULL DEFAULT now(),
    sent_at    timestamptz
);

-- Request telemetry (openvibe-sdk/telemetry): one row per aggregated sample, pruned after 14 days.
CREATE TABLE telemetry_samples (
    id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    at                    timestamptz NOT NULL,
    service               text NOT NULL,
    project               text,
    subject               text,
    resource              text,
    provider              text,
    node                  text,
    cell                  text,
    region                text,
    operation             text NOT NULL,
    latency_ms            double precision,
    queue_delay_ms        double precision,
    ttfb_ms               double precision,
    throughput_per_second double precision,
    bytes                 bigint,
    status                text,
    cache_status          text,
    cost_estimate         double precision,
    route_epoch           bigint,
    trace_id              text,
    extra                 jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX telemetry_samples_at_idx ON telemetry_samples (at);
CREATE INDEX telemetry_samples_service_idx ON telemetry_samples (service, operation, at);


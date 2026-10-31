'use strict';

/**
 * Account export and deletion → Casino (ADR-033; openvibe-sdk/account-data). Casino keeps nothing about a person: play
 * chips live in the player's browser and a shared simulation has no name on it, so an export says so and a deletion has
 * nothing to erase. The consumer still answers both topics, so Network's ledger shows Casino as done.
 */
const { createAccountData, TOPICS } = require('openvibe-sdk/account-data');

const TABLES = [];

function create({ db, log = console } = {}) {
    return createAccountData({
        db,
        service: 'casino',
        tables: TABLES,
        note: 'Casino keeps nothing about you: play chips live in your browser, and a shared simulation has no name on it.',
        log,
    });
}

module.exports = { create, TABLES, TOPICS };

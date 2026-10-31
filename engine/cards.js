'use strict';

/**
 * Cards, for the games that use them. A card is a plain object — { rank: 1..13, suit: 0..3 } — so it survives
 * JSON, a Web Worker's message and a database column without a parser. Rank 1 is the ace, 11 the jack, 12 the
 * queen, 13 the king.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) { module.exports = api; return; }
    root.OpenVibeCards = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const SUITS = ['♠', '♥', '♦', '♣'];
    const RANKS = [null, 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

    /** A fresh shoe of `decks` shuffled decks, in order (the caller shuffles). */
    function makeShoe(decks = 6) {
        const out = [];
        for (let d = 0; d < decks; d += 1) {
            for (let s = 0; s < 4; s += 1) {
                for (let r = 1; r <= 13; r += 1) out.push({ rank: r, suit: s });
            }
        }
        return out;
    }

    const label = (card) => (card && card.rank ? RANKS[card.rank] : '');
    const suit = (card) => (card ? SUITS[card.suit] : '');
    const isRed = (card) => Boolean(card) && (card.suit === 1 || card.suit === 2);
    const text = (card) => `${label(card)}${suit(card)}`;
    const isTen = (card) => Boolean(card) && card.rank >= 10;

    /**
     * The best total a hand can make: an ace is 11 unless that busts, then 1; jack, queen and king are 10.
     * Returns { total, soft, bust }. Two aces are a soft 12, three aces a soft 13.
     */
    function handValue(cards) {
        const list = Array.isArray(cards) ? cards : [];
        let aces = 0;
        let total = 0;
        for (const c of list) {
            if (!c) continue;
            if (c.rank === 1) aces += 1;
            else total += c.rank > 10 ? 10 : c.rank;
        }
        let soft = false;
        if (aces > 0) {
            total += 10 + aces;
            soft = true;
            if (total > 21) { total -= 10; soft = false; }
        }
        return { total, soft, bust: total > 21 };
    }

    /** A natural: an ace and a ten-value card, two cards only. */
    function isBlackjack(cards) {
        return Array.isArray(cards) && cards.length === 2 && handValue(cards).total === 21;
    }

    return { SUITS, RANKS, makeShoe, label, suit, isRed, text, handValue, isBlackjack, isTen };
});

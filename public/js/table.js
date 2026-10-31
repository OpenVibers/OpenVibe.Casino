/* OpenVibe.Casino's tables. The engines (/engine/*.js, the same files the server and the simulator run) deal every card,
 * spin and roll from a seed made here; this file only draws the table and passes your choices to them. Chips come from
 * window.CasinoChips (public/js/casino.js) and are worth nothing. Every control is a button, every result is read out
 * (aria-live), and motion follows the network's tokens, so Calm and reduced motion keep it still. */
(function () {
    'use strict';
    var felt = document.querySelector('[data-cs-felt]');
    if (!felt) return;
    var game = document.getElementById('cs-table').getAttribute('data-game');
    var chips = window.CasinoChips;
    var seed = (function () { try { var a = new Uint32Array(1); crypto.getRandomValues(a); return a[0]; } catch (e) { return Date.now() >>> 0; } })();

    // ── Small helpers: DOM nodes only, never markup from strings ──
    function el(tag, attrs) {
        var n = document.createElement(tag);
        if (attrs) Object.keys(attrs).forEach(function (k) {
            if (k === 'text') n.textContent = attrs[k];
            else if (k === 'on') Object.keys(attrs.on).forEach(function (ev) { n.addEventListener(ev, attrs.on[ev]); });
            else if (k === 'class') n.className = attrs[k];
            else n.setAttribute(k, attrs[k]);
        });
        var add = function (c) { if (c == null) return; if (Array.isArray(c)) { c.forEach(add); return; } n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); };
        for (var i = 2; i < arguments.length; i++) add(arguments[i]);
        return n;
    }
    function fmt(n) { return (Math.round(n * 100) / 100).toLocaleString('en-US'); }
    var say = el('p', { class: 'cs-say', 'aria-live': 'polite', text: '' });
    function tell(text, kind) { say.textContent = text; say.className = 'cs-say' + (kind ? ' is-' + kind : ''); }
    var denom = 25;
    function denomPicker() {
        var row = el('div', { class: 'cs-denoms', role: 'radiogroup', 'aria-label': 'Chip size' });
        [5, 25, 100].forEach(function (d) {
            var b = el('button', { type: 'button', class: 'cs-chip c' + d, role: 'radio', 'aria-checked': String(d === denom), text: String(d), on: { click: function () { denom = d; row.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); }); } } });
            row.appendChild(b);
        });
        return row;
    }
    function card(c, hidden) {
        if (hidden) return el('span', { class: 'cs-card is-back', 'aria-label': 'face-down card' });
        var red = c.suit === 1 || c.suit === 2;
        var name = window.OpenVibeCards.label(c) + window.OpenVibeCards.suit(c);
        return el('span', { class: 'cs-card' + (red ? ' is-red' : ''), 'aria-label': name }, el('b', { text: window.OpenVibeCards.label(c) }), el('i', { text: window.OpenVibeCards.suit(c) }));
    }
    function btn(label, fn, cls) { return el('button', { type: 'button', class: 'cs-btn' + (cls ? ' ' + cls : ''), text: label, on: { click: fn } }); }

    var TABLES = {};

    // ── Blackjack ────────────────────────────────────────────
    TABLES.blackjack = function () {
        var B = window.OpenVibeBlackjack;
        var g = B.createGame({ seed: seed });
        var bet = 25; var showHint = false;
        var dealerRow = el('div', { class: 'cs-hand cs-dealer' });
        var handsRow = el('div', { class: 'cs-hands' });
        var controls = el('div', { class: 'cs-controls' });
        var betLine = el('div', { class: 'cs-betline' });
        var hintBox = el('label', { class: 'cs-hint-toggle' }, el('input', { type: 'checkbox', on: { change: function (e) { showHint = e.target.checked; draw(); } } }), ' Show the basic-strategy move');
        felt.appendChild(el('div', { class: 'cs-bj' }, el('p', { class: 'cs-label', text: 'Dealer' }), dealerRow, el('p', { class: 'cs-label', text: 'You' }), handsRow, say, controls, betLine, hintBox));

        function total(s) { return s.dealerTotal != null ? ' · ' + s.dealerTotal : ''; }
        function draw() {
            var s = g.state();
            dealerRow.replaceChildren();
            if (s.phase !== 'idle') {
                s.dealer.forEach(function (c) { dealerRow.appendChild(card(c)); });
                if (s.phase !== 'done') dealerRow.appendChild(card(null, true));
                dealerRow.appendChild(el('span', { class: 'cs-total', text: s.phase === 'done' ? 'Dealer' + total(s) : '' }));
            }
            handsRow.replaceChildren();
            s.hands.forEach(function (h, i) {
                var box = el('div', { class: 'cs-hand' + (s.phase === 'player' && i === s.current ? ' is-now' : '') });
                h.cards.forEach(function (c) { box.appendChild(card(c)); });
                box.appendChild(el('span', { class: 'cs-total', text: (h.soft && h.total < 21 ? 'soft ' : '') + h.total + ' · bet ' + h.bet }));
                handsRow.appendChild(box);
            });
            controls.replaceChildren();
            var options = g.available();
            var hint = showHint ? g.hint() : null;
            var labels = { hit: 'Hit', stand: 'Stand', double: 'Double', split: 'Split', insure: 'Take insurance', 'no-insurance': 'No insurance' };
            options.forEach(function (o) {
                var extra = (o === 'double' || o === 'split') ? s.hands[s.current].bet : o === 'insure' ? s.hands[0].bet / 2 : 0;
                if (extra && !chips.can(committed() + extra)) return;
                var b = btn(labels[o], function () { g.act(o); after(); }, hint === o ? 'is-hint' : '');
                controls.appendChild(b);
            });
            betLine.replaceChildren();
            if (s.phase === 'idle' || s.phase === 'done') {
                betLine.appendChild(denomPicker());
                betLine.appendChild(btn('Deal ' + bet, deal));
                betLine.appendChild(el('span', { class: 'cs-muted', text: 'Bet' }));
                [-1, 1].forEach(function (d) { betLine.appendChild(btn(d < 0 ? '−' : '+', function () { bet = Math.max(5, bet + d * denom); draw(); }, 'is-quiet is-small')); });
            }
        }
        function committed() { return g.state().hands.reduce(function (a, h) { return a + h.bet; }, 0) + (g.state().insurance || 0); }
        function deal() {
            if (!chips.can(bet)) { tell('Not enough chips for that bet. A fresh 1,000 arrive at midnight.', 'bad'); return; }
            g.start(bet);
            tell(g.phase === 'insurance' ? 'The dealer shows an ace. Insurance? (Basic strategy says no.)' : 'Your move.');
            after();
        }
        function after() {
            var s = g.state();
            if (s.phase === 'done') {
                var net = s.outcome.net;
                chips.change(net);
                var words = s.outcome.results.map(function (r) { return { blackjack: 'Blackjack!', win: 'You win', lose: 'Dealer wins', push: 'Push', bust: 'Bust' }[r.result]; }).join(', ');
                tell(words + (net ? (net > 0 ? ': +' : ': ') + fmt(net) + ' chips' : ''), net > 0 ? 'good' : net < 0 ? 'bad' : '');
            } else if (s.phase === 'player') tell(showHint ? 'Basic strategy: ' + g.hint() + '.' : 'Your move.');
            draw();
        }
        draw();
        tell('Pick a bet and deal. Six decks, dealer stands on soft 17, blackjack pays 3 to 2.');
    };

    // ── Roulette ─────────────────────────────────────────────
    TABLES.roulette = function () {
        var R = window.OpenVibeRoulette;
        var wheel = 'european';
        var g = R.createGame({ wheel: wheel, seed: seed });
        var bets = {};      // key → { bet, amount }
        var board = el('div', { class: 'cs-board' });
        var strip = el('div', { class: 'cs-strip', 'aria-hidden': 'true' });
        var placed = el('p', { class: 'cs-muted' });
        var wheelPick = el('div', { class: 'cs-seg', role: 'radiogroup', 'aria-label': 'Wheel' });
        ['european', 'american'].forEach(function (w) {
            wheelPick.appendChild(el('button', { type: 'button', role: 'radio', 'aria-checked': String(w === wheel), text: w === 'european' ? 'European (one zero)' : 'American (0 and 00)', on: { click: function () { wheel = w; g = R.createGame({ wheel: wheel, seed: seed + 1 }); bets = {}; build(); wheelPick.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-checked', String(x.textContent.indexOf(w === 'european' ? 'European' : 'American') === 0)); }); } } }));
        });
        felt.appendChild(el('div', { class: 'cs-rl' }, wheelPick, strip, board, say, placed, el('div', { class: 'cs-betline' }, denomPicker(), btn('Spin', spin), btn('Clear bets', function () { bets = {}; paintBets(); }, 'is-quiet'))));

        function sum() { return Object.keys(bets).reduce(function (a, k) { return a + bets[k].amount; }, 0); }
        function place(key, bet) {
            if (!chips.can(sum() + denom)) { tell('Not enough chips for another ' + denom + '.', 'bad'); return; }
            bets[key] = bets[key] || { bet: bet, amount: 0 };
            bets[key].amount += denom;
            paintBets();
        }
        function paintBets() {
            board.querySelectorAll('[data-k]').forEach(function (c) { var b = bets[c.getAttribute('data-k')]; c.setAttribute('data-chips', b ? String(b.amount) : ''); c.classList.toggle('has-bet', !!b); });
            placed.textContent = sum() ? 'On the table: ' + fmt(sum()) + ' chips. House edge on every bet: ' + (R.edge({ type: 'red' }, wheel) * 100).toFixed(2) + '%' + (wheel === 'american' && bets.top ? ' (the top line: 7.89%)' : '') + '.' : 'Pick a chip size, then click the numbers or the outside bets.';
        }
        function cell(label, key, bet, cls) { return el('button', { type: 'button', class: 'cs-cell ' + (cls || ''), 'data-k': key, text: label, 'aria-label': label + (bet.type === 'straight' ? '' : ' bet'), on: { click: function () { place(key, bet); } } }); }
        function build() {
            board.replaceChildren();
            var zeros = el('div', { class: 'cs-zeros' });
            (wheel === 'american' ? ['0', '00'] : ['0']).forEach(function (z) { zeros.appendChild(cell(z, 'n' + z, { type: 'straight', numbers: [z] }, 'is-green')); });
            var grid = el('div', { class: 'cs-grid' });
            for (var row = 3; row >= 1; row--) for (var col = 0; col < 12; col++) {
                var n = col * 3 + row;
                grid.appendChild(cell(String(n), 'n' + n, { type: 'straight', numbers: [String(n)] }, R.colour(String(n)) === 'red' ? 'is-red' : 'is-black'));
            }
            var cols = el('div', { class: 'cs-cols' });
            [3, 2, 1].forEach(function (c) { cols.appendChild(cell('2 to 1', 'c' + c, { type: 'column', which: c })); });
            var outs = el('div', { class: 'cs-outs' });
            [['1st 12', 'd1', { type: 'dozen', which: 1 }], ['2nd 12', 'd2', { type: 'dozen', which: 2 }], ['3rd 12', 'd3', { type: 'dozen', which: 3 }], ['1 to 18', 'low', { type: 'low' }], ['Even', 'even', { type: 'even' }], ['Red', 'red', { type: 'red' }, 'is-red'], ['Black', 'black', { type: 'black' }, 'is-black'], ['Odd', 'odd', { type: 'odd' }], ['19 to 36', 'high', { type: 'high' }]].concat(wheel === 'american' ? [['0, 00, 1, 2, 3', 'top', { type: 'top' }]] : [])
                .forEach(function (o) { outs.appendChild(cell(o[0], o[1], o[2], o[3])); });
            board.append(zeros, grid, cols, outs);
            strip.replaceChildren();
            paintBets();
        }
        function spin() {
            var list = Object.keys(bets).map(function (k) { var b = bets[k]; return Object.assign({}, b.bet, { amount: b.amount }); });
            if (!list.length) { tell('Place a bet first.'); return; }
            var r = g.spin(list);
            chips.change(r.net);
            strip.replaceChildren(el('span', { class: 'cs-pocket is-' + r.colour, text: r.pocket }));
            tell(r.pocket + ' ' + r.colour + '. ' + (r.net > 0 ? 'You win ' + fmt(r.net) + ' chips.' : r.net < 0 ? 'The house takes ' + fmt(-r.net) + '.' : 'Even.'), r.net > 0 ? 'good' : r.net < 0 ? 'bad' : '');
        }
        build();
    };

    // ── Baccarat ─────────────────────────────────────────────
    TABLES.baccarat = function () {
        var BC = window.OpenVibeBaccarat;
        var g = BC.createGame({ seed: seed });
        var stakes = { player: 0, banker: 0, tie: 0 };
        var hands = el('div', { class: 'cs-bac-hands' });
        var spots = el('div', { class: 'cs-spots' });
        var edges = { player: '1.24%', banker: '1.06%', tie: '14.36%' };
        ['player', 'banker', 'tie'].forEach(function (k) {
            spots.appendChild(el('button', { type: 'button', class: 'cs-spot', 'data-k': k, on: { click: function () {
                var total = stakes.player + stakes.banker + stakes.tie;
                if (!chips.can(total + denom)) { tell('Not enough chips for another ' + denom + '.', 'bad'); return; }
                stakes[k] += denom; paint();
            } } }, el('b', { text: k === 'tie' ? 'Tie' : k[0].toUpperCase() + k.slice(1) }), el('span', { text: k === 'banker' ? 'pays 0.95 to 1' : k === 'tie' ? 'pays 8 to 1' : 'pays 1 to 1' }), el('small', { text: 'house edge ' + edges[k] }), el('em', { 'data-amount': '' })));
        });
        felt.appendChild(el('div', { class: 'cs-bac' }, hands, spots, say, el('div', { class: 'cs-betline' }, denomPicker(), btn('Deal', deal), btn('Clear bets', function () { stakes = { player: 0, banker: 0, tie: 0 }; paint(); }, 'is-quiet'))));
        function paint() { spots.querySelectorAll('[data-k]').forEach(function (s) { var a = stakes[s.getAttribute('data-k')]; s.querySelector('em').textContent = a ? a + ' chips' : ''; s.classList.toggle('has-bet', !!a); }); }
        function deal() {
            var list = Object.keys(stakes).filter(function (k) { return stakes[k]; }).map(function (k) { return { bet: k, amount: stakes[k] }; });
            if (!list.length) { tell('Put chips on the player, the banker or a tie.'); return; }
            var r = g.deal(list);
            chips.change(r.net);
            hands.replaceChildren(
                el('div', { class: 'cs-hand' + (r.winner === 'player' ? ' is-win' : '') }, el('p', { class: 'cs-label', text: 'Player · ' + r.playerTotal }), el('div', { class: 'cs-row' }, r.playerCards.map(function (c) { return card(c); }))),
                el('div', { class: 'cs-hand' + (r.winner === 'banker' ? ' is-win' : '') }, el('p', { class: 'cs-label', text: 'Banker · ' + r.bankerTotal }), el('div', { class: 'cs-row' }, r.bankerCards.map(function (c) { return card(c); }))));
            tell((r.winner === 'tie' ? 'A tie' : (r.winner === 'player' ? 'The player' : 'The banker') + ' wins') + ', ' + r.playerTotal + ' to ' + r.bankerTotal + '. ' + (r.net > 0 ? '+' + fmt(r.net) + ' chips.' : r.net < 0 ? fmt(r.net) + ' chips.' : 'Your bet pushes.'), r.net > 0 ? 'good' : r.net < 0 ? 'bad' : '');
        }
        paint();
        tell('Put chips on a spot and deal. The cards play themselves; the banker bet costs least.');
    };

    // ── Craps ────────────────────────────────────────────────
    TABLES.craps = function () {
        var C = window.OpenVibeCraps;
        var g = C.createGame({ seed: seed });
        var dice = el('div', { class: 'cs-dice', 'aria-hidden': 'true' });
        var puck = el('p', { class: 'cs-puck' });
        var spots = el('div', { class: 'cs-spots' });
        var open = el('p', { class: 'cs-muted' });
        var kinds = [['pass', 'Pass line', 'even money · 1.41%'], ['dontPass', 'Don\'t pass', 'even money · 1.36%'], ['odds', 'Odds behind the line', 'true odds · 0%'], ['place6', 'Place 6', '7 to 6 · 1.52%'], ['place8', 'Place 8', '7 to 6 · 1.52%'], ['field', 'Field', 'one roll · 5.56%']];
        kinds.forEach(function (k) {
            spots.appendChild(el('button', { type: 'button', class: 'cs-spot', 'data-k': k[0], on: { click: function () {
                var stake = g.bets.reduce(function (a, b) { return a + b.amount; }, 0);
                if (!chips.can(stake + denom)) { tell('Not enough chips for another ' + denom + '.', 'bad'); return; }
                var type = k[0].indexOf('place') === 0 ? 'place' : k[0];
                var out = g.bet(type, denom, type === 'place' ? Number(k[0].slice(5)) : null);
                tell(out.ok ? k[1] + ': ' + denom + ' chips down.' : out.error[0].toUpperCase() + out.error.slice(1) + '.', out.ok ? '' : 'bad');
                paint();
            } } }, el('b', { text: k[1] }), el('small', { text: k[2] })));
        });
        felt.appendChild(el('div', { class: 'cs-cr' }, el('div', { class: 'cs-cr-top' }, dice, puck), spots, say, open, el('div', { class: 'cs-betline' }, denomPicker(), btn('Roll', roll))));
        var PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
        function die(n) { var d = el('span', { class: 'cs-die' }); for (var i = 0; i < 9; i++) d.appendChild(el('i', { class: PIPS[n].indexOf(i) >= 0 ? 'on' : '' })); return d; }
        function paint() {
            puck.textContent = g.point ? 'The point is ' + g.point : 'Come-out roll: no point yet';
            puck.classList.toggle('is-on', !!g.point);
            var list = g.bets;
            open.textContent = list.length ? 'On the table: ' + list.map(function (b) { return (b.type === 'place' ? 'place ' + b.at : b.type === 'dontPass' ? 'don\'t pass' : b.type) + ' ' + b.amount; }).join(', ') : 'No bets down.';
        }
        function roll() {
            if (!g.bets.length) { tell('Put a bet down first; the pass line is the classic.'); return; }
            var r = g.roll();
            chips.change(r.net);
            dice.replaceChildren(die(r.dice[0]), die(r.dice[1]));
            var line = r.total + '. ' + (r.settled.length ? r.settled.map(function (b) { return (b.type === 'place' ? 'place ' + b.at : b.type === 'dontPass' ? 'don\'t pass' : b.type) + (b.net > 0 ? ' wins ' + fmt(b.net) : b.net < 0 ? ' loses' : ' pushes'); }).join(', ') + '.' : 'Nothing settles.');
            if (!r.pointBefore && r.point) line += ' The point is ' + r.point + '.';
            if (r.pointBefore && !r.point) line += ' The point is over.';
            tell(line, r.net > 0 ? 'good' : r.net < 0 ? 'bad' : '');
            paint();
        }
        paint();
        tell('Bet the pass line and roll. Once there is a point, odds behind it pay true odds, the only free bet in the house.');
    };

    // ── Slots ────────────────────────────────────────────────
    TABLES.slots = function () {
        var S = window.OpenVibeSlots;
        var g = S.createGame({ seed: seed });
        var bet = 5;
        var reels = el('div', { class: 'cs-reels-live', 'aria-hidden': 'true' });
        var x = S.exact();
        felt.appendChild(el('div', { class: 'cs-sl' }, reels, say,
            el('p', { class: 'cs-muted', text: 'This machine pays back ' + (x.rtp * 100).toFixed(2) + '% over time and wins something on ' + Math.round(x.hitRate * 100) + '% of spins. The house keeps ' + (x.edge * 100).toFixed(2) + '%.' }),
            el('div', { class: 'cs-betline' }, el('span', { class: 'cs-muted', text: 'Bet' }), [1, 5, 25].reduce(function (seg, b) { seg.appendChild(el('button', { type: 'button', role: 'radio', 'aria-checked': String(b === bet), text: String(b), on: { click: function (e) { bet = b; seg.querySelectorAll('button').forEach(function (y) { y.setAttribute('aria-checked', String(y === e.currentTarget)); }); } } })); return seg; }, el('div', { class: 'cs-seg', role: 'radiogroup', 'aria-label': 'Bet' })), btn('Spin', spin))));
        function face(sym) { return el('span', { class: 'cs-sym sym-' + sym, text: { seven: '7', bell: 'BELL', star: '★', plum: 'PLUM', lemon: 'LEMON', cherry: 'CHERRY', blank: '' }[sym] }); }
        function paint(line) { reels.replaceChildren(); line.forEach(function (s) { reels.appendChild(el('span', { class: 'cs-reel-win' }, face(s))); }); }
        function spin() {
            if (!chips.can(bet)) { tell('Not enough chips for that bet.', 'bad'); return; }
            var r = g.spin(bet);
            chips.change(r.net);
            paint(r.line);
            reels.classList.remove('is-new'); void reels.offsetWidth; reels.classList.add('is-new');
            tell(r.win ? 'Pays ' + fmt(r.win) + (r.win < bet ? ': less than the bet, so still a loss of ' + fmt(bet - r.win) : r.win === bet ? ': your bet back' : ': +' + fmt(r.net)) + '.' : 'No win. −' + bet + '.', r.net > 0 ? 'good' : r.net < 0 ? 'bad' : '');
        }
        paint(['seven', 'bell', 'star']);
        tell('Pick a bet and spin. Every stop on every reel is equally likely; Learn shows the strips.');
    };

    function start() { if (TABLES[game]) TABLES[game](); }
    var gate = document.querySelector('[data-cs-gate]');
    if (gate && !gate.hidden) document.addEventListener('cs-gate-open', start, { once: true });
    else start();
})();

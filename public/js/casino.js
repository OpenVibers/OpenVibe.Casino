/* OpenVibe.Casino, on every page: the play chips (a fresh 1,000 each day, kept in this browser, worth nothing), the
 * 18+ gate in front of the tables, and the reminder of how long a session has run. Everything here is local: no chip
 * count, age answer or session time leaves the browser. */
(function () {
    'use strict';
    var DAILY = 1000;
    var KEY = 'cs_chips';
    var store = {
        get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
        set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode: this page only */ } },
    };
    var today = function () { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
    var memory = null;

    function read() {
        var v = null;
        try { v = JSON.parse(store.get(KEY) || 'null'); } catch (e) { v = null; }
        if (!v && memory) v = memory;
        if (!v || v.day !== today() || typeof v.chips !== 'number' || !isFinite(v.chips)) v = { day: today(), chips: DAILY, best: DAILY };
        return v;
    }
    function write(v) { memory = v; store.set(KEY, JSON.stringify(v)); paint(); }
    function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
    function paint() {
        var v = read();
        document.querySelectorAll('[data-cs-chips]').forEach(function (el) { el.textContent = fmt(v.chips); });
        document.querySelectorAll('[data-cs-reset]').forEach(function (el) { el.textContent = v.chips < 1 ? 'Out for today: a fresh 1,000 at midnight' : 'A fresh 1,000 each day'; });
    }

    /** The chips: get(), change(net) after a settled bet, and can(n) before one. */
    window.CasinoChips = {
        get: function () { return read().chips; },
        can: function (n) { return read().chips >= n; },
        change: function (net) {
            var v = read();
            v.chips = Math.max(0, Math.round((v.chips + net) * 100) / 100);
            v.best = Math.max(v.best || DAILY, v.chips);
            write(v);
            return v.chips;
        },
        paint: paint,
    };

    function gate() {
        var g = document.querySelector('[data-cs-gate]');
        if (!g) return;
        if (store.get('cs_adult') === 'yes' || (memory && memory.adult)) return;
        g.hidden = false;
        var yes = g.querySelector('[data-cs-adult]');
        if (yes) {
            yes.focus();
            yes.addEventListener('click', function () { store.set('cs_adult', 'yes'); memory = Object.assign(read(), { adult: true }); g.hidden = true; document.dispatchEvent(new CustomEvent('cs-gate-open')); });
        }
    }

    // The session reminder: every 30 minutes at a table, one calm line.
    function session() {
        var el = document.querySelector('[data-cs-session]');
        if (!el) return;
        var started = Number(sessionStorage.getItem('cs_started')) || Date.now();
        try { sessionStorage.setItem('cs_started', String(started)); } catch (e) { /* */ }
        function check() {
            var mins = Math.floor((Date.now() - started) / 60000);
            if (mins >= 30) {
                el.hidden = false;
                el.textContent = 'You have been at the tables for ' + mins + ' minutes. A good moment for a break; the chips will be here.';
            }
        }
        check();
        setInterval(check, 60000);
    }

    function init() { paint(); gate(); session(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

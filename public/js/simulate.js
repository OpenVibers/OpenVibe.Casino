/* The simulator page: the form picks a game, a bet or strategy, the rounds and a seed; a Web Worker (sim-worker.js) plays
 * them with the engines and this file draws the house's share as it settles toward the exact figure, then says the result
 * in one plain sentence. A run of up to the server's limit can be shared: the server plays the same seed and keeps it. */
(function () {
    'use strict';
    var root = document.getElementById('cs-sim');
    if (!root) return;
    var form = root.querySelector('[data-cs-sim]');
    var gameSel = root.querySelector('[data-cs-sim-game]');
    var choiceSel = root.querySelector('[data-cs-sim-choice]');
    var canvas = root.querySelector('[data-cs-chart]');
    var result = root.querySelector('[data-cs-result]');
    var progress = root.querySelector('[data-cs-progress]');
    var shareBtn = root.querySelector('[data-cs-share]');
    var plans = JSON.parse(root.getAttribute('data-plans') || '{}');
    var refs = JSON.parse(root.getAttribute('data-refs') || '{}');
    var labels = JSON.parse(root.getAttribute('data-labels') || '{}');
    var maxShare = Number(root.getAttribute('data-max-share')) || 200000;
    var worker = null; var points = []; var last = null;

    function fillChoices(initial) {
        var list = plans[gameSel.value] || [];
        choiceSel.replaceChildren();
        list.forEach(function (c) { var o = document.createElement('option'); o.value = c; o.textContent = labels[gameSel.value + ':' + c] || c; if (c === initial) o.selected = true; choiceSel.appendChild(o); });
    }
    gameSel.addEventListener('change', function () { fillChoices(''); });
    fillChoices(choiceSel.getAttribute('data-initial'));

    function css(name, fallback) { var v = getComputedStyle(root).getPropertyValue(name).trim(); return v || fallback; }
    function draw(ref) {
        var ctx = canvas.getContext('2d');
        var w = canvas.width; var h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        if (!points.length) return;
        var vals = points.map(function (p) { return p.edge * 100; }).concat([ref]);
        var lo = Math.min.apply(null, vals); var hi = Math.max.apply(null, vals);
        var pad = Math.max(0.5, (hi - lo) * 0.15); lo -= pad; hi += pad;
        var x = function (i) { return 40 + (i / Math.max(1, points.length - 1)) * (w - 56); };
        var y = function (v) { return 12 + (1 - (v - lo) / (hi - lo)) * (h - 36); };
        ctx.font = '12px system-ui, sans-serif';
        ctx.fillStyle = css('--ovk-muted', '#93a0b4');
        ctx.fillText(hi.toFixed(1) + '%', 2, 16); ctx.fillText(lo.toFixed(1) + '%', 2, h - 24);
        ctx.strokeStyle = css('--ovk-muted', '#93a0b4'); ctx.setLineDash([5, 5]); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(40, y(ref)); ctx.lineTo(w - 16, y(ref)); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillText('the exact edge, ' + ref.toFixed(2) + '%', w - 170, y(ref) - 6);
        ctx.strokeStyle = css('--room-accent', '#51c672'); ctx.lineWidth = 2.5;
        ctx.beginPath();
        points.forEach(function (p, i) { var px = x(i); var py = y(p.edge * 100); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
        ctx.stroke();
        ctx.fillStyle = css('--ovk-muted', '#93a0b4');
        ctx.fillText('rounds played →', w - 120, h - 6);
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (worker) worker.terminate();
        var game = gameSel.value; var choice = choiceSel.value;
        var rounds = Number(form.elements.rounds.value);
        var seed = form.elements.seed.value ? Number(form.elements.seed.value) >>> 0 : (function () { try { var a = new Uint32Array(1); crypto.getRandomValues(a); return a[0]; } catch (x) { return Date.now() >>> 0; } })();
        form.elements.seed.value = String(seed);
        var ref = refs[game + ':' + choice] == null ? 0 : refs[game + ':' + choice];
        points = []; last = null; shareBtn.hidden = true;
        progress.hidden = false; progress.firstElementChild.style.width = '0%';
        result.textContent = 'Playing ' + rounds.toLocaleString('en-US') + ' rounds…';
        worker = new Worker('/js/sim-worker.js');
        worker.onmessage = function (m) {
            var d = m.data;
            if (d.type === 'progress') { points.push(d); progress.firstElementChild.style.width = (100 * d.done / rounds).toFixed(1) + '%'; draw(ref); return; }
            if (d.type === 'done') {
                progress.hidden = true;
                last = { game: game, choice: choice, rounds: rounds, seed: seed, result: d.result };
                var kept = d.result.edge_percent;
                result.textContent = 'Over ' + rounds.toLocaleString('en-US') + ' rounds the house kept ' + kept.toFixed(2) + '% of what was bet' + (kept < 0 ? ' (the player came out ahead this time; run longer and it turns)' : '') + '. The exact edge is ' + ref.toFixed(2) + '%; this run\'s margin of error is about ±' + (2 * d.result.stderr_percent).toFixed(2) + '%.';
                shareBtn.hidden = rounds > maxShare;
                worker.terminate(); worker = null;
            }
        };
        worker.postMessage({ game: game, choice: choice, rounds: rounds, seed: seed });
    });

    shareBtn.addEventListener('click', function () {
        if (!last) return;
        shareBtn.disabled = true;
        fetch('/api/v1/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: last.game, choice: last.choice, rounds: last.rounds, seed: last.seed, share: true }) })
            .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
            .then(function (x) {
                if (!x.ok) { result.textContent += ' Sharing did not work: ' + (x.j.detail || 'try again in a minute') + '.'; return; }
                var a = document.createElement('a'); a.href = x.j.url; a.textContent = x.j.url;
                result.appendChild(document.createTextNode(' Shared: ')); result.appendChild(a);
                try { navigator.clipboard.writeText(x.j.url); } catch (e) { /* the link is on the page */ }
            })
            .catch(function () { result.textContent += ' Sharing did not work; try again.'; })
            .then(function () { shareBtn.disabled = false; });
    });
})();

'use strict';
// WCAG 2.1 AA: the ladder's game names were their fixed tone colour as text (3.4:1 on white, 3.6:1 on dark).
// The tone now mixes 55% into the theme's text colour, so the name keeps its hue and gains the contrast.
//   node test/contrast.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'casino.css'), 'utf8');
assert.ok(
    css.includes('color: color-mix(in srgb, var(--tone) 55%, var(--text-primary, #e6edf7));'),
    'game names mix the ladder tone with the theme text colour'
);
assert.ok(!css.includes('.cs-l-game { font-size: 13px; font-weight: 700; color: var(--tone); }'), 'the bare tone colour is gone');
console.log('contrast: game names read on every theme');

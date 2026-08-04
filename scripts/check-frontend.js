#!/usr/bin/env node
/*
 * Frontend integrity check (no browser needed) — runs in CI on every push.
 * The app is split into index.html (markup) + styles.css + app.js. This
 * validates JS syntax, that critical functions/ids exist and are unique,
 * and that index.html wires up the external files. Fast and deterministic.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dir = path.resolve(__dirname, '..', 'frontend');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(dir, 'app.js'), 'utf8');
const sw = fs.readFileSync(path.join(dir, 'sw.js'), 'utf8');

let failures = 0;
const fail = (m) => { console.error('  ✗ ' + m); failures++; };
const ok = (m) => console.log('  ✓ ' + m);

// 1) JS syntax (app.js + service worker)
try { new vm.Script(appJs); ok('app.js parses'); } catch (e) { fail('app.js syntax: ' + e.message.split('\n')[0]); }
try { new vm.Script(sw); ok('sw.js parses'); } catch (e) { fail('sw.js syntax: ' + e.message.split('\n')[0]); }

// Any remaining inline <script> (there shouldn't be) must also parse
[...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].forEach((m, i) => {
  try { new vm.Script(m[1]); } catch (e) { fail(`inline script #${i + 1}: ${e.message.split('\n')[0]}`); }
});

// 2) index.html wires the external files
if (/<link[^>]+href="styles\.css"/.test(html)) ok('styles.css linked'); else fail('index.html does not link styles.css');
if (/<script[^>]+src="app\.js"/.test(html)) ok('app.js linked'); else fail('index.html does not load app.js');

// 3) Critical functions present exactly once (in app.js)
const requiredFns = [
  'navigate', 'refreshDashboard', 'renderPerfil', 'renderGoleiras', 'salvarGoleira',
  'calcPerformanceAuto', 'computeIGD', 'renderLesoes', 'renderPID', 'gerarAnaliseIA',
  'exportBackup', 'cloudPullNew', 'openTwoFactorSetup', 'forgetAthlete', 'menuScroll',
];
requiredFns.forEach((fn) => {
  const n = (appJs.match(new RegExp('function ' + fn + '\\b', 'g')) || []).length;
  if (n === 0) fail(`missing function ${fn}()`);
  else if (n > 1) fail(`duplicate function ${fn}() (${n}x)`);
});
if (!failures) ok(`${requiredFns.length} critical functions present, unique`);

// 4) Critical DOM ids present (in index.html)
const requiredIds = [
  'page-dashboard', 'page-perfil', 'page-lesoes', 'page-pid', 'page-clube',
  'auth-overlay', 'sidebar', 'toasts', 'fab-btn', 'menu-scroll', 'net-status', 'gk-main',
];
requiredIds.forEach((id) => { if (!html.includes('id="' + id + '"')) fail(`missing element id="${id}"`); });
if (requiredIds.every((id) => html.includes('id="' + id + '"'))) ok(`${requiredIds.length} critical DOM ids present`);

// 5) html lang set (accessibility/i18n)
if (/<html[^>]*\blang=/.test(html)) ok('html lang attribute set'); else fail('missing <html lang="...">');

console.log(failures ? `\nFRONTEND CHECK FAILED (${failures} issue(s))` : '\nFrontend check passed.');
process.exit(failures ? 1 : 0);

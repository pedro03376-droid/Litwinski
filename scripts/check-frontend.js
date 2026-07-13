#!/usr/bin/env node
/*
 * Frontend integrity check (no browser needed) — runs in CI on every push.
 * Catches the classes of regression this project has actually hit:
 *  - JavaScript syntax errors in the single-file app or the service worker
 *  - a critical function or DOM id going missing
 *  - accidental duplicate function definitions
 * Fast and deterministic; exits non-zero on any failure.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'frontend', 'index.html');
const swPath = path.join(root, 'frontend', 'sw.js');

let failures = 0;
const fail = (msg) => { console.error('  ✗ ' + msg); failures++; };
const ok = (msg) => console.log('  ✓ ' + msg);

const html = fs.readFileSync(htmlPath, 'utf8');

// 1) Inline <script> syntax
const scripts = [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
let badScripts = 0;
scripts.forEach((s, i) => { try { new vm.Script(s); } catch (e) { badScripts++; fail(`inline script #${i + 1} syntax: ${e.message.split('\n')[0]}`); } });
if (!badScripts) ok(`${scripts.length} inline script block(s) parse`);

// 2) Service worker syntax
try { new vm.Script(fs.readFileSync(swPath, 'utf8')); ok('sw.js parses'); } catch (e) { fail('sw.js syntax: ' + e.message.split('\n')[0]); }

// 3) Critical functions present exactly once
const requiredFns = [
  'navigate', 'refreshDashboard', 'renderPerfil', 'renderGoleiras', 'salvarGoleira',
  'calcPerformanceAuto', 'computeIGD', 'renderLesoes', 'renderPID', 'gerarAnaliseIA',
  'exportBackup', 'cloudPullNew', 'openTwoFactorSetup', 'forgetAthlete', 'menuScroll',
];
requiredFns.forEach((fn) => {
  const n = (html.match(new RegExp('function ' + fn + '\\b', 'g')) || []).length;
  if (n === 0) fail(`missing function ${fn}()`);
  else if (n > 1) fail(`duplicate function ${fn}() (${n}×)`);
});
if (!failures) ok(`${requiredFns.length} critical functions present, unique`);

// 4) Critical DOM ids present
const requiredIds = [
  'page-dashboard', 'page-perfil', 'page-lesoes', 'page-pid', 'page-clube',
  'auth-overlay', 'sidebar', 'toasts', 'fab-btn', 'menu-scroll', 'net-status',
];
requiredIds.forEach((id) => { if (!html.includes('id="' + id + '"')) fail(`missing element id="${id}"`); });
if (requiredIds.every((id) => html.includes('id="' + id + '"'))) ok(`${requiredIds.length} critical DOM ids present`);

// 5) html lang set (accessibility/i18n)
if (/<html[^>]*\blang=/.test(html)) ok('html lang attribute set'); else fail('missing <html lang="...">');

console.log(failures ? `\nFRONTEND CHECK FAILED (${failures} issue(s))` : '\nFrontend check passed.');
process.exit(failures ? 1 : 0);

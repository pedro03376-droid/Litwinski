#!/usr/bin/env node
/*
 * End-to-end smoke test (headless Chromium) — runs in CI.
 * Boots the real app with a seeded session + sample data and checks the
 * regression classes this project has actually hit:
 *   - the app boots (auth overlay hidden) with no uncaught JS error
 *   - every key page renders content when navigated to
 *   - no horizontal overflow (dashboard "cut off" bug)
 *   - the page can scroll vertically (menu/dashboard "no scroll" bug)
 * Exits non-zero on the first failure.
 */
const { chromium } = require('playwright');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, '..', 'frontend', 'index.html');
const PAGES = ['dashboard', 'executivo', 'goleiras', 'perfil', 'treinos', 'lesoes', 'pid', 'clube', 'notificacoes', 'auditoria'];

let failures = 0;
const fail = (m) => { console.error('  ✗ ' + m); failures++; };
const ok = (m) => console.log('  ✓ ' + m);

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.split('\n')[0]));

  await page.addInitScript(() => {
    // Deterministic Chart.js stub so the smoke test never depends on the CDN.
    // The real library (loaded in a browser) simply overwrites this.
    if (!window.Chart) {
      const Stub = function () {};
      Stub.prototype.destroy = function () {}; Stub.prototype.update = function () {}; Stub.prototype.resize = function () {};
      Stub.defaults = { font: {}, color: '', animation: {}, animations: {}, plugins: { legend: { labels: {} }, tooltip: {} } };
      window.Chart = Stub;
    }
    localStorage.setItem('gkhub_session', JSON.stringify({ token: 't', user: 'CI', expiresAt: Date.now() + 9e11 }));
    localStorage.setItem('gkhub_goleiras', JSON.stringify([
      { id: 'g1', nome: 'Ana CI', equipe: 'Time CI', categoria: 'Sub-17', naipe: 'feminino' },
      { id: 'g2', nome: 'Bia CI', equipe: 'Time CI', categoria: 'Adulto', naipe: 'feminino' },
    ]));
    const pts = [], sc = [];
    for (let i = 0; i < 6; i++) {
      pts.push({ id: 'p' + i, adversario: 'Adv ' + i, competicao: 'Liga', data: '2026-0' + ((i % 9) + 1) + '-10', goalkeeperId: i % 2 ? 'g2' : 'g1', gf: 3, gc: i % 3 });
      sc.push({ id: 's' + i, goalkeeperId: i % 2 ? 'g2' : 'g1', partidaId: 'p' + i, dad: 3, dae: 2, dbd: 2, dc: 1, gda: i % 3, dpc: 8, dpe: 2, int: 2, sai: 1 });
    }
    localStorage.setItem('gkhub_partidas', JSON.stringify(pts));
    localStorage.setItem('gkhub_scouts', JSON.stringify(sc));
  });

  await page.goto(FILE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Boots + overlay hidden
  const overlayHidden = await page.evaluate(() => document.getElementById('auth-overlay')?.classList.contains('hidden'));
  overlayHidden ? ok('app boots, auth overlay hidden') : fail('auth overlay still visible after seeded session');

  // Each page renders + no horizontal overflow
  for (const pg of PAGES) {
    try {
      await page.evaluate((p) => navigate(p), pg);
      await page.waitForTimeout(500);
      const r = await page.evaluate((p) => {
        const el = document.getElementById('page-' + p);
        const vw = document.documentElement.clientWidth;
        // widest non-wrapper element in this page
        let maxRight = vw;
        el?.querySelectorAll('*').forEach((n) => {
          let a = n.parentElement, wrapped = false;
          while (a) { const o = getComputedStyle(a).overflowX; if (o === 'auto' || o === 'scroll') { wrapped = true; break; } a = a.parentElement; }
          if (!wrapped) { const x = n.getBoundingClientRect().right; if (x > maxRight) maxRight = Math.round(x); }
        });
        return { active: el?.classList.contains('active'), hasContent: (el?.textContent || '').trim().length > 0, vw, maxRight };
      }, pg);
      if (!r.active) fail(`page "${pg}" did not activate`);
      else if (!r.hasContent) fail(`page "${pg}" rendered empty`);
      else if (r.maxRight > r.vw + 2) fail(`page "${pg}" overflows horizontally (right=${r.maxRight} > vw=${r.vw})`);
      else ok(`page "${pg}" renders, fits width`);
    } catch (e) { fail(`page "${pg}" threw: ${e.message.split('\n')[0]}`); }
  }

  // Vertical scroll works on a tall page
  await page.evaluate(() => navigate('dashboard'));
  await page.evaluate(() => { const c = document.querySelector('.content'); const t = document.createElement('div'); t.style.height = '2000px'; c.appendChild(t); });
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(300);
  const y = await page.evaluate(() => window.scrollY);
  y > 300 ? ok('vertical scroll works (scrolled ' + y + 'px)') : fail('page did not scroll vertically');

  // No uncaught JS errors
  if (errors.length) fail('uncaught JS error(s): ' + errors.slice(0, 3).join(' | '));
  else ok('no uncaught JS errors');

  await browser.close();
  console.log(failures ? `\nE2E SMOKE FAILED (${failures})` : '\nE2E smoke passed.');
  process.exit(failures ? 1 : 0);
}

run().catch((e) => { console.error('runner error:', e); process.exit(1); });

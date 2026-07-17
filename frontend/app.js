/* Global Chart.js polish — applies to every chart, filled only where a
       chart's own options don't already override it (visual-only). */
    (function () {
      if (typeof Chart === 'undefined') return;
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      Chart.defaults.font.family = "'Inter', sans-serif";
      Chart.defaults.font.size = 12;
      Chart.defaults.color = '#94A3B8';
      Chart.defaults.animation = reduce ? false : { duration: 700, easing: 'easeOutQuart' };
      Chart.defaults.animations = reduce ? {} : { y: { from: (ctx) => (ctx.chart.scales.y ? ctx.chart.scales.y.getPixelForValue(0) : undefined) } };
      Chart.defaults.plugins.legend.labels.usePointStyle = true;
      Chart.defaults.plugins.legend.labels.boxWidth = 8;
      Chart.defaults.plugins.legend.labels.padding = 14;
      const tt = Chart.defaults.plugins.tooltip;
      tt.backgroundColor = 'rgba(15,23,42,.95)';
      tt.borderColor = 'rgba(255,255,255,.12)';
      tt.borderWidth = 1;
      tt.titleColor = '#F8FAFC';
      tt.bodyColor = '#CBD5E1';
      tt.padding = 12;
      tt.cornerRadius = 10;
      tt.boxPadding = 6;
      tt.usePointStyle = true;
      tt.titleFont = { weight: '700', size: 12 };
    })();
  

/* ── next inline block ── */


// ═══════════════════════════════════════════════════════════
// DATA STORE
// ═══════════════════════════════════════════════════════════
const DB = {
  load(key) { try { return JSON.parse(localStorage.getItem('gkhub_'+key) || '[]'); } catch { return []; } },
  save(key, data) {
    localStorage.setItem('gkhub_'+key, JSON.stringify(data));
    // Auto-sync the newer collections to the cloud (see _NEW_SYNC below)
    if (!DB._suppressSync && typeof _schedulePush === 'function' && typeof _NEW_SYNC !== 'undefined' && _NEW_SYNC.includes(key)) _schedulePush(key, data);
  },
  get goleiras()  { return this.load('goleiras'); },
  get partidas()  { return this.load('partidas'); },
  get scouts()    { return this.load('scouts'); },
  saveGoleiras(d) { this.save('goleiras', d); },
  savePartidas(d) { this.save('partidas', d); },
  saveScouts(d)   { this.save('scouts', d); },
  get notifications() { return this.load('notifications'); },
  get auditlog()      { return this.load('auditlog'); },
  get reports()       { return this.load('reports'); },
  get lesoes()        { return this.load('lesoes'); },
  get pid()           { return this.load('pid'); },
  get aianalyses()    { return this.load('aianalyses'); },
  saveAianalyses(d)   { this.save('aianalyses', d); },
  saveNotifications(d){ this.save('notifications', d); },
  saveAuditlog(d)     { this.save('auditlog', d); },
  saveReports(d)      { this.save('reports', d); },
  saveLesoes(d)       { this.save('lesoes', d); },
  savePID(d)          { this.save('pid', d); },
};

/* ═══════════════════════════════════════════════════════════
   SISTEMA — Notificações · Auditoria · Central de Relatórios
   Persistido em localStorage (mesmo padrão do DB). Aditivo.
   ═══════════════════════════════════════════════════════════ */
function _nowParts() {
  const d = new Date();
  return { ts: d.getTime(), date: d.toISOString().slice(0, 10), time: d.toTimeString().slice(0, 5) };
}
function _uid() { return 'x' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }
function _currentUserName() {
  return localStorage.getItem('gkhub_backend_email') || localStorage.getItem('gkhub_user_name') || 'Você';
}

// Audit log — capped ring buffer
function logAudit(module, description) {
  try {
    const { ts, date, time } = _nowParts();
    const list = DB.auditlog;
    list.unshift({ id: _uid(), user: _currentUserName(), ts, date, time, module, description });
    DB.saveAuditlog(list.slice(0, 500));
  } catch (e) {}
}

// In-app notification store
function pushNotif(type, title, text) {
  try {
    const { ts } = _nowParts();
    const list = DB.notifications;
    list.unshift({ id: _uid(), type: type || 'info', title, text: text || '', ts, read: false });
    DB.saveNotifications(list.slice(0, 200));
    updateNotifBadge();
  } catch (e) {}
}

// Report library entry (metadata for generated PDFs)
function logReport(meta) {
  try {
    const { ts, date } = _nowParts();
    const list = DB.reports;
    list.unshift({ id: _uid(), ts, date, favorite: false, ...meta });
    DB.saveReports(list.slice(0, 300));
  } catch (e) {}
}

function updateNotifBadge() {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  const n = DB.notifications.filter(x => !x.read).length;
  if (n > 0) { badge.style.display = 'block'; badge.textContent = n > 99 ? '99+' : String(n); }
  else badge.style.display = 'none';
}

const _NOTIF_ICON = { match: '⚽', partida: '⚽', scout: '📊', pdf: '📄', report: '📄', alert: '⚠️', goal: '🎯', info: 'ℹ️', sync: '☁️', csv: '📁' };
function _relTime(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return Math.floor(s / 60) + ' min';
  if (s < 86400) return Math.floor(s / 3600) + ' h';
  const d = Math.floor(s / 86400);
  return d < 30 ? d + ' d' : formatDate(new Date(ts).toISOString().slice(0, 10));
}

// ── Notificações ──
function renderNotificacoes() {
  updateNotifBadge();
  const el = document.getElementById('notif-list');
  if (!el) return;
  const q = (document.getElementById('notif-search')?.value || '').trim().toLowerCase();
  const f = document.getElementById('notif-filter')?.value || '';
  let list = DB.notifications;
  if (f === 'unread') list = list.filter(n => !n.read);
  else if (f) list = list.filter(n => n.type === f);
  if (q) list = list.filter(n => (n.title || '').toLowerCase().includes(q) || (n.text || '').toLowerCase().includes(q));
  if (!list.length) { el.innerHTML = '<div class="empty-state"><p>Nenhuma notificação.</p></div>'; return; }
  el.innerHTML = list.map(n => `
    <div style="display:flex;gap:12px;align-items:flex-start;padding:12px 4px;border-bottom:1px solid var(--border);${n.read ? 'opacity:.62;' : ''}">
      <span style="font-size:18px;">${_NOTIF_ICON[n.type] || 'ℹ️'}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:13px;">${_esc(n.title || '')}${n.read ? '' : ' <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--primary);vertical-align:middle;margin-left:4px;"></span>'}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px;">${_esc(n.text || '')}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
        <span style="font-size:11px;color:var(--muted);white-space:nowrap;">${_relTime(n.ts)}</span>
        <div style="display:flex;gap:4px;">
          ${n.read ? '' : `<button class="btn btn-ghost btn-sm" style="padding:2px 8px;" onclick="markNotifRead('${n.id}')">Lida</button>`}
          <button class="btn btn-ghost btn-sm" style="padding:2px 6px;color:#ef4444;" onclick="deleteNotif('${n.id}')">✕</button>
        </div>
      </div>
    </div>`).join('');
}
function markNotifRead(id) { const l = DB.notifications; const n = l.find(x => x.id === id); if (n) n.read = true; DB.saveNotifications(l); renderNotificacoes(); }
function deleteNotif(id) { DB.saveNotifications(DB.notifications.filter(x => x.id !== id)); renderNotificacoes(); }
function markAllNotifRead() { const l = DB.notifications.map(n => ({ ...n, read: true })); DB.saveNotifications(l); renderNotificacoes(); toast('Todas marcadas como lidas.', 'success'); }

// Auto-generate insight-based notifications (deduped so they don't spam)
function syncIntelligenceNotifications() {
  try {
    let seen = {};
    try { seen = JSON.parse(localStorage.getItem('gkhub_intel_notified') || '{}'); } catch (e) { seen = {}; }
    const activeKeys = new Set();
    DB.goleiras.forEach(g => {
      gkIntelligence(g.id, DB.partidas, DB.scouts).filter(i => i.level === 'warn').forEach(i => {
        const key = g.id + '::' + i.title;
        activeKeys.add(key);
        if (!seen[key]) { pushNotif('alert', i.title + ' — ' + g.nome, i.text); seen[key] = 1; }
      });
    });
    // Clear resolved conditions so they can fire again if they return
    Object.keys(seen).forEach(k => { if (!activeKeys.has(k)) delete seen[k]; });
    localStorage.setItem('gkhub_intel_notified', JSON.stringify(seen));
  } catch (e) {}
}

// ── Central de Relatórios ──
let repShowFav = false;
function renderCentralRelatorios() {
  const el = document.getElementById('rep-list');
  if (!el) return;
  const q = (document.getElementById('rep-search')?.value || '').trim().toLowerCase();
  const f = document.getElementById('rep-filter')?.value || '';
  const favBtn = document.getElementById('rep-fav-btn');
  if (favBtn) favBtn.className = 'btn btn-sm ' + (repShowFav ? 'btn-primary' : 'btn-secondary');
  let list = DB.reports;
  if (f) list = list.filter(r => r.type === f);
  if (repShowFav) list = list.filter(r => r.favorite);
  if (q) list = list.filter(r => (r.title || '').toLowerCase().includes(q) || (r.athlete || '').toLowerCase().includes(q) || (r.competition || '').toLowerCase().includes(q));
  if (!list.length) { el.innerHTML = '<div class="empty-state"><p>Nenhum relatório na biblioteca. Gere um PDF para começar.</p></div>'; return; }
  const typeLabel = { individual: 'Individual', geral: 'Geral', partidas: 'Partidas', competicao: 'Competição', analise: 'Análise IA', ia: 'Insights IA', treinos: 'Treinos' };
  el.innerHTML = list.map(r => `
    <div style="display:flex;gap:12px;align-items:center;padding:12px 4px;border-bottom:1px solid var(--border);">
      <span style="font-size:18px;">📄</span>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:13px;">${_esc(r.title || 'Relatório')}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px;">
          <span class="badge badge-dev">${typeLabel[r.type] || r.type}</span>
          ${r.athlete ? ' · ' + _esc(r.athlete) : ''}${r.competition ? ' · ' + _esc(r.competition) : ''} · ${formatDate(r.date)}
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" style="padding:4px 8px;color:${r.favorite ? '#FCD34D' : 'var(--muted)'};" onclick="repToggleFav('${r.id}')" title="Favoritar">${r.favorite ? '★' : '☆'}</button>
      <button class="btn btn-secondary btn-sm" onclick="repRegen('${_esc(r.type)}','${_esc(r.athleteId || '')}')">Gerar novamente</button>
      <button class="btn btn-ghost btn-sm" style="padding:4px 6px;color:#ef4444;" onclick="repDelete('${r.id}')">✕</button>
    </div>`).join('');
}
function repToggleFav(id) { const l = DB.reports; const r = l.find(x => x.id === id); if (r) r.favorite = !r.favorite; DB.saveReports(l); renderCentralRelatorios(); }
function repDelete(id) { DB.saveReports(DB.reports.filter(x => x.id !== id)); renderCentralRelatorios(); }
function repRegen(type, athleteId) {
  // Take the user to the report generator with context (regeneration is manual
  // and always reflects the latest data — no stale snapshot stored).
  if (type === 'treinos') { navigate('treinos'); toast('Use “📄 Relatório PDF” na aba Treinos.', 'info'); return; }
  if ((type === 'individual' || type === 'analise') && athleteId) {
    navigate('relatorios');
    setTimeout(() => { const s = document.getElementById('pdf-gk-select'); if (s) { s.value = athleteId; } }, 200);
    toast('Selecione o formato e gere o relatório atualizado.', 'info');
    return;
  }
  navigate('relatorios');
}

// ── Auditoria ──
function renderAuditoria() {
  const tb = document.getElementById('audit-tbody');
  if (!tb) return;
  const q = (document.getElementById('audit-search')?.value || '').trim().toLowerCase();
  let list = DB.auditlog;
  if (q) list = list.filter(a => (a.description || '').toLowerCase().includes(q) || (a.user || '').toLowerCase().includes(q) || (a.module || '').toLowerCase().includes(q));
  if (!list.length) { tb.innerHTML = '<tr><td colspan="4"><div class="empty-state"><p>Nenhuma ação registrada ainda.</p></div></td></tr>'; return; }
  tb.innerHTML = list.slice(0, 200).map(a => `
    <tr>
      <td style="white-space:nowrap;">${formatDate(a.date)} <span style="color:var(--muted);">${a.time || ''}</span></td>
      <td>${_esc(a.user || '—')}</td>
      <td><span class="badge badge-dev">${_esc(a.module || '—')}</span></td>
      <td>${_esc(a.description || '')}</td>
    </tr>`).join('');
}
function exportAuditCsv() {
  const rows = [['Data', 'Hora', 'Usuário', 'Módulo', 'Descrição']].concat(
    DB.auditlog.map(a => [a.date, a.time, a.user, a.module, (a.description || '').replace(/"/g, '""')]));
  const csv = rows.map(r => r.map(c => `"${c ?? ''}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'gkhub_auditoria.csv'; a.click();
  URL.revokeObjectURL(url);
  toast('Auditoria exportada.', 'success');
}

/* ═══════════════════════════════════════════════════════════
   CONFIGURAÇÕES DO CLUBE
   ═══════════════════════════════════════════════════════════ */
function clubSettings() { try { return JSON.parse(localStorage.getItem('gkhub_club_settings') || '{}'); } catch (e) { return {}; } }
let _clbEscudo = '';
function renderClube() {
  const c = clubSettings();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  set('clb-nome', c.nome); set('clb-cidade', c.cidade); set('clb-estado', c.estado);
  set('clb-pais', c.pais || 'Brasil'); set('clb-display', c.display);
  set('clb-escala', c.escala || 10); set('clb-treino-min', c.treinoMin || 60);
  if (c.cor1) set('clb-cor1', c.cor1); if (c.cor2) set('clb-cor2', c.cor2);
  _clbEscudo = c.escudo || '';
  const prev = document.getElementById('clb-escudo-prev');
  if (prev) prev.innerHTML = _clbEscudo ? `<img src="${_clbEscudo}" style="width:100%;height:100%;object-fit:cover;">` : '🏛️';
  // IGD weight inputs
  const w = igdWeights();
  const wrap = document.getElementById('clb-igd-weights');
  if (wrap) wrap.innerHTML = Object.keys(IGD_DIM_LABEL).map(k => `
    <div class="form-group"><label class="form-label">${IGD_DIM_LABEL[k]}</label>
      <input type="number" class="form-input" id="clb-w-${k}" value="${w[k]}" min="0" max="100"></div>`).join('');
}
function clbUploadEscudo(input) {
  const f = input.files && input.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { _clbEscudo = r.result; const p = document.getElementById('clb-escudo-prev'); if (p) p.innerHTML = `<img src="${_clbEscudo}" style="width:100%;height:100%;object-fit:cover;">`; };
  r.readAsDataURL(f);
}
function saveClube() {
  const val = (id) => (document.getElementById(id)?.value || '').trim();
  const c = {
    nome: val('clb-nome'), cidade: val('clb-cidade'), estado: val('clb-estado'),
    pais: val('clb-pais'), display: val('clb-display'),
    cor1: val('clb-cor1'), cor2: val('clb-cor2'),
    escala: parseInt(val('clb-escala'), 10) || 10, treinoMin: parseInt(val('clb-treino-min'), 10) || 60,
    escudo: _clbEscudo || '',
  };
  localStorage.setItem('gkhub_club_settings', JSON.stringify(c));
  const w = {};
  Object.keys(IGD_DIM_LABEL).forEach(k => { w[k] = parseInt(document.getElementById('clb-w-' + k)?.value, 10) || 0; });
  localStorage.setItem('gkhub_igd_weights', JSON.stringify(w));
  applyClubBranding();
  logAudit('Clube', 'Atualizou as configurações do clube');
  toast('Configurações salvas!', 'success');
}
function resetIgdWeights() { localStorage.removeItem('gkhub_igd_weights'); renderClube(); toast('Pesos do IGD restaurados.', 'info'); }

// Metodologia — transparência das notas e referências por naipe (editável)
let _metodoMod = 'futsal';
function _metodoSwitch(mod) { _metodoMod = (mod === 'beach') ? 'beach' : 'futsal'; openMetodologia(); }
function openMetodologia() {
  const mod = _metodoMod;
  const b = gkBench(mod);
  let modal = document.getElementById('metodo-modal');
  if (!modal) { modal = document.createElement('div'); modal.id = 'metodo-modal'; modal.className = 'modal-backdrop'; document.body.appendChild(modal); }
  const num = (v) => (v != null ? v : '');
  const tab = (m, l) => `<button class="btn btn-sm ${mod === m ? 'btn-primary' : 'btn-secondary'}" onclick="_metodoSwitch('${m}')">${l}</button>`;
  const eixos = mod === 'beach' ? `
        <ul style="margin:8px 0 8px 18px;">
          <li><b>Defesa</b> — eficiência defensiva (% de defesa). No beach soccer o jogo é de alto placar e há finalizações de qualquer zona (voleios, bicicletas), então a <b>referência de % de defesa é menor</b>.</li>
          <li><b>Distribuição</b> — o goleiro é a <b>"primeira linha de ataque"</b>: participa da criação/finalização de ~60% dos gols via arremesso longo. Por isso a distribuição <b>pesa mais</b> aqui.</li>
          <li><b>Tático</b> — interceptações e saídas (comando de área na areia).</li>
        </ul>` : `
        <ul style="margin:8px 0 8px 18px;">
          <li><b>Defesa</b> — eficiência defensiva (% de defesa), incluindo altas, baixas, central, 1×1 e esquadros.</li>
          <li><b>Distribuição</b> — precisão da reposição (curta + longa). No futsal de elite, ~41% das ações do goleiro são com bola.</li>
          <li><b>Tático</b> — interceptações e saídas (comando de área).</li>
        </ul>`;
  modal.innerHTML = `
    <div class="modal" style="max-width:640px;">
      <div class="modal-header"><span class="modal-title">📚 Metodologia & Referências</span><button class="modal-close" onclick="closeModal('metodo-modal')">&times;</button></div>
      <div class="modal-body" style="font-size:13px;line-height:1.6;">
        <div style="display:flex;gap:8px;margin-bottom:12px;">${tab('futsal', 'Futsal')}${tab('beach', 'Beach Soccer')}</div>
        <p><b>Modalidade:</b> ${GKHUB_MODALIDADES[mod]}. As notas automáticas combinam três eixos, com pesos ajustados à realidade da modalidade:</p>
        ${eixos}
        <p><b>Ajuste por naipe:</b> a literatura aponta diferenças <i>qualitativas</i> (no feminino, menor velocidade de chute → mais defesas possíveis e ênfase em precisão/posicionamento). Não há normas numéricas fechadas por naipe/modalidade, então os valores abaixo são <b>referências calibráveis</b> (o nível que corresponde à nota “Boa” = 7,0), não normas absolutas.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:12px 0;">
          <div>
            <div style="font-weight:700;margin-bottom:6px;">Feminino</div>
            <label class="form-label">% defesa ref.</label><input type="number" step="0.01" min="0" max="1" class="form-input" id="mt-f-save" value="${num(b.feminino.saveRate)}">
            <label class="form-label" style="margin-top:6px;">precisão distrib. ref.</label><input type="number" step="0.01" min="0" max="1" class="form-input" id="mt-f-dist" value="${num(b.feminino.dist)}">
          </div>
          <div>
            <div style="font-weight:700;margin-bottom:6px;">Masculino</div>
            <label class="form-label">% defesa ref.</label><input type="number" step="0.01" min="0" max="1" class="form-input" id="mt-m-save" value="${num(b.masculino.saveRate)}">
            <label class="form-label" style="margin-top:6px;">precisão distrib. ref.</label><input type="number" step="0.01" min="0" max="1" class="form-input" id="mt-m-dist" value="${num(b.masculino.dist)}">
          </div>
        </div>
        <div style="font-weight:700;margin:6px 0;">Pesos (${GKHUB_MODALIDADES[mod]})</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
          <div><label class="form-label">Defesa</label><input type="number" step="0.05" min="0" max="1" class="form-input" id="mt-w-def" value="${num(b.weights.defesa)}"></div>
          <div><label class="form-label">Distribuição</label><input type="number" step="0.05" min="0" max="1" class="form-input" id="mt-w-dist" value="${num(b.weights.dist)}"></div>
          <div><label class="form-label">Tático</label><input type="number" step="0.05" min="0" max="1" class="form-input" id="mt-w-tat" value="${num(b.weights.tatico)}"></div>
        </div>
        <details style="margin-top:14px;"><summary style="cursor:pointer;font-weight:600;">Fontes</summary>
          <div style="font-size:12px;color:var(--muted);margin-top:8px;">
            • Indicadores de desempenho de goleiro (% de defesa, gols sofridos, distribuição, comando de área) — Apunts Sports Medicine (2023).<br>
            • Futsal de elite: ações ofensivas ~58% vs defensivas ~42% — pesquisas de futsal (ResearchGate).<br>
            • Beach soccer: goleiro como "primeira linha de ataque", participa de ~60% dos gols; distribuição por arremesso longo é indicador-chave — FIFA Training Centre (2025); Beach Soccer Worldwide; PLOS One (2019, indicadores técnico-táticos).<br>
            • Diferenças por naipe (força/velocidade de chute, estratégia de finalização) — De-la-Cruz-Torres et al. (2025).<br>
            <i>As notas manuais informadas no scout sempre têm prioridade sobre a nota automática.</i>
          </div>
        </details>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="_metodoRestore('${mod}')">Restaurar ${GKHUB_MODALIDADES[mod]}</button>
        <button class="btn btn-primary" onclick="saveMetodologia()">Salvar referências</button>
      </div>
    </div>`;
  openModal('metodo-modal');
}
function _metodoRestore(mod) {
  try { const all = JSON.parse(localStorage.getItem('gkhub_bench') || '{}'); delete all[mod]; if (all.feminino || all.masculino || all.weights) { delete all.feminino; delete all.masculino; delete all.weights; } localStorage.setItem('gkhub_bench', JSON.stringify(all)); } catch (e) {}
  toast('Referências de ' + GKHUB_MODALIDADES[mod] + ' restauradas.', 'info');
  openMetodologia();
}
function saveMetodologia() {
  const num = (id) => parseFloat(document.getElementById(id)?.value);
  const mod = _metodoMod;
  let all = {};
  try { all = JSON.parse(localStorage.getItem('gkhub_bench') || '{}'); } catch (e) { all = {}; }
  // compat: se houver bench antigo em formato plano, migra para futsal
  if (all.feminino || all.masculino || all.weights) { all = { futsal: { feminino: all.feminino, masculino: all.masculino, weights: all.weights } }; }
  all[mod] = {
    feminino:  { saveRate: num('mt-f-save'), dist: num('mt-f-dist') },
    masculino: { saveRate: num('mt-m-save'), dist: num('mt-m-dist') },
    weights:   { defesa: num('mt-w-def'), dist: num('mt-w-dist'), tatico: num('mt-w-tat') },
  };
  localStorage.setItem('gkhub_bench', JSON.stringify(all));
  logAudit('Clube', 'Ajustou a metodologia de notas (' + GKHUB_MODALIDADES[mod] + ')');
  closeModal('metodo-modal');
  toast('Referências de ' + GKHUB_MODALIDADES[mod] + ' salvas.', 'success');
  if (typeof refreshDashboard === 'function') refreshDashboard();
}
function applyClubBranding() {
  const c = clubSettings();
  if (c.cor1) { document.documentElement.style.setProperty('--primary', c.cor1); document.documentElement.style.setProperty('--primary-d', c.cor1); }
  if (c.cor1 && c.cor2) document.documentElement.style.setProperty('--primary-g', `linear-gradient(135deg,${c.cor1},${c.cor2})`);
}

/* ═══════════════════════════════════════════════════════════
   CONTROLE DE LESÕES
   ═══════════════════════════════════════════════════════════ */
const LESAO_REGIOES = ['Ombro', 'Cotovelo', 'Punho/Mão', 'Dedos', 'Quadril', 'Coxa', 'Joelho', 'Tornozelo', 'Pé', 'Coluna', 'Cabeça', 'Outra'];
const LESAO_STATUS = { afastada: 'Afastada', recuperacao: 'Em recuperação', liberada_treino: 'Liberada p/ treino', liberada_jogo: 'Liberada p/ jogo' };
const LESAO_STATUS_COLOR = { afastada: 'var(--error)', recuperacao: 'var(--warning)', liberada_treino: 'var(--primary)', liberada_jogo: 'var(--success)' };
let lesaoChart = null;

function openLesaoForm() {
  const gkOpts = DB.goleiras.map(g => `<option value="${g.id}">${_esc(g.nome)}</option>`).join('');
  let modal = document.getElementById('lesao-modal');
  if (!modal) { modal = document.createElement('div'); modal.id = 'lesao-modal'; modal.className = 'modal-backdrop'; document.body.appendChild(modal); }
  modal.innerHTML = `
    <div class="modal" style="max-width:540px;">
      <div class="modal-header"><span class="modal-title">Registrar lesão</span><button class="modal-close" onclick="closeModal('lesao-modal')">&times;</button></div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="form-group full"><label class="form-label">Goleira *</label><select class="form-select" id="les-gk"><option value="">Selecionar…</option>${gkOpts}</select></div>
          <div class="form-group"><label class="form-label">Tipo</label><input class="form-input" id="les-tipo" placeholder="Ex.: Entorse, Estiramento"></div>
          <div class="form-group"><label class="form-label">Região</label><select class="form-select" id="les-regiao">${LESAO_REGIOES.map(r => `<option>${r}</option>`).join('')}</select></div>
          <div class="form-group"><label class="form-label">Data *</label><input type="date" class="form-input" id="les-data"></div>
          <div class="form-group"><label class="form-label">Gravidade</label><select class="form-select" id="les-grav"><option>Leve</option><option>Moderada</option><option>Grave</option></select></div>
          <div class="form-group"><label class="form-label">Tempo previsto (dias)</label><input type="number" class="form-input" id="les-previsto" min="0" value="14"></div>
          <div class="form-group"><label class="form-label">Situação atual</label><select class="form-select" id="les-status">${Object.keys(LESAO_STATUS).map(s => `<option value="${s}">${LESAO_STATUS[s]}</option>`).join('')}</select></div>
          <div class="form-group full"><label class="form-label">Diagnóstico</label><textarea class="form-textarea" id="les-diag" rows="2"></textarea></div>
        </div>
      </div>
      <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal('lesao-modal')">Cancelar</button><button class="btn btn-primary" onclick="saveLesao()">Salvar</button></div>
    </div>`;
  openModal('lesao-modal');
}
function saveLesao() {
  const val = (id) => (document.getElementById(id)?.value || '').trim();
  const gkId = val('les-gk'), data = val('les-data');
  if (!gkId) { toast('Selecione a goleira.', 'error'); return; }
  if (!data) { toast('Informe a data.', 'error'); return; }
  const list = DB.lesoes;
  list.unshift({ id: _uid(), gkId, tipo: val('les-tipo'), regiao: val('les-regiao'), data,
    gravidade: val('les-grav'), previsto: parseInt(val('les-previsto'), 10) || 0,
    status: val('les-status'), diagnostico: val('les-diag'), criadoEm: Date.now() });
  DB.saveLesoes(list);
  const gk = DB.goleiras.find(g => g.id === gkId);
  logAudit('Lesões', 'Registrou lesão de ' + (gk ? gk.nome : gkId) + ' (' + val('les-regiao') + ')');
  pushNotif('alert', 'Nova lesão registrada', (gk ? gk.nome : '') + ' — ' + val('les-regiao'));
  closeModal('lesao-modal');
  toast('Lesão registrada.', 'success');
  renderLesoes();
}
function updateLesaoStatus(id, status) {
  const list = DB.lesoes; const l = list.find(x => x.id === id); if (!l) return;
  l.status = status; DB.saveLesoes(list);
  if (status === 'liberada_jogo') pushNotif('goal', 'Retorno liberado', 'Goleira liberada para jogos.');
  renderLesoes();
}
function deleteLesao(id) { if (!confirm('Excluir este registro de lesão?')) return; DB.saveLesoes(DB.lesoes.filter(x => x.id !== id)); logAudit('Lesões', 'Excluiu um registro de lesão'); renderLesoes(); }
function _daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 864e5); }
function renderLesoes() {
  const list = DB.lesoes;
  const gkName = (id) => { const g = DB.goleiras.find(x => x.id === id); return g ? g.nome : '—'; };
  const today = new Date().toISOString().slice(0, 10);
  const afastadas = list.filter(l => l.status === 'afastada' || l.status === 'recuperacao');
  const totalDias = list.reduce((s, l) => s + (l.status === 'liberada_jogo' ? (l.previsto || 0) : Math.max(0, _daysBetween(l.data, today))), 0);
  const recTimes = list.filter(l => l.previsto).map(l => l.previsto);
  const kpis = [
    ['Total de lesões', list.length, 'stat-cyan'],
    ['Afastadas agora', afastadas.length, 'stat-red'],
    ['Dias perdidos', totalDias, 'stat-yellow'],
    ['Tempo médio (dias)', recTimes.length ? Math.round(recTimes.reduce((a, b) => a + b, 0) / recTimes.length) : 0, 'stat-green'],
  ];
  const kEl = document.getElementById('lesao-kpis');
  if (kEl) kEl.innerHTML = kpis.map(([l, v, c]) => `<div class="stat-card"><div class="stat-label">${l}</div><div class="stat-value ${c}" style="font-size:30px;">${v}</div></div>`).join('');

  // Region chart
  const byRegion = {};
  list.forEach(l => { byRegion[l.regiao || 'Outra'] = (byRegion[l.regiao || 'Outra'] || 0) + 1; });
  const canvas = document.getElementById('lesao-chart');
  if (canvas && typeof Chart !== 'undefined') {
    if (lesaoChart) lesaoChart.destroy();
    const labels = Object.keys(byRegion);
    if (labels.length) lesaoChart = new Chart(canvas, { type: 'bar', data: { labels, datasets: [{ data: labels.map(k => byRegion[k]), backgroundColor: 'rgba(239,68,68,.55)', borderRadius: 4 }] }, options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });
    else { const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }

  // Alerts: recorrência (mesma região ≥2) + afastamento longo (> previsto)
  const aEl = document.getElementById('lesao-alerts');
  if (aEl) {
    const alerts = [];
    const perGkRegion = {};
    list.forEach(l => { const k = l.gkId + '|' + l.regiao; perGkRegion[k] = (perGkRegion[k] || 0) + 1; });
    Object.keys(perGkRegion).forEach(k => { if (perGkRegion[k] >= 2) { const [gid, reg] = k.split('|'); alerts.push('🔁 Dor recorrente: ' + gkName(gid) + ' — ' + reg); } });
    afastadas.forEach(l => { const dias = Math.max(0, _daysBetween(l.data, today)); if (l.previsto && dias > l.previsto) alerts.push('⏳ Afastamento longo: ' + gkName(l.gkId) + ' (' + dias + 'd / previsto ' + l.previsto + 'd)'); });
    aEl.innerHTML = alerts.length ? alerts.map(a => `<div style="font-size:13px;padding:8px 0;border-bottom:1px solid var(--border);color:var(--warning);">${_esc(a)}</div>`).join('') : '<div class="empty-state" style="padding:24px;"><p>Nenhum alerta. 🟢</p></div>';
  }

  // List
  const q = (document.getElementById('lesao-search')?.value || '').trim().toLowerCase();
  let rows = list;
  if (q) rows = rows.filter(l => gkName(l.gkId).toLowerCase().includes(q) || (l.tipo || '').toLowerCase().includes(q) || (l.regiao || '').toLowerCase().includes(q));
  const el = document.getElementById('lesao-list');
  if (el) el.innerHTML = rows.length ? `<div class="table-wrap"><table>
    <thead><tr><th>Goleira</th><th>Região</th><th>Tipo</th><th>Data</th><th>Gravidade</th><th>Situação</th><th>Ações</th></tr></thead>
    <tbody>${rows.map(l => `<tr>
      <td><strong>${_esc(gkName(l.gkId))}</strong></td><td>${_esc(l.regiao || '—')}</td><td>${_esc(l.tipo || '—')}</td>
      <td>${formatDate(l.data)}</td><td>${_esc(l.gravidade || '—')}</td>
      <td><select class="form-select" style="padding:4px 8px;font-size:12px;color:${LESAO_STATUS_COLOR[l.status]};" onchange="updateLesaoStatus('${l.id}',this.value)">${Object.keys(LESAO_STATUS).map(s => `<option value="${s}"${s === l.status ? ' selected' : ''}>${LESAO_STATUS[s]}</option>`).join('')}</select></td>
      <td><button class="btn btn-ghost btn-sm" style="color:#ef4444;" onclick="deleteLesao('${l.id}')">✕</button></td>
    </tr>`).join('')}</tbody></table></div>` : '<div class="empty-state"><p>Nenhuma lesão registrada. Use "Registrar lesão".</p></div>';
}

/* ═══════════════════════════════════════════════════════════
   PID — Plano Individual de Desenvolvimento
   ═══════════════════════════════════════════════════════════ */
const PID_AREAS = {
  tecnica: { label: 'Técnica', topics: ['Bola aérea', 'Reflexo', 'Posicionamento', '1x1', 'Distribuição'] },
  fisica:  { label: 'Física', topics: ['Agilidade', 'Explosão', 'Resistência', 'Velocidade'] },
  mental:  { label: 'Mental', topics: ['Comunicação', 'Liderança', 'Confiança', 'Concentração'] },
};
const PID_STATUS = { andamento: 'Em andamento', concluido: 'Concluído', pausado: 'Pausado' };
let _pidGkId = null;

function _pidPopulateSelect() {
  const sel = document.getElementById('pid-gk-select');
  if (!sel) return;
  const cur = sel.value || _pidGkId;
  sel.innerHTML = '<option value="">Selecionar…</option>' + DB.goleiras.map(g => `<option value="${g.id}">${_esc(g.nome)}</option>`).join('');
  if (cur) sel.value = cur;
}
function openPidForm() {
  const gkId = document.getElementById('pid-gk-select')?.value;
  if (!gkId) { toast('Selecione uma goleira primeiro.', 'info'); return; }
  let modal = document.getElementById('pid-modal');
  if (!modal) { modal = document.createElement('div'); modal.id = 'pid-modal'; modal.className = 'modal-backdrop'; document.body.appendChild(modal); }
  const areaOpts = Object.keys(PID_AREAS).map(k => `<option value="${k}">${PID_AREAS[k].label}</option>`).join('');
  const topicOpts = PID_AREAS.tecnica.topics.map(t => `<option>${t}</option>`).join('');
  modal.innerHTML = `
    <div class="modal" style="max-width:520px;">
      <div class="modal-header"><span class="modal-title">Novo objetivo (PID)</span><button class="modal-close" onclick="closeModal('pid-modal')">&times;</button></div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="form-group"><label class="form-label">Área</label><select class="form-select" id="pid-area" onchange="_pidSyncTopics()">${areaOpts}</select></div>
          <div class="form-group"><label class="form-label">Fundamento</label><select class="form-select" id="pid-topic">${topicOpts}</select></div>
          <div class="form-group full"><label class="form-label">Descrição *</label><input class="form-input" id="pid-desc" placeholder="Ex.: Melhorar saída em cruzamentos"></div>
          <div class="form-group"><label class="form-label">Responsável</label><input class="form-input" id="pid-resp" placeholder="Treinador"></div>
          <div class="form-group"><label class="form-label">Prioridade</label><select class="form-select" id="pid-prio"><option>Alta</option><option selected>Média</option><option>Baixa</option></select></div>
          <div class="form-group"><label class="form-label">Início</label><input type="date" class="form-input" id="pid-inicio"></div>
          <div class="form-group"><label class="form-label">Prazo</label><input type="date" class="form-input" id="pid-prazo"></div>
          <div class="form-group full"><label class="form-label">Critério de sucesso</label><input class="form-input" id="pid-criterio" placeholder="Como saber que foi atingido"></div>
        </div>
      </div>
      <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal('pid-modal')">Cancelar</button><button class="btn btn-primary" onclick="savePid()">Salvar</button></div>
    </div>`;
  openModal('pid-modal');
}
function _pidSyncTopics() {
  const area = document.getElementById('pid-area')?.value;
  const sel = document.getElementById('pid-topic');
  if (area && sel && PID_AREAS[area]) sel.innerHTML = PID_AREAS[area].topics.map(t => `<option>${t}</option>`).join('');
}
function savePid() {
  const gkId = document.getElementById('pid-gk-select')?.value;
  const val = (id) => (document.getElementById(id)?.value || '').trim();
  const desc = val('pid-desc');
  if (!desc) { toast('Informe a descrição.', 'error'); return; }
  const list = DB.pid;
  list.unshift({ id: _uid(), gkId, area: val('pid-area'), topic: val('pid-topic'), descricao: desc,
    responsavel: val('pid-resp'), prioridade: val('pid-prio'), inicio: val('pid-inicio'), prazo: val('pid-prazo'),
    criterio: val('pid-criterio'), status: 'andamento', progresso: 0, criadoEm: Date.now() });
  DB.savePID(list);
  const gk = DB.goleiras.find(g => g.id === gkId);
  logAudit('PID', 'Criou objetivo para ' + (gk ? gk.nome : gkId) + ': ' + desc);
  closeModal('pid-modal');
  toast('Objetivo criado!', 'success');
  renderPID();
}
function pidProgress(id, delta) {
  const list = DB.pid; const o = list.find(x => x.id === id); if (!o) return;
  o.progresso = Math.max(0, Math.min(100, (o.progresso || 0) + delta));
  if (o.progresso >= 100) { o.status = 'concluido'; pushNotif('goal', 'Objetivo concluído', o.descricao); logAudit('PID', 'Concluiu objetivo: ' + o.descricao); }
  else if (o.status === 'concluido') o.status = 'andamento';
  DB.savePID(list); renderPID(); if (typeof renderPerfil === 'function' && _pidGkId) {}
}
function pidDelete(id) { if (!confirm('Excluir este objetivo?')) return; DB.savePID(DB.pid.filter(x => x.id !== id)); renderPID(); }
function renderPID() {
  _pidPopulateSelect();
  const gkId = document.getElementById('pid-gk-select')?.value || '';
  _pidGkId = gkId;
  const kEl = document.getElementById('pid-kpis');
  const cEl = document.getElementById('pid-content');
  if (!gkId) { if (kEl) kEl.innerHTML = ''; if (cEl) cEl.innerHTML = '<div class="empty-state"><p>Selecione uma goleira para ver o plano.</p></div>'; return; }
  const objs = DB.pid.filter(o => o.gkId === gkId);
  const done = objs.filter(o => o.status === 'concluido').length;
  const prog = objs.length ? Math.round(objs.reduce((s, o) => s + (o.progresso || 0), 0) / objs.length) : 0;
  const today = new Date().toISOString().slice(0, 10);
  const proximos = objs.filter(o => o.prazo && o.prazo >= today && o.status !== 'concluido').sort((a, b) => a.prazo.localeCompare(b.prazo)).length;
  if (kEl) kEl.innerHTML = [
    ['Objetivos', objs.length, 'stat-cyan'], ['Concluídos', done, 'stat-green'],
    ['Progresso médio', prog + '%', 'stat-yellow'], ['Prazos futuros', proximos, ''],
  ].map(([l, v, c]) => `<div class="stat-card"><div class="stat-label">${l}</div><div class="stat-value ${c}" style="font-size:30px;">${v}</div></div>`).join('');

  const igd = computeIGD(gkId);
  if (cEl) cEl.innerHTML = Object.keys(PID_AREAS).map(area => {
    const areaObjs = objs.filter(o => o.area === area);
    const dimScore = igd.dims[area] != null ? ` · IGD ${IGD_DIM_LABEL[area]}: <strong style="color:${igdColor(igd.dims[area])};">${igd.dims[area]}</strong>` : '';
    return `<div class="card" style="margin-bottom:16px;">
      <div class="card-header"><span class="card-title">${PID_AREAS[area].label}</span><span style="font-size:12px;color:var(--muted);">${areaObjs.length} objetivo(s)${dimScore}</span></div>
      ${areaObjs.length ? areaObjs.map(o => _pidObjHtml(o)).join('') : '<div style="color:var(--muted);font-size:13px;">Nenhum objetivo nesta área.</div>'}
    </div>`;
  }).join('');
}
function _pidObjHtml(o) {
  const prioColor = { Alta: 'var(--error)', Média: 'var(--warning)', Baixa: 'var(--muted)' }[o.prioridade] || 'var(--muted)';
  const done = o.status === 'concluido';
  return `<div style="padding:12px 0;border-bottom:1px solid var(--border);">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:start;">
      <div>
        <div style="font-weight:700;font-size:14px;${done ? 'text-decoration:line-through;opacity:.6;' : ''}">${_esc(o.descricao)}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px;">${_esc(o.topic || '')}${o.responsavel ? ' · ' + _esc(o.responsavel) : ''}${o.prazo ? ' · prazo ' + formatDate(o.prazo) : ''} · <span style="color:${prioColor};">${_esc(o.prioridade || '')}</span></div>
        ${o.criterio ? `<div style="font-size:11px;color:var(--muted);margin-top:2px;">🎯 ${_esc(o.criterio)}</div>` : ''}
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0;">
        <button class="btn btn-ghost btn-sm" style="padding:2px 8px;" onclick="pidProgress('${o.id}',25)" title="+25%">+</button>
        <button class="btn btn-ghost btn-sm" style="padding:2px 8px;" onclick="pidProgress('${o.id}',-25)" title="-25%">−</button>
        <button class="btn btn-ghost btn-sm" style="padding:2px 6px;color:#ef4444;" onclick="pidDelete('${o.id}')">✕</button>
      </div>
    </div>
    <div style="height:7px;background:rgba(255,255,255,.08);border-radius:4px;margin-top:8px;overflow:hidden;"><div style="height:100%;width:${o.progresso || 0}%;background:${done ? 'var(--success)' : 'var(--primary)'};border-radius:4px;transition:width .5s;"></div></div>
    <div style="font-size:10px;color:var(--muted);margin-top:2px;">${o.progresso || 0}% · ${PID_STATUS[o.status] || o.status}</div>
  </div>`;
}

let editingId = { goleira: null, partida: null, scout: null };
let dashFilterFrom = '';
let dashFilterTo   = '';
let chartPerf = null, chartEvolucao = null;

// ═══════════════════════════════════════════════════════════
// SIDEBAR COLLAPSE
// ═══════════════════════════════════════════════════════════
function toggleSidebar() {
  document.body.classList.toggle('sidebar-collapsed');
  localStorage.setItem('gkhub_sidebar_collapsed', document.body.classList.contains('sidebar-collapsed') ? '1' : '0');
}
(function initSidebar() {
  if (localStorage.getItem('gkhub_sidebar_collapsed') === '1') {
    document.body.classList.add('sidebar-collapsed');
  }
})();

// ═══════════════════════════════════════════════════════════
// COUNT-UP ANIMATION
// ═══════════════════════════════════════════════════════════
function animateCount(el, target, suffix = '') {
  const isFloat = target % 1 !== 0;
  const duration = 600;
  const start = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const ease = 1 - Math.pow(1 - t, 3);
    const val = target * ease;
    el.textContent = isFloat ? val.toFixed(1) + suffix : Math.round(val) + suffix;
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ═══════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════
const pageTitles = {
  dashboard: 'Dashboard', executivo: 'Dashboard Executivo', goleiras: 'Goleiras',
  perfil: 'Perfil da Goleira', comparacao: 'Comparação Entre Goleiras',
  matchcenter: 'Match Center — Ao Vivo',
  partidas: 'Partidas', scout: 'Scout de Jogo',
  performance: 'Performance',
  treinos: 'Treinos',
  usuario: 'Meu Perfil',
  heatmap: 'Heatmap Inteligente', relatorios: 'Relatórios PDF', config: 'Nuvem (Firebase)',
  notificacoes: 'Notificações', 'central-relatorios': 'Central de Relatórios', auditoria: 'Auditoria',
  clube: 'Configurações do Clube', lesoes: 'Controle de Lesões', pid: 'Plano Individual de Desenvolvimento'
};

function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-'+page).classList.add('active');
  document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
  document.getElementById('topbar-title').textContent = pageTitles[page] || page;
  document.getElementById('sidebar').classList.remove('open');
  if (page === 'dashboard') refreshDashboard();
  if (page === 'executivo') renderExecutivo();
  if (page === 'goleiras') renderGoleiras();
  if (page === 'perfil') { updateGoleiraSelects(); renderPerfil(); }
  if (page === 'comparacao') { updateGoleiraSelects(); renderComparacao(); }
  if (page === 'matchcenter') { mcPopulateSelects(); }
  if (page === 'partidas') renderPartidas();
  if (page === 'scout') renderScouts();
  if (page === 'performance') renderPerformance();
  if (page === 'treinos') renderTreinos();
  if (page === 'heatmap') renderHeatmap();
  if (page === 'relatorios') { updatePdfSelects(); updateCompSelect(); }
  if (page === 'config') { renderConfigStatus(); _renderBackendStatus(); loadClubMembers(); }
  if (page === 'usuario') { loadUserPage(); }
  if (page === 'notificacoes') renderNotificacoes();
  if (page === 'central-relatorios') renderCentralRelatorios();
  if (page === 'auditoria') renderAuditoria();
  if (page === 'clube') { renderClube(); _lgpdPopulate(); }
  if (page === 'lesoes') renderLesoes();
  if (page === 'pid') renderPID();
  // Recompute scroll-helper visibility after the page renders (charts/data
  // change the height); a couple of delayed passes catch async chart layout.
  if (typeof _updateScrollUI === 'function') { setTimeout(_updateScrollUI, 120); setTimeout(_updateScrollUI, 600); }
}

// ═══════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ═══════════════════════════════════════════════════════════
// MODAL
// ═══════════════════════════════════════════════════════════
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  if (id === 'modal-mc-relatorio') {
    // Restore save button and clear historical report context
    const saveBtn = document.querySelector('#modal-mc-relatorio [onclick="mcSalvarEFechar()"]');
    if (saveBtn) saveBtn.style.display = '';
    // If closed without saving (historical view), clear report globals
    if (!mcPendingSegmentos) {
      mcCurrentReportSegs = null;
      mcPendingPId = null;
    }
  }
}
document.querySelectorAll('.modal-backdrop').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
});

// ═══════════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════════
function switchTab(btn, tabId) {
  const parent = btn.closest('.modal') || btn.closest('.card') || document;
  parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  parent.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(tabId).classList.add('active');
}

// ═══════════════════════════════════════════════════════════
// PERFORMANCE CALC
// ═══════════════════════════════════════════════════════════
/* ── Modelo de nota — FUTSAL, ajustado por naipe ───────────────────────────
   Baseado no arcabouço consolidado de indicadores de goleiro(a) (% de defesa,
   gols sofridos, 1x1, precisão de distribuição, saídas/comando de área) e na
   especificidade do futsal, onde a distribuição/progressão de bola é ~41% das
   ações do goleiro em nível de elite — por isso pesa mais que no futebol de
   campo. As referências por naipe são calibráveis (Config. do Clube →
   Metodologia) e são DEFAULTS documentados, não normas fechadas: a literatura
   aponta diferenças qualitativas (mulheres: menor velocidade de chute → mais
   defesas possíveis e ênfase em precisão/posicionamento). */
// Referências por MODALIDADE e naipe (valor que corresponde à nota "Boa" = 7,0).
// Futsal: quadra, distribuição importante (~41% das ações do goleiro).
// Beach soccer: areia, jogo de alto placar (defesas de qualquer zona → % de
// defesa de referência menor) e o goleiro é a "primeira linha de ataque" —
// participa de ~60% dos gols; por isso a DISTRIBUIÇÃO (arremesso longo) pesa
// ainda mais. Defaults documentados e ajustáveis (Config → Metodologia).
const GKHUB_MODALIDADES = { futsal: 'Futsal', beach: 'Beach Soccer' };
const GKHUB_BENCH_DEFAULT = {
  futsal: {
    feminino:  { saveRate: 0.66, dist: 0.72 },
    masculino: { saveRate: 0.62, dist: 0.75 },
    weights: { defesa: 0.65, dist: 0.25, tatico: 0.10 },
  },
  beach: {
    feminino:  { saveRate: 0.55, dist: 0.72 },
    masculino: { saveRate: 0.52, dist: 0.74 },
    weights: { defesa: 0.50, dist: 0.40, tatico: 0.10 }, // distribuição (arremesso) é a arma central
  },
};
function _modalidadeOf(gkId) { const g = DB.goleiras.find(x => x.id === gkId); return (g && g.modalidade === 'beach') ? 'beach' : 'futsal'; }
function gkBench(mod) {
  mod = (mod === 'beach') ? 'beach' : 'futsal';
  const d = GKHUB_BENCH_DEFAULT[mod];
  try {
    const all = JSON.parse(localStorage.getItem('gkhub_bench') || '{}');
    const s = (all && all[mod]) ? all[mod] : (mod === 'futsal' ? all : {}); // compat: bench antigo (plano) = futsal
    return {
      feminino: { ...d.feminino, ...((s && s.feminino) || {}) },
      masculino: { ...d.masculino, ...((s && s.masculino) || {}) },
      weights: { ...d.weights, ...((s && s.weights) || {}) },
    };
  } catch (e) { return JSON.parse(JSON.stringify(d)); }
}
function _naipeOf(gkId) { const g = DB.goleiras.find(x => x.id === gkId); return (g && g.naipe === 'masculino') ? 'masculino' : 'feminino'; }
function _anchorScore(v, ref) { // ref→7.0, 1.0→10, 0→0 (linear por trechos)
  if (!(ref > 0) || ref >= 1) ref = 0.65;
  if (v <= 0) return 0;
  if (v >= 1) return 10;
  return v <= ref ? (v / ref) * 7 : 7 + ((v - ref) / (1 - ref)) * 3;
}
function calcPerformanceAuto(scout, naipe) {
  const totalDef = (+scout.dad||0) + (+scout.dae||0) + (+scout.dbd||0) + (+scout.dbe||0) + (+scout.dc||0) + (+scout.d1x1||0) + (+scout.esq||0);
  const gols     = (+scout.gda||0) + (+scout.gfa||0) + (+scout.gpe||0) + (+scout.gfl||0);
  if (totalDef + gols === 0) return null;
  const b = gkBench(_modalidadeOf(scout.goalkeeperId));
  const ref = b[naipe || _naipeOf(scout.goalkeeperId)] || b.feminino;
  const w = b.weights;
  // Defesa — eficiência defensiva (% de defesa) vs referência do naipe
  const defesaS = _anchorScore(totalDef / (totalDef + gols), ref.saveRate);
  // Distribuição — precisão da reposição (curta + longa)
  const distCerto = (+scout.dpc||0) + (+scout.dmc||0);
  const distTotal = distCerto + (+scout.dpe||0) + (+scout.dme||0);
  const distS = distTotal > 0 ? _anchorScore(distCerto / distTotal, ref.dist) : 7; // neutro sem dados
  // Núcleo (defesa + distribuição) normalizado → nível de referência = "Boa" (7,0)
  const coreDen = (w.defesa + w.dist) || 1;
  const core = (defesaS * w.defesa + distS * w.dist) / coreDen;
  // Tático (interceptações + saídas / comando de área) entra como BÔNUS, para
  // não penalizar quem tem boa defesa/distribuição mas poucas ações táticas.
  const tatBonus = Math.min(1, ((+scout.int||0) + (+scout.sai||0)) * 0.15) * (w.tatico * 5);
  return Math.round(Math.min(10, core + tatBonus) * 10) / 10;
}

function calcPerformance(scout) {
  const nota = scout.nota ? parseFloat(scout.nota) : null;
  if (nota !== null && !isNaN(nota)) return nota;
  return calcPerformanceAuto(scout);
}

function classifyPerf(score) {
  if (score === null || score === undefined) return { label: '—', cls: '' };
  if (score >= 9) return { label: 'Elite', cls: 'badge-elite' };
  if (score >= 8) return { label: 'Excelente', cls: 'badge-excelente' };
  if (score >= 7) return { label: 'Boa', cls: 'badge-boa' };
  if (score >= 5) return { label: 'Regular', cls: 'badge-regular' };
  return { label: 'Em Desenvolvimento', cls: 'badge-dev' };
}

function avgPerformance(goalkeeperId) {
  const scouts = _mergeScouts(DB.scouts.filter(s => s.goalkeeperId == goalkeeperId));
  if (!scouts.length) return null;
  const scores = scouts.map(calcPerformance).filter(s => s !== null);
  if (!scores.length) return null;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}

// ═══════════════════════════════════════════════════════════
// GOLEIRAS
// ═══════════════════════════════════════════════════════════
function uid() { return Date.now() + Math.random().toString(36).slice(2, 7); }

function openNovaGoleira() {
  editingId.goleira = null;
  currentFotoBase64 = '';
  document.getElementById('modal-goleira-title').textContent = 'Nova Goleira';
  ['nome','nasc','num','altura','peso','equipe','obs'].forEach(f => document.getElementById('gk-'+f).value = '');
  ['categoria','pe','mao','naipe'].forEach(f => document.getElementById('gk-'+f).value = '');
  var _m=document.getElementById('gk-modalidade'); if(_m) _m.value='futsal';
  const _c = document.getElementById('gk-consent'); if (_c) _c.checked = false;
  const _cr = document.getElementById('gk-consent-resp'); if (_cr) _cr.value = '';
  clearFoto();
  openModal('modal-goleira');
}

function salvarGoleira() {
  const nome = document.getElementById('gk-nome').value.trim();
  if (!nome) { toast('Informe o nome da goleira', 'error'); return; }
  const goleiras = DB.goleiras;
  const existente = editingId.goleira ? goleiras.find(g=>g.id===editingId.goleira) : null;
  const obj = {
    id: editingId.goleira || uid(),
    nome, nasc: document.getElementById('gk-nasc').value,
    num: document.getElementById('gk-num').value,
    altura: document.getElementById('gk-altura').value,
    peso: document.getElementById('gk-peso').value,
    equipe: document.getElementById('gk-equipe').value,
    categoria: document.getElementById('gk-categoria').value,
    pe: document.getElementById('gk-pe').value,
    mao: document.getElementById('gk-mao').value,
    naipe: document.getElementById('gk-naipe').value,
    modalidade: document.getElementById('gk-modalidade').value,
    obs: document.getElementById('gk-obs').value,
    consent: document.getElementById('gk-consent').checked,
    consentResp: document.getElementById('gk-consent-resp').value,
    consentData: document.getElementById('gk-consent').checked ? (existente && existente.consentData ? existente.consentData : new Date().toISOString().slice(0, 10)) : '',
    foto: currentFotoBase64 || (existente ? existente.foto : ''),
    criadoEm: editingId.goleira ? undefined : new Date().toISOString(),
  };
  if (editingId.goleira) {
    const idx = goleiras.findIndex(g => g.id === editingId.goleira);
    if (idx !== -1) { goleiras[idx] = { ...goleiras[idx], ...obj }; }
  } else {
    goleiras.push(obj);
  }
  DB.saveGoleiras(goleiras);
  cloudSet('goleiras', editingId.goleira ? goleiras.find(g=>g.id===editingId.goleira) : obj);
  logAudit('Goleiras', (editingId.goleira ? 'Atualizou' : 'Cadastrou') + ' a goleira ' + nome);
  if (!editingId.goleira) pushNotif('info', 'Nova goleira', nome + ' foi cadastrada.');
  closeModal('modal-goleira');
  renderGoleiras();
  updateGoleiraSelects();
  toast(editingId.goleira ? 'Goleira atualizada!' : 'Goleira cadastrada!', 'success');
}

function editarGoleira(id) {
  const g = DB.goleiras.find(x => x.id === id);
  if (!g) return;
  editingId.goleira = id;
  document.getElementById('modal-goleira-title').textContent = 'Editar Goleira';
  document.getElementById('gk-nome').value = g.nome || '';
  document.getElementById('gk-nasc').value = g.nasc || '';
  document.getElementById('gk-num').value = g.num || '';
  document.getElementById('gk-altura').value = g.altura || '';
  document.getElementById('gk-peso').value = g.peso || '';
  document.getElementById('gk-equipe').value = g.equipe || '';
  document.getElementById('gk-categoria').value = g.categoria || '';
  document.getElementById('gk-naipe').value = g.naipe || '';
  document.getElementById('gk-modalidade').value = g.modalidade || 'futsal';
  document.getElementById('gk-pe').value = g.pe || '';
  document.getElementById('gk-mao').value = g.mao || '';
  document.getElementById('gk-obs').value = g.obs || '';
  document.getElementById('gk-consent').checked = !!g.consent;
  document.getElementById('gk-consent-resp').value = g.consentResp || '';
  currentFotoBase64 = g.foto || '';
  updateFotoPreview(currentFotoBase64);
  openModal('modal-goleira');
}

function excluirGoleira(id) {
  if (!confirm('Excluir esta goleira? Os scouts e dados associados também serão removidos.')) return;
  const _gk = DB.goleiras.find(g => g.id === id);
  logAudit('Goleiras', 'Excluiu a goleira ' + (_gk ? _gk.nome : id));
  DB.saveGoleiras(DB.goleiras.filter(g => g.id !== id));
  DB.saveScouts(DB.scouts.filter(s => s.goalkeeperId !== id));
  cloudDelete('goleiras', id);
  renderGoleiras();
  updateGoleiraSelects();
  toast('Goleira excluída.', 'info');
}

function renderGoleiras() {
  const q = (document.getElementById('search-goleiras')?.value || '').toLowerCase();
  const goleiras = DB.goleiras.filter(g => !q || g.nome.toLowerCase().includes(q) || (g.equipe||'').toLowerCase().includes(q));
  const tbody = document.getElementById('tbody-goleiras');
  if (!goleiras.length) {
    tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state"><p>Nenhuma goleira encontrada.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = goleiras.map((g, i) => {
    const avg = avgPerformance(g.id);
    const { label, cls } = classifyPerf(avg);
    return `<tr>
      <td>${i + 1}</td>
      <td><strong>${_esc(g.nome)}</strong></td>
      <td>${g.nasc ? formatDate(g.nasc) : '—'}</td>
      <td>${g.altura ? g.altura + ' cm' : '—'}</td>
      <td>${g.peso ? g.peso + ' kg' : '—'}</td>
      <td>${_esc(g.equipe || '—')}</td>
      <td>${_esc(g.categoria || '—')}</td>
      <td>${_esc(g.pe || '—')}</td>
      <td>${avg !== null ? `<span class="badge ${cls}">${label} (${avg})</span>` : '<span style="color:var(--muted)">—</span>'}</td>
      <td>
        <div class="td-actions">
          <button class="btn btn-primary btn-sm" onclick="verPerfil('${g.id}')">Perfil</button>
          <button class="btn btn-ghost btn-sm" onclick="editarGoleira('${g.id}')">Editar</button>
          <button class="btn btn-danger btn-sm" onclick="excluirGoleira('${g.id}')">Excluir</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════
// PARTIDAS
// ═══════════════════════════════════════════════════════════
function toggleSegundaGoleira(forcar) {
  const sec = document.getElementById('secao-gk2');
  const grp = document.getElementById('grupo-periodo1');
  const btn = document.getElementById('btn-add-gk2');
  const lbl = document.getElementById('lbl-gk1');
  const ativo = forcar !== undefined ? forcar : (sec.style.display === 'none');
  sec.style.display = ativo ? 'block' : 'none';
  grp.style.display = ativo ? 'block' : 'none';
  lbl.textContent = ativo ? '1ª Goleira' : 'Goleira';
  btn.textContent = ativo ? '✕ Remover 2ª goleira' : '+ 2ª Goleira';
  btn.style.color = ativo ? 'var(--error)' : 'var(--muted)';
  if (!ativo) {
    document.getElementById('match-gk2').value = '';
    document.getElementById('match-periodo1').value = '1º Tempo';
    document.getElementById('match-periodo2').value = '2º Tempo';
  }
}

function salvarPartida() {
  const data = document.getElementById('match-data').value;
  const adv = document.getElementById('match-adv').value.trim();
  if (!adv) { toast('Informe o adversário', 'error'); return; }
  if (!data) { toast('Informe a data da partida', 'error'); return; }
  const gkIdCheck = document.getElementById('match-goleira').value;
  if (!gkIdCheck) { toast('Selecione a goleira da partida', 'error'); return; }
  const partidas = DB.partidas;
  const gk2Id = document.getElementById('match-gk2').value;
  const temGk2 = document.getElementById('secao-gk2').style.display !== 'none' && gk2Id;
  const obj = {
    id: editingId.partida || uid(),
    data, hora: document.getElementById('match-hora').value,
    adversario: adv,
    competicao: document.getElementById('match-comp').value,
    fase: document.getElementById('match-fase').value,
    local: document.getElementById('match-local').value,
    goalkeeperId: document.getElementById('match-goleira').value,
    periodo1: temGk2 ? (document.getElementById('match-periodo1').value || '1º Tempo') : '',
    gk2Id: temGk2 ? gk2Id : '',
    periodo2: temGk2 ? (document.getElementById('match-periodo2').value || '2º Tempo') : '',
    gf: +document.getElementById('match-gf').value || 0,
    gc: +document.getElementById('match-gc').value || 0,
    obs: document.getElementById('match-obs').value,
  };
  if (editingId.partida) {
    const idx = partidas.findIndex(p => p.id === editingId.partida);
    if (idx !== -1) partidas[idx] = { ...partidas[idx], ...obj };
  } else {
    partidas.push(obj);
  }
  DB.savePartidas(partidas);
  cloudSet('partidas', editingId.partida ? partidas.find(p=>p.id===editingId.partida) : obj);
  closeModal('modal-partida');
  renderPartidas();
  toast(editingId.partida ? 'Partida atualizada!' : 'Partida cadastrada!', 'success');
  if (loadPreferences().notifPartidas) {
    const adv = document.getElementById('pt-adversario')?.value || obj.adversario || 'adversário';
    _sendNotif('Partida registrada', `Partida contra ${adv} salva com sucesso`, 'partida');
  }
}

function editarPartida(id) {
  const p = DB.partidas.find(x => x.id === id);
  if (!p) return;
  editingId.partida = id;
  document.getElementById('modal-partida-title').textContent = 'Editar Partida';
  document.getElementById('match-data').value = p.data || '';
  document.getElementById('match-hora').value = p.hora || '';
  document.getElementById('match-adv').value = p.adversario || '';
  document.getElementById('match-comp').value = p.competicao || '';
  document.getElementById('match-fase').value = p.fase || '';
  document.getElementById('match-local').value = p.local || '';
  document.getElementById('match-goleira').value = p.goalkeeperId || '';
  document.getElementById('match-gf').value = p.gf ?? 0;
  document.getElementById('match-gc').value = p.gc ?? 0;
  document.getElementById('match-obs').value = p.obs || '';
  // Restaura 2ª goleira
  toggleSegundaGoleira(false);
  if (p.gk2Id) {
    toggleSegundaGoleira(true);
    document.getElementById('match-gk2').value = p.gk2Id;
    document.getElementById('match-periodo1').value = p.periodo1 || '1º Tempo';
    document.getElementById('match-periodo2').value = p.periodo2 || '2º Tempo';
  }
  openModal('modal-partida');
}

function excluirPartida(id) {
  if (!confirm('Excluir esta partida e todos os scouts vinculados a ela?')) return;
  const _pt = DB.partidas.find(p => p.id === id);
  logAudit('Partidas', 'Excluiu a partida ' + (_pt ? ('vs ' + (_pt.adversario || '—')) : id));
  DB.savePartidas(DB.partidas.filter(p => p.id !== id));
  const scoutsVinculados = DB.scouts.filter(s => s.partidaId === id);
  DB.saveScouts(DB.scouts.filter(s => s.partidaId !== id));
  scoutsVinculados.forEach(s => cloudDelete('scouts', s.id));
  cloudDelete('partidas', id);
  renderPartidas();
  toast('Partida e scouts vinculados excluídos.', 'info');
}

let filtroCompeticao = '';

function renderFiltroCompeticoes() {
  const todas = DB.partidas;
  const comps = [...new Set(todas.map(p => p.competicao || '').filter(Boolean))].sort();
  const container = document.getElementById('filtro-competicoes');
  if (!container) return;
  if (comps.length < 2) { container.style.display = 'none'; return; }
  container.style.display = 'flex';
  const chips = [{ label: 'Todas', value: '' }, ...comps.map(c => ({ label: c, value: c }))];
  container.innerHTML = chips.map(c => {
    const ativo = filtroCompeticao === c.value;
    return `<button onclick="filtroCompeticao='${c.value.replace(/'/g,"\\'")}';renderFiltroCompeticoes();renderPartidas();"
      style="padding:5px 14px;border-radius:20px;border:1px solid ${ativo ? 'var(--primary)' : 'var(--border)'};
             background:${ativo ? 'rgba(0,212,255,.15)' : 'var(--card)'};
             color:${ativo ? 'var(--primary)' : 'var(--muted)'};
             font-size:12px;font-weight:${ativo ? 600 : 400};cursor:pointer;transition:all .2s;white-space:nowrap;">
      ${c.label}${c.value ? ` <span style="opacity:.6;font-size:10px;">(${todas.filter(p=>(p.competicao||'')=== c.value).length})</span>` : ''}
    </button>`;
  }).join('');
}

function renderPartidas() {
  renderFiltroCompeticoes();
  const q = (document.getElementById('search-partidas')?.value || '').toLowerCase();
  const partidas = DB.partidas.filter(p => {
    const matchQ = !q || (p.adversario||'').toLowerCase().includes(q) || (p.competicao||'').toLowerCase().includes(q);
    const matchComp = !filtroCompeticao || (p.competicao || '') === filtroCompeticao;
    return matchQ && matchComp;
  });
  const goleiras = DB.goleiras;
  const tbody = document.getElementById('tbody-partidas');
  if (!partidas.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><p>Nenhuma partida encontrada.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = [...partidas].sort((a,b) => (b.data||'').localeCompare(a.data||'')).map(p => {
    const gk  = goleiras.find(g => g.id === p.goalkeeperId);
    const gk2 = p.gk2Id ? goleiras.find(g => g.id === p.gk2Id) : null;
    const scouts = DB.scouts.filter(s => s.partidaId === p.id);
    const totalDef = scouts.reduce((acc, s) =>
      acc + (+s.dad||0)+(+s.dae||0)+(+s.dbd||0)+(+s.dbe||0)+(+s.dc||0), 0);
    let res = '—';
    if (p.gf !== undefined && p.gc !== undefined) {
      const r = p.gf > p.gc ? 'V' : p.gf < p.gc ? 'D' : 'E';
      const color = r==='V'?'var(--success)':r==='D'?'var(--error)':'var(--warning)';
      res = `<span style="color:${color};font-weight:700">${r} ${p.gf}×${p.gc}</span>`;
    }
    let gkCell = gk ? _esc(gk.nome) : '—';
    if (gk2) {
      gkCell = `<span style="display:block;line-height:1.6;">
        <span style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;">${_esc(p.periodo1||'1º T')}</span><br>
        <strong>${gk ? _esc(gk.nome) : '—'}</strong>
      </span>
      <span style="display:block;line-height:1.6;margin-top:4px;padding-top:4px;border-top:1px solid var(--border);">
        <span style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;">${_esc(p.periodo2||'2º T')}</span><br>
        <strong>${_esc(gk2.nome)}</strong>
      </span>`;
    }
    return `<tr>
      <td>${p.data ? formatDate(p.data) : '—'}</td>
      <td><strong>${_esc(p.adversario)}</strong></td>
      <td>${_esc(p.competicao || '—')}</td>
      <td>${gkCell}</td>
      <td>${res}</td>
      <td>${p.gc ?? '—'}</td>
      <td>${totalDef || '—'}</td>
      <td>
        <div class="td-actions">
          <button class="btn btn-ghost btn-sm" onclick="verRelatorioPartida('${p.id}')">📊 Relatório</button>
          <button class="btn btn-ghost btn-sm" onclick="editarPartida('${p.id}')">Editar</button>
          <button class="btn btn-danger btn-sm" onclick="excluirPartida('${p.id}')">Excluir</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function verRelatorioPartida(pId) {
  const partida = DB.partidas.find(p => p.id === pId);
  if (!partida) return;
  const scouts = DB.scouts.filter(s => s.partidaId === pId);
  if (!scouts.length) { toast('Nenhum scout registrado para esta partida', 'info'); return; }

  // Build segments from saved scouts
  const segs = scouts.map(s => ({
    gkId: s.goalkeeperId,
    periodoLabel: s.periodo || '1T',
    data: Object.fromEntries(MC_FIELDS.map(f => [f, +s[f]||0]))
  }));

  // Set MC globals from historical data
  const notaVals = scouts.map(s => parseFloat(s.nota) || calcPerformanceAuto(s) || 7.0);
  mcNotaAtual    = notaVals[notaVals.length - 1] ?? 7.0;
  mcMaxNota      = Math.max(...notaVals);
  mcMinNota      = Math.min(...notaVals);
  mcBestNotaSec  = 0; mcWorstNotaSec = 0;
  mcMaxStreak    = 0; mcMaxPosStreak = 0; mcMaxNegStreak = 0;
  mcNotaHistory  = []; // no live history for past matches
  mcLog          = []; // clear any leftover live session log
  mcSeconds      = 0;
  mcPendingPId   = pId; // needed for PDF to find partida data

  // Hide "Salvar e Fechar" (only relevant for live MC session)
  const saveBtn = document.querySelector('#modal-mc-relatorio [onclick="mcSalvarEFechar()"]');
  if (saveBtn) saveBtn.style.display = 'none';

  mcMostrarRelatorioFinal(segs, pId);

  // Override subtitle to clarify it's historical
  const subtitleEl = document.getElementById('mc-rel-subtitle');
  if (subtitleEl) {
    const parts = [];
    if (partida.adversario) parts.push(partida.adversario);
    if (partida.data) parts.push(formatDate(partida.data));
    parts.push(`${scouts.length} período(s) · Dados históricos`);
    subtitleEl.textContent = parts.join(' · ');
  }
}

// ═══════════════════════════════════════════════════════════
// SCOUT
// ═══════════════════════════════════════════════════════════
function preencherNotaAuto() {
  const fields = ['dad','dae','dbd','dbe','dc','d1x1','esq','gda','gfa','gpe','gfl','tchmed','tc1x1','tchala','tchst','dpc','dpe','dmc','dme','int','pose','posd','sai'];
  const s = {};
  fields.forEach(f => { s[f] = document.getElementById('s-'+f)?.value || 0; });
  const nota = calcPerformanceAuto(s);
  if (nota === null) { toast('Insira defesas ou gols para calcular a nota', 'error'); return; }
  document.getElementById('s-nota').value = nota;
  atualizarNotaPreview();
  toast(`Nota calculada: ${nota}`, 'success');
}

function atualizarNotaPreview() {
  const fields = ['dad','dae','dbd','dbe','dc','d1x1','esq','gda','gfa','gpe','gfl','tchmed','tc1x1','tchala','tchst','dpc','dpe','dmc','dme','int','pose','posd','sai'];
  const s = {};
  fields.forEach(f => { s[f] = document.getElementById('s-'+f)?.value || 0; });
  const notaManual = document.getElementById('s-nota')?.value;
  if (notaManual && !isNaN(parseFloat(notaManual))) { s.nota = notaManual; }
  const nota = calcPerformance(s);
  const badge = document.getElementById('nota-preview-badge');
  const lbl   = document.getElementById('nota-preview-label');
  const tipo  = document.getElementById('nota-preview-tipo');
  if (!badge) return;
  if (nota === null) {
    badge.textContent = '—'; lbl.textContent = 'Insira dados para calcular'; tipo.textContent = '';
    badge.style.color = 'var(--muted)';
    return;
  }
  const { label, cls } = classifyPerf(nota);
  badge.textContent = nota;
  lbl.textContent = label;
  tipo.textContent = notaManual ? 'nota manual' : 'calculada automaticamente';
  const colors = { 'badge-elite': '#60A5FA', 'badge-excelente': '#34D399', 'badge-boa': '#FCD34D', 'badge-regular': '#FCA5A5', 'badge-dev': '#94A3B8' };
  badge.style.color = colors[cls] || 'var(--primary)';
}

function salvarScout() {
  const goalkeeperId = document.getElementById('scout-goleira').value;
  if (!goalkeeperId) { toast('Selecione a goleira', 'error'); return; }
  const scouts = DB.scouts;
  const fields = ['dad','dae','dbd','dbe','dc','d1x1','esq','gda','gfa','gpe','gfl','tchmed','tc1x1','tchala','tchst','dpc','dpe','dmc','dme','int','pose','posd','sai','nota'];
  const obj = { id: editingId.scout || uid(), goalkeeperId,
    partidaId: document.getElementById('scout-partida').value };
  fields.forEach(f => { obj[f] = document.getElementById('s-'+f)?.value || 0; });
  // Persiste nota calculada automaticamente se não houver nota manual
  if (!parseFloat(obj.nota)) {
    const autoNota = calcPerformanceAuto(obj);
    if (autoNota !== null) obj.nota = autoNota;
  }
  if (editingId.scout) {
    const idx = scouts.findIndex(s => s.id === editingId.scout);
    if (idx !== -1) scouts[idx] = { ...scouts[idx], ...obj };
  } else {
    scouts.push(obj);
  }
  DB.saveScouts(scouts);
  cloudSet('scouts', editingId.scout ? scouts.find(s=>s.id===editingId.scout) : obj);
  closeModal('modal-scout');
  renderScouts();
  toast('Scout salvo!', 'success');
  if (loadPreferences().notifScouts) {
    const gkN = DB.goleiras.find(g=>g.id===document.getElementById('scout-goleira').value)?.nome || 'Goleira';
    _sendNotif('Scout registrado', `Scout de ${gkN} salvo com sucesso`, 'scout');
  }
}

function editarScout(id) {
  const s = DB.scouts.find(x => x.id === id);
  if (!s) return;
  editingId.scout = id;
  document.getElementById('modal-scout-title').textContent = 'Editar Scout';
  document.getElementById('scout-goleira').value = s.goalkeeperId || '';
  document.getElementById('scout-partida').value = s.partidaId || '';
  const fields = ['dad','dae','dbd','dbe','dc','d1x1','esq','gda','gfa','gpe','gfl','tchmed','tc1x1','tchala','tchst','dpc','dpe','dmc','dme','int','pose','posd','sai','nota'];
  fields.forEach(f => { const el = document.getElementById('s-'+f); if(el) el.value = s[f] || 0; });
  openModal('modal-scout');
  atualizarNotaPreview();
}

function excluirScout(id) {
  if (!confirm('Excluir este scout?')) return;
  logAudit('Scouts', 'Excluiu um scout');
  DB.saveScouts(DB.scouts.filter(s => s.id !== id));
  cloudDelete('scouts', id);
  renderScouts();
  toast('Scout excluído.', 'info');
}

// Merge scout records with the same goalkeeper + game into one combined entry.
// Numeric stat fields are summed; manual nota is averaged when present.
function _mergeScouts(scouts) {
  const _STAT_FIELDS = ['dad','dae','dbd','dbe','dc','d1x1','esq','gda','gfa','gpe','gfl','int','sai','dpc','dpe','dmc','dme','pose','posd'];
  const map = new Map();
  for (const s of scouts) {
    const key = `${s.goalkeeperId}__${s.partidaId}`;
    if (!map.has(key)) {
      map.set(key, { ...s });
    } else {
      const m = map.get(key);
      for (const f of _STAT_FIELDS) m[f] = (+m[f]||0) + (+s[f]||0);
      // average manual notas when both have one
      if (m.nota && s.nota) m.nota = ((parseFloat(m.nota)||0) + (parseFloat(s.nota)||0)) / 2;
    }
  }
  return [...map.values()];
}

function renderScouts() {
  const goleiras = DB.goleiras;
  const partidas = DB.partidas;
  const scouts = _mergeScouts(DB.scouts);
  const tbody = document.getElementById('tbody-scouts');
  if (!scouts.length) {
    tbody.innerHTML = `<tr><td colspan="11"><div class="empty-state"><p>Nenhum scout registrado.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = scouts.map(s => {
    const gk = goleiras.find(g => g.id === s.goalkeeperId);
    const pt = partidas.find(p => p.id === s.partidaId);
    const totalDef = (+s.dad||0)+(+s.dae||0)+(+s.dbd||0)+(+s.dbe||0)+(+s.dc||0);
    const totalGols = (+s.gda||0)+(+s.gfa||0)+(+s.gpe||0)+(+s.gfl||0);
    const totalDist = (+s.dpc||0)+(+s.dpe||0)+(+s.dmc||0)+(+s.dme||0);
    const pos = (+s.pose||0)+(+s.posd||0);
    const nota = calcPerformance(s);
    const { label, cls } = classifyPerf(nota);
    const isManual = s.nota && !isNaN(parseFloat(s.nota));
    const notaHtml = nota !== null
      ? `<span class="badge ${cls}" title="${isManual ? 'Nota manual' : 'Calculada automaticamente'}">${nota} <small style="opacity:.7">${label}</small></span>`
      : '<span style="color:var(--muted)">—</span>';
    return `<tr>
      <td><strong>${gk ? _esc(gk.nome) : '—'}</strong></td>
      <td>${pt ? `${_esc(pt.adversario)}${pt.data?' ('+formatDate(pt.data)+')':''}` : '—'}</td>
      <td>${totalDef}</td>
      <td>${(+s.dbd||0)+(+s.dbe||0)}</td>
      <td>${s.dc || 0}</td>
      <td>${totalGols}</td>
      <td>${s.int || 0}</td>
      <td>${totalDist}</td>
      <td>${pos}</td>
      <td>${notaHtml}</td>
      <td>
        <div class="td-actions">
          <button class="btn btn-ghost btn-sm" onclick="editarScout('${s.id}')">Editar</button>
          <button class="btn btn-danger btn-sm" onclick="excluirScout('${s.id}')">Excluir</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════
// PERFORMANCE
// ═══════════════════════════════════════════════════════════
function renderPerformance() {
  const goleiras = DB.goleiras;
  const listEl = document.getElementById('perf-gk-list');
  if (!goleiras.length) {
    listEl.innerHTML = `<div class="empty-state"><p>Nenhuma goleira cadastrada.</p></div>`;
    return;
  }
  listEl.innerHTML = goleiras.map(g => {
    const avg = avgPerformance(g.id);
    const { label, cls } = classifyPerf(avg);
    return `<div onclick="showPerfDetail('${g.id}')" style="cursor:pointer;padding:10px 12px;border-radius:8px;border:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;transition:background .2s;" onmouseover="this.style.background='rgba(255,255,255,.04)'" onmouseout="this.style.background=''">
      <span style="font-weight:500;font-size:13px;">${_esc(g.nome)}</span>
      ${avg !== null ? `<span class="badge ${cls}">${avg}</span>` : '<span style="color:var(--muted);font-size:12px;">sem dados</span>'}
    </div>`;
  }).join('');
}

function showPerfDetail(gkId) {
  const gk = DB.goleiras.find(g => g.id === gkId);
  if (!gk) return;
  const scouts = _mergeScouts(DB.scouts.filter(s => s.goalkeeperId === gkId));
  const el = document.getElementById('perf-detail');
  if (!scouts.length) {
    el.innerHTML = `<div class="card-title" style="margin-bottom:12px;">${_esc(gk.nome)}</div><div class="empty-state"><p>Nenhum scout registrado para esta goleira.</p></div>`;
    return;
  }
  const totalDef = scouts.reduce((a,s) => a+(+s.dad||0)+(+s.dae||0)+(+s.dbd||0)+(+s.dbe||0)+(+s.dc||0), 0);
  const totalGols = scouts.reduce((a,s) => a+(+s.gda||0)+(+s.gfa||0)+(+s.gpe||0)+(+s.gfl||0), 0);
  const totalInt = scouts.reduce((a,s) => a+(+s.int||0), 0);
  const totalDist = scouts.reduce((a,s) => a+(+s.dpc||0)+(+s.dmc||0), 0);
  const avgNota = avgPerformance(gkId);
  const { label, cls } = classifyPerf(avgNota);
  const dims = [
    { label: 'Defesa Alta', val: Math.min(10, (scouts.reduce((a,s)=>a+(+s.dad||0)+(+s.dae||0),0)/scouts.length)) },
    { label: 'Defesa Baixa', val: Math.min(10, (scouts.reduce((a,s)=>a+(+s.dbd||0)+(+s.dbe||0),0)/scouts.length)) },
    { label: 'Defesa Central', val: Math.min(10, (scouts.reduce((a,s)=>a+(+s.dc||0),0)/scouts.length)) },
    { label: 'Interceptações', val: Math.min(10, (totalInt/scouts.length)) },
    { label: 'Distribuição', val: Math.min(10, (totalDist/scouts.length)) },
    { label: 'Esquadros', val: Math.min(10, (scouts.reduce((a,s)=>a+(+s.esq||0),0)/scouts.length)) },
  ];
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div>
        <div style="font-size:16px;font-weight:700;">${_esc(gk.nome)}</div>
        <div style="color:var(--muted);font-size:12px;">${_esc(gk.equipe||'')} ${gk.categoria?'• '+_esc(gk.categoria):''}</div>
      </div>
      ${avgNota !== null ? `<span class="badge ${cls}" style="font-size:14px;padding:6px 14px;">${label} — ${avgNota}</span>` : ''}
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;">
      <div style="text-align:center;"><div style="font-size:22px;font-weight:700;color:var(--primary);">${totalDef}</div><div style="font-size:11px;color:var(--muted);">Defesas</div></div>
      <div style="text-align:center;"><div style="font-size:22px;font-weight:700;color:var(--error);">${totalGols}</div><div style="font-size:11px;color:var(--muted);">Gols Sofridos</div></div>
      <div style="text-align:center;"><div style="font-size:22px;font-weight:700;color:var(--success);">${scouts.length}</div><div style="font-size:11px;color:var(--muted);">Partidas</div></div>
    </div>
    <div>${dims.map(d => {
      const pct = Math.min(100, (d.val / 10) * 100);
      return `<div class="perf-bar-row">
        <div class="perf-bar-label">${d.label}</div>
        <div class="perf-bar-track"><div class="perf-bar-fill" style="width:${pct}%"></div></div>
        <div class="perf-bar-val">${d.val.toFixed(1)}</div>
      </div>`;
    }).join('')}</div>
  `;
  // Evolution chart
  const labels = scouts.map((_, i) => `P${i+1}`);
  const scores = scouts.map(calcPerformance);
  renderEvolucaoChart(labels, scores);
}

function renderEvolucaoChart(labels, data) {
  if (chartEvolucao) chartEvolucao.destroy();
  chartEvolucao = new Chart(document.getElementById('chart-evolucao'), {
    type: 'line',
    data: {
      labels,
      datasets: [{ label: 'Performance', data, borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,.1)', tension: 0.4, fill: true, pointBackgroundColor: '#3B82F6' }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
      scales: { x: { grid: { color: '#1E1E3A' }, ticks: { color: '#5A5A7A' } },
        y: { grid: { color: '#1E1E3A' }, ticks: { color: '#5A5A7A' }, min: 0, max: 10 } } }
  });
}

// ═══════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════
/* ═══════════════════════════════════════════════════════════
   AÇÕES RÁPIDAS (FAB) — reuse existing "+ new" openers
   ═══════════════════════════════════════════════════════════ */
function toggleFab() { document.body.classList.toggle('fab-open'); }
function _closeFab() { document.body.classList.remove('fab-open'); }
function fabAction(kind) {
  _closeFab();
  const clickBtn = (sel) => { const b = document.querySelector(sel); if (b) b.click(); };
  switch (kind) {
    case 'goleira': clickBtn('[onclick="openModal(\'modal-goleira\')"]'); break;
    case 'partida': clickBtn('[onclick="openModal(\'modal-partida\')"]'); break;
    case 'scout':   clickBtn('[onclick="openModal(\'modal-scout\')"]'); break;
    case 'treino':    navigate('treinos'); setTimeout(() => { if (typeof openTpSessionForm === 'function') openTpSessionForm(); }, 80); break;
    case 'exercicio': navigate('treinos'); setTimeout(() => { if (typeof openTpExerciseForm === 'function') openTpExerciseForm(); }, 80); break;
    case 'meta':    navigate('perfil'); toast('Selecione a goleira e clique em “+ Meta”.', 'info'); break;
    case 'pdf':     navigate('relatorios'); break;
  }
}
/* ── Botão de rolagem — funciona seja o scroller a janela, .main ou .content ── */
function _scroller() {
  const cands = [document.scrollingElement, document.querySelector('.main'), document.querySelector('.content')];
  for (const el of cands) { if (el && el.scrollHeight > el.clientHeight + 4) return el; }
  return document.scrollingElement || document.documentElement;
}
function scrollHelperClick() {
  const el = _scroller();
  const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
  if (atBottom) el.scrollTo({ top: 0, behavior: 'smooth' });
  else el.scrollBy({ top: Math.round(el.clientHeight * 0.85), behavior: 'smooth' });
}
function _updateScrollHelper() {
  const btn = document.getElementById('scroll-helper');
  if (!btn) return;
  btn.style.display = 'flex'; // sempre visível (independe da escala/tamanho da tela)
  const el = _scroller();
  const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
  const icon = document.getElementById('scroll-helper-icon');
  if (icon) icon.style.transform = atBottom ? 'rotate(180deg)' : '';
  btn.title = atBottom ? 'Voltar ao topo' : 'Rolar para baixo';
}
// Botão de rolagem do MENU lateral (alcança as opções de baixo)
function _menuNav() { return document.querySelector('.sidebar-nav'); }
function menuScroll() {
  const el = _menuNav(); if (!el) return;
  const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 6;
  if (atBottom) el.scrollTo({ top: 0, behavior: 'smooth' });
  else el.scrollBy({ top: Math.round(el.clientHeight * 0.7), behavior: 'smooth' });
}
function _updateMenuScroll() {
  const btn = document.getElementById('menu-scroll'); const el = _menuNav();
  if (!btn || !el) return;
  const scrollable = el.scrollHeight > el.clientHeight + 4;
  btn.style.display = scrollable ? 'flex' : 'none';
  if (!scrollable) return;
  const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 6;
  const icon = document.getElementById('menu-scroll-icon');
  if (icon) icon.style.transform = atBottom ? 'rotate(180deg)' : '';
}
function _updateScrollUI() { _updateScrollHelper(); _updateMenuScroll(); }
document.addEventListener('scroll', _updateScrollUI, true);
window.addEventListener('resize', _updateScrollUI);

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') _closeFab(); });
document.addEventListener('click', (e) => {
  if (!document.body.classList.contains('fab-open')) return;
  const fab = document.getElementById('fab-btn'), menu = document.getElementById('fab-menu');
  if (fab && menu && !fab.contains(e.target) && !menu.contains(e.target)) _closeFab();
}, true);

/* ═══════════════════════════════════════════════════════════
   CENTRAL DE INTELIGÊNCIA — cross-module insight engine
   Reads existing data (goleiras + partidas + scouts) and derives
   automatic insights. Pure/derived — no writes, no new endpoints.
   ═══════════════════════════════════════════════════════════ */

// Chronological per-goalkeeper match line: [{ id, date, nota, gc }]
function _gkMatchTimeline(gkId, partidas, scouts) {
  const byMatch = {};
  scouts.filter(s => s.goalkeeperId === gkId && s.partidaId).forEach(s => {
    (byMatch[s.partidaId] = byMatch[s.partidaId] || []).push(s);
  });
  const rows = Object.keys(byMatch).map(pid => {
    const merged = (typeof _mergeScouts === 'function') ? (_mergeScouts(byMatch[pid])[0] || byMatch[pid][0]) : byMatch[pid][0];
    const p = partidas.find(x => x.id === pid);
    const gc = ['gda', 'gfa', 'gpe', 'gfl'].reduce((a, k) => a + (+merged[k] || 0), 0);
    return { id: pid, date: (p && p.data) || '', nota: (typeof calcPerformance === 'function' ? calcPerformance(merged) : null), gc };
  });
  return rows.filter(r => r.nota != null).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

// Returns insight objects for one goalkeeper (most relevant first).
function gkIntelligence(gkId, partidas, scouts) {
  const line = _gkMatchTimeline(gkId, partidas, scouts);
  const out = [];
  const avg = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  const notas = line.map(r => r.nota);

  // Trend: recent half vs first half
  if (line.length >= 4) {
    const half = Math.ceil(line.length / 2);
    const delta = +(avg(notas.slice(-half)) - avg(notas.slice(0, half))).toFixed(1);
    if (delta >= 0.5) out.push({ icon: '📈', level: 'good', title: 'Em evolução', text: `Média subiu ${delta > 0 ? '+' : ''}${delta} pts nas partidas recentes.` });
    else if (delta <= -0.5) out.push({ icon: '📉', level: 'warn', title: 'Queda de rendimento', text: `Média caiu ${delta} pts. Vale acompanhamento.` });
  }

  // Recent slump: last 3 vs previous 3
  if (line.length >= 6) {
    const d = +(avg(notas.slice(-3)) - avg(notas.slice(-6, -3))).toFixed(1);
    if (d <= -1) out.push({ icon: '⚠️', level: 'warn', title: 'Alerta de forma', text: `Queda de ${d} pts nos últimos 3 jogos.` });
  }

  // Best streak of strong games (nota >= 7)
  let best = 0, cur = 0;
  notas.forEach(n => { if (n >= 7) { cur++; best = Math.max(best, cur); } else cur = 0; });
  if (best >= 3) out.push({ icon: '🔥', level: 'good', title: 'Boa sequência', text: `${best} jogos seguidos com nota ≥ 7.` });

  // Trailing clean-sheet streak
  let cs = 0;
  for (let i = line.length - 1; i >= 0; i--) { if (line[i].gc === 0) cs++; else break; }
  if (cs >= 2) out.push({ icon: '🔒', level: 'good', title: 'Sem sofrer gols', text: `${cs} jogos seguidos sem levar gol.` });

  // Peak of the season
  if (notas.length) {
    const peak = Math.max(...notas);
    if (peak >= 8.5) out.push({ icon: '⭐', level: 'good', title: 'Pico da temporada', text: `Melhor nota registrada: ${peak}.` });
  }

  // Too few games → follow-up
  if (line.length > 0 && line.length < 2) out.push({ icon: '🔎', level: 'info', title: 'Poucos dados', text: 'Apenas 1 partida analisada. Registre mais scouts.' });

  return out.map(o => ({ ...o, gkId }));
}

let _perfilGkId = null;
function renderPerfilPID(gkId) {
  const card = document.getElementById('perfil-pid-card');
  const el = document.getElementById('perfil-pid');
  if (!card || !el) return;
  const objs = DB.pid.filter(o => o.gkId === gkId);
  if (!objs.length) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  const done = objs.filter(o => o.status === 'concluido').length;
  const prog = Math.round(objs.reduce((s, o) => s + (o.progresso || 0), 0) / objs.length);
  const active = objs.filter(o => o.status !== 'concluido').slice(0, 4);
  el.innerHTML = `
    <div style="display:flex;gap:20px;margin-bottom:12px;font-size:13px;">
      <div><b style="font-size:20px;">${objs.length}</b> <span style="color:var(--muted);">objetivos</span></div>
      <div><b style="font-size:20px;color:var(--success);">${done}</b> <span style="color:var(--muted);">concluídos</span></div>
      <div><b style="font-size:20px;color:var(--primary);">${prog}%</b> <span style="color:var(--muted);">progresso</span></div>
    </div>
    ${active.map(o => `<div style="margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;font-size:12px;"><span>${_esc(o.descricao)}</span><span style="color:var(--muted);">${o.progresso || 0}%</span></div>
      <div style="height:5px;background:rgba(255,255,255,.08);border-radius:3px;margin-top:3px;overflow:hidden;"><div style="height:100%;width:${o.progresso || 0}%;background:var(--primary);"></div></div>
    </div>`).join('')}`;
}

function renderPerfilTimeline(gkId) {
  const card = document.getElementById('perfil-timeline-card');
  const el = document.getElementById('perfil-timeline');
  if (!card || !el) return;
  const line = _gkMatchTimeline(gkId, DB.partidas, DB.scouts);
  const events = [];
  const matchLabel = (r) => { const p = DB.partidas.find(x => x.id === r.id); return p ? ('vs ' + (p.adversario || '—')) : ''; };
  if (line.length) {
    const first = line[0];
    events.push({ date: first.date, icon: '🎬', title: 'Primeira partida analisada', detail: `${matchLabel(first)} · nota ${first.nota}` });
    const cs = line.find(r => r.gc === 0);
    if (cs) events.push({ date: cs.date, icon: '🔒', title: 'Primeiro jogo sem sofrer gol', detail: matchLabel(cs) });
    const peak = line.reduce((m, r) => (r.nota > m.nota ? r : m), line[0]);
    events.push({ date: peak.date, icon: '⭐', title: 'Maior nota da temporada', detail: `${matchLabel(peak)} · nota ${peak.nota}` });
    const last = line[line.length - 1];
    if (last.id !== first.id) events.push({ date: last.date, icon: '📍', title: 'Última partida', detail: `${matchLabel(last)} · nota ${last.nota}` });
  }
  if (!events.length) { card.style.display = 'none'; return; }
  events.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  card.style.display = 'block';
  el.innerHTML = events.map(ev => `
    <div class="tl-item">
      <span class="tl-dot"></span>
      <div style="display:flex;align-items:center;gap:8px;"><span>${ev.icon}</span><span style="font-weight:700;font-size:13px;">${_esc(ev.title)}</span>
        <span style="margin-left:auto;font-size:11px;color:var(--muted);">${ev.date ? formatDate(ev.date) : '—'}</span></div>
      <div style="font-size:12px;color:var(--muted);margin-top:2px;">${_esc(ev.detail)}</div>
    </div>`).join('');
}

/* ── Análise por IA (Gemini via backend) ───────────────────── */
// Mostra a última análise salva (se houver) ao abrir o perfil
function renderPerfilIA(gkId) {
  const body = document.getElementById('perfil-ia-body');
  if (!body) return;
  const last = _latestAIAnalysis(gkId, ['perfil', 'partida']);
  if (last && last.analysis) {
    _aiRenderResult(last.analysis, body, 'Nota geral da IA', { gkId, savedAt: formatDate(new Date(last.ts).toISOString().slice(0, 10)) });
  } else {
    body.innerHTML = '<div style="color:var(--muted);font-size:13px;">Clique em "Gerar análise" para uma avaliação técnica automática desta goleira com base em todos os dados registrados.</div>';
  }
}
async function _aiPost(context) {
  try { const r = await api.post('/ai-analysis/insights', { context }); const d = r && (r.data !== undefined ? r.data : r); return (d && d.analysis) || null; }
  catch (e) { return null; }
}
function _aiRenderResult(a, bodyEl, scoreLabel, opts) {
  opts = opts || {};
  const gkId = opts.gkId;
  const list = (arr) => (arr && arr.length) ? arr.map(x => `<li style="margin-bottom:4px;">${_esc(x)}</li>`).join('') : '<li style="color:var(--muted);">—</li>';
  const sec = (icon, title, arr, color) => `<div style="margin-bottom:12px;"><div style="font-weight:700;font-size:13px;color:${color};margin-bottom:4px;">${icon} ${title}</div><ul style="margin:0 0 0 18px;font-size:13px;line-height:1.5;">${list(arr)}</ul></div>`;
  // Sugestões de treino com botão "+ PID" quando há uma goleira associada
  let trainHtml;
  if (gkId && a.trainingSuggestions && a.trainingSuggestions.length) {
    _AI_SUGG_CACHE = a.trainingSuggestions.slice();
    trainHtml = `<div style="margin-bottom:12px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <div style="font-weight:700;font-size:13px;">🏋️ Sugestões de treino</div>
        <button class="btn btn-secondary btn-sm" onclick="pidFromAI('${_esc(gkId)}')">➕ Adicionar todas ao PID</button></div>
      <div>${a.trainingSuggestions.map((x, i) => `<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;padding:4px 0;border-bottom:1px solid var(--border);font-size:13px;">
        <span>${_esc(x)}</span><button class="btn btn-ghost btn-sm" style="flex-shrink:0;padding:2px 8px;" onclick="pidFromAIOne('${_esc(gkId)}',${i})">+ PID</button></div>`).join('')}</div></div>`;
  } else {
    trainHtml = sec('🏋️', 'Sugestões de treino', a.trainingSuggestions, 'var(--text)');
  }
  bodyEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
      <div style="font-size:12px;color:var(--muted);">${scoreLabel || 'Nota geral da IA'}</div>
      <div style="font-size:22px;font-weight:800;color:${igdColor((a.overallScore || 0) * 10)};">${a.overallScore ?? '—'}<span style="font-size:13px;color:var(--muted);">/10</span></div>
    </div>
    ${sec('💪', 'Pontos fortes', a.strengths, 'var(--success)')}
    ${sec('🎯', 'Pontos de atenção', a.attentionPoints, 'var(--warning)')}
    ${(a.evolutionNotes && a.evolutionNotes.length) ? sec('📈', 'Evolução', a.evolutionNotes, 'var(--primary)') : ''}
    ${trainHtml}
    <div style="font-size:11px;color:var(--muted);margin-top:8px;border-top:1px solid var(--border);padding-top:8px;">${opts.savedAt ? 'Gerado em ' + opts.savedAt + ' · ' : ''}IA (Gemini). Use como apoio à decisão técnica.</div>`;
}
let _AI_SUGG_CACHE = [];
// Histórico de análises IA (local + Central de Relatórios)
function _saveAIAnalysis(scope, gkId, analysis, label) {
  try {
    const list = DB.aianalyses;
    list.unshift({ id: _uid(), ts: Date.now(), scope, gkId: gkId || null, label: label || scope, analysis });
    DB.saveAianalyses(list.slice(0, 100));
    const gk = gkId ? DB.goleiras.find(g => g.id === gkId) : null;
    logReport({ type: 'ia', title: 'Análise IA — ' + (label || scope), athlete: gk ? gk.nome : undefined, athleteId: gkId || undefined });
  } catch (e) {}
}
function _latestAIAnalysis(gkId, scopes) {
  return DB.aianalyses.find(x => x.gkId === gkId && (!scopes || scopes.includes(x.scope))) || null;
}
// PID a partir das sugestões da IA
const _PID_AREA_KEYWORDS = {
  tecnica: ['aér', 'aer', 'reflex', 'posicion', '1x1', '1 x 1', 'distribu', 'reposi', 'saída', 'saida', 'esquadro', 'defes', 'chute', 'finaliz'],
  fisica: ['agilidade', 'explos', 'resist', 'velocidad', 'força', 'forca', 'físic', 'fisic', 'condicion', 'potênc', 'potenc'],
  mental: ['comunica', 'lideran', 'confian', 'concentr', 'menta', 'psicol', 'decis'],
};
function _pidAreaFor(text) {
  const t = (text || '').toLowerCase();
  for (const area of ['fisica', 'mental', 'tecnica']) { if (_PID_AREA_KEYWORDS[area].some(k => t.includes(k))) return area; }
  return 'tecnica';
}
function _addPidObjective(gkId, text) {
  const list = DB.pid;
  list.unshift({ id: _uid(), gkId, area: _pidAreaFor(text), topic: '', descricao: text, responsavel: 'IA', prioridade: 'Média', inicio: '', prazo: '', criterio: 'Sugestão gerada por IA', status: 'andamento', progresso: 0, criadoEm: Date.now() });
  DB.savePID(list);
}
function pidFromAIOne(gkId, idx) {
  const text = _AI_SUGG_CACHE[idx];
  if (!text) return;
  _addPidObjective(gkId, text);
  const gk = DB.goleiras.find(g => g.id === gkId);
  logAudit('PID', 'Objetivo criado por IA para ' + (gk ? gk.nome : gkId));
  toast('Objetivo adicionado ao PID.', 'success');
}
function pidFromAI(gkId) {
  if (!_AI_SUGG_CACHE.length) return;
  _AI_SUGG_CACHE.forEach(t => _addPidObjective(gkId, t));
  const gk = DB.goleiras.find(g => g.id === gkId);
  logAudit('PID', _AI_SUGG_CACHE.length + ' objetivos criados por IA para ' + (gk ? gk.nome : gkId));
  toast(_AI_SUGG_CACHE.length + ' objetivos adicionados ao PID.', 'success');
  if (typeof renderPerfilPID === 'function') renderPerfilPID(gkId);
}

// Match Center — análise da partida ao vivo
async function mcAnaliseIA() {
  const wrap = document.getElementById('mc-ai-wrap');
  const bodyEl = document.getElementById('mc-ai-body');
  const btn = document.getElementById('mc-ai-btn');
  if (!wrap || !bodyEl) return;
  wrap.style.display = 'block';
  bodyEl.innerHTML = '<div style="color:var(--muted);font-size:13px;">🤖 Analisando a partida com IA…</div>';
  if (btn) { btn.disabled = true; btn.classList.add('is-loading'); }
  const p = (typeof mcPendingPId !== 'undefined' && mcPendingPId) ? DB.partidas.find(x => x.id === mcPendingPId) : null;
  const gk = p ? DB.goleiras.find(g => g.id === p.goalkeeperId) : null;
  const ctx = {
    contexto: 'analise_de_partida_de_futsal',
    naipe: (gk && gk.naipe) || 'feminino',
    adversario: p ? p.adversario : undefined,
    placar: { nos: mcPlacar.nos, adversario: mcPlacar.adv },
    notaAoVivoFinal: mcNotaAtual, maiorNota: mcMaxNota, menorNota: mcMinNota,
    maiorSequenciaSemSofrerGol_segundos: mcMaxSemGolSec,
    scoutDaPartida: mcData,
  };
  const a = await _aiPost(ctx);
  if (btn) { btn.disabled = false; btn.classList.remove('is-loading'); }
  if (!a) { bodyEl.innerHTML = '<div style="color:var(--warning);font-size:13px;">⚠️ IA indisponível (servidor sem chave, sem conexão ou sem login no backend). Tente novamente após entrar com email/Google.</div>'; return; }
  if (gk) _saveAIAnalysis('partida', gk.id, a, (gk.nome || '') + (p ? ' vs ' + p.adversario : ''));
  _aiRenderResult(a, bodyEl, 'Nota da partida (IA)', { gkId: gk ? gk.id : null });
  try { logAudit('IA', 'Gerou análise IA da partida' + (p ? ' vs ' + p.adversario : '')); } catch (e) {}
}

// Treinos — sugestão de próximo treino
async function tpAnaliseIA() {
  const wrap = document.getElementById('tp-ai-wrap');
  const bodyEl = document.getElementById('tp-ai-body');
  const btn = document.getElementById('tp-ai-btn');
  if (!wrap || !bodyEl) return;
  wrap.style.display = 'block';
  bodyEl.innerHTML = '<div style="color:var(--muted);font-size:13px;">🤖 Gerando sugestão de treino com IA…</div>';
  if (btn) { btn.disabled = true; btn.classList.add('is-loading'); }
  const dash = _tpDashCache || {};
  // fraquezas agregadas do elenco (dimensões IGD mais baixas)
  const dimSums = {}, dimN = {};
  DB.goleiras.forEach(g => { const d = computeIGD(g.id).dims; Object.keys(d).forEach(k => { if (d[k] != null) { dimSums[k] = (dimSums[k] || 0) + d[k]; dimN[k] = (dimN[k] || 0) + 1; } }); });
  const mediasDim = {}; Object.keys(dimSums).forEach(k => mediasDim[k] = Math.round(dimSums[k] / dimN[k]));
  const ctx = {
    contexto: 'planejamento_do_proximo_treino_de_futsal',
    objetivo: 'Sugerir o foco e exercícios do próximo treino com base nos indicadores da equipe.',
    totalSessoes: dash.totalSessions, presencaMediaPct: dash.attendanceRate,
    avaliacaoMedia: dash.avgEvaluation, pseMedia: dash.avgRpe, cargaSemanal: dash.weeklyWorkload,
    mediasPorDimensaoIGD: mediasDim, atletas: DB.goleiras.length,
  };
  const a = await _aiPost(ctx);
  if (btn) { btn.disabled = false; btn.classList.remove('is-loading'); }
  if (!a) { bodyEl.innerHTML = '<div style="color:var(--warning);font-size:13px;">⚠️ IA indisponível (servidor sem chave, sem conexão ou sem login no backend).</div>'; return; }
  _saveAIAnalysis('treino', null, a, 'Equipe');
  _aiRenderResult(a, bodyEl, 'Prontidão da equipe (IA)');
  try { logAudit('IA', 'Gerou sugestão de treino por IA'); } catch (e) {}
}

function _gkAIContext(gkId) {
  const g = DB.goleiras.find(x => x.id === gkId) || {};
  const scouts = _mergeScouts(DB.scouts.filter(s => s.goalkeeperId === gkId));
  const sum = (k) => scouts.reduce((a, s) => a + (+s[k] || 0), 0);
  const def = sum('dad') + sum('dae') + sum('dbd') + sum('dbe') + sum('dc') + sum('d1x1') + sum('esq');
  const gols = sum('gda') + sum('gfa') + sum('gpe') + sum('gfl');
  const distC = sum('dpc') + sum('dmc'), distT = distC + sum('dpe') + sum('dme');
  const igd = computeIGD(gkId);
  const line = _gkMatchTimeline(gkId, DB.partidas, DB.scouts);
  return {
    nome: g.nome, modalidade: g.modalidade === 'beach' ? 'beach soccer' : 'futsal', naipe: g.naipe || 'feminino', categoria: g.categoria || null, equipe: g.equipe || null,
    partidasAnalisadas: scouts.length,
    igd: igd.score, dimensoesIGD: igd.dims,
    performanceMedia: avgPerformance(gkId),
    taxaDefesaPct: (def + gols) ? +(def / (def + gols) * 100).toFixed(1) : null,
    precisaoDistribuicaoPct: distT ? +(distC / distT * 100).toFixed(1) : null,
    totalDefesas: def, golsSofridos: gols, interceptacoes: sum('int'), saidasDoGol: sum('sai'),
    ultimasNotas: line.slice(-6).map(r => r.nota),
  };
}
async function gerarAnaliseIA() {
  const gkId = _perfilGkId;
  const body = document.getElementById('perfil-ia-body');
  const btn = document.getElementById('perfil-ia-btn');
  if (!gkId || !body) return;
  const ctx = _gkAIContext(gkId);
  if (!ctx.partidasAnalisadas) { body.innerHTML = '<div style="color:var(--muted);font-size:13px;">Registre ao menos um scout desta goleira para gerar a análise.</div>'; return; }
  body.innerHTML = '<div style="color:var(--muted);font-size:13px;">🤖 Analisando com IA…</div>';
  if (btn) { btn.disabled = true; btn.classList.add('is-loading'); }
  let res = null;
  try { res = await api.post('/ai-analysis/insights', { context: ctx }); } catch (e) { res = null; }
  if (btn) { btn.disabled = false; btn.classList.remove('is-loading'); }
  const data = res && (res.data !== undefined ? res.data : res);
  const a = data && data.analysis;
  if (!a) {
    // Fallback: insights locais (heurística) quando a IA não está disponível
    const local = gkIntelligence(gkId, DB.partidas, DB.scouts);
    body.innerHTML = `<div style="font-size:12px;color:var(--warning);margin-bottom:10px;">⚠️ IA indisponível (servidor sem chave ou sem conexão). Mostrando insights automáticos locais:</div>`
      + (local.length ? local.map(i => `<div style="font-size:13px;padding:4px 0;">${i.icon} ${_esc(i.text)}</div>`).join('') : '<div style="color:var(--muted);font-size:13px;">Sem insights suficientes.</div>');
    return;
  }
  _saveAIAnalysis('perfil', gkId, a, ctx.nome || 'Goleira');
  _aiRenderResult(a, body, 'Nota geral da IA', { gkId });
  try { logAudit('IA', 'Gerou análise por IA de ' + (ctx.nome || gkId)); } catch (e) {}
}

function renderPerfilInsights(gkId) {
  const card = document.getElementById('perfil-insights-card');
  const el = document.getElementById('perfil-insights');
  if (!card || !el) return;
  const ins = gkIntelligence(gkId, DB.partidas, DB.scouts);
  if (!ins.length) { card.style.display = 'none'; return; }
  const colors = { good: 'var(--success)', warn: 'var(--warning)', info: 'var(--muted)' };
  card.style.display = 'block';
  el.innerHTML = ins.map(i => `
    <div style="border:1px solid var(--border);border-left:3px solid ${colors[i.level]};border-radius:var(--radius);padding:12px 14px;background:rgba(255,255,255,.02);">
      <div style="display:flex;align-items:center;gap:8px;"><span style="font-size:18px;">${i.icon}</span><div style="font-weight:700;font-size:13px;">${_esc(i.title)}</div></div>
      <div style="font-size:12px;color:var(--muted);margin-top:6px;line-height:1.4;">${_esc(i.text)}</div>
    </div>`).join('');
}

function renderDashIntelligence(goleiras, partidas, scouts) {
  const wrap = document.getElementById('dash-intelligence');
  const grid = document.getElementById('dash-intel-grid');
  const summary = document.getElementById('dash-intel-summary');
  if (!wrap || !grid) return;

  const all = [];
  let evolving = 0, alert = 0;
  goleiras.forEach(g => {
    const ins = gkIntelligence(g.id, partidas, scouts);
    if (ins.some(i => i.title === 'Em evolução')) evolving++;
    if (ins.some(i => i.level === 'warn')) alert++;
    ins.forEach(i => all.push({ ...i, gk: g }));
  });

  if (!all.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';

  // Warnings first, then positives; cap to keep the panel focused.
  const rank = { warn: 0, good: 1, info: 2 };
  all.sort((a, b) => (rank[a.level] - rank[b.level]));
  const shown = all.slice(0, 9);

  if (summary) summary.textContent = `${goleiras.length} atletas · ${evolving} em evolução · ${alert} em alerta`;

  const colors = { good: 'var(--success)', warn: 'var(--warning)', info: 'var(--muted)' };
  grid.innerHTML = shown.map(i => {
    const first = (i.gk.nome || '').split(' ')[0];
    return `<div onclick="verPerfil('${_esc(i.gk.id)}')" title="Abrir perfil de ${_esc(i.gk.nome)}"
      style="cursor:pointer;border:1px solid var(--border);border-left:3px solid ${colors[i.level]};border-radius:var(--radius);padding:12px 14px;transition:border-color .18s,transform .18s;background:rgba(255,255,255,.02);"
      onmouseover="this.style.transform='translateY(-2px)';this.style.borderColor='var(--border-h)';this.style.borderLeftColor='${colors[i.level]}';"
      onmouseout="this.style.transform='';this.style.borderColor='var(--border)';this.style.borderLeftColor='${colors[i.level]}';">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:18px;">${i.icon}</span>
        <div style="font-weight:700;font-size:13px;">${_esc(i.title)}</div>
        <div style="margin-left:auto;font-size:11px;color:var(--muted);font-weight:600;">${_esc(first)}</div>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-top:6px;line-height:1.4;">${_esc(i.text)}</div>
    </div>`;
  }).join('');
}

/* ═══════════════════════════════════════════════════════════
   IGD — Índice Global de Desenvolvimento (0–100)
   Composto por 6 dimensões com pesos configuráveis. Usa dados
   locais (partidas/scouts) + resumo de treino quando disponível.
   ═══════════════════════════════════════════════════════════ */
const IGD_DEFAULT_WEIGHTS = { tecnica: 25, fisica: 15, mental: 15, participacao: 15, evolucao: 15, consistencia: 15 };
const IGD_DIM_LABEL = { tecnica: 'Técnica', fisica: 'Física', mental: 'Mental', participacao: 'Participação', evolucao: 'Evolução', consistencia: 'Consistência' };
function igdWeights() {
  try { return { ...IGD_DEFAULT_WEIGHTS, ...(JSON.parse(localStorage.getItem('gkhub_igd_weights') || '{}')) }; }
  catch (e) { return { ...IGD_DEFAULT_WEIGHTS }; }
}
function _igdClamp(v) { return Math.max(0, Math.min(100, v)); }

// summary = training-plus goalkeeper summary (optional). Returns {score, dims, weights}.
function computeIGD(gkId, summary) {
  const line = _gkMatchTimeline(gkId, DB.partidas, DB.scouts);
  const notas = line.map(r => r.nota);
  const avg = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  const dims = {};

  // Técnica — blend of match performance + training technical evaluation
  const perf = avgPerformance(gkId);
  const tech = [];
  if (perf != null) tech.push(perf * 10);
  if (summary && summary.avgTechnical) tech.push(summary.avgTechnical * 10);
  dims.tecnica = tech.length ? +avg(tech).toFixed(0) : null;

  // Física / Mental — from training evaluations
  dims.fisica = (summary && summary.avgPhysical) ? Math.round(summary.avgPhysical * 10) : null;
  dims.mental = (summary && summary.avgMental) ? Math.round(summary.avgMental * 10) : null;

  // Participação — attendance if trained, else games played (8 = 100)
  if (summary && summary.attendanceRate != null && summary.trainings > 0) dims.participacao = Math.round(summary.attendanceRate);
  else if (line.length) dims.participacao = Math.round(Math.min(100, line.length * 12.5));
  else dims.participacao = null;

  // Evolução — recent vs first half trend
  if (line.length >= 4) {
    const half = Math.ceil(line.length / 2);
    dims.evolucao = Math.round(_igdClamp(50 + (avg(notas.slice(-half)) - avg(notas.slice(0, half))) * 12));
  } else dims.evolucao = null;

  // Consistência — inverse of nota variability
  if (notas.length >= 3) {
    const m = avg(notas), sd = Math.sqrt(avg(notas.map(n => (n - m) ** 2)));
    dims.consistencia = Math.round(_igdClamp(100 - sd * 22));
  } else dims.consistencia = null;

  const w = igdWeights();
  let sum = 0, wsum = 0;
  Object.keys(w).forEach(k => { if (dims[k] != null) { sum += dims[k] * w[k]; wsum += w[k]; } });
  return { score: wsum ? Math.round(sum / wsum) : null, dims, weights: w };
}

// Daily-deduped IGD history per goalkeeper → weekly/monthly deltas
function _igdRecord(gkId, score) {
  if (score == null) return;
  try {
    const all = JSON.parse(localStorage.getItem('gkhub_igd_history') || '{}');
    const arr = all[gkId] || [];
    const today = new Date().toISOString().slice(0, 10);
    if (!arr.length || arr[arr.length - 1].d !== today) arr.push({ d: today, s: score, t: Date.now() });
    else arr[arr.length - 1].s = score;
    all[gkId] = arr.slice(-180);
    localStorage.setItem('gkhub_igd_history', JSON.stringify(all));
  } catch (e) {}
}
function _igdDelta(gkId, days) {
  try {
    const all = JSON.parse(localStorage.getItem('gkhub_igd_history') || '{}');
    const arr = all[gkId] || [];
    if (arr.length < 2) return null;
    const cutoff = Date.now() - days * 864e5;
    const past = [...arr].reverse().find(x => x.t <= cutoff) || arr[0];
    const cur = arr[arr.length - 1];
    return past ? cur.s - past.s : null;
  } catch (e) { return null; }
}

function igdInsights(gkId, igd, summary) {
  const out = [];
  if (!igd || igd.score == null) return out;
  const dm = _igdDelta(gkId, 30), dw = _igdDelta(gkId, 7);
  if (dm != null && dm !== 0) out.push({ level: dm > 0 ? 'good' : 'warn', text: `Seu IGD ${dm > 0 ? 'subiu' : 'caiu'} ${Math.abs(dm)} ponto(s) no último mês.` });
  if (dw != null && dw > 0) out.push({ level: 'good', text: `+${dw} ponto(s) na última semana.` });
  const present = Object.keys(igd.dims).filter(k => igd.dims[k] != null);
  if (present.length) {
    const strong = present.reduce((a, b) => (igd.dims[b] > igd.dims[a] ? b : a));
    const weak = present.reduce((a, b) => (igd.dims[b] < igd.dims[a] ? b : a));
    out.push({ level: 'good', text: `Ponto forte: ${IGD_DIM_LABEL[strong]} (${igd.dims[strong]}).` });
    if (igd.dims[weak] < 60) out.push({ level: 'warn', text: `A desenvolver: ${IGD_DIM_LABEL[weak]} (${igd.dims[weak]}).` });
  }
  if (igd.dims.participacao != null && igd.dims.participacao < 70) out.push({ level: 'warn', text: `Frequência abaixo da meta reduziu o índice.` });

  // Comparação com equipe e categoria (base local, comparável)
  const me = DB.goleiras.find(g => g.id === gkId);
  const sameNaipe = (g) => !me || !me.naipe || !g.naipe || g.naipe === me.naipe; // compara like-with-like
  const scoreOf = (g) => { const s = computeIGD(g.id).score; return s == null ? null : s; };
  const teamScores = DB.goleiras.filter(g => g.equipe && me && g.equipe === me.equipe && sameNaipe(g)).map(scoreOf).filter(v => v != null);
  const catScores = DB.goleiras.filter(g => g.categoria && me && g.categoria === me.categoria && sameNaipe(g)).map(scoreOf).filter(v => v != null);
  const mean = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
  if (teamScores.length >= 2) { const m = mean(teamScores); const d = igd.score - m; out.push({ level: d >= 0 ? 'good' : 'info', text: `Equipe: ${igd.score} vs média ${m} (${d >= 0 ? '+' : ''}${d}).` }); }
  if (catScores.length >= 2) { const m = mean(catScores); const d = igd.score - m; out.push({ level: d >= 0 ? 'good' : 'info', text: `Categoria: ${igd.score} vs média ${m} (${d >= 0 ? '+' : ''}${d}).` }); }
  return out;
}

function igdColor(score) {
  if (score == null) return 'var(--muted)';
  if (score >= 80) return 'var(--success)';
  if (score >= 60) return 'var(--primary)';
  if (score >= 40) return 'var(--warning)';
  return 'var(--error)';
}

// Renders the IGD card in the goalkeeper profile (summary optional).
function renderPerfilIGD(gkId, summary) {
  const card = document.getElementById('perfil-igd-card');
  const el = document.getElementById('perfil-igd');
  if (!card || !el) return;
  const igd = computeIGD(gkId, summary);
  if (igd.score == null) { card.style.display = 'none'; return; }
  _igdRecord(gkId, igd.score);
  card.style.display = 'block';
  const col = igdColor(igd.score);
  const dm = _igdDelta(gkId, 30), dw = _igdDelta(gkId, 7);
  const deltaChip = (d, lbl) => d == null ? '' : `<span style="font-size:11px;color:${d > 0 ? 'var(--success)' : d < 0 ? 'var(--error)' : 'var(--muted)'};font-weight:600;">${d > 0 ? '▲' : d < 0 ? '▼' : '='} ${Math.abs(d)} ${lbl}</span>`;
  const dims = Object.keys(IGD_DIM_LABEL).filter(k => igd.dims[k] != null);
  const bars = dims.map(k => `
    <div style="margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px;"><span style="color:var(--muted);">${IGD_DIM_LABEL[k]}</span><span style="font-weight:700;">${igd.dims[k]}</span></div>
      <div style="height:6px;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden;"><div style="height:100%;width:${igd.dims[k]}%;background:${igdColor(igd.dims[k])};border-radius:4px;transition:width .7s;"></div></div>
    </div>`).join('');
  const insights = igdInsights(gkId, igd, summary);
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:auto 1fr;gap:24px;align-items:center;">
      <div style="text-align:center;">
        <div style="width:120px;height:120px;border-radius:50%;background:conic-gradient(${col} ${igd.score * 3.6}deg, rgba(255,255,255,.08) 0);display:flex;align-items:center;justify-content:center;">
          <div style="width:92px;height:92px;border-radius:50%;background:var(--card);display:flex;flex-direction:column;align-items:center;justify-content:center;">
            <div style="font-size:32px;font-weight:800;color:${col};line-height:1;">${igd.score}</div>
            <div style="font-size:9px;color:var(--muted);letter-spacing:1px;margin-top:2px;">IGD</div>
          </div>
        </div>
        <div style="margin-top:8px;display:flex;flex-direction:column;gap:2px;">${deltaChip(dw, 'sem')}${deltaChip(dm, 'mês')}</div>
      </div>
      <div>${bars}</div>
    </div>
    ${insights.length ? `<div style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px;display:flex;flex-direction:column;gap:6px;">${insights.map(i => `<div style="font-size:12px;color:${i.level === 'good' ? 'var(--success)' : i.level === 'warn' ? 'var(--warning)' : 'var(--muted)'};">${i.level === 'good' ? '📈' : i.level === 'warn' ? '⚠️' : 'ℹ️'} ${_esc(i.text)}</div>`).join('')}</div>` : ''}`;
}

/* ═══════════════════════════════════════════════════════════
   DASHBOARD EXECUTIVO — coordinator view (local + training API)
   ═══════════════════════════════════════════════════════════ */
function _evolDelta(gkId) {
  const line = _gkMatchTimeline(gkId, DB.partidas, DB.scouts).map(r => r.nota);
  if (line.length < 4) return null;
  const half = Math.ceil(line.length / 2);
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  return +(avg(line.slice(-half)) - avg(line.slice(0, half))).toFixed(1);
}

async function renderExecutivo() {
  const goleiras = DB.goleiras, partidas = DB.partidas, scouts = DB.scouts;
  const teamId = _tpTeamId();
  const q = teamId ? ('?teamId=' + encodeURIComponent(teamId)) : '';

  let dash = {}, sessions = [];
  try { dash = _tpUnwrap(await api.get('/training-plus/dashboard' + q), {}) || {}; } catch (e) { dash = {}; }
  try { sessions = _tpUnwrap(await api.get('/training-plus/sessions' + q), []) || []; } catch (e) { sessions = []; }

  const scores = goleiras.map(g => avgPerformance(g.id)).filter(v => v != null);
  const teamAvg = scores.length ? +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : null;

  const kpis = [
    { label: 'Atletas', value: goleiras.length, cls: 'stat-cyan' },
    { label: 'Treinos', value: dash.totalSessions ?? 0, cls: 'stat-green' },
    { label: 'Partidas', value: partidas.length, cls: 'stat-yellow' },
    { label: 'Presença média', value: dash.attendanceRate != null ? dash.attendanceRate + '%' : '—', cls: 'stat-green' },
    { label: 'Carga semanal', value: dash.weeklyWorkload ?? 0, cls: 'stat-cyan' },
    { label: 'Performance média', value: teamAvg ?? '—', cls: '' },
  ];
  const kEl = document.getElementById('exec-kpis');
  if (kEl) kEl.innerHTML = kpis.map(k => `
    <div class="stat-card">
      <div class="stat-label">${k.label}</div>
      <div class="stat-value ${k.cls}" style="font-size:32px;">${_esc(String(k.value))}</div>
    </div>`).join('');

  // Highlights
  const withScore = goleiras.filter(g => avgPerformance(g.id) != null);
  const best = [...withScore].sort((a, b) => (avgPerformance(b.id) || 0) - (avgPerformance(a.id) || 0))[0];
  const evol = goleiras.map(g => ({ g, d: _evolDelta(g.id) })).filter(x => x.d != null).sort((a, b) => b.d - a.d)[0];
  const hEl = document.getElementById('exec-highlights');
  const gkLink = (g, extra) => `<div onclick="verPerfil('${_esc(g.id)}')" style="cursor:pointer;display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">
    <span style="font-weight:600;font-size:13px;">${_esc(g.nome)}</span><span style="color:var(--primary);font-weight:700;font-size:13px;">${extra}</span></div>`;
  if (hEl) {
    let h = '';
    if (best) h += `<div style="font-size:11px;color:var(--muted);margin-bottom:2px;">Melhor atleta</div>` + gkLink(best, (avgPerformance(best.id) || 0) + ' pts');
    if (evol) h += `<div style="font-size:11px;color:var(--muted);margin:10px 0 2px;">Maior evolução</div>` + gkLink(evol.g, (evol.d > 0 ? '+' : '') + evol.d + ' pts');
    hEl.innerHTML = h || '<div class="empty-state" style="padding:24px;"><p>Sem dados suficientes.</p></div>';
  }

  // Alerts (warn-level insights)
  const aEl = document.getElementById('exec-alerts');
  if (aEl) {
    const alerts = [];
    goleiras.forEach(g => {
      const warn = gkIntelligence(g.id, partidas, scouts).find(i => i.level === 'warn');
      if (warn) alerts.push({ g, warn });
    });
    aEl.innerHTML = alerts.length ? alerts.slice(0, 6).map(a => `
      <div onclick="verPerfil('${_esc(a.g.id)}')" style="cursor:pointer;display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);">
        <span>${a.warn.icon}</span>
        <div><div style="font-weight:600;font-size:13px;">${_esc(a.g.nome)}</div>
        <div style="font-size:11px;color:var(--muted);">${_esc(a.warn.text)}</div></div>
      </div>`).join('') : '<div class="empty-state" style="padding:24px;"><p>Nenhum alerta. Elenco saudável. 🟢</p></div>';
  }

  const today = new Date().toISOString().slice(0, 10);

  // Próximos treinos
  const ntEl = document.getElementById('exec-next-trainings');
  if (ntEl) {
    const next = [...sessions].filter(s => s.date && String(s.date).slice(0, 10) >= today && s.status !== 'cancelled')
      .sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(0, 5);
    ntEl.innerHTML = next.length ? next.map(s => `
      <div onclick="navigate('treinos')" style="cursor:pointer;display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">
        <span style="font-weight:600;font-size:13px;">${_esc(s.title || 'Treino')}</span>
        <span style="color:var(--muted);font-size:12px;">${formatDate(String(s.date).slice(0, 10))}${s.time ? ' · ' + _esc(s.time) : ''}</span>
      </div>`).join('') : '<div class="empty-state" style="padding:24px;"><p>Nenhum treino agendado.</p></div>';
  }

  // Próximas partidas
  const nmEl = document.getElementById('exec-next-matches');
  if (nmEl) {
    const next = [...partidas].filter(p => p.data && p.data >= today)
      .sort((a, b) => a.data.localeCompare(b.data)).slice(0, 5);
    nmEl.innerHTML = next.length ? next.map(p => `
      <div onclick="navigate('partidas')" style="cursor:pointer;display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">
        <span style="font-weight:600;font-size:13px;">vs ${_esc(p.adversario || '—')}</span>
        <span style="color:var(--muted);font-size:12px;">${formatDate(p.data)}${p.hora ? ' · ' + _esc(p.hora) : ''}</span>
      </div>`).join('') : '<div class="empty-state" style="padding:24px;"><p>Nenhuma partida futura cadastrada.</p></div>';
  }
}

function refreshDashboard() {
  const goleiras = DB.goleiras;
  const partidas = DB.partidas.filter(p => {
    if (!p.data) return true;
    if (dashFilterFrom && p.data < dashFilterFrom) return false;
    if (dashFilterTo   && p.data > dashFilterTo)   return false;
    return true;
  });
  const filteredPtIds = new Set(partidas.map(p => p.id));
  const scouts = DB.scouts.filter(s => !s.partidaId || filteredPtIds.has(s.partidaId));
  const elGk = document.getElementById('stat-total-gk');
  const elPt = document.getElementById('stat-total-matches');
  const elSc = document.getElementById('stat-total-scouts');
  animateCount(elGk, goleiras.length);
  animateCount(elPt, partidas.length);
  animateCount(elSc, scouts.length);
  const allScores = goleiras.map(g => avgPerformance(g.id)).filter(s => s !== null);
  const elAvg = document.getElementById('stat-avg-perf');
  if (allScores.length) {
    const avg = allScores.reduce((a,b)=>a+b,0)/allScores.length;
    animateCount(elAvg, avg);
  } else {
    elAvg.textContent = '—';
  }

  // ── Central de Inteligência (cross-module insights) ──
  renderDashIntelligence(goleiras, partidas, scouts);
  syncIntelligenceNotifications();

  // ── Destaques do Treinador ──
  function gkScoutSum(gkId, keys) {
    return scouts.filter(s=>s.goalkeeperId===gkId).reduce((a,s)=>a+keys.reduce((b,k)=>b+(+s[k]||0),0),0);
  }
  const gksComScout = goleiras.filter(g => scouts.some(s=>s.goalkeeperId===g.id));
  const destaquesEl = document.getElementById('dash-destaques');
  const destaquesGrid = document.getElementById('dash-destaques-grid');
  if (gksComScout.length >= 1 && destaquesEl && destaquesGrid) {
    // 1. Melhor da temporada
    const melhorTemporada = [...gksComScout].sort((a,b)=>(avgPerformance(b.id)||0)-(avgPerformance(a.id)||0))[0];
    // 2. Mais defesas
    const maisDefesas = [...gksComScout].sort((a,b)=>
      gkScoutSum(b.id,['dad','dae','dbd','dbe','dc'])-gkScoutSum(a.id,['dad','dae','dbd','dbe','dc']))[0];
    // 3. Menos gols sofridos (apenas quem tem pelo menos 1 partida)
    const menosGols = [...gksComScout].sort((a,b)=>
      gkScoutSum(a.id,['gda','gfa','gpe','gfl'])-gkScoutSum(b.id,['gda','gfa','gpe','gfl']))[0];
    // 4. Melhor distribuição
    const melhorDist = [...gksComScout].sort((a,b)=>{
      function acc(id){ const c=gkScoutSum(id,['dpc','dmc']); const t=c+gkScoutSum(id,['dpe','dme']); return t>0?c/t:0; }
      return acc(b.id)-acc(a.id);
    })[0];
    // 5. Melhor evolução (diferença entre média das últimas 3 vs primeiras 3 partidas)
    const melhorEvolucao = [...gksComScout].sort((a,b)=>{
      function evol(id){
        const sc=[...scouts.filter(s=>s.goalkeeperId===id)].sort((x,y)=>{
          const px=partidas.find(p=>p.id===x.partidaId), py=partidas.find(p=>p.id===y.partidaId);
          return (px?.data||'').localeCompare(py?.data||'');
        });
        if(sc.length<2) return 0;
        const half=Math.ceil(sc.length/2);
        const primeiros=sc.slice(0,half).map(calcPerformance).filter(n=>n!==null);
        const ultimos=sc.slice(-half).map(calcPerformance).filter(n=>n!==null);
        if(!primeiros.length||!ultimos.length) return 0;
        return (ultimos.reduce((a,b)=>a+b,0)/ultimos.length)-(primeiros.reduce((a,b)=>a+b,0)/primeiros.length);
      }
      return evol(b.id)-evol(a.id);
    })[0];

    const destaques = [
      { emoji:'🏆', titulo:'Melhor da Temporada', gk:melhorTemporada,
        valor: avgPerformance(melhorTemporada?.id), unidade:'pts', color:'var(--warning)' },
      { emoji:'🥊', titulo:'Mais Defesas', gk:maisDefesas,
        valor: gkScoutSum(maisDefesas?.id,['dad','dae','dbd','dbe','dc']), unidade:'def', color:'var(--primary)' },
      { emoji:'🔒', titulo:'Menos Gols Sofr.', gk:menosGols,
        valor: gkScoutSum(menosGols?.id,['gda','gfa','gpe','gfl']), unidade:'gols', color:'var(--success)' },
      { emoji:'🎯', titulo:'Melhor Distribuição', gk:melhorDist,
        valor: (()=>{ const c=gkScoutSum(melhorDist?.id,['dpc','dmc']); const t=c+gkScoutSum(melhorDist?.id,['dpe','dme']); return t>0?Math.round(c/t*100)+'%':'—'; })(),
        unidade:'precisão', color:'#FFB300' },
      { emoji:'📈', titulo:'Melhor Evolução', gk:melhorEvolucao,
        valor:(()=>{
          if(!melhorEvolucao) return '—';
          const sc=[...scouts.filter(s=>s.goalkeeperId===melhorEvolucao.id)].sort((x,y)=>{
            const px=partidas.find(p=>p.id===x.partidaId), py=partidas.find(p=>p.id===y.partidaId);
            return (px?.data||'').localeCompare(py?.data||'');
          });
          if(sc.length<2) return '—';
          const half=Math.ceil(sc.length/2);
          const primeiros=sc.slice(0,half).map(calcPerformance).filter(n=>n!==null);
          const ultimos=sc.slice(-half).map(calcPerformance).filter(n=>n!==null);
          if(!primeiros.length||!ultimos.length) return '—';
          const delta=(ultimos.reduce((a,b)=>a+b,0)/ultimos.length)-(primeiros.reduce((a,b)=>a+b,0)/primeiros.length);
          return (delta>=0?'+':'')+delta.toFixed(1);
        })(),
        unidade:'melhora', color:'#69F0AE' },
    ];

    destaquesGrid.innerHTML = destaques.map((d,i) => {
      if (!d.gk) return '';
      const foto = d.gk.foto && d.gk.foto.startsWith('data:image/')
        ? `<img src="${d.gk.foto}" style="width:100%;height:100%;object-fit:cover;">`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.5" style="width:26px;height:26px;"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>`;
      return `<div class="destaque-card" onclick="verPerfil('${d.gk.id}')"
        style="--accent:${d.color};--accent-color:${d.color};animation-delay:${i*50}ms;">
        <span class="destaque-icon">${d.emoji}</span>
        <div class="destaque-label">${d.titulo}</div>
        <div class="destaque-avatar" style="border-color:${d.color};">${foto}</div>
        <div class="destaque-name">${_esc(d.gk.nome.split(' ')[0])}</div>
        <div class="destaque-value" style="color:${d.color};">${d.valor}</div>
        <div class="destaque-unit">${d.unidade}</div>
      </div>`;
    }).join('');
    destaquesEl.style.display = 'block';
  } else if (destaquesEl) {
    destaquesEl.style.display = 'none';
  }

  // Recent GKs
  const recGk = document.getElementById('dash-recent-gk');
  if (!goleiras.length) {
    recGk.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg><p>Nenhuma goleira cadastrada</p></div>`;
  } else {
    recGk.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Nome</th><th>Equipe</th><th>Performance</th></tr></thead><tbody>
      ${goleiras.slice(0,5).map(g => {
        const avg = avgPerformance(g.id);
        const { label, cls } = classifyPerf(avg);
        return `<tr><td><strong>${_esc(g.nome)}</strong></td><td>${_esc(g.equipe||'—')}</td><td>${avg!==null?`<span class="badge ${cls}">${avg}</span>`:'—'}</td></tr>`;
      }).join('')}
    </tbody></table></div>`;
  }

  // Recent Matches
  const recM = document.getElementById('dash-recent-matches');
  if (!partidas.length) {
    recM.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/></svg><p>Nenhuma partida registrada</p></div>`;
  } else {
    const sorted = [...partidas].sort((a,b)=>(b.data||'').localeCompare(a.data||'')).slice(0,5);
    recM.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Data</th><th>Adversário</th><th>Competição</th><th>Resultado</th></tr></thead><tbody>
      ${sorted.map(p => {
        let res = '—';
        if (p.gf!==undefined&&p.gc!==undefined) {
          const r = p.gf>p.gc?'V':p.gf<p.gc?'D':'E';
          const c = r==='V'?'var(--success)':r==='D'?'var(--error)':'var(--warning)';
          res = `<span style="color:${c};font-weight:700">${r} ${p.gf}×${p.gc}</span>`;
        }
        return `<tr><td>${p.data?formatDate(p.data):'—'}</td><td>${_esc(p.adversario)}</td><td>${_esc(p.competicao||'—')}</td><td>${res}</td></tr>`;
      }).join('')}
    </tbody></table></div>`;
  }

  // Perf chart
  if (chartPerf) chartPerf.destroy();
  const perfData = goleiras.map(g => ({ nome: g.nome.split(' ')[0], score: avgPerformance(g.id) })).filter(d => d.score !== null);
  if (perfData.length) {
    const avgScore = perfData.length ? perfData.reduce((a,d)=>a+d.score,0)/perfData.length : 0;
    chartPerf = new Chart(document.getElementById('chart-perf'), {
      type: 'bar',
      data: {
        labels: perfData.map(d => d.nome),
        datasets: [
          {
            label: 'Performance',
            data: perfData.map(d => d.score),
            backgroundColor: perfData.map(d => d.score >= 8 ? 'rgba(16,185,129,.75)' : d.score >= 6 ? 'rgba(59,130,246,.75)' : 'rgba(245,158,11,.75)'),
            borderColor: perfData.map(d => d.score >= 8 ? '#10B981' : d.score >= 6 ? '#3B82F6' : '#F59E0B'),
            borderWidth: 2, borderRadius: 8, borderSkipped: false,
            hoverBackgroundColor: perfData.map(d => d.score >= 8 ? 'rgba(16,185,129,.95)' : d.score >= 6 ? 'rgba(59,130,246,.95)' : 'rgba(245,158,11,.95)'),
          },
          {
            label: 'Média',
            data: perfData.map(() => avgScore),
            type: 'line',
            borderColor: '#F59E0B',
            borderWidth: 2,
            borderDash: [6, 4],
            pointRadius: 0,
            fill: false,
            tension: 0,
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 800, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15,23,42,.95)',
            borderColor: 'rgba(255,255,255,.1)',
            borderWidth: 1,
            padding: 12,
            titleColor: '#F8FAFC',
            bodyColor: '#94A3B8',
            callbacks: {
              label: ctx => ctx.dataset.label === 'Média'
                ? ` Média: ${avgScore.toFixed(1)}`
                : ` Performance: ${ctx.parsed.y}`
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#64748B', font: { size: 12 } } },
          y: {
            grid: { color: 'rgba(255,255,255,.04)', drawBorder: false },
            ticks: { color: '#64748B', font: { size: 11 } },
            min: 0, max: 10,
            border: { display: false }
          }
        }
      }
    });
  } else {
    const ctx = document.getElementById('chart-perf').getContext('2d');
    ctx.clearRect(0,0,1000,1000);
  }
}

// ═══════════════════════════════════════════════════════════
// SELECT HELPERS
// ═══════════════════════════════════════════════════════════
function updateGoleiraSelects() {
  const goleiras = DB.goleiras;
  const opts = `<option value="">Selecionar…</option>` + goleiras.map(g => `<option value="${g.id}">${_esc(g.nome)}</option>`).join('');
  ['match-goleira','match-gk2','scout-goleira','comp-gk1','comp-gk2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { const v = el.value; el.innerHTML = opts; el.value = v; }
  });
  const perfilEl = document.getElementById('perfil-gk-select');
  if (perfilEl) { const v = perfilEl.value; perfilEl.innerHTML = `<option value="">Selecione a goleira…</option>` + goleiras.map(g=>`<option value="${g.id}">${_esc(g.nome)}</option>`).join(''); perfilEl.value = v; }
  const hmEl = document.getElementById('heatmap-gk');
  if (hmEl) { const v = hmEl.value; hmEl.innerHTML = `<option value="">Todas as goleiras</option>` + goleiras.map(g => `<option value="${g.id}">${_esc(g.nome)}</option>`).join(''); hmEl.value = v; }
  const pdfEl = document.getElementById('pdf-gk-select');
  if (pdfEl) pdfEl.innerHTML = `<option value="">Selecione a goleira…</option>` + goleiras.map(g => `<option value="${g.id}">${_esc(g.nome)}</option>`).join('');
  const partidas = DB.partidas;
  const popts = `<option value="">Selecionar…</option>` + partidas.map(p => `<option value="${p.id}">${_esc(p.adversario)}${p.data?' ('+formatDate(p.data)+')':''}</option>`).join('');
  const spt = document.getElementById('scout-partida');
  if (spt) spt.innerHTML = popts;
}
const updateSelects = updateGoleiraSelects;

// ═══════════════════════════════════════════════════════════
// EXCEL IMPORT
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════
function formatDate(d) {
  if (!d) return '—';
  try { const dt = new Date(d+'T00:00:00'); return dt.toLocaleDateString('pt-BR'); } catch { return d; }
}

// ═══════════════════════════════════════════════════════════
// OPEN MODAL OVERRIDES (reset state)
// ═══════════════════════════════════════════════════════════
const origOpenModal = openModal;
document.querySelector('[onclick="openModal(\'modal-goleira\')"]')?.addEventListener('click', () => {
  editingId.goleira = null;
  document.getElementById('modal-goleira-title').textContent = 'Nova Goleira';
  ['nome','nasc','num','altura','peso','equipe','obs'].forEach(f => document.getElementById('gk-'+f).value='');
  ['categoria','pe','mao','naipe'].forEach(f => document.getElementById('gk-'+f).value='');
  var _m=document.getElementById('gk-modalidade'); if(_m) _m.value='futsal';
});
document.querySelector('[onclick="openModal(\'modal-partida\')"]')?.addEventListener('click', () => {
  editingId.partida = null;
  document.getElementById('modal-partida-title').textContent = 'Nova Partida';
  ['data','hora','adv','comp','fase','local','obs'].forEach(f => document.getElementById('match-'+f).value='');
  document.getElementById('match-goleira').value='';
  document.getElementById('match-gf').value=0; document.getElementById('match-gc').value=0;
  toggleSegundaGoleira(false);
});
document.querySelector('[onclick="openModal(\'modal-scout\')"]')?.addEventListener('click', () => {
  editingId.scout = null;
  document.getElementById('modal-scout-title').textContent = 'Novo Scout';
  document.getElementById('scout-goleira').value='';
  document.getElementById('scout-partida').value='';
  const fields = ['dad','dae','dbd','dbe','dc','d1x1','esq','gda','gfa','gpe','gfl','tchmed','tc1x1','tchala','tchst','dpc','dpe','dmc','dme','int','pose','posd','sai'];
  fields.forEach(f => { const el=document.getElementById('s-'+f); if(el) el.value=0; });
  document.getElementById('s-nota').value='';
  atualizarNotaPreview();
});

// Responsive menu button
if (window.innerWidth <= 768) document.getElementById('menu-btn').style.display='flex';
window.addEventListener('resize', () => {
  document.getElementById('menu-btn').style.display = window.innerWidth<=768?'flex':'none';
});

// ═══════════════════════════════════════════════════════════
// HEATMAP
// ═══════════════════════════════════════════════════════════
function aggScouts(gkId) {
  let scouts = DB.scouts;
  if (gkId) scouts = scouts.filter(s => s.goalkeeperId === gkId);
  return scouts;
}
// ═══════════════════════════════════════════════════════════
// FOTO DA GOLEIRA
// ═══════════════════════════════════════════════════════════
let currentFotoBase64 = '';
let cropOriginalSrc = '';     // raw upload for re-crop
let cropTarget = 'modal';    // 'modal' or 'perfil'
let cropGkId = null;          // for perfil direct save

// ── Crop state ────────────────────────────────────────────
const cropState = {
  x: 0, y: 0, scale: 1,
  isDragging: false,
  startX: 0, startY: 0,
  startImgX: 0, startImgY: 0,
  size: 260
};

function openCropModal(src, target = 'modal', gkId = null) {
  cropOriginalSrc = src;
  cropTarget = target;
  cropGkId = gkId;
  const img = document.getElementById('crop-img');
  const zoom = document.getElementById('crop-zoom');
  img.onload = () => {
    // Auto-fit to fill circle
    const fitScale = Math.max(cropState.size / img.naturalWidth, cropState.size / img.naturalHeight);
    cropState.scale = fitScale;
    cropState.x = (cropState.size - img.naturalWidth * fitScale) / 2;
    cropState.y = (cropState.size - img.naturalHeight * fitScale) / 2;
    if (zoom) { zoom.min = fitScale; zoom.max = fitScale * 4; zoom.step = fitScale * 0.01; zoom.value = fitScale; }
    updateCropTransform();
  };
  img.src = src;
  openModal('modal-crop');
}

function updateCropTransform() {
  const img = document.getElementById('crop-img');
  if (!img || !img.naturalWidth) return;
  img.style.left = cropState.x + 'px';
  img.style.top  = cropState.y + 'px';
  img.style.width  = (img.naturalWidth  * cropState.scale) + 'px';
  img.style.height = (img.naturalHeight * cropState.scale) + 'px';
}

function applyCrop() {
  const img = document.getElementById('crop-img');
  if (!img || !img.naturalWidth) return;
  const out = 240;
  const ratio = out / cropState.size;
  const canvas = document.createElement('canvas');
  canvas.width = out; canvas.height = out;
  const ctx = canvas.getContext('2d');
  ctx.beginPath();
  ctx.arc(out/2, out/2, out/2, 0, Math.PI*2);
  ctx.clip();
  ctx.drawImage(img, cropState.x*ratio, cropState.y*ratio,
    img.naturalWidth*cropState.scale*ratio, img.naturalHeight*cropState.scale*ratio);
  const result = canvas.toDataURL('image/jpeg', 0.85);

  if (cropTarget === 'perfil' && cropGkId) {
    // Save directly to the goalkeeper
    const goleiras = DB.goleiras;
    const idx = goleiras.findIndex(g => g.id === cropGkId);
    if (idx !== -1) {
      goleiras[idx].foto = result;
      DB.saveGoleiras(goleiras);
      cloudSet('goleiras', goleiras[idx]);
      renderPerfil();
      toast('Foto atualizada!', 'success');
    }
  } else {
    // Save to modal form
    currentFotoBase64 = result;
    updateFotoPreview(result);
    const ajBtn = document.getElementById('btn-ajustar-foto');
    if (ajBtn) ajBtn.style.display = 'inline-flex';
  }
  closeModal('modal-crop');
}

function reabrirCrop() {
  if (cropOriginalSrc) openCropModal(cropOriginalSrc, 'modal');
}

// Init drag on crop container (called once on load)
function initCropDrag() {
  const c = document.getElementById('crop-container');
  if (!c) return;
  const move = (dx, dy) => {
    cropState.x = cropState.startImgX + dx;
    cropState.y = cropState.startImgY + dy;
    updateCropTransform();
  };
  // Mouse
  c.addEventListener('mousedown', e => {
    cropState.isDragging = true; c.style.cursor = 'grabbing';
    cropState.startX = e.clientX; cropState.startY = e.clientY;
    cropState.startImgX = cropState.x; cropState.startImgY = cropState.y;
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!cropState.isDragging) return;
    move(e.clientX - cropState.startX, e.clientY - cropState.startY);
  });
  document.addEventListener('mouseup', () => { cropState.isDragging = false; c.style.cursor = 'grab'; });
  // Touch
  c.addEventListener('touchstart', e => {
    const t = e.touches[0];
    cropState.isDragging = true;
    cropState.startX = t.clientX; cropState.startY = t.clientY;
    cropState.startImgX = cropState.x; cropState.startImgY = cropState.y;
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!cropState.isDragging) return;
    const t = e.touches[0];
    move(t.clientX - cropState.startX, t.clientY - cropState.startY);
  }, { passive: true });
  document.addEventListener('touchend', () => { cropState.isDragging = false; });
  // Zoom
  const zoom = document.getElementById('crop-zoom');
  if (zoom) zoom.addEventListener('input', () => {
    const img = document.getElementById('crop-img');
    if (!img) return;
    const newScale = parseFloat(zoom.value);
    const cx = cropState.size / 2;
    const cy = cropState.size / 2;
    cropState.x = cx - (cx - cropState.x) * (newScale / cropState.scale);
    cropState.y = cy - (cy - cropState.y) * (newScale / cropState.scale);
    cropState.scale = newScale;
    updateCropTransform();
  });
}
initCropDrag();

function handleFotoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => openCropModal(e.target.result, 'modal');
  reader.readAsDataURL(file);
}

// Perfil page: click avatar to edit photo
function perfilEditarFoto() {
  document.getElementById('perfil-foto-input').click();
}
function handlePerfilFotoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const gkId = document.getElementById('perfil-select')?.value;
  if (!gkId) { toast('Selecione uma goleira primeiro', 'error'); return; }
  const reader = new FileReader();
  reader.onload = e => openCropModal(e.target.result, 'perfil', gkId);
  reader.readAsDataURL(file);
  input.value = '';
}

function updateFotoPreview(src) {
  const el = document.getElementById('gk-foto-preview');
  if (!el) return;
  el.innerHTML = src
    ? `<img src="${src}" style="width:100%;height:100%;object-fit:cover;">`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.5" style="width:36px;height:36px;"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>`;
}
function clearFoto() {
  currentFotoBase64 = '';
  cropOriginalSrc = '';
  updateFotoPreview('');
  const ajBtn = document.getElementById('btn-ajustar-foto');
  if (ajBtn) ajBtn.style.display = 'none';
  const inp = document.getElementById('gk-foto-input');
  if (inp) inp.value = '';
}

// ═══════════════════════════════════════════════════════════
// PERFIL DA GOLEIRA
// ═══════════════════════════════════════════════════════════
let perfilChart = null;
function verPerfil(gkId) {
  navigate('perfil');
  const sel = document.getElementById('perfil-gk-select');
  if (sel) { sel.value = gkId; renderPerfil(); }
}
function calcIdade(nasc) {
  if (!nasc) return null;
  const diff = new Date() - new Date(nasc);
  return Math.floor(diff / (1000*60*60*24*365.25));
}
function renderPerfil() {
  const gkId = document.getElementById('perfil-gk-select')?.value;
  const content = document.getElementById('perfil-content');
  const empty   = document.getElementById('perfil-empty');
  if (!gkId) { content.style.display='none'; empty.style.display='block'; return; }
  const gk = DB.goleiras.find(g => g.id === gkId);
  if (!gk) return;
  content.style.display='block'; empty.style.display='none';
  _perfilGkId = gkId;
  renderPerfilTreinos(gkId);
  renderPerfilInsights(gkId);
  renderPerfilTimeline(gkId);
  renderPerfilPID(gkId);
  renderPerfilIA(gkId);

  // Foto + nome
  const fotoEl = document.getElementById('perfil-foto');
  fotoEl.innerHTML = gk.foto
    ? `<img src="${(gk.foto||'').startsWith('data:image/') ? gk.foto : ''}" style="width:100%;height:100%;object-fit:cover;">`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.5" style="width:48px;height:48px;"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>`;
  document.getElementById('perfil-nome').textContent = gk.nome;
  const idade = calcIdade(gk.nasc);
  const sub = [gk.equipe, gk.categoria, idade ? idade+' anos' : null].filter(Boolean).join(' • ');
  document.getElementById('perfil-sub').textContent = sub || '—';

  // Badge de performance
  const avg = avgPerformance(gkId);
  const { label, cls } = classifyPerf(avg);
  document.getElementById('perfil-badge').innerHTML = avg !== null
    ? `<span class="badge ${cls}" style="font-size:13px;padding:5px 12px;">${label} — ${avg}</span>`
    : '<span style="color:var(--muted);font-size:12px;">Sem dados de performance</span>';

  // Info grid
  const infoItems = [
    ['Nascimento', gk.nasc ? formatDate(gk.nasc) : '—'],
    ['Idade', idade ? idade+' anos' : '—'],
    ['Altura', gk.altura ? gk.altura+' cm' : '—'],
    ['Peso', gk.peso ? gk.peso+' kg' : '—'],
    ['Pé dominante', gk.pe || '—'],
    ['Mão dominante', gk.mao || '—'],
    ['Modalidade', gk.modalidade === 'beach' ? 'Beach Soccer' : 'Futsal'],
    ['Naipe', gk.naipe ? (gk.naipe === 'masculino' ? 'Masculino' : 'Feminino') : '—'],
    ['Nº camisa', gk.num || '—'],
    ['Equipe', gk.equipe || '—'],
  ];
  document.getElementById('perfil-info-grid').innerHTML = infoItems.map(([k,v])=>`
    <div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;">${k}</div>
    <div style="font-weight:600;font-size:13px;margin-top:2px;">${v}</div></div>`).join('');

  // Ranking interno
  const allGks = DB.goleiras;
  const ranking = [...allGks]
    .map(g => ({ id: g.id, nome: g.nome, avg: avgPerformance(g.id) }))
    .filter(g => g.avg !== null)
    .sort((a,b) => b.avg - a.avg);
  const pos = ranking.findIndex(r => r.id === gkId) + 1;
  document.getElementById('perfil-ranking').innerHTML = `
    <div class="card-header"><span class="card-title">Ranking Interno</span></div>
    <div style="text-align:center;padding:12px 0;">
      <div style="font-size:48px;font-weight:800;color:var(--primary);">${pos > 0 ? '#'+pos : '—'}</div>
      <div style="font-size:12px;color:var(--muted);margin-top:4px;">de ${allGks.length} goleiras cadastradas</div>
    </div>
    <div style="font-size:12px;color:var(--muted);">
      ${ranking.slice(0,5).map((r,i)=>`
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);${r.id===gkId?'color:var(--primary);font-weight:700;':''}">
          <span>#${i+1} ${_esc(r.nome)}</span><span>${r.avg}</span>
        </div>`).join('')}
    </div>`;

  // Stats acumulados (scouts merged por jogo)
  const scouts = _mergeScouts(DB.scouts.filter(s => s.goalkeeperId === gkId));
  const sum = k => scouts.reduce((a,s)=>a+(+s[k]||0),0);
  const totalDef = sum('dad')+sum('dae')+sum('dbd')+sum('dbe')+sum('dc')+sum('d1x1');
  const totalGols = sum('gda')+sum('gfa')+sum('gpe')+sum('gfl');
  const distAcc = (sum('dpc')+sum('dmc')) / Math.max(sum('dpc')+sum('dmc')+sum('dpe')+sum('dme'), 1);
  document.getElementById('perfil-stats').innerHTML = `
    <div class="card-header"><span class="card-title">Estatísticas</span></div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;padding:8px 0;">
      ${[['Partidas', scouts.length],['Defesas', totalDef],['Gols sofridos', totalGols],['Interceptações', sum('int')],
         ['Esquadros', sum('esq')],['Precisão dist.', Math.round(distAcc*100)+'%']
        ].map(([k,v])=>`<div style="text-align:center;padding:10px;background:var(--bg);border-radius:8px;">
          <div style="font-size:20px;font-weight:800;color:var(--primary);">${v}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">${k}</div></div>`).join('')}
    </div>`;

  // Evolução técnica
  const sorted = [...scouts].sort((a,b) => {
    const pa = DB.partidas.find(p=>p.id===a.partidaId);
    const pb = DB.partidas.find(p=>p.id===b.partidaId);
    return (pa?.data||'').localeCompare(pb?.data||'');
  });
  const labels = sorted.map((s,i) => {
    const p = DB.partidas.find(pt=>pt.id===s.partidaId);
    return p ? p.adversario.slice(0,8) : 'J'+(i+1);
  });
  const scores = sorted.map(calcPerformance);
  document.getElementById('perfil-evol-label').textContent = scouts.length ? `${scouts.length} partidas` : '';
  if (perfilChart) perfilChart.destroy();
  perfilChart = new Chart(document.getElementById('chart-perfil-evol'), {
    type: 'line',
    data: { labels, datasets: [{ label: 'Nota', data: scores, borderColor:'#3B82F6', backgroundColor:'rgba(59,130,246,.1)', tension:.4, fill:true, pointBackgroundColor:'#3B82F6', pointRadius:5 }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false} },
      scales:{ x:{grid:{color:'#1E1E3A'},ticks:{color:'#5A5A7A'}}, y:{grid:{color:'#1E1E3A'},ticks:{color:'#5A5A7A'},min:0,max:10} } }
  });

  // Histórico de partidas
  const tbody = document.getElementById('perfil-historico-tbody');
  if (!sorted.length) { tbody.innerHTML='<tr><td colspan="7"><div class="empty-state"><p>Nenhum scout registrado.</p></div></td></tr>'; return; }
  tbody.innerHTML = sorted.reverse().map(s => {
    const p = DB.partidas.find(pt=>pt.id===s.partidaId);
    const def = (+s.dad||0)+(+s.dae||0)+(+s.dbd||0)+(+s.dbe||0)+(+s.dc||0);
    const gc  = (+s.gda||0)+(+s.gfa||0)+(+s.gpe||0)+(+s.gfl||0);
    const nota = calcPerformance(s);
    const { label:lb, cls } = classifyPerf(nota);
    let res = '—';
    if (p?.gf !== undefined) {
      const r = p.gf>p.gc?'V':p.gf<p.gc?'D':'E';
      const col = r==='V'?'var(--success)':r==='D'?'var(--error)':'var(--warning)';
      res = `<span style="color:${col};font-weight:700;">${r} ${p.gf}×${p.gc}</span>`;
    }
    return `<tr>
      <td>${p?.data ? formatDate(p.data) : '—'}</td>
      <td><strong>${_esc(p?.adversario || '—')}</strong></td>
      <td>${_esc(p?.competicao || '—')}</td>
      <td>${res}</td>
      <td>${def}</td><td>${gc}</td>
      <td>${nota !== null ? `<span class="badge ${cls}">${nota}</span>` : '—'}</td>
    </tr>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════
// ANÁLISE DE DESEMPENHO
// ═══════════════════════════════════════════════════════════
let analiseGkId = null;

function abrirAnalise() {
  const sel = document.getElementById('perfil-gk-select');
  const gkId = sel?.value || analiseGkId;
  if (!gkId) { toast('Selecione uma goleira no Perfil primeiro', 'error'); return; }
  gerarAnalise(gkId);
}

function gerarAnalise(gkId) {
  analiseGkId = gkId;
  const gk      = DB.goleiras.find(g => g.id === gkId);
  const scouts   = _mergeScouts(DB.scouts.filter(s => s.goalkeeperId === gkId));
  const partidas = DB.partidas;
  if (!gk) return;
  if (scouts.length < 1) { toast('Sem scouts registrados para análise', 'error'); return; }

  // ── Aggregate raw stats ─────────────────────────────────
  const sum = k => scouts.reduce((a,s) => a + (+s[k]||0), 0);
  const totalDef   = sum('dad')+sum('dae')+sum('dbd')+sum('dbe')+sum('dc');
  const totalEsq   = sum('esq');
  const totalGols  = sum('gda')+sum('gfa')+sum('gpe')+sum('gfl');
  const golArea    = sum('gda');
  const golFora    = sum('gfa');
  const golPen     = sum('gpe');
  const golFalt    = sum('gfl');
  const defAlta    = sum('dad')+sum('dae');
  const defBaixa   = sum('dbd')+sum('dbe');
  const defCentral = sum('dc');
  const distPeCert = sum('dpc'); const distPeErr = sum('dpe');
  const distMaoCert= sum('dmc'); const distMaoErr= sum('dme');
  const distCertas = distPeCert + distMaoCert;
  const distTotal  = distCertas + distPeErr + distMaoErr;
  const totalInt   = sum('int');
  const totalSai   = sum('sai');
  const totalPos   = sum('pose') + sum('posd');
  const nPartidas  = Math.max(1, [...new Set(scouts.map(s=>s.partidaId).filter(Boolean))].length || scouts.length);
  const avgNota    = avgPerformance(gkId);

  // ── Derived metrics ─────────────────────────────────────
  const taxaDef   = (totalDef + totalGols) > 0 ? totalDef / (totalDef + totalGols) : null;
  const taxaDist  = distTotal > 0 ? distCertas / distTotal : null;
  const taxaDistPe= (distPeCert+distPeErr) > 0 ? distPeCert/(distPeCert+distPeErr) : null;
  const taxaDistMao=(distMaoCert+distMaoErr)>0 ? distMaoCert/(distMaoCert+distMaoErr) : null;
  const gkPerGame = v => (v / nPartidas).toFixed(1);

  // ── Evolution trend ──────────────────────────────────────
  const sorted = [...scouts].sort((a,b)=>{
    const pa=partidas.find(p=>p.id===a.partidaId), pb=partidas.find(p=>p.id===b.partidaId);
    return (pa?.data||'').localeCompare(pb?.data||'');
  });
  let tendencia = 'estável', tendenciaDelta = 0, tendenciaClasse = '→';
  if (sorted.length >= 3) {
    const half = Math.ceil(sorted.length / 2);
    const prim = sorted.slice(0,half).map(calcPerformance).filter(n=>n!==null);
    const ult  = sorted.slice(-half).map(calcPerformance).filter(n=>n!==null);
    if (prim.length && ult.length) {
      const avgP = prim.reduce((a,b)=>a+b,0)/prim.length;
      const avgU = ult.reduce((a,b)=>a+b,0)/ult.length;
      tendenciaDelta = +(avgU - avgP).toFixed(2);
      if (tendenciaDelta >= 1.0)       { tendencia='excelente'; tendenciaClasse='↑↑'; }
      else if (tendenciaDelta >= 0.3)  { tendencia='crescente'; tendenciaClasse='↑'; }
      else if (tendenciaDelta <= -1.0) { tendencia='queda acentuada'; tendenciaClasse='↓↓'; }
      else if (tendenciaDelta < -0.3)  { tendencia='queda'; tendenciaClasse='↓'; }
    }
  }

  // ── Consistency (std deviation of scores) ───────────────
  const notas = scouts.map(calcPerformance).filter(n=>n!==null);
  let consistencia = null;
  if (notas.length >= 2) {
    const avg = notas.reduce((a,b)=>a+b,0)/notas.length;
    const std = Math.sqrt(notas.reduce((a,n)=>a+(n-avg)**2,0)/notas.length);
    consistencia = Math.max(0, Math.min(10, 10 - std * 2));
  }

  // ── Classify each dimension ──────────────────────────────
  function classifyRate(rate, excelente=.85, bom=.70, regular=.55) {
    if (rate === null) return { label:'Sem dados', color:'var(--muted)', score: null };
    if (rate >= excelente) return { label:'Excelente', color:'var(--success)', score: rate*10 };
    if (rate >= bom)       return { label:'Boa',       color:'var(--primary)', score: rate*10 };
    if (rate >= regular)   return { label:'Regular',   color:'var(--warning)', score: rate*10 };
    return                        { label:'A melhorar', color:'var(--error)',  score: rate*10 };
  }
  const clDef  = classifyRate(taxaDef, .85, .70, .55);
  const clDist = classifyRate(taxaDist, .80, .65, .50);
  const clNota = avgNota !== null
    ? (avgNota>=8.5?{label:'Elite',color:'#FFB300'}:avgNota>=7?{label:'Excelente',color:'var(--success)'}:avgNota>=5.5?{label:'Boa',color:'var(--primary)'}:avgNota>=4?{label:'Regular',color:'var(--warning)'}:{label:'Em Desenvolvimento',color:'var(--error)'})
    : {label:'Sem dados',color:'var(--muted)'};

  // ── Pontos fortes ────────────────────────────────────────
  const forcas = [];
  if (taxaDef !== null && taxaDef >= .80) forcas.push({ icon:'🛡️', texto:`Alta taxa de defesa (${(taxaDef*100).toFixed(0)}%) — intercepta a maioria dos chutes recebidos` });
  if (taxaDist !== null && taxaDist >= .75) forcas.push({ icon:'🎯', texto:`Distribuição precisa (${(taxaDist*100).toFixed(0)}% de acerto) — controla bem a bola com pé e mão` });
  if (totalInt / nPartidas >= 1.5) forcas.push({ icon:'✊', texto:`Alta frequência de interceptações (${gkPerGame(totalInt)}/jogo) — antecipa bem as jogadas` });
  if (totalSai / nPartidas >= 1.0) forcas.push({ icon:'🚀', texto:`Ativa nas saídas (${gkPerGame(totalSai)}/jogo) — reduz o espaço para o atacante` });
  if (defBaixa > defAlta && totalDef > 3) forcas.push({ icon:'🔽', texto:'Mais eficiente em defesas baixas — boa cobertura de solo e ângulos fechados' });
  if (defAlta > defBaixa && totalDef > 3) forcas.push({ icon:'⬆️', texto:'Destaque em defesas altas — boa envergadura e leitura de trajetórias aéreas' });
  if (tendencia === 'crescente' || tendencia === 'excelente') forcas.push({ icon:'📈', texto:`Evolução técnica ${tendencia} (${tendenciaDelta>0?'+':''}${tendenciaDelta} pts) — consistente progresso` });
  if (consistencia !== null && consistencia >= 7.5) forcas.push({ icon:'🎖️', texto:`Alta consistência (${consistencia.toFixed(1)}/10) — desempenho equilibrado entre as partidas` });
  if (totalEsq > 0 && totalDef > 0) forcas.push({ icon:'🏹', texto:`${totalEsq} esquadro(s) registrado(s) — reações de alto nível demonstradas` });

  // ── Pontos de melhoria ───────────────────────────────────
  const melhorias = [];
  if (taxaDef !== null && taxaDef < .70) melhorias.push({ icon:'🎯', texto:`Taxa de defesa de ${(taxaDef*100).toFixed(0)}% — foco em leitura de trajetória e posicionamento no gol` });
  if (taxaDistPe !== null && taxaDistPe < .65) melhorias.push({ icon:'🦵', texto:`Distribuição de pé com ${(taxaDistPe*100).toFixed(0)}% de precisão — priorizar treino de lançamentos curtos e médios` });
  if (taxaDistMao !== null && taxaDistMao < .65) melhorias.push({ icon:'🤲', texto:`Distribuição de mão com ${(taxaDistMao*100).toFixed(0)}% de precisão — trabalhar arremessos e controle de potência` });
  if (golPen > 0 && totalGols > 0 && golPen/totalGols > .30) melhorias.push({ icon:'⚠️', texto:`${golPen} gol(is) de pênalti sofrido(s) — desenvolver leitura de cobranças e trabalho psicológico` });
  if (totalInt / nPartidas < 0.5 && nPartidas >= 3) melhorias.push({ icon:'👀', texto:'Poucas interceptações por jogo — trabalhar antecipação e saída de linha' });
  if (tendencia === 'queda' || tendencia === 'queda acentuada') melhorias.push({ icon:'📉', texto:`Tendência de ${tendencia} recente (${tendenciaDelta} pts) — revisar carga de treino e aspectos técnicos` });
  if (consistencia !== null && consistencia < 5) melhorias.push({ icon:'📊', texto:`Inconsistência de desempenho (${consistencia.toFixed(1)}/10) — criar rotina pré-jogo e trabalho mental` });
  if (golArea / Math.max(1,totalGols) > .60 && totalGols >= 2) melhorias.push({ icon:'📍', texto:`${((golArea/totalGols)*100).toFixed(0)}% dos gols sofridos dentro da área — melhorar posicionamento e fechamento de ângulo` });

  // ── Recomendações técnicas ───────────────────────────────
  const recs = [];
  if (taxaDef !== null && taxaDef < .75) recs.push('Treino específico de posicionamento: cone de gol e exercícios de ângulo com chutes de longa e curta distância');
  if (taxaDistPe !== null && taxaDistPe < .70) recs.push('Circuito de distribuição de pé: lançamentos para alvo fixo em 3 distâncias (5m, 10m, 15m), meta de 75% de precisão');
  if (taxaDistMao !== null && taxaDistMao < .70) recs.push('Série de arremessos guiados: trabalho com parceiro ou tela de alvo, enfatizando precisão antes de potência');
  if (totalSai / nPartidas < 0.8) recs.push('Exercícios de saída de gol: 1v1 com atacante, decisão de quando sair ou ficar no gol — pelo menos 2× por semana');
  if (tendenciaDelta < 0) recs.push('Revisão de vídeo das últimas partidas em conjunto com o treinador para identificar padrões de erro');
  if (golPen > 2) recs.push('Treino de pênaltis: estudo de cobradores (lateralidade, posição do pé), 20 min no final de cada sessão');
  recs.push('Registro de feedback pós-treino: diário técnico semanal para acompanhar evolução qualitativa');
  if (consistencia !== null && consistencia < 6) recs.push('Implantação de rotina de aquecimento mental (respiração + visualização) nos 30min pré-partida');
  if (totalInt / nPartidas < 1) recs.push('Jogo de antecipação: exercícios de leitura de passes e saída antecipada para cruzamentos e bolas na área');

  // ── Resumo executivo ─────────────────────────────────────
  const nivel = clNota.label;
  const defStr = taxaDef !== null ? `taxa de defesa de ${(taxaDef*100).toFixed(0)}%` : 'dados de defesa em coleta';
  const distStr = taxaDist !== null ? `precisão de distribuição de ${(taxaDist*100).toFixed(0)}%` : 'distribuição em desenvolvimento';
  const resumo = `${_esc(gk.nome)} apresenta nível de desempenho classificado como <strong>${nivel}</strong>, com nota média de <strong>${avgNota !== null ? avgNota.toFixed(1) : '—'}/10</strong> ao longo de <strong>${nPartidas} partida(s)</strong> analisada(s). `
    + `A goleira registra ${defStr}, ${distStr} e média de <strong>${gkPerGame(totalDef)} defesas por jogo</strong>. `
    + `A tendência de evolução é <strong>${tendencia}</strong>${Math.abs(tendenciaDelta) > 0.1 ? ` (${tendenciaDelta > 0 ? '+' : ''}${tendenciaDelta} pts)` : ''}.`
    + (forcas.length ? ` Seus principais pontos fortes são ${forcas.slice(0,2).map(f=>f.texto.split('—')[0].toLowerCase()).join(' e ')}.` : '');

  // ── Build HTML report ────────────────────────────────────
  const tendCorColor = tendencia.includes('crescente')||tendencia==='excelente' ? 'var(--success)' : tendencia.includes('queda') ? 'var(--error)' : 'var(--warning)';

  const html = `
  <div id="analise-pdf-content">
    <!-- Header: Nota geral + Classificação -->
    <div style="display:grid;grid-template-columns:auto 1fr auto;gap:20px;align-items:center;margin-bottom:24px;padding:20px;background:linear-gradient(135deg,rgba(0,212,255,.06),rgba(123,47,190,.06));border:1px solid rgba(0,212,255,.15);border-radius:14px;">
      <div style="text-align:center;">
        <div style="font-size:52px;font-weight:900;line-height:1;color:${clNota.color};text-shadow:0 0 30px ${clNota.color}40;">${avgNota !== null ? avgNota.toFixed(1) : '—'}</div>
        <div style="font-size:10px;font-weight:600;color:var(--muted);letter-spacing:1px;margin-top:4px;">NOTA GERAL</div>
      </div>
      <div>
        <div style="font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.8px;text-transform:uppercase;margin-bottom:4px;">Nível de Desempenho</div>
        <div style="font-size:22px;font-weight:800;color:${clNota.color};">${nivel}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px;">${nPartidas} partida(s) · ${scouts.length} scout(s) · Gerado em ${new Date().toLocaleDateString('pt-BR')}</div>
      </div>
      <div style="text-align:center;padding:12px 20px;background:rgba(0,0,0,.2);border-radius:10px;">
        <div style="font-size:28px;font-weight:800;color:${tendCorColor};">${tendenciaClasse}</div>
        <div style="font-size:10px;color:var(--muted);letter-spacing:.5px;margin-top:2px;">EVOLUÇÃO</div>
        <div style="font-size:11px;font-weight:600;color:${tendCorColor};margin-top:2px;">${tendencia}</div>
      </div>
    </div>

    <!-- Resumo executivo -->
    <div style="background:rgba(255,255,255,.03);border-left:3px solid var(--primary);border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:20px;font-size:13px;line-height:1.7;color:var(--text);">${resumo}</div>

    <!-- Métricas principais: 4 cards -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">
      ${[
        { label:'Taxa de Defesa', val: taxaDef !== null ? (taxaDef*100).toFixed(0)+'%' : '—', sub: totalDef+' defesas / '+(totalGols)+' gols', color: clDef.color },
        { label:'Precisão Distrib.', val: taxaDist !== null ? (taxaDist*100).toFixed(0)+'%' : '—', sub: distCertas+' certas / '+distTotal+' total', color: clDist.color },
        { label:'Def. por Jogo', val: gkPerGame(totalDef), sub: totalEsq+' esquadro(s)', color:'var(--primary)' },
        { label:'Consistência', val: consistencia !== null ? consistencia.toFixed(1)+'/10' : '—', sub: notas.length+' notas registradas', color: consistencia !== null && consistencia >= 7 ? 'var(--success)' : 'var(--warning)' },
      ].map(m=>`
        <div style="background:var(--card-2);border:1px solid var(--border);border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:9px;font-weight:700;color:var(--muted);letter-spacing:.8px;text-transform:uppercase;margin-bottom:6px;">${m.label}</div>
          <div style="font-size:26px;font-weight:800;color:${m.color};line-height:1;">${m.val}</div>
          <div style="font-size:10px;color:var(--muted);margin-top:4px;">${m.sub}</div>
        </div>`).join('')}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
      <!-- Pontos Fortes -->
      <div style="background:rgba(0,230,118,.04);border:1px solid rgba(0,230,118,.2);border-radius:12px;padding:16px;">
        <div style="font-size:11px;font-weight:700;color:var(--success);letter-spacing:.8px;text-transform:uppercase;margin-bottom:12px;">✅ Pontos Fortes</div>
        ${(forcas.length ? forcas.slice(0,4) : [{icon:'➕',texto:'Continue acumulando partidas para identificar padrões de força'}]).map(f=>`
          <div style="display:flex;gap:8px;margin-bottom:9px;font-size:12px;line-height:1.5;">
            <span style="flex-shrink:0;">${f.icon}</span>
            <span style="color:var(--text);">${f.texto}</span>
          </div>`).join('')}
      </div>
      <!-- Pontos de Melhoria -->
      <div style="background:rgba(255,179,0,.04);border:1px solid rgba(255,179,0,.2);border-radius:12px;padding:16px;">
        <div style="font-size:11px;font-weight:700;color:var(--warning);letter-spacing:.8px;text-transform:uppercase;margin-bottom:12px;">⚠️ A Desenvolver</div>
        ${(melhorias.length ? melhorias.slice(0,4) : [{icon:'💪',texto:'Manter o ritmo atual e continuar evoluindo nas métricas já consolidadas'}]).map(m=>`
          <div style="display:flex;gap:8px;margin-bottom:9px;font-size:12px;line-height:1.5;">
            <span style="flex-shrink:0;">${m.icon}</span>
            <span style="color:var(--text);">${m.texto}</span>
          </div>`).join('')}
      </div>
    </div>

    <!-- Análise por zona de defesa -->
    <div style="background:var(--card-2);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:20px;">
      <div style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.8px;text-transform:uppercase;margin-bottom:14px;">🗺️ Distribuição por Zona</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
        ${[
          { zona:'Altas', val:defAlta, pct: totalDef>0?(defAlta/totalDef*100).toFixed(0):0, color:'#3B82F6' },
          { zona:'Centrais', val:defCentral, pct: totalDef>0?(defCentral/totalDef*100).toFixed(0):0, color:'#7B2FBE' },
          { zona:'Baixas', val:defBaixa, pct: totalDef>0?(defBaixa/totalDef*100).toFixed(0):0, color:'#00E676' },
        ].map(z=>`
          <div style="text-align:center;">
            <div style="font-size:9px;font-weight:600;color:var(--muted);letter-spacing:.5px;margin-bottom:6px;">${z.zona.toUpperCase()}</div>
            <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden;margin-bottom:6px;">
              <div style="height:100%;width:${z.pct}%;background:${z.color};border-radius:3px;transition:width .6s;"></div>
            </div>
            <div style="font-size:18px;font-weight:800;color:${z.color};">${z.val}</div>
            <div style="font-size:10px;color:var(--muted);">${z.pct}% das defesas</div>
          </div>`).join('')}
      </div>
      ${totalGols > 0 ? `<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border);font-size:11px;color:var(--muted);">
        <span style="font-weight:600;color:var(--text);">Gols sofridos por tipo: </span>
        Dentro da área: <strong>${golArea}</strong> · Fora: <strong>${golFora}</strong> · Pênalti: <strong>${golPen}</strong> · Falta: <strong>${golFalt}</strong>
      </div>` : ''}
    </div>

    <!-- Recomendações técnicas -->
    <div style="background:rgba(0,212,255,.04);border:1px solid rgba(0,212,255,.15);border-radius:12px;padding:16px;">
      <div style="font-size:11px;font-weight:700;color:var(--primary);letter-spacing:.8px;text-transform:uppercase;margin-bottom:12px;">📋 Recomendações Técnicas</div>
      ${recs.slice(0,5).map((r,i)=>`
        <div style="display:flex;gap:10px;margin-bottom:10px;font-size:12px;line-height:1.5;">
          <span style="width:20px;height:20px;border-radius:50%;background:var(--primary);color:#000;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">${i+1}</span>
          <span style="color:var(--text);">${r}</span>
        </div>`).join('')}
    </div>
  </div>`;

  document.getElementById('analise-title').textContent = `Análise — ${gk.nome}`;
  document.getElementById('analise-subtitle').textContent = `${gk.equipe||'Equipe não informada'} · ${gk.categoria||'Categoria não informada'}`;
  document.getElementById('analise-body').innerHTML = html;
  openModal('modal-analise');
}

function exportarAnalisePDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  const gkId = analiseGkId;
  const gk = gkId ? DB.goleiras.find(g=>g.id===gkId) : null;

  doc.setFillColor(7,7,15); doc.rect(0,0,210,297,'F');
  doc.setTextColor(238,238,248);
  doc.setFontSize(18); doc.setFont('helvetica','bold');
  doc.text('GK Hub — Análise de Desempenho', 15, 20);
  doc.setFontSize(11); doc.setFont('helvetica','normal'); doc.setTextColor(90,90,122);
  doc.text(gk ? `${gk.nome} · ${gk.equipe||'—'} · ${gk.categoria||'—'}` : '—', 15, 28);
  doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 15, 34);

  // Render the analise body as text using autoTable
  const scouts = gkId ? DB.scouts.filter(s=>s.goalkeeperId===gkId) : [];
  const sum = k => scouts.reduce((a,s)=>a+(+s[k]||0),0);
  const avgNota = gkId ? avgPerformance(gkId) : null;
  const totalDef = sum('dad')+sum('dae')+sum('dbd')+sum('dbe')+sum('dc')+sum('d1x1');
  const totalGols= sum('gda')+sum('gfa')+sum('gpe')+sum('gfl');
  const distCertas=sum('dpc')+sum('dmc'); const distTotal=distCertas+sum('dpe')+sum('dme');
  const taxaDef = (totalDef+totalGols)>0 ? totalDef/(totalDef+totalGols) : null;
  const taxaDist = distTotal>0 ? distCertas/distTotal : null;
  const nP = Math.max(1,[...new Set(scouts.map(s=>s.partidaId).filter(Boolean))].length||scouts.length);

  doc.autoTable({
    startY: 42,
    head:[['Métrica','Valor','Avaliação']],
    body:[
      ['Nota Geral', avgNota!==null?avgNota.toFixed(1)+'/10':'—', avgNota>=8.5?'Elite':avgNota>=7?'Excelente':avgNota>=5.5?'Boa':avgNota>=4?'Regular':'Em Desenvolvimento'],
      ['Taxa de Defesa', taxaDef!==null?(taxaDef*100).toFixed(0)+'%':'—', taxaDef>=.85?'Excelente':taxaDef>=.70?'Boa':taxaDef>=.55?'Regular':'A melhorar'],
      ['Precisão Distribuição', taxaDist!==null?(taxaDist*100).toFixed(0)+'%':'—', taxaDist>=.80?'Excelente':taxaDist>=.65?'Boa':'A melhorar'],
      ['Total Defesas', totalDef.toString(), (totalDef/nP).toFixed(1)+'/jogo'],
      ['Gols Sofridos', totalGols.toString(), (totalGols/nP).toFixed(1)+'/jogo'],
      ['Interceptações', sum('int').toString(), (sum('int')/nP).toFixed(1)+'/jogo'],
      ['Saídas', sum('sai').toString(), (sum('sai')/nP).toFixed(1)+'/jogo'],
      ['Partidas Analisadas', nP.toString(), scouts.length+' scout(s)'],
    ],
    styles:{ textColor:[238,238,248], fillColor:[19,19,36], lineColor:[30,30,58] },
    headStyles:{ fillColor:[0,212,255], textColor:[0,0,0], fontStyle:'bold' },
    alternateRowStyles:{ fillColor:[26,26,48] },
    theme:'grid'
  });
  doc.save(`analise_${gk?.nome?.replace(/\s+/g,'_')||'goleira'}_${new Date().toISOString().slice(0,10)}.pdf`);
  logReport({ type: 'analise', title: 'Análise de Desempenho — ' + (gk?.nome || 'goleira'), athlete: gk?.nome, athleteId: gk?.id });
  toast('PDF exportado!','success');
}

// ═══════════════════════════════════════════════════════════
// COMPARAÇÃO ENTRE GOLEIRAS
// ═══════════════════════════════════════════════════════════
let compChart = null;
function renderComparacao() {
  const idA = document.getElementById('comp-gk1')?.value;
  const idB = document.getElementById('comp-gk2')?.value;
  const result = document.getElementById('comp-result');
  const empty  = document.getElementById('comp-empty');
  if (!idA || !idB || idA === idB) { result.style.display='none'; empty.style.display='block'; return; }
  const gkA = DB.goleiras.find(g=>g.id===idA);
  const gkB = DB.goleiras.find(g=>g.id===idB);
  if (!gkA || !gkB) return;
  result.style.display='block'; empty.style.display='none';
  document.getElementById('comp-nome-a').textContent = gkA.nome;
  document.getElementById('comp-nome-b').textContent = gkB.nome;

  function gkStats(gkId) {
    const sc = DB.scouts.filter(s=>s.goalkeeperId===gkId);
    if (!sc.length) return null;
    const sum = k => sc.reduce((a,s)=>a+(+s[k]||0),0);
    const totalDef = sum('dad')+sum('dae')+sum('dbd')+sum('dbe')+sum('dc')+sum('d1x1');
    const totalGols = sum('gda')+sum('gfa')+sum('gpe')+sum('gfl');
    const distCerto = sum('dpc')+sum('dmc');
    const distTotal = distCerto+sum('dpe')+sum('dme');
    return {
      notaMedia: avgPerformance(gkId) ?? 0,
      taxaDefesa: totalDef+totalGols>0 ? Math.round(totalDef/(totalDef+totalGols)*100)/10 : 0,
      distAcc: distTotal>0 ? Math.round(distCerto/distTotal*100)/10 : 0,
      intPJ: sc.length>0 ? Math.round(sum('int')/sc.length*10)/10 : 0,
      esquPJ: sc.length>0 ? Math.round(sum('esq')/sc.length*10)/10 : 0,
      partidas: sc.length,
    };
  }
  const sA = gkStats(idA) || { notaMedia:0, taxaDefesa:0, distAcc:0, intPJ:0, esquPJ:0, partidas:0 };
  const sB = gkStats(idB) || { notaMedia:0, taxaDefesa:0, distAcc:0, intPJ:0, esquPJ:0, partidas:0 };

  const dims = [
    { label:'Nota Média', a:sA.notaMedia, b:sB.notaMedia, max:10 },
    { label:'Taxa Defesa (%×0.1)', a:sA.taxaDefesa, b:sB.taxaDefesa, max:10 },
    { label:'Precisão Dist. (%×0.1)', a:sA.distAcc, b:sB.distAcc, max:10 },
    { label:'Intercep./Jogo', a:sA.intPJ, b:sB.intPJ, max:Math.max(sA.intPJ,sB.intPJ,1)*1.2 },
    { label:'Esquadros/Jogo', a:sA.esquPJ, b:sB.esquPJ, max:Math.max(sA.esquPJ,sB.esquPJ,1)*1.2 },
    { label:'Partidas', a:sA.partidas, b:sB.partidas, max:Math.max(sA.partidas,sB.partidas,1)*1.2 },
  ];

  // Radar chart
  if (compChart) compChart.destroy();
  compChart = new Chart(document.getElementById('chart-comp-radar'), {
    type: 'radar',
    data: {
      labels: dims.map(d=>d.label),
      datasets: [
        { label:gkA.nome, data:dims.map(d=>d.a), borderColor:'#3B82F6', backgroundColor:'rgba(59,130,246,.15)', pointBackgroundColor:'#3B82F6' },
        { label:gkB.nome, data:dims.map(d=>d.b), borderColor:'#FFB300', backgroundColor:'rgba(255,179,0,.15)', pointBackgroundColor:'#FFB300' },
      ]
    },
    options: { responsive:true, maintainAspectRatio:false,
      scales:{ r:{ grid:{color:'#1E1E3A'}, ticks:{color:'#5A5A7A',backdropColor:'transparent'}, pointLabels:{color:'#5A5A7A',font:{size:10}} } },
      plugins:{ legend:{ labels:{color:'#E8E8F0',font:{size:11}} } } }
  });

  // Barras comparativas
  document.getElementById('comp-bars').innerHTML = dims.map(d => {
    const pctA = Math.round(d.a/d.max*100);
    const pctB = Math.round(d.b/d.max*100);
    const winner = d.a > d.b ? 'a' : d.b > d.a ? 'b' : '';
    return `<div style="margin-bottom:14px;">
      <div style="font-size:11px;color:var(--muted);text-align:center;margin-bottom:4px;">${d.label}</div>
      <div class="comp-row">
        <div>
          <div style="text-align:right;font-weight:${winner==='a'?700:400};color:${winner==='a'?'var(--primary)':'var(--text)'};">${d.a}</div>
          <div style="display:flex;justify-content:flex-end;margin-top:3px;">
            <div style="width:${pctA}%;max-width:100%;height:6px;border-radius:4px;background:var(--primary);"></div>
          </div>
        </div>
        <div style="text-align:center;font-size:10px;color:var(--muted);">vs</div>
        <div>
          <div style="font-weight:${winner==='b'?700:400};color:${winner==='b'?'var(--warning)':'var(--text)'};">${d.b}</div>
          <div style="margin-top:3px;">
            <div style="width:${pctB}%;max-width:100%;height:6px;border-radius:4px;background:var(--warning);"></div>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

  // Tabela detalhada
  const rows = [
    ['Partidas com scout', sA.partidas, sB.partidas],
    ['Nota média', sA.notaMedia, sB.notaMedia],
    ['Taxa de defesa', sA.taxaDefesa+'%', sB.taxaDefesa+'%'],
    ['Precisão distribuição', sA.distAcc+'%', sB.distAcc+'%'],
    ['Interceptações/jogo', sA.intPJ, sB.intPJ],
    ['Esquadros/jogo', sA.esquPJ, sB.esquPJ],
  ];
  document.getElementById('comp-table-detail').innerHTML = `
    <thead><tr><th>Métrica</th><th style="color:var(--primary);">${_esc(gkA.nome)}</th><th style="color:var(--warning);">${_esc(gkB.nome)}</th></tr></thead>
    <tbody>${rows.map(([m,a,b])=>{
      const aw=typeof a==='number'&&typeof b==='number'&&a>b;
      const bw=typeof a==='number'&&typeof b==='number'&&b>a;
      return `<tr><td>${m}</td><td style="font-weight:${aw?700:400};color:${aw?'var(--primary)':''};">${a}</td><td style="font-weight:${bw?700:400};color:${bw?'var(--warning)':''};">${b}</td></tr>`;
    }).join('')}</tbody>`;
}

// ═══════════════════════════════════════════════════════════
// HEATMAP INTELIGENTE
// ═══════════════════════════════════════════════════════════
function switchHmTab(btn, tabId) {
  document.querySelectorAll('.hm-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('#page-heatmap .tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  btn.classList.add('active');
  if (tabId === 'hm-distrib') renderDistribChart();
}

// ── Heatmap filter state ──────────────────────────────────
let hmPeriodo = 'all';

function populateHmFilters() {
  const partidas = DB.partidas;
  const gkId = document.getElementById('heatmap-gk')?.value || '';

  // Temporadas (anos distintos)
  const anos = [...new Set(partidas.map(p => (p.data||'').slice(0,4)).filter(Boolean))].sort((a,b)=>b-a);
  const selTemp = document.getElementById('hm-filter-temporada');
  const curTemp = selTemp?.value;
  if (selTemp) { selTemp.innerHTML = '<option value="">Todas</option>' + anos.map(a=>`<option value="${a}"${a===curTemp?' selected':''}>${a}</option>`).join(''); }

  // Competições
  const comps = [...new Set(partidas.map(p=>p.competicao).filter(Boolean))].sort();
  const selComp = document.getElementById('hm-filter-comp');
  const curComp = selComp?.value;
  if (selComp) { selComp.innerHTML = '<option value="">Todas</option>' + comps.map(c=>`<option value="${c}"${c===curComp?' selected':''}>${c}</option>`).join(''); }

  // Adversários (filtrados pela GK atual para relevância)
  let scouts = DB.scouts;
  if (gkId) scouts = scouts.filter(s=>s.goalkeeperId===gkId);
  const pIds = new Set(scouts.map(s=>s.partidaId).filter(Boolean));
  const advPartidas = partidas.filter(p=>pIds.size===0||pIds.has(p.id));
  const advs = [...new Set(advPartidas.map(p=>p.adversario).filter(Boolean))].sort();
  const selAdv = document.getElementById('hm-filter-adv');
  const curAdv = selAdv?.value;
  if (selAdv) { selAdv.innerHTML = '<option value="">Todos</option>' + advs.map(a=>`<option value="${a}"${a===curAdv?' selected':''}>${a}</option>`).join(''); }
}

function setHmPeriodo(val) {
  hmPeriodo = val;
  ['all','10','5'].forEach(v => {
    const btn = document.getElementById('hm-per-'+v);
    if (!btn) return;
    if (v === val) { btn.style.background='var(--card)'; btn.style.color='var(--text)'; }
    else           { btn.style.background='none';       btn.style.color='var(--muted)'; }
  });
  renderHeatmap();
}

function hmFilterChange() {
  populateHmFilters(); // re-populate adversários when GK changes
  renderHeatmap();
}

function limparFiltrosHm() {
  const ids = ['heatmap-gk','hm-filter-temporada','hm-filter-comp','hm-filter-adv'];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  setHmPeriodo('all');
}

function aggScoutsHeatmap() {
  const gkId    = document.getElementById('heatmap-gk')?.value || '';
  const temp    = document.getElementById('hm-filter-temporada')?.value || '';
  const comp    = document.getElementById('hm-filter-comp')?.value || '';
  const adv     = document.getElementById('hm-filter-adv')?.value || '';
  const partidas = DB.partidas;

  // Build filtered partida ID set
  let filteredPartidas = partidas;
  if (temp) filteredPartidas = filteredPartidas.filter(p=>(p.data||'').startsWith(temp));
  if (comp) filteredPartidas = filteredPartidas.filter(p=>p.competicao===comp);
  if (adv)  filteredPartidas = filteredPartidas.filter(p=>p.adversario===adv);

  // Apply período (últimos N) — sort by date desc and take first N
  if (hmPeriodo !== 'all') {
    const n = +hmPeriodo;
    filteredPartidas = [...filteredPartidas].sort((a,b)=>(b.data||'').localeCompare(a.data||'')).slice(0,n);
  }
  const pIds = new Set(filteredPartidas.map(p=>p.id));

  let scouts = DB.scouts;
  if (gkId) scouts = scouts.filter(s=>s.goalkeeperId===gkId);
  // Apply partida filters only if any active
  if (temp||comp||adv||hmPeriodo!=='all') {
    scouts = scouts.filter(s=>!s.partidaId||pIds.has(s.partidaId));
  }

  // Update summary badge
  const summary = document.getElementById('hm-filter-summary');
  if (summary) {
    const active = [];
    if (gkId) { const g=DB.goleiras.find(g=>g.id===gkId); if(g) active.push(`Goleira: <strong>${_esc(g.nome)}</strong>`); }
    if (temp) active.push(`Temporada: <strong>${_esc(temp)}</strong>`);
    if (comp) active.push(`Competição: <strong>${_esc(comp)}</strong>`);
    if (adv)  active.push(`Adversário: <strong>${_esc(adv)}</strong>`);
    if (hmPeriodo!=='all') active.push(`Período: <strong>últimos ${hmPeriodo} jogos</strong>`);
    if (active.length) {
      summary.innerHTML = `<span style="color:var(--primary);font-weight:600;margin-right:6px;">Filtros ativos:</span>${active.join(' · ')} <span style="color:var(--muted);margin-left:4px;">(${scouts.length} scout${scouts.length!==1?'s':''})</span>`;
      summary.style.display = 'block';
    } else {
      summary.style.display = 'none';
    }
  }

  return scouts;
}

function renderHeatmap() {
  populateHmFilters();
  // Segue a modalidade da goleira selecionada (a menos que o usuário escolha manualmente)
  const _gkId = document.getElementById('heatmap-gk')?.value;
  const _sel = document.getElementById('hm-modalidade');
  if (_sel && _gkId && !_hmModManual) {
    const _g = DB.goleiras.find(x => x.id === _gkId);
    if (_g) _sel.value = (_g.modalidade === 'beach') ? 'beach' : 'futsal';
  }
  const scouts = aggScoutsHeatmap();
  const sum = k => scouts.reduce((a,s)=>a+(+s[k]||0),0);

  const defGrid = [
    [sum('dae'), sum('dad'), 0],
    [sum('dbe')+sum('dc'), sum('int'), sum('esq')],
    [sum('dbd'), sum('posd')+sum('pose'), 0],
  ];
  const golGrid = [
    [Math.round(sum('gda')*0.4), Math.round(sum('gfa')*0.5), 0],
    [Math.round(sum('gda')*0.2), sum('gpe'), sum('gfl')],
    [Math.round(sum('gda')*0.4), Math.round(sum('gfa')*0.5), 0],
  ];
  // Chutes recebidos = defesas + gols por zona
  const chutesGrid = defGrid.map((row,r) => row.map((v,c) => v + golGrid[r][c]));

  const beach = _hmModalidade() === 'beach';
  const bands = beach ? ['Aéreo / voleio', 'Meia altura', 'Rasteiro'] : ['Alto', 'Médio', 'Rasteiro'];
  drawCourt('court-chutes', chutesGrid, '139,92,246', bands);
  drawCourt('court-defesas', defGrid, '59,130,246', bands);
  drawCourt('court-gols', golGrid, '239,68,68', bands);
  renderDistribChart(scouts);

  // Resumo — especializado por modalidade
  const chutes = sum('dad')+sum('dae')+sum('dbd')+sum('dbe')+sum('dc')+sum('d1x1')+sum('gda')+sum('gfa')+sum('gpe')+sum('gfl');
  const aereas = sum('dad')+sum('dae'), maoC = sum('dmc'), maoT = maoC+sum('dme'), peC = sum('dpc'), peT = peC+sum('dpe');
  const pct = (n,d) => d>0 ? Math.round(n/d*100)+'%' : '—';
  let stats;
  if (beach) {
    // Beach: jogo aéreo + o goleiro é a "primeira linha de ataque" (arremesso/mão)
    stats = [
      ['Chutes recebidos', chutes],
      ['Defesas aéreas (topo)', aereas],
      ['% chutes na faixa aérea', pct(aereas + sum('gfa'), chutes)],
      ['Gols de fora / longa distância', sum('gfa')],
      ['Distribuição por ARREMESSO (mão) — volume', maoT],
      ['Distribuição por arremesso — precisão', pct(maoC, maoT)],
      ['Distribuição por pé — precisão', pct(peC, peT)],
      ['Interceptações / saídas', sum('int')+sum('sai')],
    ];
  } else {
    stats = [
      ['Chutes Recebidos', chutes],
      ['Defesas Altas', aereas],
      ['Defesas Baixas', sum('dbd')+sum('dbe')],
      ['Defesa Central', sum('dc')],
      ['Interceptações', sum('int')],
      ['Esquadros', sum('esq')],
      ['Gols Dentro da Área', sum('gda')],
      ['Gols Fora da Área', sum('gfa')],
      ['Distribuição por pé — precisão', pct(peC, peT)],
      ['Distribuição por mão — precisão', pct(maoC, maoT)],
    ];
  }
  document.getElementById('heatmap-summary').innerHTML =
    (beach ? '<div style="font-size:11px;color:var(--warning);margin-bottom:8px;">🏖️ Beach soccer: destaque para o jogo aéreo/voleio e a distribuição por arremesso (o goleiro é a 1ª linha de ataque).</div>' : '')
    + `<table><thead><tr><th>Métrica</th><th>Total</th></tr></thead><tbody>${stats.map(([k,v])=>`<tr><td>${k}</td><td><strong>${v}</strong></td></tr>`).join('')}</tbody></table>`;
}

function renderDistribChart(scouts) {
  const sc = scouts || aggScoutsHeatmap();
  const sum = k => sc.reduce((a,s)=>a+(+s[k]||0),0);
  const dpc=sum('dpc'), dpe=sum('dpe'), dmc=sum('dmc'), dme=sum('dme');
  const totalPe=dpc+dpe, totalMao=dmc+dme;
  const detail = document.getElementById('distrib-detail');
  if (!detail) return;
  if (dpc+dpe+dmc+dme === 0) {
    detail.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:8px 0;">Sem dados de distribuição.</p>';
    return;
  }
  const beach = _hmModalidade() === 'beach';
  const pe = { title:'Pé', certo:dpc, errado:dpe, total:totalPe };
  const mao = { title: beach ? 'Mão (arremesso)' : 'Mão', certo:dmc, errado:dme, total:totalMao };
  // Beach soccer: o arremesso (mão) é a principal arma de ataque → vem primeiro
  const sections = beach ? [mao, pe] : [pe, mao];
  const note = beach ? '<div style="font-size:11px;color:var(--warning);margin-bottom:12px;">🏖️ No beach soccer o arremesso longo (mão) é a principal forma de iniciar o ataque — priorize alcance e precisão.</div>' : '';
  detail.innerHTML = note + sections.map(s => {
    const acc = s.total > 0 ? Math.round(s.certo/s.total*100) : 0;
    const color = acc >= 70 ? 'var(--success)' : acc >= 50 ? 'var(--warning)' : 'var(--error)';
    return `<div style="margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-weight:600;font-size:14px;">${s.title}</span>
        <span style="font-size:18px;font-weight:800;color:${color};">${acc}% <small style="font-size:12px;font-weight:400;color:var(--muted);">precisão</small></span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div style="background:rgba(0,200,83,.1);border:1px solid rgba(0,200,83,.3);border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:var(--success);">${s.certo}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">Certas</div>
        </div>
        <div style="background:rgba(255,61,87,.1);border:1px solid rgba(255,61,87,.3);border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:var(--error);">${s.errado}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">Erradas</div>
        </div>
      </div>
      <div style="margin-top:8px;height:8px;border-radius:4px;background:var(--border);overflow:hidden;">
        <div style="width:${acc}%;height:100%;background:${color};border-radius:4px;transition:width .4s;"></div>
      </div>
    </div>`;
  }).join('<hr style="border-color:var(--border);margin:4px 0 16px;">');
}
function _hmModalidade() { return document.getElementById('hm-modalidade')?.value === 'beach' ? 'beach' : 'futsal'; }
let _hmModManual = false;
function hmModalidadeChange() { _hmModManual = true; renderHeatmap(); }
function hmGkChange() { _hmModManual = false; hmFilterChange(); } // ao trocar de goleira, volta a seguir a modalidade dela
function drawCourt(id, grid, rgb, bands) {
  const court = document.getElementById(id);
  if (!court) return;
  const beach = _hmModalidade() === 'beach';
  court.classList.toggle('hm-beach', beach);
  const max = Math.max(1, ...grid.flat());
  let html = `<div class="hm-goal left"></div><div class="hm-goal right"></div><div class="hm-grid">`;
  for (let r=0;r<3;r++) for (let c=0;c<3;c++) {
    const v = grid[r][c];
    const intensity = v/max;
    let bg = v>0 ? `rgba(${rgb},${0.15+intensity*0.7})` : 'transparent';
    // Beach soccer: realça a faixa aérea (topo), onde vive o voleio/bicicleta
    if (beach && r === 0 && v === 0) bg = 'rgba(245,200,110,.07)';
    const lbl = (bands && c === 1) ? `<span class="lbl">${bands[r]}</span>` : '';
    html += `<div class="hm-cell" style="background:${bg};">${v>0?v:''}${lbl}</div>`;
  }
  html += `</div>`;
  court.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════
// PDF REPORTS
// ═══════════════════════════════════════════════════════════
function pdfHeader(doc, title) {
  const _clb = (function(){ try { return JSON.parse(localStorage.getItem('gkhub_club_settings')||'{}'); } catch(e){ return {}; } })();
  doc.setFillColor(13,13,26);
  doc.rect(0,0,210,28,'F');
  doc.setTextColor(0,212,255);
  doc.setFontSize(20); doc.setFont(undefined,'bold');
  doc.text(_clb.display || _clb.nome || 'GK Hub', 14, 14);
  doc.setTextColor(180,180,200);
  doc.setFontSize(9); doc.setFont(undefined,'normal');
  doc.text([_clb.cidade, _clb.estado].filter(Boolean).join(' / ') || 'Goalkeeper Performance Platform', 14, 21);
  doc.setTextColor(40,40,40);
  doc.setFontSize(14); doc.setFont(undefined,'bold');
  doc.text(title, 14, 40);
  doc.setFontSize(9); doc.setFont(undefined,'normal'); doc.setTextColor(120,120,120);
  doc.text('Gerado em ' + new Date().toLocaleString('pt-BR'), 14, 46);
}
function pdfGeral() {
  if (!window.jspdf) { toast('Biblioteca PDF não carregada','error'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  pdfHeader(doc, 'Relatório Geral');
  const goleiras = DB.goleiras;
  if (!goleiras.length) { toast('Nenhuma goleira cadastrada','error'); return; }
  const rows = goleiras.map(g => {
    const avg = avgPerformance(g.id); const { label } = classifyPerf(avg);
    return [g.nome, g.equipe||'-', g.categoria||'-', avg!==null?avg:'-', avg!==null?label:'-'];
  });
  doc.autoTable({ startY: 52, head: [['Goleira','Equipe','Categoria','Nota','Classificação']], body: rows,
    headStyles: { fillColor: [30,30,53], textColor: [0,212,255] }, styles: { fontSize: 9 } });
  doc.setFontSize(11); doc.setFont(undefined,'bold'); doc.setTextColor(40,40,40);
  doc.text('Resumo', 14, doc.lastAutoTable.finalY + 12);
  doc.autoTable({ startY: doc.lastAutoTable.finalY + 16,
    body: [['Total de goleiras', goleiras.length],['Partidas', DB.partidas.length],['Scouts', DB.scouts.length]],
    styles: { fontSize: 9 } });
  doc.save('gkhub_relatorio_geral.pdf');
  logReport({ type: 'geral', title: 'Relatório Geral do Elenco' });
  toast('PDF gerado!','success');
  if (loadPreferences().notifPdf) _sendNotif('PDF gerado', 'Relatório Geral exportado', 'pdf');
}
function pdfIndividual() {
  const gkId = document.getElementById('pdf-gk-select').value;
  if (!gkId) { toast('Selecione uma goleira','error'); return; }
  const gk = DB.goleiras.find(g=>g.id===gkId);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  pdfHeader(doc, 'Relatório Individual — ' + gk.nome);
  const scouts = _mergeScouts(DB.scouts.filter(s=>s.goalkeeperId===gkId));
  const avg = avgPerformance(gkId); const { label } = classifyPerf(avg);
  doc.autoTable({ startY: 52, head: [['Dado','Valor']], body: [
    ['Nome', gk.nome],['Equipe', gk.equipe||'-'],['Categoria', gk.categoria||'-'],
    ['Modalidade', gk.modalidade==='beach'?'Beach Soccer':'Futsal'],
    ['Naipe', gk.naipe ? (gk.naipe==='masculino'?'Masculino':'Feminino') : '-'],
    ['Altura', gk.altura?gk.altura+' cm':'-'],['Peso', gk.peso?gk.peso+' kg':'-'],
    ['Pé dominante', gk.pe||'-'],['Performance média', avg!==null?avg+' ('+label+')':'sem dados'],
    ['IGD — Índice Global', (()=>{ const i=computeIGD(gk.id); return i.score!=null? i.score+' / 100' : 'sem dados'; })()],
    ['Partidas com scout', scouts.length],
  ], headStyles: { fillColor: [30,30,53], textColor: [0,212,255] }, styles: { fontSize: 9 } });
  if (scouts.length) {
    const sum = (k)=>scouts.reduce((a,s)=>a+(+s[k]||0),0);
    doc.text('Estatísticas acumuladas', 14, doc.lastAutoTable.finalY + 12);
    doc.autoTable({ startY: doc.lastAutoTable.finalY + 16, head: [['Métrica','Total']], body: [
      ['Defesas Altas', sum('dad')+sum('dae')],['Defesas Baixas', sum('dbd')+sum('dbe')],
      ['Defesa Central', sum('dc')],['Interceptações', sum('int')],['Esquadros', sum('esq')],
      ['Gols sofridos', sum('gda')+sum('gfa')+sum('gpe')+sum('gfl')],
    ], headStyles: { fillColor: [30,30,53], textColor: [0,212,255] }, styles: { fontSize: 9 } });
  }
  doc.save('gkhub_'+gk.nome.replace(/\s/g,'_')+'.pdf');
  logReport({ type: 'individual', title: 'Relatório Individual — ' + gk.nome, athlete: gk.nome, athleteId: gk.id });
  toast('PDF gerado!','success');
  if (loadPreferences().notifPdf) _sendNotif('PDF gerado', `Relatório de ${gk.nome} exportado`, 'pdf');
}
function pdfPartidas() {
  const partidas = DB.partidas;
  if (!partidas.length) { toast('Nenhuma partida registrada','error'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  pdfHeader(doc, 'Relatório de Partidas');
  const gkMap = Object.fromEntries(DB.goleiras.map(g=>[g.id,g.nome]));
  const rows = [...partidas].sort((a,b)=>(b.data||'').localeCompare(a.data||'')).map(p => {
    const hasScore = p.gf !== undefined && p.gc !== undefined;
    const r = hasScore ? (p.gf>p.gc?'V':p.gf<p.gc?'D':'E') : '—';
    const score = hasScore ? `${r} ${p.gf}×${p.gc}` : '—';
    return [p.data?formatDate(p.data):'-', p.adversario, p.competicao||'-', gkMap[p.goalkeeperId]||'-', score];
  });
  doc.autoTable({ startY: 52, head: [['Data','Adversário','Competição','Goleira','Resultado']], body: rows,
    headStyles: { fillColor: [30,30,53], textColor: [0,212,255] }, styles: { fontSize: 9 } });
  doc.save('gkhub_partidas.pdf');
  logReport({ type: 'partidas', title: 'Relatório de Partidas' });
  toast('PDF gerado!','success');
  if (loadPreferences().notifPdf) _sendNotif('PDF gerado', 'Relatório de Partidas exportado', 'pdf');
}

function updateCompSelect() {
  const comps = [...new Set(DB.partidas.map(p => p.competicao || '').filter(Boolean))].sort();
  const el = document.getElementById('pdf-comp-select');
  if (!el) return;
  el.innerHTML = '<option value="">Selecione a competição…</option>' +
    comps.map(c => `<option value="${c}">${c}</option>`).join('');
}

function updatePdfSelects() {
  const el = document.getElementById('pdf-gk-select');
  if (!el) return;
  el.innerHTML = '<option value="">Selecione a goleira…</option>' +
    DB.goleiras.map(g => `<option value="${g.id}">${_esc(g.nome)}</option>`).join('');
}

function pdfCompeticao() {
  const comp = document.getElementById('pdf-comp-select').value;
  if (!comp) { toast('Selecione uma competição', 'error'); return; }
  const partidas = DB.partidas.filter(p => (p.competicao || '') === comp);
  if (!partidas.length) { toast('Nenhuma partida nesta competição', 'error'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  pdfHeader(doc, 'Relatório — ' + comp);
  const goleiras = DB.goleiras;
  const gkMap = Object.fromEntries(goleiras.map(g => [g.id, g.nome]));
  const scouts = DB.scouts;

  // ── Tabela de partidas ──
  doc.setFontSize(11); doc.setFont(undefined,'bold'); doc.setTextColor(40,40,40);
  doc.text('Partidas', 14, 52);
  const rowsP = [...partidas].sort((a,b) => (a.data||'').localeCompare(b.data||'')).map(p => {
    const gkNome = gkMap[p.goalkeeperId] || '—';
    const gk2Nome = p.gk2Id ? (gkMap[p.gk2Id] || '—') : '';
    const gkCell = gk2Nome ? `${gkNome} (${p.periodo1||'1ºT'}) / ${gk2Nome} (${p.periodo2||'2ºT'})` : gkNome;
    const r = p.gf > p.gc ? 'V' : p.gf < p.gc ? 'D' : 'E';
    const ptScouts = scouts.filter(s => s.partidaId === p.id);
    const def = ptScouts.reduce((a,s) => a+(+s.dad||0)+(+s.dae||0)+(+s.dbd||0)+(+s.dbe||0)+(+s.dc||0), 0);
    return [p.data ? formatDate(p.data) : '—', p.adversario, gkCell, `${r} ${p.gf}×${p.gc}`, def || '—', p.gc ?? '—'];
  });
  doc.autoTable({
    startY: 56,
    head: [['Data','Adversário','Goleira(s)','Resultado','Defesas','G. Sofr.']],
    body: rowsP,
    headStyles: { fillColor: [30,30,53], textColor: [0,212,255] },
    styles: { fontSize: 8 },
    columnStyles: { 2: { cellWidth: 60 } }
  });

  // ── Performance das goleiras nesta competição ──
  const gkIds = [...new Set([
    ...partidas.map(p => p.goalkeeperId).filter(Boolean),
    ...partidas.map(p => p.gk2Id).filter(Boolean)
  ])];
  const rowsGK = gkIds.map(gkId => {
    const gk = goleiras.find(g => g.id === gkId);
    if (!gk) return null;
    const ptIds = partidas.filter(p => p.goalkeeperId === gkId || p.gk2Id === gkId).map(p => p.id);
    const sc = _mergeScouts(scouts.filter(s => s.goalkeeperId === gkId && ptIds.includes(s.partidaId)));
    const notas = sc.map(calcPerformance).filter(n => n !== null);
    const avg = notas.length ? Math.round((notas.reduce((a,b)=>a+b,0)/notas.length)*10)/10 : null;
    const { label } = classifyPerf(avg);
    const totalDef = sc.reduce((a,s)=>a+(+s.dad||0)+(+s.dae||0)+(+s.dbd||0)+(+s.dbe||0)+(+s.dc||0),0);
    const totalGols = sc.reduce((a,s)=>a+(+s.gda||0)+(+s.gfa||0)+(+s.gpe||0)+(+s.gfl||0),0);
    return [gk.nome, ptIds.length, sc.length, totalDef, totalGols, avg ?? '—', avg ? label : '—'];
  }).filter(Boolean);

  if (rowsGK.length) {
    const y = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(11); doc.setFont(undefined,'bold'); doc.setTextColor(40,40,40);
    doc.text('Performance das Goleiras nesta Competição', 14, y);
    doc.autoTable({
      startY: y + 4,
      head: [['Goleira','Partidas','Scouts','Defesas','G. Sofr.','Nota Média','Classificação']],
      body: rowsGK,
      headStyles: { fillColor: [30,30,53], textColor: [0,212,255] },
      styles: { fontSize: 8 }
    });
  }

  // ── Resumo ──
  const totalJogos = partidas.length;
  const vitorias = partidas.filter(p => p.gf > p.gc).length;
  const derrotas = partidas.filter(p => p.gf < p.gc).length;
  const empates  = partidas.filter(p => p.gf === p.gc).length;
  const y2 = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(11); doc.setFont(undefined,'bold'); doc.setTextColor(40,40,40);
  doc.text('Resumo da Competição', 14, y2);
  doc.autoTable({
    startY: y2 + 4,
    body: [
      ['Partidas disputadas', totalJogos],
      ['Vitórias', vitorias], ['Empates', empates], ['Derrotas', derrotas],
      ['Aproveitamento', totalJogos ? Math.round(((vitorias + empates*0.5)/totalJogos)*100)+'%' : '—'],
    ],
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold' } }
  });

  doc.save('gkhub_' + comp.replace(/\s+/g,'_') + '.pdf');
  logReport({ type: 'competicao', title: 'Relatório — ' + comp, competition: comp });
  toast('PDF gerado!','success');
  if (loadPreferences().notifPdf) _sendNotif('PDF gerado', `Relatório de ${comp} exportado`, 'pdf');
}

// ═══════════════════════════════════════════════════════════
// MATCH CENTER — Central de Análise Profissional
// ═══════════════════════════════════════════════════════════
const MC_FIELDS = ['dad','dae','dbd','dbe','dc','d1x1','esq','gda','gfa','gpe','gfl','dpc','dpe','dmc','dme','int','pose','posd','sai'];
let mcData = {};
let mcLog = [];
let mcTimerInterval = null;
let mcSeconds = 0;
let mcRunning = false;
let mcPeriodo = 1;
let mcPlacar = { nos: 0, adv: 0 };
let mcGkSegmentos = [];
// Enhanced state
let mcNotaAtual = 7.0;
let mcNotaHistory = [];   // [{sec, nota}]
let mcStreak = 0;
let mcMaxStreak = 0;
let mcMaxNota = 7.0;
let mcMinNota = 7.0;
let mcLastGolSec = null;
let mcMaxSemGolSec = 0;
let mcMapMode = 'def';
let mcMomentumChart = null;
let mcMomentumOpen = false;
let mcCurrentReportSegs = null;
// Timeline de Desempenho
let mcTimelineChart = null;
let mcTimelineOpen = false;
let mcPosStreak = 0;
let mcNegStreak = 0;
let mcMaxPosStreak = 0;
let mcMaxNegStreak = 0;
let mcBestNotaSec = 0;
let mcWorstNotaSec = 0;
// Pending data for post-game modal
let mcPendingSegmentos = null;
let mcPendingPId = null;
// Tempo Técnico
let mcTTInterval = null;
let mcTTSeconds = 0;
let mcTTWasRunning = false;

const MC_NOTA_PESOS = {
  dad:+0.20, dae:+0.20,            // defesa difícil
  dbd:+0.05, dbe:+0.05, dc:+0.05,  // defesa simples
  d1x1:+0.25,                       // defesa 1x1
  esq:+0.25,                        // esquadro
  dpc:+0.05, dmc:+0.05,             // distribuição correta
  dpe:-0.10, dme:-0.10,             // distribuição errada
  gda:-0.20, gfa:-0.20, gpe:-0.20, gfl:-0.20, // gol sofrido
  int:+0.10, sai:+0.10,             // interceptação / saída correta
  pose:+0.05, posd:+0.05            // posicionamento
};

const MC_ICONS = {
  def:'🧤', gol:'⚽', dist:'🎯', out:'🛡️',
  sub:'🔄', periodo:'─', 'placar-nos':'⚽', 'placar-adv':'⚽', tt:'⏱'
};

const MC_TIPO_ICONS = {
  dad:'🧤', dae:'🧤', dbd:'🧤', dbe:'🧤', dc:'🧤', d1x1:'🥊', esq:'💥',
  gda:'⚽', gfa:'⚽', gpe:'⚽', gfl:'⚽',
  dpc:'🎯', dpe:'❌', dmc:'🎯', dme:'❌',
  int:'🛡️', sai:'🏃', pose:'📍', posd:'📍'
};

function mcReset() {
  MC_FIELDS.forEach(f => mcData[f] = 0);
  mcLog = []; mcSeconds = 0; mcRunning = false;
  mcPeriodo = 1; mcPlacar = { nos:0, adv:0 };
  mcGkSegmentos = [];
  mcNotaAtual = 7.0; mcNotaHistory = [];
  mcStreak = 0; mcMaxStreak = 0;
  mcMaxNota = 7.0; mcMinNota = 7.0;
  mcLastGolSec = null; mcMaxSemGolSec = 0;
  mcMapMode = 'def';
  mcMomentumOpen = false;
  mcTimelineOpen = false;
  mcPosStreak = 0; mcNegStreak = 0; mcMaxPosStreak = 0; mcMaxNegStreak = 0;
  mcBestNotaSec = 0; mcWorstNotaSec = 0;
  mcCurrentReportSegs = null; mcPendingSegmentos = null; mcPendingPId = null;
  mcTTSeconds = 0; mcTTWasRunning = false;
  if (mcTimerInterval) { clearInterval(mcTimerInterval); mcTimerInterval = null; }
  if (mcTTInterval) { clearInterval(mcTTInterval); mcTTInterval = null; }
  if (mcMomentumChart) { mcMomentumChart.destroy(); mcMomentumChart = null; }
  if (mcTimelineChart) { mcTimelineChart.destroy(); mcTimelineChart = null; }
}
mcReset();

function mcPopulateSelects() {
  const goleiras = DB.goleiras;
  const partidas = DB.partidas;
  const opts = `<option value="">Selecionar…</option>` + goleiras.map(g=>`<option value="${g.id}">${_esc(g.nome)}</option>`).join('');
  ['mc-goleira'].forEach(id => { const el=document.getElementById(id); if(el){el.innerHTML=opts;} });
  const pEl = document.getElementById('mc-partida');
  if (pEl) pEl.innerHTML = `<option value="">Selecionar…</option>` +
    [...partidas].sort((a,b)=>(b.data||'').localeCompare(a.data||'')).map(p =>
      `<option value="${p.id}">${_esc(p.adversario)}${p.data?' ('+formatDate(p.data)+')':''}</option>`).join('');
}

function mcOnPartidaChange() {
  const pId = document.getElementById('mc-partida')?.value;
  const p = DB.partidas.find(x=>x.id===pId);
  const advLbl = document.getElementById('mc-adv-label');
  if (p) {
    if (advLbl) advLbl.textContent = p.adversario;
    mcPlacar.nos = p.gf ?? 0; mcPlacar.adv = p.gc ?? 0;
    const el = id => document.getElementById(id);
    if (el('mc-score-nos')) el('mc-score-nos').textContent = mcPlacar.nos;
    if (el('mc-score-adv')) el('mc-score-adv').textContent = mcPlacar.adv;
    if (p.goalkeeperId) { const sel=document.getElementById('mc-goleira'); if(sel) sel.value=p.goalkeeperId; }
  } else { if (advLbl) advLbl.textContent = 'Adversário'; }
}

function mcFormatTime(sec) {
  const m=String(Math.floor(sec/60)).padStart(2,'0');
  const s=String(sec%60).padStart(2,'0');
  return m+':'+s;
}

function mcToggleTimer() {
  const btn=document.getElementById('mc-btn-timer');
  const dot=document.getElementById('mc-status-dot');
  const btn2t=document.getElementById('mc-btn-2t');
  if (mcRunning) {
    clearInterval(mcTimerInterval); mcTimerInterval=null; mcRunning=false;
    if (btn) btn.innerHTML='▶ Continuar';
    if (dot) { dot.style.background='var(--warning)'; dot.style.animation=''; }
    if (btn2t && mcPeriodo===1) btn2t.style.display='inline-flex';
  } else {
    mcRunning=true;
    if (btn) btn.innerHTML='⏸ Pausar';
    if (dot) { dot.style.background='var(--error)'; dot.style.animation='none'; }
    if (btn2t) btn2t.style.display='none';
    mcTimerInterval=setInterval(()=>{
      mcSeconds++;
      const el=document.getElementById('mc-timer');
      if(el) el.textContent=mcFormatTime(mcSeconds);
      // Track sem gol time
      if (mcLastGolSec !== null) {
        const delta = mcSeconds - mcLastGolSec;
        if (delta > mcMaxSemGolSec) mcMaxSemGolSec = delta;
      }
    },1000);
  }
}

function mcEvento(key, label, tipo) {
  mcData[key] = (mcData[key]||0)+1;
  const timeStr = mcFormatTime(mcSeconds);
  mcLog.unshift({ key, label, tipo, time:timeStr, periodo:mcPeriodo, sec:mcSeconds });
  mcUpdateCounters();
  mcUpdateLog();
  mcUpdateNota(key);
  mcUpdateStreak(key, tipo);
  mcUpdateHighlights();
  mcCheckAlerts();
  mcUpdateEventMap();
  mcUpdatePeriodStats();
  // Button flash
  const undoBtn=document.getElementById('mc-btn-undo');
  if (undoBtn) { undoBtn.disabled=false; undoBtn.style.opacity='1'; }
}

function mcDesfazer() {
  if (!mcLog.length) return;
  const last=mcLog.shift();
  if (mcData[last.key] > 0) mcData[last.key]--;
  mcUpdateCounters();
  mcUpdateLog();
  // Recalc nota from scratch
  mcNotaAtual = mcCalcNota();
  mcUpdateNotaUI();
  mcUpdateStreak(null, null);
  mcUpdateHighlights();
  mcUpdateEventMap();
  mcUpdatePeriodStats();
  toast(`Desfeito: ${last.label}`,'info');
  const undoBtn=document.getElementById('mc-btn-undo');
  if (undoBtn && !mcLog.length) { undoBtn.disabled=true; undoBtn.style.opacity='.5'; }
}

function mcUpdateCounters() {
  const def=(mcData.dad||0)+(mcData.dae||0)+(mcData.dbd||0)+(mcData.dbe||0)+(mcData.dc||0)+(mcData.d1x1||0)+(mcData.esq||0);
  const gol=(mcData.gda||0)+(mcData.gfa||0)+(mcData.gpe||0)+(mcData.gfl||0);
  const dist=(mcData.dpc||0)+(mcData.dpe||0)+(mcData.dmc||0)+(mcData.dme||0);
  const int_=mcData.int||0;
  const el=id=>document.getElementById(id);
  if(el('mc-c-def'))    el('mc-c-def').textContent=def;
  if(el('mc-c-gol'))    el('mc-c-gol').textContent=gol;
  if(el('mc-c-dist'))   el('mc-c-dist').textContent=dist;
  if(el('mc-c-int'))    el('mc-c-int').textContent=int_;
  if(el('mc-c-streak')) el('mc-c-streak').textContent=mcStreak;
}

function mcUpdateLog() {
  const el=document.getElementById('mc-log');
  if (!el) return;
  const countEl=document.getElementById('mc-event-count');
  const realEvents=mcLog.filter(e=>e.tipo!=='periodo');
  if(countEl) countEl.textContent=`${realEvents.length} evento${realEvents.length!==1?'s':''}`;
  if (!mcLog.length) {
    el.innerHTML='<div style="color:var(--muted);text-align:center;padding:20px 0;font-size:13px;">Nenhum evento registrado</div>';
    return;
  }
  const typeColors={def:'rgba(59,130,246,.15)',gol:'rgba(239,68,68,.15)',dist:'rgba(245,158,11,.15)',out:'rgba(16,185,129,.15)',sub:'rgba(245,158,11,.15)','placar-nos':'rgba(16,185,129,.15)','placar-adv':'rgba(239,68,68,.15)',tt:'rgba(167,139,250,.15)'};
  const borderColors={def:'rgba(59,130,246,.4)',gol:'rgba(239,68,68,.4)',dist:'rgba(245,158,11,.4)',out:'rgba(16,185,129,.4)',sub:'rgba(245,158,11,.4)','placar-nos':'rgba(16,185,129,.4)','placar-adv':'rgba(239,68,68,.4)',tt:'rgba(167,139,250,.4)'};
  el.innerHTML=mcLog.slice(0,60).map((e,i)=>{
    if (e.tipo==='periodo') return `<div style="text-align:center;padding:6px 0;font-size:10px;font-weight:700;color:var(--muted);letter-spacing:1px;">${e.label}</div>`;
    const icon=MC_TIPO_ICONS[e.key]||MC_ICONS[e.tipo]||'●';
    const bg=typeColors[e.tipo]||'rgba(255,255,255,.05)';
    const bc=borderColors[e.tipo]||'var(--border)';
    const ptBadge=e.periodo?`<span style="font-size:9px;font-weight:700;background:${e.periodo===1?'rgba(59,130,246,.12)':'rgba(245,158,11,.12)'};color:${e.periodo===1?'var(--primary)':'var(--warning)'};border-radius:3px;padding:1px 4px;">${e.periodo}T</span>`:'';
    return `<div class="mc-timeline-item" title="${e.label} @ ${e.time}" style="opacity:${i===0?1:Math.max(0.45,1-i*0.04)}">
      <div class="mc-timeline-icon" style="background:${bg};border:1px solid ${bc};">${icon}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:${i===0?700:500};font-size:12px;line-height:1.3;">${e.label}</div>
        <div style="display:flex;gap:6px;align-items:center;margin-top:2px;">
          <span style="color:var(--muted);font-size:10px;font-variant-numeric:tabular-nums;">${e.time}</span>
          ${ptBadge}
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── Nota ao Vivo ────────────────────────────────────────────
function mcCalcNota() {
  let nota = 7.0;
  // Process events in chronological order (log is reversed)
  [...mcLog].reverse().forEach(e => {
    const peso = MC_NOTA_PESOS[e.key];
    if (peso !== undefined) nota += peso;
  });
  return Math.max(0, Math.min(10, nota));
}

function mcUpdateNota(key) {
  if (key && MC_NOTA_PESOS[key] !== undefined) {
    mcNotaAtual = Math.max(0, Math.min(10, mcNotaAtual + MC_NOTA_PESOS[key]));
    const peso = MC_NOTA_PESOS[key];
    if (peso > 0) {
      mcPosStreak++; mcNegStreak = 0;
      if (mcPosStreak > mcMaxPosStreak) mcMaxPosStreak = mcPosStreak;
    } else if (peso < 0) {
      mcNegStreak++; mcPosStreak = 0;
      if (mcNegStreak > mcMaxNegStreak) mcMaxNegStreak = mcNegStreak;
    }
  } else {
    mcNotaAtual = mcCalcNota();
  }
  if (mcNotaAtual > mcMaxNota) { mcMaxNota = mcNotaAtual; mcBestNotaSec = mcSeconds; }
  if (mcNotaAtual < mcMinNota) { mcMinNota = mcNotaAtual; mcWorstNotaSec = mcSeconds; }
  mcNotaHistory.push({ sec:mcSeconds, nota:mcNotaAtual });
  mcUpdateNotaUI();
  if (mcMomentumOpen) mcRenderMomentum();
  if (mcTimelineOpen) mcRenderTimeline();
}

function mcUpdateNotaUI() {
  const valEl=document.getElementById('mc-nota-val');
  const ringEl=document.getElementById('mc-nota-ring');
  const trendEl=document.getElementById('mc-nota-trend');
  if (!valEl) return;
  valEl.textContent=mcNotaAtual.toFixed(1);
  const color=mcNotaAtual>=8.5?'#34D399':mcNotaAtual>=7?'var(--primary)':mcNotaAtual>=5?'var(--warning)':'var(--error)';
  if(valEl) valEl.style.color=color;
  if(ringEl) { ringEl.style.borderColor=color; ringEl.style.color=color; }
  // Trend: sum of last 3 event weights
  const recentPesos=mcLog.slice(0,4).map(e=>MC_NOTA_PESOS[e.key]||0).reduce((a,b)=>a+b,0);
  const trendText=recentPesos>=0.15?'↗ Crescendo':recentPesos<=-0.15?'↘ Em queda':'→ Estável';
  const trendColor=recentPesos>=0.15?'#34D399':recentPesos<=-0.15?'var(--error)':'var(--muted)';
  if(trendEl) { trendEl.textContent=trendText; trendEl.style.color=trendColor; }
}

// ── Streak tracking ─────────────────────────────────────────
function mcUpdateStreak(key, tipo) {
  if (tipo==='def') {
    mcStreak++;
    if (mcStreak>mcMaxStreak) mcMaxStreak=mcStreak;
  } else if (tipo==='gol') {
    mcStreak=0;
    mcLastGolSec=mcSeconds;
  } else if (!key) {
    // Recalc streak from log
    mcStreak=0;
    for (const e of mcLog) {
      if (e.tipo==='def') mcStreak++;
      else if (e.tipo==='gol') break;
    }
  }
  const el=document.getElementById('mc-c-streak');
  if(el) el.textContent=mcStreak;
}

// ── Highlights Panel ─────────────────────────────────────────
function mcUpdateHighlights() {
  const el=document.getElementById('mc-highlights');
  if (!el || !mcLog.filter(e=>e.tipo!=='periodo').length) return;
  const semGolDisplay=mcLastGolSec!==null?mcFormatTime(mcSeconds-mcLastGolSec):mcFormatTime(mcSeconds);
  el.innerHTML=`
    <div class="mc-highlight-row">
      <span style="color:var(--muted);">⭐ Nota Máx.</span>
      <span class="mc-highlight-val" style="color:#34D399;">${mcMaxNota.toFixed(1)}</span>
    </div>
    <div class="mc-highlight-row">
      <span style="color:var(--muted);">📉 Nota Mín.</span>
      <span class="mc-highlight-val" style="color:var(--warning);">${mcMinNota.toFixed(1)}</span>
    </div>
    <div class="mc-highlight-row">
      <span style="color:var(--muted);">🔥 Maior Sequência</span>
      <span class="mc-highlight-val" style="color:var(--primary);">${mcMaxStreak} def.</span>
    </div>
    <div class="mc-highlight-row">
      <span style="color:var(--muted);">⏱ Seq. Atual</span>
      <span class="mc-highlight-val">${mcStreak} def.</span>
    </div>
    <div class="mc-highlight-row" style="border:none;">
      <span style="color:var(--muted);">🧱 Sem Gol há</span>
      <span class="mc-highlight-val">${semGolDisplay}</span>
    </div>`;
}

// ── Alerts System ────────────────────────────────────────────
function mcCheckAlerts() {
  const bar=document.getElementById('mc-alerts-bar');
  if (!bar) return;
  const alerts=[];
  const recent5=mcLog.slice(0,5);
  const recentGols=recent5.filter(e=>['gda','gfa','gpe','gfl'].includes(e.key));
  const recentDistErr=recent5.filter(e=>['dpe','dme'].includes(e.key));
  if (recentGols.length>=2) alerts.push({type:'error',msg:'⚠ Alta pressão — 2 ou mais gols sofridos recentemente'});
  if (recentDistErr.length>=3) alerts.push({type:'warning',msg:'⚠ Distribuição inconsistente — muitos erros seguidos'});
  if (mcNotaAtual<5.0) alerts.push({type:'error',msg:'⚠ Queda de rendimento — nota abaixo de 5.0'});
  if (mcStreak>=5) alerts.push({type:'success',msg:`★ Sequência de ${mcStreak} defesas consecutivas!`});
  if (mcNotaAtual>=9.0) alerts.push({type:'success',msg:`★ Desempenho excepcional — Nota ${mcNotaAtual.toFixed(1)}`});
  if (!alerts.length) { bar.style.display='none'; return; }
  bar.style.display='flex';
  bar.style.flexDirection='column';
  bar.style.gap='6px';
  bar.innerHTML=alerts.map(a=>`<div class="mc-alert-item mc-alert-${a.type}">${a.msg}</div>`).join('');
}

// ── Event Map ────────────────────────────────────────────────
function mcSetMapMode(mode) {
  mcMapMode=mode;
  ['def','gol','dist'].forEach(m=>{
    const btn=document.getElementById('mc-map-'+m);
    if(!btn) return;
    if(m===mode) {
      const colors={def:'rgba(59,130,246,.15)',gol:'rgba(239,68,68,.15)',dist:'rgba(245,158,11,.15)'};
      const borders={def:'rgba(59,130,246,.4)',gol:'rgba(239,68,68,.4)',dist:'rgba(245,158,11,.4)'};
      const texts={def:'#93C5FD',gol:'#FCA5A5',dist:'#FCD34D'};
      btn.style.background=colors[m]; btn.style.borderColor=borders[m]; btn.style.color=texts[m];
    } else {
      btn.style.background='none'; btn.style.borderColor='var(--border)'; btn.style.color='var(--muted)';
    }
  });
  mcUpdateEventMap();
}

function mcUpdateEventMap() {
  const el=document.getElementById('mc-event-map');
  if (!el) return;
  let grid, rgb;
  if (mcMapMode==='def') {
    grid=[[mcData.dae||0, 0, mcData.dad||0],[mcData.dc||0,mcData.esq||0,mcData.dc||0],[mcData.dbe||0,0,mcData.dbd||0]];
    rgb='59,130,246';
  } else if (mcMapMode==='gol') {
    const da=mcData.gda||0, fa=mcData.gfa||0;
    grid=[[Math.round(fa*.3),Math.round(fa*.4),Math.round(fa*.3)],[Math.round(da*.25),mcData.gpe||0,Math.round(da*.25)],[Math.round(da*.25),mcData.gfl||0,Math.round(da*.25)]];
    rgb='239,68,68';
  } else {
    grid=[[mcData.dpc||0,mcData.dmc||0,0],[mcData.dpe||0,mcData.dme||0,0],[0,0,0]];
    rgb='245,158,11';
  }
  const max=Math.max(1,...grid.flat());
  let html='';
  for(let r=0;r<3;r++) for(let c=0;c<3;c++){
    const v=grid[r][c];
    const intens=v/max;
    const bg=v>0?`rgba(${rgb},${0.12+intens*0.7})`:'rgba(255,255,255,.02)';
    html+=`<div class="mc-field-cell" style="background:${bg};">${v>0?`<span>${v}</span>`:''}</div>`;
  }
  el.innerHTML=html;
}

// ── Stats por Período ─────────────────────────────────────────
function mcUpdatePeriodStats() {
  const el=document.getElementById('mc-period-stats');
  if (!el) return;
  const curDef=(mcData.dad||0)+(mcData.dae||0)+(mcData.dbd||0)+(mcData.dbe||0)+(mcData.dc||0)+(mcData.d1x1||0)+(mcData.esq||0);
  const curGol=(mcData.gda||0)+(mcData.gfa||0)+(mcData.gpe||0)+(mcData.gfl||0);
  const curInt=mcData.int||0;
  const curDistC=(mcData.dpc||0)+(mcData.dmc||0);
  const curDistE=(mcData.dpe||0)+(mcData.dme||0);
  const curDistT=curDistC+curDistE;
  const curAp=curDistT>0?Math.round(curDistC/curDistT*100):0;
  const segs=mcGkSegmentos;
  const priColor=mcPeriodo===1?'var(--primary)':'var(--warning)';
  let html=`
    <div style="font-size:10px;font-weight:700;color:${priColor};letter-spacing:.6px;text-transform:uppercase;margin-bottom:6px;">${mcPeriodo===1?'1º Tempo (atual)':'2º Tempo (atual)'}</div>
    <div class="mc-period-grid" style="margin-bottom:10px;">
      <div class="mc-period-cell"><div class="pv" style="color:var(--primary);">${curDef}</div><div class="pl">Defesas</div></div>
      <div class="mc-period-cell"><div class="pv" style="color:var(--error);">${curGol}</div><div class="pl">Gols</div></div>
      <div class="mc-period-cell"><div class="pv" style="color:#6EE7B7;">${curInt}</div><div class="pl">Interceptações</div></div>
      <div class="mc-period-cell"><div class="pv" style="color:var(--warning);">${curAp}%</div><div class="pl">Aproveit. Dist.</div></div>
    </div>`;
  if (segs.length) {
    segs.forEach(seg=>{
      const d=seg.data;
      const def=(d.dad||0)+(d.dae||0)+(d.dbd||0)+(d.dbe||0)+(d.dc||0)+(d.esq||0);
      const gol=(d.gda||0)+(d.gfa||0)+(d.gpe||0)+(d.gfl||0);
      const dC=(d.dpc||0)+(d.dmc||0), dE=(d.dpe||0)+(d.dme||0);
      const ap=(dC+dE)>0?Math.round(dC/(dC+dE)*100):0;
      const gk=DB.goleiras.find(g=>g.id===seg.gkId);
      html+=`
        <div style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.6px;text-transform:uppercase;margin-bottom:6px;">${seg.periodoLabel} — ${gk?.nome||'—'}</div>
        <div class="mc-period-grid" style="margin-bottom:10px;">
          <div class="mc-period-cell"><div class="pv" style="color:var(--primary);">${def}</div><div class="pl">Defesas</div></div>
          <div class="mc-period-cell"><div class="pv" style="color:var(--error);">${gol}</div><div class="pl">Gols</div></div>
          <div class="mc-period-cell"><div class="pv" style="color:#6EE7B7;">${d.int||0}</div><div class="pl">Intercep.</div></div>
          <div class="mc-period-cell"><div class="pv" style="color:var(--warning);">${ap}%</div><div class="pl">Aproveit.</div></div>
        </div>`;
    });
    const uniqueGks=[...new Set(segs.map(s=>s.gkId))];
    if (uniqueGks.length>=2) mcUpdateGkComp(segs);
  }
  el.innerHTML=html;
}

function mcUpdateGkComp(segs) {
  const card=document.getElementById('mc-gk-comp-card');
  const el=document.getElementById('mc-gk-comp');
  if (!card||!el) return;
  card.style.display='block';
  const groups={};
  segs.forEach(s=>{
    if (!groups[s.gkId]) groups[s.gkId]={gkId:s.gkId,data:{}};
    MC_FIELDS.forEach(f=>{ groups[s.gkId].data[f]=(groups[s.gkId].data[f]||0)+(s.data[f]||0); });
  });
  const gkArr=Object.values(groups).slice(0,2);
  if (gkArr.length<2) return;
  const [a,b]=gkArr;
  const gkA=DB.goleiras.find(g=>g.id===a.gkId);
  const gkB=DB.goleiras.find(g=>g.id===b.gkId);
  const metrics=[
    { label:'Defesas', va:(a.data.dad||0)+(a.data.dae||0)+(a.data.dbd||0)+(a.data.dbe||0)+(a.data.dc||0), vb:(b.data.dad||0)+(b.data.dae||0)+(b.data.dbd||0)+(b.data.dbe||0)+(b.data.dc||0) },
    { label:'Gols Sofridos', va:(a.data.gda||0)+(a.data.gfa||0)+(a.data.gpe||0)+(a.data.gfl||0), vb:(b.data.gda||0)+(b.data.gfa||0)+(b.data.gpe||0)+(b.data.gfl||0) },
    { label:'Interceptações', va:a.data.int||0, vb:b.data.int||0 },
  ];
  const mxDef=Math.max(1,...metrics.map(m=>Math.max(m.va,m.vb)));
  el.innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 60px 1fr;gap:4px;margin-bottom:8px;">
      <div style="font-size:11px;font-weight:700;color:var(--primary);text-align:right;">${_esc(gkA?.nome||'GK A')}</div>
      <div></div>
      <div style="font-size:11px;font-weight:700;color:var(--warning);">${_esc(gkB?.nome||'GK B')}</div>
    </div>
    ${metrics.map(m=>`
    <div class="comp-row" style="grid-template-columns:1fr 80px 1fr;">
      <div>
        <div style="text-align:right;font-weight:700;font-size:13px;color:var(--primary);">${m.va}</div>
        <div class="comp-bar-wrap"><div class="comp-bar-a" style="width:${Math.round(m.va/mxDef*100)}%;"></div></div>
      </div>
      <div class="comp-label">${m.label}</div>
      <div>
        <div style="font-weight:700;font-size:13px;color:var(--warning);">${m.vb}</div>
        <div class="comp-bar-wrap"><div class="comp-bar-b" style="width:${Math.round(m.vb/mxDef*100)}%;"></div></div>
      </div>
    </div>`).join('')}`;
}

// ── Momentum Chart ────────────────────────────────────────────
function mcToggleMomentum() {
  mcToggleTimeline();
}

function mcToggleTimeline() {
  mcTimelineOpen=!mcTimelineOpen;
  const wrap=document.getElementById('mc-timeline-wrap');
  const tog=document.getElementById('mc-timeline-toggle');
  if (wrap) wrap.style.display=mcTimelineOpen?'block':'none';
  if (tog) tog.textContent=mcTimelineOpen?'▲ Ocultar':'▼ Mostrar';
  if (mcTimelineOpen) mcRenderTimeline();
}

function mcDetectFases() {
  const h=mcNotaHistory;
  if (h.length<4) return [];
  const phases=[];
  let runStart=0, runDir=null;
  const getDir=(a,b)=>{ const d=b-a; return d>0.08?1:d<-0.08?-1:0; };
  for (let i=1;i<=h.length;i++) {
    const dir=i<h.length?getDir(h[i-1].nota,h[i]?.nota??h[i-1].nota):0;
    if (runDir===null){runDir=dir;continue;}
    const switchDir=(dir!==runDir&&dir!==0)||i===h.length;
    if (switchDir) {
      const endIdx=i-1;
      const totalDelta=h[endIdx].nota-h[runStart].nota;
      const eventCount=endIdx-runStart;
      const timeDelta=h[endIdx].sec-h[runStart].sec;
      if (eventCount>=2&&Math.abs(totalDelta)>=0.35&&timeDelta>=45) {
        const isPrevQueda=phases.length>0&&phases[phases.length-1].tipo==='queda';
        let tipo,emoji,label;
        if (totalDelta>0) {
          tipo=isPrevQueda?'recuperacao':'alta';
          emoji=isPrevQueda?'📈':'🔥';
          label=isPrevQueda?'Recuperação':'Momento de Destaque';
        } else {
          tipo='queda'; emoji='⚠'; label='Queda de Rendimento';
        }
        phases.push({tipo,emoji,label,startSec:h[runStart].sec,endSec:h[endIdx].sec,startNota:h[runStart].nota,endNota:h[endIdx].nota,delta:totalDelta});
      }
      if (i<h.length){runStart=i-1;runDir=dir;}
    }
  }
  return phases;
}

function mcRenderTimeline() {
  const canvas=document.getElementById('mc-timeline-chart');
  if (!canvas) return;
  const data=mcNotaHistory;
  if (!data.length){return;}
  const labels=data.map(p=>mcFormatTime(p.sec));
  const values=data.map(p=>p.nota);
  // Point colors: green>=8, blue>=6.5, yellow>=5, red<5
  const ptColors=values.map(v=>v>=8?'#34D399':v>=6.5?'#3B82F6':v>=5?'#F59E0B':'#EF4444');
  if (mcTimelineChart){mcTimelineChart.destroy();mcTimelineChart=null;}
  mcTimelineChart=new Chart(canvas,{
    type:'line',
    data:{labels,datasets:[{
      label:'Desempenho',data:values,
      borderColor:'#3B82F6',
      backgroundColor:(ctx)=>{
        const g=ctx.chart.ctx.createLinearGradient(0,0,0,180);
        g.addColorStop(0,'rgba(59,130,246,.25)');g.addColorStop(1,'rgba(59,130,246,.02)');return g;
      },
      tension:.4,fill:true,
      pointRadius:values.map((v,i)=>{
        // Larger points for best/worst
        if (i===values.indexOf(Math.max(...values))||i===values.indexOf(Math.min(...values))) return 6;
        return 3;
      }),
      pointBackgroundColor:ptColors,
      pointBorderColor:ptColors,
      borderWidth:2
    }]},
    options:{
      responsive:true,maintainAspectRatio:false,
      animation:{duration:300},
      plugins:{
        legend:{display:false},
        tooltip:{
          backgroundColor:'rgba(15,23,42,.95)',
          titleColor:'#94A3B8',bodyColor:'#F8FAFC',
          callbacks:{
            title:items=>'⏱ '+items[0].label,
            label:item=>'Nota: '+item.raw.toFixed(2)
          }
        }
      },
      scales:{
        x:{ticks:{color:'#94A3B8',font:{size:9},maxTicksLimit:8},grid:{color:'rgba(255,255,255,.04)'}},
        y:{min:0,max:10,ticks:{color:'#94A3B8',font:{size:9},stepSize:2},grid:{color:'rgba(255,255,255,.06)'},
          afterFit:s=>{s.width=28;}}
      }
    }
  });
  // Render phase bar
  mcRenderFasesBar();
  // Render smart log
  mcRenderSmartLog();
}

function mcRenderFasesBar() {
  const el=document.getElementById('mc-fases-bar');
  if (!el) return;
  const fases=mcDetectFases();
  if (!fases.length){el.innerHTML='';return;}
  const faseColors={alta:'rgba(52,211,153,.15)',queda:'rgba(239,68,68,.12)',recuperacao:'rgba(59,130,246,.15)',estavel:'rgba(148,163,184,.06)'};
  const faseBorder={alta:'rgba(52,211,153,.5)',queda:'rgba(239,68,68,.4)',recuperacao:'rgba(59,130,246,.4)',estavel:'rgba(148,163,184,.2)'};
  el.innerHTML=`
    <div style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.8px;text-transform:uppercase;margin-bottom:6px;">Fases Detectadas</div>
    <div style="display:flex;flex-direction:column;gap:4px;">
      ${fases.map(f=>`
        <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:${faseColors[f.tipo]};border:1px solid ${faseBorder[f.tipo]};border-radius:8px;">
          <span style="font-size:14px;">${f.emoji}</span>
          <div style="flex:1;">
            <span style="font-size:11px;font-weight:700;color:var(--text);">${f.label}</span>
            <span style="font-size:10px;color:var(--muted);margin-left:6px;">${mcFormatTime(f.startSec)} → ${mcFormatTime(f.endSec)}</span>
          </div>
          <span style="font-size:11px;font-weight:700;color:${f.delta>0?'#34D399':'#EF4444'};">${f.delta>0?'+':''}${f.delta.toFixed(1)}</span>
        </div>`).join('')}
    </div>`;
}

function mcRenderSmartLog() {
  const el=document.getElementById('mc-smart-log');
  if (!el) return;
  const events=mcLog.filter(e=>e.tipo!=='periodo').slice().reverse();
  if (!events.length){el.innerHTML='';return;}
  const fases=mcDetectFases();
  const typeColors={def:'#3B82F6',gol:'#EF4444',dist:'#F59E0B',out:'#10B981',sub:'#8B5CF6','placar-nos':'#10B981','placar-adv':'#EF4444'};
  let html='<div style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.8px;text-transform:uppercase;margin-bottom:6px;">Linha do Tempo</div>';
  let lastFaseIdx=-1;
  for (const ev of events) {
    // Check if a phase starts around this event
    for (let fi=lastFaseIdx+1;fi<fases.length;fi++) {
      const f=fases[fi];
      if (ev.sec>=f.startSec&&ev.sec<=f.endSec&&fi>lastFaseIdx) {
        lastFaseIdx=fi;
        const faseColors2={alta:'rgba(52,211,153,.12)',queda:'rgba(239,68,68,.1)',recuperacao:'rgba(59,130,246,.12)'};
        const faseBorder2={alta:'rgba(52,211,153,.4)',queda:'rgba(239,68,68,.35)',recuperacao:'rgba(59,130,246,.35)'};
        html+=`<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;margin:4px 0;background:${faseColors2[f.tipo]||'rgba(148,163,184,.08)'};border-left:2px solid ${faseBorder2[f.tipo]||'var(--border)'};border-radius:0 6px 6px 0;font-size:10px;font-weight:700;color:var(--muted);">${f.emoji} ${f.label} · ${mcFormatTime(f.startSec)}</div>`;
        break;
      }
    }
    const icon=MC_TIPO_ICONS[ev.key]||MC_ICONS[ev.tipo]||'•';
    html+=`<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px;">
      <span style="color:var(--muted);font-variant-numeric:tabular-nums;width:38px;flex-shrink:0;font-size:11px;">${ev.time}</span>
      <span style="font-size:13px;">${icon}</span>
      <span style="flex:1;color:var(--text);">${ev.label}</span>
      <span style="width:7px;height:7px;border-radius:50%;background:${typeColors[ev.tipo]||'var(--muted)'};flex-shrink:0;"></span>
    </div>`;
  }
  el.innerHTML=html;
}

function mcRenderMomentum() { mcRenderTimeline(); }

// ── Placar ao vivo ───────────────────────────────────────────
function mcAjustarPlacar(team, delta) {
  mcPlacar[team]=Math.max(0,(mcPlacar[team]||0)+delta);
  const elNos=document.getElementById('mc-score-nos');
  const elAdv=document.getElementById('mc-score-adv');
  if(elNos) elNos.textContent=mcPlacar.nos;
  if(elAdv) elAdv.textContent=mcPlacar.adv;
  const timeStr=mcFormatTime(mcSeconds);
  const lbl=team==='nos'?(delta>0?'⚽ Gol Nosso':'↩ Gol Nosso Anulado'):(delta>0?'⚽ Gol Adversário':'↩ Gol Adversário Anulado');
  mcLog.unshift({key:'_placar',label:lbl,tipo:team==='nos'?'placar-nos':'placar-adv',time:timeStr,periodo:mcPeriodo,sec:mcSeconds});
  mcUpdateLog();
}

// ── Segundo Tempo ────────────────────────────────────────────
function mcIniciarSegundoTempo() {
  if (mcPeriodo===2) return;
  if (!confirm('Iniciar 2º Tempo?\nO cronômetro será zerado e os eventos da goleira atual serão salvos como 1º Tempo.')) return;
  mcSnapshotGkSegmento('1T');
  mcPeriodo=2;
  if (mcRunning) mcToggleTimer();
  mcSeconds=0;
  document.getElementById('mc-timer').textContent='00:00';
  MC_FIELDS.forEach(f=>mcData[f]=0);
  mcUpdateCounters();
  const badge=document.getElementById('mc-periodo-badge');
  if(badge){badge.textContent='2º TEMPO';badge.style.background='rgba(245,158,11,.1)';badge.style.color='var(--warning)';badge.style.borderColor='rgba(245,158,11,.3)';}
  document.getElementById('mc-btn-2t').style.display='none';
  mcLog.unshift({key:'_periodo',label:'─── 2º Tempo ───',tipo:'periodo',time:'00:00',periodo:2,sec:0});
  mcUpdateLog();
  mcUpdatePeriodStats();
  toast('2º Tempo iniciado — cronômetro zerado!','info');
}

// ── Tempo Técnico ─────────────────────────────────────────────
function mcTempoTecnico() {
  // If TT already running, cancel it
  if (mcTTInterval) {
    clearInterval(mcTTInterval); mcTTInterval = null;
    const badge = document.getElementById('mc-tt-badge');
    const btn = document.getElementById('mc-btn-tt');
    if (badge) badge.style.display = 'none';
    if (btn) { btn.textContent = '⏱ T. Técnico'; btn.style.color = '#a78bfa'; }
    // Resume timer if it was running before TT
    if (mcTTWasRunning) mcToggleTimer();
    mcTTWasRunning = false;
    toast('Tempo Técnico cancelado', 'info');
    return;
  }
  // Pause main timer if running
  mcTTWasRunning = mcRunning;
  if (mcRunning) mcToggleTimer();

  mcTTSeconds = 60;
  const timeStr = mcFormatTime(mcSeconds);
  mcLog.unshift({ key: '_tt', label: '⏱ Tempo Técnico', tipo: 'tt', time: timeStr, periodo: mcPeriodo, sec: mcSeconds });
  mcUpdateLog();

  const badge = document.getElementById('mc-tt-badge');
  const countEl = document.getElementById('mc-tt-count');
  const btn = document.getElementById('mc-btn-tt');
  if (badge) badge.style.display = 'block';
  if (countEl) countEl.textContent = mcTTSeconds;
  if (btn) { btn.textContent = '✕ Cancelar TT'; btn.style.color = 'var(--error)'; }

  toast('⏱ Tempo Técnico — 60 segundos', 'info');

  mcTTInterval = setInterval(() => {
    mcTTSeconds--;
    if (countEl) countEl.textContent = mcTTSeconds;
    if (mcTTSeconds <= 0) {
      clearInterval(mcTTInterval); mcTTInterval = null;
      if (badge) badge.style.display = 'none';
      if (btn) { btn.textContent = '⏱ T. Técnico'; btn.style.color = '#a78bfa'; }
      toast('⏱ Tempo Técnico encerrado!', 'success');
      // Auto-resume if timer was running before
      if (mcTTWasRunning) mcToggleTimer();
      mcTTWasRunning = false;
    }
  }, 1000);
}

// ── Troca de Goleira ─────────────────────────────────────────
function mcSnapshotGkSegmento(periodoLabel) {
  const gkId=document.getElementById('mc-goleira')?.value;
  if (!gkId) return;
  const segData={};
  MC_FIELDS.forEach(f=>segData[f]=mcData[f]||0);
  mcGkSegmentos.push({gkId,periodoLabel:periodoLabel||`${mcPeriodo}T`,data:segData});
  mcUpdateGkInfo();
}

function mcUpdateGkInfo() {
  if (!mcGkSegmentos.length) return;
  const infoEl=document.getElementById('mc-gk-info');
  const listEl=document.getElementById('mc-gk-info-list');
  if(!infoEl||!listEl) return;
  listEl.textContent=mcGkSegmentos.map(s=>{
    const gk=DB.goleiras.find(g=>g.id===s.gkId);
    return `${gk?.nome||'—'} (${s.periodoLabel})`;
  }).join(' → ');
  infoEl.style.display='block';
}

function mcTrocarGoleira() {
  const goleiras=DB.goleiras;
  const atualId=document.getElementById('mc-goleira')?.value;
  const outras=goleiras.filter(g=>g.id!==atualId);
  if (!outras.length){toast('Não há outras goleiras cadastradas','error');return;}
  const sel=document.getElementById('mc-nova-goleira');
  if(sel) sel.innerHTML=outras.map(g=>`<option value="${g.id}">${_esc(g.nome)}</option>`).join('');
  document.getElementById('mc-trocar-painel').style.display='block';
}

function mcConfirmarTroca() {
  const novaId=document.getElementById('mc-nova-goleira')?.value;
  if (!novaId) return;
  const novaGk=DB.goleiras.find(g=>g.id===novaId);
  mcSnapshotGkSegmento(`${mcPeriodo}T`);
  MC_FIELDS.forEach(f=>mcData[f]=0);
  mcUpdateCounters();
  const sel=document.getElementById('mc-goleira');
  if(sel) sel.value=novaId;
  const timeStr=mcFormatTime(mcSeconds);
  mcLog.unshift({key:'_sub',label:`🔄 Entra: ${novaGk?.nome||'Nova GK'}`,tipo:'sub',time:timeStr,periodo:mcPeriodo,sec:mcSeconds});
  mcUpdateLog();
  mcUpdatePeriodStats();
  document.getElementById('mc-trocar-painel').style.display='none';
  toast(`Goleira alterada para ${novaGk?.nome||'—'}!`,'success');
}

// ── Encerrar Partida ─────────────────────────────────────────
function mcEncerrar() {
  const gkId=document.getElementById('mc-goleira')?.value;
  const pId=document.getElementById('mc-partida')?.value;
  if (!gkId){toast('Selecione a goleira antes de encerrar','error');return;}
  if (!pId && !confirm('Nenhuma partida selecionada. Os scouts serão salvos sem vínculo com uma partida. Continuar?')) return;
  const finalSegmentos=[...mcGkSegmentos];
  const totalCurrentEvents=MC_FIELDS.reduce((a,f)=>a+(mcData[f]||0),0);
  if (totalCurrentEvents>0||finalSegmentos.length===0){
    const curData={};
    MC_FIELDS.forEach(f=>curData[f]=mcData[f]||0);
    finalSegmentos.push({gkId,periodoLabel:`${mcPeriodo}T`,data:curData,notaFinal:mcNotaAtual});
  }
  const totalAll=finalSegmentos.reduce((a,s)=>a+MC_FIELDS.reduce((b,f)=>b+(s.data[f]||0),0),0);
  if (totalAll===0&&finalSegmentos.length===0){toast('Nenhum evento registrado','error');return;}
  if (!confirm(`Encerrar o jogo e salvar ${finalSegmentos.length} scout(s)?`)) return;
  if (mcRunning) mcToggleTimer();
  // Store pending for post-game modal
  mcPendingSegmentos=finalSegmentos;
  mcPendingPId=pId;
  // Show post-game report first
  mcMostrarRelatorioFinal(finalSegmentos, pId);
}

function mcSalvarEFechar() {
  const finalSegmentos=mcPendingSegmentos;
  const pId=mcPendingPId;
  if (!finalSegmentos) { closeModal('modal-mc-relatorio'); return; }
  const scouts=DB.scouts;
  finalSegmentos.forEach(seg=>{
    const obj={id:uid(),goalkeeperId:seg.gkId,partidaId:pId||'',periodo:seg.periodoLabel};
    MC_FIELDS.forEach(f=>{obj[f]=seg.data[f]||0;});
    // Salva nota ao vivo calculada pelo MC; se não disponível, calcula pela fórmula
    const notaMC = seg.notaFinal ?? mcNotaAtual;
    const notaCalc = calcPerformanceAuto(obj);
    obj.nota = (notaMC !== 7.0 || notaCalc === null) ? parseFloat(notaMC.toFixed(1)) : notaCalc;
    scouts.push(obj);
    cloudSet('scouts',obj);
  });
  DB.saveScouts(scouts);
  if (pId){
    const partidas=DB.partidas;
    const pIdx=partidas.findIndex(p=>p.id===pId);
    if(pIdx!==-1){
      partidas[pIdx].gf=mcPlacar.nos;
      partidas[pIdx].gc=mcPlacar.adv;
      DB.savePartidas(partidas);
      cloudSet('partidas',partidas[pIdx]);
    }
  }
  toast(`${finalSegmentos.length} scout(s) salvos com sucesso!`,'success');
  closeModal('modal-mc-relatorio');
  mcPendingSegmentos=null; mcPendingPId=null;
  // Reset UI
  mcReset(); mcUpdateCounters(); mcUpdateLog();
  document.getElementById('mc-timer').textContent='00:00';
  document.getElementById('mc-btn-timer').innerHTML='▶ Iniciar';
  document.getElementById('mc-status-dot').style.background='var(--muted)';
  document.getElementById('mc-score-nos').textContent='0';
  document.getElementById('mc-score-adv').textContent='0';
  document.getElementById('mc-btn-2t').style.display='none';
  document.getElementById('mc-trocar-painel').style.display='none';
  document.getElementById('mc-gk-info').style.display='none';
  document.getElementById('mc-gk-comp-card').style.display='none';
  document.getElementById('mc-alerts-bar').style.display='none';
  document.getElementById('mc-highlights').innerHTML='<div style="color:var(--muted);font-size:12px;text-align:center;padding:8px 0;">Registre eventos para ver destaques</div>';
  document.getElementById('mc-event-count').textContent='0 eventos';
  mcUpdateNotaUI();
  const badge=document.getElementById('mc-periodo-badge');
  if(badge){badge.textContent='1º TEMPO';badge.style.background='rgba(59,130,246,.1)';badge.style.color='var(--primary)';badge.style.borderColor='rgba(59,130,246,.3)';}
  const undoBtn=document.getElementById('mc-btn-undo');
  if(undoBtn){undoBtn.disabled=true;undoBtn.style.opacity='.5';}
  navigate('scout');
}

// ── Relatório Pós-Jogo ───────────────────────────────────────
function mcMostrarRelatorioFinal(segs, pId) {
  mcCurrentReportSegs = segs;
  const partida=DB.partidas.find(p=>p.id===pId);
  const gkIds=[...new Set(segs.map(s=>s.gkId))];
  const subtitleParts=[];
  if(partida) subtitleParts.push(`${partida.adversario} · ${formatDate(partida.data||'')}`);
  subtitleParts.push(`${mcFormatTime(mcSeconds)} jogados · ${segs.length} período(s)`);
  const subtitleEl=document.getElementById('mc-rel-subtitle');
  if(subtitleEl) subtitleEl.textContent=subtitleParts.join(' · ');

  let html='<div id="mc-rel-content">';

  gkIds.forEach(gkId=>{
    const gk=DB.goleiras.find(g=>g.id===gkId);
    const gkSegs=segs.filter(s=>s.gkId===gkId);
    const sum=f=>gkSegs.reduce((a,s)=>a+(s.data[f]||0),0);
    const def=sum('dad')+sum('dae')+sum('dbd')+sum('dbe')+sum('dc')+sum('d1x1')+sum('esq');
    const gol=sum('gda')+sum('gfa')+sum('gpe')+sum('gfl');
    const distC=sum('dpc')+sum('dmc'), distE=sum('dpe')+sum('dme');
    const distT=distC+distE;
    const taxaDef=(def+gol)>0?def/(def+gol):null;
    const taxaDist=distT>0?distC/distT:null;
    const nota=mcNotaAtual;
    const nivel=nota>=9?'Elite':nota>=7.5?'Destaque':nota>=6?'Competitiva':nota>=4.5?'Em Desenvolvimento':'Necessita Evolução';
    const nivelColor=nota>=9?'#34D399':nota>=7.5?'#3B82F6':nota>=6?'#F59E0B':nota>=4.5?'#94A3B8':'#EF4444';

    const forcas=[];
    if(taxaDef!==null&&taxaDef>=.80) forcas.push(`Taxa de defesa de ${(taxaDef*100).toFixed(0)}% — excelente`);
    if(taxaDist!==null&&taxaDist>=.75) forcas.push(`Distribuição ${(taxaDist*100).toFixed(0)}% de precisão`);
    if(mcMaxStreak>=4) forcas.push(`Sequência de ${mcMaxStreak} defesas consecutivas`);
    if(sum('int')>=2) forcas.push(`${sum('int')} interceptações — boa leitura de jogo`);
    if(sum('esq')>0) forcas.push(`${sum('esq')} esquadro(s) — reações de alto nível`);

    const mels=[];
    if(taxaDef!==null&&taxaDef<.65) mels.push(`Taxa de defesa de ${(taxaDef*100).toFixed(0)}% — trabalhar posicionamento`);
    if(taxaDist!==null&&taxaDist<.60) mels.push(`Distribuição com apenas ${(taxaDist*100).toFixed(0)}% — foco na precisão`);
    if(sum('gpe')>0) mels.push(`${sum('gpe')} gol(is) de pênalti — desenvolver leitura de cobranças`);
    if(distE>distC) mels.push('Mais distribuições erradas que certas — prioridade no treino');

    const recs=[];
    if(taxaDef!==null&&taxaDef<.75) recs.push('Treino de posicionamento de gol com cones e finalizações variadas');
    if(taxaDist!==null&&taxaDist<.70) recs.push('Sessão de distribuição: 20 min por treino, alvo a 10m e 15m');
    if(sum('gpe')>1) recs.push('Análise de cobranças de pênalti — padrão de lateralidade dos adversários');
    recs.push('Revisão em vídeo dos eventos da partida com a comissão técnica');

    html+=`
      <div style="margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:16px;padding:16px;background:linear-gradient(135deg,rgba(59,130,246,.06),rgba(139,92,246,.06));border:1px solid rgba(59,130,246,.15);border-radius:14px;margin-bottom:16px;">
          <div style="text-align:center;flex-shrink:0;">
            <div style="font-size:44px;font-weight:900;color:${nivelColor};line-height:1;">${nota.toFixed(1)}</div>
            <div style="font-size:9px;color:var(--muted);letter-spacing:1px;font-weight:600;">NOTA FINAL</div>
          </div>
          <div style="flex:1;">
            <div style="font-size:18px;font-weight:800;">${gk?.nome||'—'}</div>
            <div style="font-size:22px;font-weight:800;color:${nivelColor};margin-top:2px;">${nivel}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:4px;">${gkSegs.map(s=>s.periodoLabel).join(' + ')} · Sequência máx: ${mcMaxStreak} def.</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;">
          ${[
            {l:'Defesas',v:def,c:'var(--primary)'},
            {l:'Gols Sofr.',v:gol,c:'var(--error)'},
            {l:'Interceções',v:sum('int'),c:'#6EE7B7'},
            {l:'Precis. Dist.',v:taxaDist!==null?(taxaDist*100).toFixed(0)+'%':'—',c:'var(--warning)'}
          ].map(m=>`<div style="background:var(--card-2);border:1px solid var(--border);border-radius:12px;padding:12px;text-align:center;"><div style="font-size:9px;color:var(--muted);letter-spacing:.8px;font-weight:700;text-transform:uppercase;margin-bottom:6px;">${m.l}</div><div style="font-size:24px;font-weight:800;color:${m.c};">${m.v}</div></div>`).join('')}
        </div>

        <div style="background:rgba(255,255,255,.03);border-left:3px solid var(--primary);border-radius:0 8px 8px 0;padding:12px 14px;margin-bottom:16px;font-size:13px;line-height:1.7;color:var(--text);">
          ${gk?.nome||'A goleira'} encerrou a partida com classificação <strong>${nivel}</strong> e nota <strong>${nota.toFixed(1)}/10</strong>.
          ${taxaDef!==null?`Taxa de defesa de <strong>${(taxaDef*100).toFixed(0)}%</strong>.`:''}
          ${mcMaxStreak>=3?`Melhor sequência defensiva de <strong>${mcMaxStreak} defesas consecutivas</strong>.`:''}
          ${mcMaxSemGolSec>60?`Ficou <strong>${mcFormatTime(mcMaxSemGolSec)}</strong> sem sofrer gols.`:''}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
          <div style="background:rgba(16,185,129,.04);border:1px solid rgba(16,185,129,.2);border-radius:12px;padding:14px;">
            <div style="font-size:10px;font-weight:700;color:var(--success);letter-spacing:.8px;text-transform:uppercase;margin-bottom:10px;">✅ Pontos Fortes</div>
            ${(forcas.length?forcas:[`Continue acumulando dados para análise`]).map(f=>`<div style="font-size:12px;line-height:1.5;margin-bottom:7px;display:flex;gap:6px;"><span>▸</span><span>${f}</span></div>`).join('')}
          </div>
          <div style="background:rgba(245,158,11,.04);border:1px solid rgba(245,158,11,.2);border-radius:12px;padding:14px;">
            <div style="font-size:10px;font-weight:700;color:var(--warning);letter-spacing:.8px;text-transform:uppercase;margin-bottom:10px;">⚠ A Desenvolver</div>
            ${(mels.length?mels:[`Manter o nível atual e continuar evoluindo`]).map(m=>`<div style="font-size:12px;line-height:1.5;margin-bottom:7px;display:flex;gap:6px;"><span>▸</span><span>${m}</span></div>`).join('')}
          </div>
        </div>

        <div style="background:rgba(59,130,246,.04);border:1px solid rgba(59,130,246,.15);border-radius:12px;padding:14px;">
          <div style="font-size:10px;font-weight:700;color:var(--primary);letter-spacing:.8px;text-transform:uppercase;margin-bottom:10px;">📋 Recomendações de Treino</div>
          ${recs.map((r,i)=>`<div style="display:flex;gap:8px;margin-bottom:8px;font-size:12px;line-height:1.5;"><span style="width:18px;height:18px;border-radius:50%;background:var(--primary);color:#fff;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">${i+1}</span><span>${r}</span></div>`).join('')}
        </div>
      </div>`;
  });

  // ── Resumo da Timeline de Desempenho ──
  const fases=mcDetectFases();
  const recentPesos=mcLog.slice(0,5).map(e=>MC_NOTA_PESOS[e.key]||0).reduce((a,b)=>a+b,0);
  const tendencia=recentPesos>=0.25?{icon:'📈',label:'Crescimento',color:'#34D399'}:recentPesos<=-0.25?{icon:'📉',label:'Queda',color:'#EF4444'}:{icon:'➡',label:'Estável',color:'#94A3B8'};
  html+=`<div style="background:var(--card-2);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:16px;">
    <div style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.8px;text-transform:uppercase;margin-bottom:12px;">📊 Resumo da Partida</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
      <div style="background:rgba(52,211,153,.06);border:1px solid rgba(52,211,153,.2);border-radius:10px;padding:10px;">
        <div style="font-size:9px;color:var(--muted);letter-spacing:.8px;font-weight:700;text-transform:uppercase;margin-bottom:4px;">🔥 Melhor Momento</div>
        <div style="font-size:18px;font-weight:800;color:#34D399;">${mcMaxNota.toFixed(1)}</div>
        <div style="font-size:10px;color:var(--muted);">⏱ ${mcFormatTime(mcBestNotaSec)}</div>
      </div>
      <div style="background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2);border-radius:10px;padding:10px;">
        <div style="font-size:9px;color:var(--muted);letter-spacing:.8px;font-weight:700;text-transform:uppercase;margin-bottom:4px;">📉 Pior Momento</div>
        <div style="font-size:18px;font-weight:800;color:#EF4444;">${mcMinNota.toFixed(1)}</div>
        <div style="font-size:10px;color:var(--muted);">⏱ ${mcFormatTime(mcWorstNotaSec)}</div>
      </div>
      <div style="background:rgba(59,130,246,.06);border:1px solid rgba(59,130,246,.2);border-radius:10px;padding:10px;">
        <div style="font-size:9px;color:var(--muted);letter-spacing:.8px;font-weight:700;text-transform:uppercase;margin-bottom:4px;">✅ Seq. Positiva Máx.</div>
        <div style="font-size:18px;font-weight:800;color:#3B82F6;">${mcMaxPosStreak}</div>
        <div style="font-size:10px;color:var(--muted);">ações consecutivas</div>
      </div>
      <div style="background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.2);border-radius:10px;padding:10px;">
        <div style="font-size:9px;color:var(--muted);letter-spacing:.8px;font-weight:700;text-transform:uppercase;margin-bottom:4px;">⚠ Seq. Negativa Máx.</div>
        <div style="font-size:18px;font-weight:800;color:#F59E0B;">${mcMaxNegStreak}</div>
        <div style="font-size:10px;color:var(--muted);">eventos negativos</div>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(148,163,184,.06);border:1px solid var(--border);border-radius:10px;margin-bottom:${fases.length?'12px':'0'};">
      <span style="font-size:20px;">${tendencia.icon}</span>
      <div>
        <div style="font-size:11px;font-weight:700;color:${tendencia.color};">Tendência Final: ${tendencia.label}</div>
        <div style="font-size:10px;color:var(--muted);">Baseado nos últimos eventos da partida</div>
      </div>
    </div>
    ${fases.length?`
    <div style="font-size:9px;color:var(--muted);letter-spacing:.8px;font-weight:700;text-transform:uppercase;margin-bottom:6px;">Fases da Partida</div>
    ${fases.map(f=>{
      const fc={alta:'rgba(52,211,153,.1)',queda:'rgba(239,68,68,.08)',recuperacao:'rgba(59,130,246,.1)'};
      const fb={alta:'rgba(52,211,153,.35)',queda:'rgba(239,68,68,.3)',recuperacao:'rgba(59,130,246,.3)'};
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:${fc[f.tipo]||'rgba(148,163,184,.06)'};border:1px solid ${fb[f.tipo]||'var(--border)'};border-radius:7px;margin-bottom:4px;font-size:11px;">
        <span>${f.emoji}</span>
        <span style="font-weight:600;flex:1;">${f.label}</span>
        <span style="color:var(--muted);">${mcFormatTime(f.startSec)} → ${mcFormatTime(f.endSec)}</span>
        <span style="font-weight:700;color:${f.delta>0?'#34D399':'#EF4444'};">${f.delta>0?'+':''}${f.delta.toFixed(1)}</span>
      </div>`;
    }).join('')}`:''}
  </div>`;

  const timelineEvents=mcLog.filter(e=>e.tipo!=='periodo').slice(0,20);
  if (timelineEvents.length) {
    const typeColors2={def:'#3B82F6',gol:'#EF4444',dist:'#F59E0B',out:'#10B981',sub:'#F59E0B','placar-nos':'#10B981','placar-adv':'#EF4444'};
    html+=`<div style="background:var(--card-2);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:16px;">
      <div style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.8px;text-transform:uppercase;margin-bottom:12px;">📅 Timeline do Jogo</div>
      ${timelineEvents.map(e=>`
        <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px;">
          <span style="color:var(--muted);font-variant-numeric:tabular-nums;width:40px;flex-shrink:0;">${e.time}</span>
          <span style="width:8px;height:8px;border-radius:50%;background:${typeColors2[e.tipo]||'var(--muted)'};flex-shrink:0;"></span>
          <span style="flex:1;">${e.label}</span>
          <span style="font-size:9px;background:${e.periodo===1?'rgba(59,130,246,.12)':'rgba(245,158,11,.12)'};color:${e.periodo===1?'var(--primary)':'var(--warning)'};border-radius:3px;padding:1px 4px;font-weight:700;">${e.periodo}T</span>
        </div>`).join('')}
    </div>`;
  }

  html+='</div>';
  const bodyEl=document.getElementById('mc-rel-body');
  if(bodyEl) bodyEl.innerHTML=html;
  const _aiw = document.getElementById('mc-ai-wrap'); if (_aiw) _aiw.style.display = 'none';
  openModal('modal-mc-relatorio');
}

// ── PDF canvas helpers ───────────────────────────────────────
function _pdfLineChart(history) {
  if (!history||history.length<2) return null;
  const W=540,H=140,pad={t:22,r:16,b:28,l:44};
  const cW=W-pad.l-pad.r, cH=H-pad.t-pad.b;
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const c=cv.getContext('2d');
  c.fillStyle='#0F172A'; c.fillRect(0,0,W,H);
  const notaVals=history.map(p=>p.nota);
  const minN=Math.max(0,Math.min(...notaVals)-0.5), maxN=Math.min(10,Math.max(...notaVals)+0.5);
  const rng=maxN-minN||1, maxSec=history[history.length-1].sec||1;
  const tx=s=>pad.l+(s/maxSec)*cW, ty=n=>pad.t+cH-((n-minN)/rng)*cH;
  // Grid
  for(let i=0;i<=4;i++){
    const n=minN+rng*i/4, gy=ty(n);
    c.strokeStyle='rgba(255,255,255,.07)'; c.lineWidth=0.8;
    c.beginPath();c.moveTo(pad.l,gy);c.lineTo(W-pad.r,gy);c.stroke();
    c.fillStyle='#64748B';c.font='11px Arial';c.textAlign='right';
    c.fillText(n.toFixed(1),pad.l-4,gy+4);
  }
  for(let i=0;i<=6;i++){
    const sec=maxSec*i/6, lx=tx(sec);
    c.strokeStyle='rgba(255,255,255,.04)';c.lineWidth=0.5;
    c.beginPath();c.moveTo(lx,pad.t);c.lineTo(lx,pad.t+cH);c.stroke();
    const m=Math.floor(sec/60),s=Math.floor(sec%60);
    c.fillStyle='#64748B';c.font='10px Arial';c.textAlign='center';
    c.fillText(`${m}:${String(s).padStart(2,'0')}`,lx,H-3);
  }
  // Area fill
  const g=c.createLinearGradient(0,pad.t,0,pad.t+cH);
  g.addColorStop(0,'rgba(59,130,246,.35)');g.addColorStop(1,'rgba(59,130,246,.02)');
  c.beginPath();c.moveTo(tx(history[0].sec),ty(history[0].nota));
  history.forEach(p=>c.lineTo(tx(p.sec),ty(p.nota)));
  c.lineTo(tx(history[history.length-1].sec),pad.t+cH);c.lineTo(tx(history[0].sec),pad.t+cH);
  c.closePath();c.fillStyle=g;c.fill();
  // Line
  c.beginPath();history.forEach((p,i)=>i===0?c.moveTo(tx(p.sec),ty(p.nota)):c.lineTo(tx(p.sec),ty(p.nota)));
  c.strokeStyle='#3B82F6';c.lineWidth=2.5;c.lineJoin='round';c.stroke();
  // Best / worst markers
  const maxP=history.reduce((a,b)=>b.nota>a.nota?b:a);
  const minP=history.reduce((a,b)=>b.nota<a.nota?b:a);
  [[maxP,'#34D399',true],[minP,'#EF4444',false]].forEach(([p,col,isMax])=>{
    c.beginPath();c.arc(tx(p.sec),ty(p.nota),5,0,Math.PI*2);c.fillStyle=col;c.fill();
    c.fillStyle=col;c.font='bold 11px Arial';c.textAlign='center';
    c.fillText(`${isMax?'▲':'▼'} ${p.nota.toFixed(1)}`,tx(p.sec),ty(p.nota)+(isMax?-9:17));
  });
  return cv;
}

function _pdfBarChart(labels,values,colors) {
  const W=260,H=130,pad={t:14,r:8,b:24,l:8};
  const cW=W-pad.l-pad.r,cH=H-pad.t-pad.b;
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;
  const c=cv.getContext('2d');
  c.fillStyle='#0F172A';c.fillRect(0,0,W,H);
  const maxV=Math.max(...values,1);
  const bw=cW/values.length;
  for(let i=0;i<=3;i++){
    const gy=pad.t+cH-cH*i/3;
    c.strokeStyle='rgba(255,255,255,0.06)';c.lineWidth=0.5;
    c.beginPath();c.moveTo(pad.l,gy);c.lineTo(W-pad.r,gy);c.stroke();
  }
  values.forEach((v,i)=>{
    const bh=(v/maxV)*cH, bx=pad.l+i*bw+bw*.15, bW2=bw*.7, by=pad.t+cH-bh;
    c.fillStyle=colors[i]||'#3B82F6';
    c.fillRect(bx,by,bW2,bh);
    if(v>0){c.fillStyle='#E2E8F0';c.font='bold 10px Arial';c.textAlign='center';c.fillText(v,bx+bW2/2,by-3);}
    c.fillStyle='#64748B';c.font='8px Arial';c.fillText(labels[i],bx+bW2/2,H-4);
  });
  return cv;
}

function _pdfDonut(distC,distE,taxaDist) {
  // Wide canvas (same aspect as bar chart 260×130) so it displays without distortion
  const W=260,H=130,cx=75,cy=65,r=52;
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;
  const c=cv.getContext('2d');
  c.fillStyle='#0F172A';c.fillRect(0,0,W,H);
  const total=distC+distE;
  if(total>0){
    const slices=[[distC,'#34D399'],[distE,'#EF4444']];
    let ang=-Math.PI/2;
    slices.forEach(function(sl){
      const sw=(sl[0]/total)*Math.PI*2;
      c.beginPath();c.moveTo(cx,cy);c.arc(cx,cy,r,ang,ang+sw);c.closePath();
      c.fillStyle=sl[1];c.fill();ang+=sw;
    });
  } else {
    c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);c.fillStyle='#1E293B';c.fill();
  }
  c.beginPath();c.arc(cx,cy,r*.56,0,Math.PI*2);c.fillStyle='#0F172A';c.fill();
  c.fillStyle='#E2E8F0';c.font='bold 18px Arial';c.textAlign='center';c.textBaseline='middle';
  c.fillText(taxaDist!==null?(taxaDist*100).toFixed(0)+'%':'—',cx,cy-5);
  c.fillStyle='#64748B';c.font='10px Arial';c.fillText('precisão',cx,cy+13);
  // Legend on right portion of canvas
  [['Certas',distC,'#34D399'],['Erradas',distE,'#EF4444']].forEach(([l,v,col],i)=>{
    const ly=28+i*38;
    c.fillStyle=col;c.beginPath();c.arc(162,ly+5,6,0,Math.PI*2);c.fill();
    c.fillStyle='#94A3B8';c.font='11px Arial';c.textAlign='left';c.fillText(l,174,ly+9);
    c.fillStyle='#E2E8F0';c.font='bold 20px Arial';c.fillText(String(v),174,ly+30);
  });
  return cv;
}

function _pdfHeatmap(data,totalDef,totalGol) {
  const W=230,H=148,ox=10,oy=18,fw=172,fh=108;
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;
  const c=cv.getContext('2d');
  c.fillStyle='#0A0E1A';c.fillRect(0,0,W,H);
  // Field bg
  c.fillStyle='#111827';c.fillRect(ox,oy,fw,fh);
  const cw=fw/3,ch=fh/3;
  const flat=data.flat(),maxV=Math.max(...flat,1);
  data.forEach((row,ri)=>row.forEach((v,ci)=>{
    const bx=ox+ci*cw,by=oy+ri*ch,int2=v/maxV;
    c.fillStyle=`rgba(${Math.round(int2*220)},${30},${Math.round((1-int2)*220)},${.15+int2*.65})`;
    c.fillRect(bx+1,by+1,cw-2,ch-2);
    if(v>0){c.fillStyle='#F1F5F9';c.font=`bold ${v>9?14:18}px Arial`;c.textAlign='center';c.textBaseline='middle';c.fillText(v,bx+cw/2,by+ch/2);}
  }));
  // Grid
  c.strokeStyle='rgba(255,255,255,.12)';c.lineWidth=0.8;
  for(let i=1;i<3;i++){
    c.beginPath();c.moveTo(ox+i*cw,oy);c.lineTo(ox+i*cw,oy+fh);c.stroke();
    c.beginPath();c.moveTo(ox,oy+i*ch);c.lineTo(ox+fw,oy+i*ch);c.stroke();
  }
  c.strokeStyle='#2D3748';c.lineWidth=1.5;c.strokeRect(ox,oy,fw,fh);
  c.fillStyle='#64748B';c.font='9px Arial';c.textBaseline='top';
  c.textAlign='left';c.fillText('Esq.',ox,4);c.textAlign='right';c.fillText('Dir.',ox+fw,4);
  // Right legend
  const lx=ox+fw+8;
  c.fillStyle='#64748B';c.font='bold 8px Arial';c.textAlign='left';c.fillText('RESUMO',lx,oy+2);
  [[`Def: ${totalDef}`,'#3B82F6'],[`Gols: ${totalGol}`,'#EF4444'],[`Taxa: ${totalDef+totalGol>0?(totalDef/(totalDef+totalGol)*100).toFixed(0)+'%':'—'}`,'#34D399']].forEach(([t,col],i)=>{
    c.fillStyle=col;c.font='9px Arial';c.fillText(t,lx,oy+16+i*14);
  });
  return cv;
}

// ── PDF Profissional ─────────────────────────────────────────
function mcExportarRelatorioPDF() {
  try { _mcExportarRelatorioPDFImpl(); } catch(e) { console.error('PDF error:',e); toast('Erro ao gerar PDF: '+e.message,'error'); }
}
function _mcExportarRelatorioPDFImpl() {
  const { jsPDF }=window.jspdf;
  const segs=mcCurrentReportSegs||mcPendingSegmentos||[];
  if(!segs.length){toast('Nenhum dado para exportar','error');return;}

  // ── Data preparation ───────────────────────────────────────
  const partida=DB.partidas.find(p=>p.id===(mcPendingPId||segs[0]?.partidaId));
  const gkId=[...new Set(segs.map(s=>s.gkId))][0];
  const gk=DB.goleiras.find(g=>g.id===gkId);
  const gkSegs=segs.filter(s=>s.gkId===gkId);
  const sum=f=>gkSegs.reduce((a,s)=>a+(+s.data[f]||0),0);

  const defDif=sum('dad')+sum('dae');
  const defSim=sum('dbd')+sum('dbe')+sum('dc');
  const def1x1=sum('d1x1');
  const defEsq=sum('esq');
  const def=defDif+defSim+def1x1+defEsq;
  const gol=sum('gda')+sum('gfa')+sum('gpe')+sum('gfl');
  const distC=sum('dpc')+sum('dmc'), distE=sum('dpe')+sum('dme');
  const intercep=sum('int');
  const taxaDef=(def+gol)>0?def/(def+gol):null;
  const taxaDist=(distC+distE)>0?distC/(distC+distE):null;
  const nota=mcNotaAtual;
  const nivel=nota>=9?'ELITE':nota>=7.5?'DESTAQUE':nota>=6?'COMPETITIVA':nota>=4.5?'EM DESENVOLVIMENTO':'NECESSITA EVOLUÇÃO';
  const nRGB=nota>=9?[52,211,153]:nota>=7.5?[59,130,246]:nota>=6?[245,158,11]:nota>=4.5?[148,163,184]:[239,68,68];

  // Season stats
  const allSc=DB.scouts.filter(s=>s.goalkeeperId===gkId);
  const sAvg=fn=>allSc.length?allSc.reduce((a,s)=>a+fn(s),0)/allSc.length:null;
  const seasonNota=sAvg(s=>parseFloat(s.nota)||calcPerformanceAuto(s)||7);
  const seasonDef=sAvg(s=>(+s.dad||0)+(+s.dae||0)+(+s.dbd||0)+(+s.dbe||0)+(+s.dc||0)+(+s.d1x1||0)+(+s.esq||0));
  const seasonGol=sAvg(s=>(+s.gda||0)+(+s.gfa||0)+(+s.gpe||0)+(+s.gfl||0));
  const seasonTaxaDef=sAvg(s=>{const d=(+s.dad||0)+(+s.dae||0)+(+s.dbd||0)+(+s.dbe||0)+(+s.dc||0)+(+s.d1x1||0)+(+s.esq||0),g=(+s.gda||0)+(+s.gfa||0)+(+s.gpe||0)+(+s.gfl||0);return(d+g)>0?d/(d+g):0;});
  const sDistC=sAvg(s=>(+s.dpc||0)+(+s.dmc||0));
  const sDistE=sAvg(s=>(+s.dpe||0)+(+s.dme||0));
  const seasonTaxaDist=(sDistC&&sDistE&&(sDistC+sDistE)>0)?sDistC/(sDistC+sDistE):null;
  const seasonIntercep=sAvg(s=>(+s.int||0));

  const hasResult=partida?.gf!==undefined&&partida?.gc!==undefined;
  const resLabel=hasResult?(partida.gf>partida.gc?'VITÓRIA':partida.gf<partida.gc?'DERROTA':'EMPATE'):'';
  const resRGB=hasResult?(partida.gf>partida.gc?[16,185,129]:partida.gf<partida.gc?[239,68,68]:[245,158,11]):[100,116,139];

  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const W=210,H=297;
  const sF=(r,g,b)=>doc.setFillColor(r,g,b);
  const sT=(r,g,b)=>doc.setTextColor(r,g,b);
  const sD=(r,g,b)=>doc.setDrawColor(r,g,b);
  const rr=(x,y,w,h,_,style)=>doc.rect(x,y,w,h,style||'F');

  // Indicator colour: green = good, yellow = near, red = bad
  const indColor=(val,ref,hiGood=true)=>{
    if(ref===null||ref===undefined||val===null)return[100,116,139];
    return(hiGood?val>=ref*0.93:val<=ref*1.07)?[52,211,153]:(hiGood?val>=ref*0.78:val<=ref*1.22)?[245,158,11]:[239,68,68];
  };

  // Page header bar (reused each page)
  const pageHeader=(title)=>{
    sF(8,12,22);rr(0,0,W,H);
    sF(59,130,246);rr(0,0,W,1.5);
    sF(14,22,46);rr(0,2,W,14);
    doc.setFontSize(6.5);doc.setFont('helvetica','bold');sT(100,116,139);doc.text('GK HUB',15,11);
    doc.setFontSize(9);doc.setFont('helvetica','bold');sT(248,250,252);doc.text(title,W/2,11,{align:'center'});
    doc.setFontSize(6.5);doc.setFont('helvetica','normal');sT(100,116,139);doc.text(gk?.nome||'',W-15,11,{align:'right'});
    sF(30,50,100);rr(0,16,W,0.5);
  };

  // Section header with optional x-offset for right column
  const sh=(lbl,yy,rgb=[59,130,246],xx=15)=>{
    sF(...rgb);rr(xx,yy,3,5);
    doc.setFontSize(8);doc.setFont('helvetica','bold');sT(...rgb);doc.text(lbl,xx+5,yy+3.8);
    sD(...rgb.map(v=>Math.round(v*0.35)));doc.setLineWidth(0.2);
    return yy+9;
  };

  // ═══════════════════════════════════════════════════════════
  // PAGE 1 — CAPA PROFISSIONAL
  // ═══════════════════════════════════════════════════════════
  // Background layers
  sF(6,10,20);rr(0,0,W,H);
  sF(10,16,34);rr(0,0,W,160);
  sF(16,24,50);rr(0,0,W,90);

  // Accent lines
  sF(59,130,246);rr(0,0,W,2.5);
  sF(30,58,138);rr(0,2.5,W,1);

  // Decorative geometric shapes
  sD(30,50,110);doc.setLineWidth(0.4);
  doc.circle(W-20,50,80,'S');
  doc.circle(W-10,35,55,'S');
  sD(20,38,85);doc.setLineWidth(0.25);
  doc.circle(25,H-35,55,'S');
  sD(15,28,65);
  doc.circle(W+10,H/2,70,'S');

  // Logo block
  sF(59,130,246);rr(15,13,9,9);
  sF(30,58,138);rr(15,13,9,4);
  doc.setFontSize(11);doc.setFont('helvetica','bold');sT(248,250,252);doc.text('GK HUB',27,20);
  doc.setFontSize(6.5);doc.setFont('helvetica','normal');sT(100,116,139);
  doc.text('Plataforma de Análise de Goleiras de Futsal',27,25.5);

  // Report type tag
  sF(20,40,90);rr(15,32,90,8);
  sF(59,130,246);rr(15,32,3,8);
  doc.setFontSize(8);doc.setFont('helvetica','bold');sT(147,197,253);doc.text('RELATÓRIO INDIVIDUAL DE DESEMPENHO',19,37.5);

  // Match pill row
  const mpParts=[];
  if(partida?.adversario)mpParts.push('vs. '+partida.adversario);
  if(partida?.competicao)mpParts.push(partida.competicao);
  if(partida?.data)mpParts.push(formatDate(partida.data));
  if(mpParts.length){
    doc.setFontSize(8);doc.setFont('helvetica','normal');sT(148,163,184);
    doc.text(mpParts.join('   ·   '),15,47);
  }

  // GK Name — large hero text
  doc.setFontSize(34);doc.setFont('helvetica','bold');sT(248,250,252);
  doc.text(gk?.nome||'Goleira',15,70,{maxWidth:135});
  sF(59,130,246);rr(15,74,55,1.5);

  // Classification badge
  const clBg=nRGB.map(v=>Math.round(v*0.12));
  sF(...clBg);rr(15,80,95,24);
  sF(...nRGB);rr(15,80,3,24);
  doc.setFontSize(18);doc.setFont('helvetica','bold');sT(...nRGB);doc.text(nivel,22,92);
  doc.setFontSize(7);doc.setFont('helvetica','normal');sT(148,163,184);doc.text('CLASSIFICAÇÃO DE DESEMPENHO',22,99);

  // Result pill
  if(hasResult){
    sF(...resRGB);rr(15,110,40,14);
    doc.setFontSize(13);doc.setFont('helvetica','bold');sT(255,255,255);doc.text(`${partida.gf}×${partida.gc}`,35,120,{align:'center'});
    doc.setFontSize(6.5);doc.setFont('helvetica','bold');sT(255,255,255);doc.text(resLabel,35,126,{align:'center'});
    sF(...resRGB.map(v=>Math.round(v*0.5)));rr(15,110,3,14);
  }

  // Nota final card (right side)
  sF(10,16,34);rr(W-78,12,63,115);
  sF(59,130,246);rr(W-78,12,63,3);
  sF(20,35,72);rr(W-78,15,63,8);
  doc.setFontSize(7);doc.setFont('helvetica','bold');sT(147,197,253);doc.text('NOTA FINAL',W-46.5,21,{align:'center'});

  // Score ring
  sD(...nRGB);doc.setLineWidth(3);doc.circle(W-46.5,60,20,'S');
  sD(20,35,70);doc.setLineWidth(1.5);doc.circle(W-46.5,60,22,'S');
  doc.setFontSize(30);doc.setFont('helvetica','bold');sT(...nRGB);doc.text(nota.toFixed(1),W-46.5,65,{align:'center'});
  doc.setFontSize(7);doc.setFont('helvetica','normal');sT(100,116,139);doc.text('/ 10.0',W-46.5,73,{align:'center'});
  doc.setFontSize(8.5);doc.setFont('helvetica','bold');sT(...nRGB);doc.text(nivel,W-46.5,82,{align:'center'});

  // Match data items
  const mInfo=[];
  if(partida?.adversario)mInfo.push(['ADVERSÁRIO',partida.adversario]);
  if(partida?.data)mInfo.push(['DATA',formatDate(partida.data)]);
  if(partida?.competicao)mInfo.push(['COMPETIÇÃO',partida.competicao]);
  mInfo.slice(0,3).forEach((it,i)=>{
    const iy=92+i*13;
    sD(30,50,90);doc.setLineWidth(0.25);doc.line(W-76,iy,W-17,iy);
    doc.setFontSize(5.5);doc.setFont('helvetica','bold');sT(100,116,139);doc.text(it[0],W-76,iy+4.5);
    doc.setFontSize(7.5);doc.setFont('helvetica','bold');sT(220,228,240);doc.text(String(it[1]),W-76,iy+10,{maxWidth:56});
  });

  // 6 mini-KPI strip at bottom of page 1
  sF(12,18,38);rr(0,145,W,55);
  sF(59,130,246);rr(0,145,W,1);
  doc.setFontSize(7);doc.setFont('helvetica','bold');sT(147,197,253);doc.text('RESUMO ESTATÍSTICO',W/2,153,{align:'center'});

  const kpis1=[
    {l:'DEFESAS',v:String(def),c:[59,130,246]},
    {l:'GOLS SOFR.',v:String(gol),c:[239,68,68]},
    {l:'APROVEIT.',v:taxaDef!==null?(taxaDef*100).toFixed(0)+'%':'—',c:[52,211,153]},
    {l:'DIST. PREC.',v:taxaDist!==null?(taxaDist*100).toFixed(0)+'%':'—',c:[245,158,11]},
    {l:'INTERCEP.',v:String(intercep),c:[139,92,246]},
    {l:'SEQ. MÁX.',v:mcMaxStreak>0?mcMaxStreak+'x':'—',c:[248,250,252]},
  ];
  const kw1=(W-30)/6;
  kpis1.forEach((k,i)=>{
    const kx=15+i*kw1;
    sF(...k.c.map(v=>Math.round(v*0.12)));rr(kx,157,kw1-2,33);
    sF(...k.c);rr(kx,157,kw1-2,2.5);
    doc.setFontSize(5.5);doc.setFont('helvetica','bold');sT(100,116,139);doc.text(k.l,kx+(kw1-2)/2,163,{align:'center'});
    doc.setFontSize(14);doc.setFont('helvetica','bold');sT(...k.c);doc.text(k.v,kx+(kw1-2)/2,178,{align:'center'});
  });

  // Page 1 bottom
  sF(8,12,22);rr(0,202,W,H-202);
  sF(30,50,100);rr(0,202,W,0.5);
  doc.setFontSize(7);doc.setFont('helvetica','normal');sT(100,116,139);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} · GK Hub`,W/2,215,{align:'center'});
  doc.text(`${gkSegs.length} período(s) analisado(s) · ${allSc.length} partida(s) na temporada`,W/2,222,{align:'center'});

  // ═══════════════════════════════════════════════════════════
  // PAGE 2 — RESUMO EXECUTIVO + TIMELINE
  // ═══════════════════════════════════════════════════════════
  doc.addPage();
  pageHeader('RESUMO EXECUTIVO');
  let y=24;

  // KPI cards (2 rows × 3)
  y=sh('INDICADORES CHAVE DA PARTIDA',y);
  const kpis2=[
    {l:'NOTA FINAL',v:nota.toFixed(1),sub:seasonNota?`μ ${seasonNota.toFixed(1)}`:'',c:nRGB,ind:indColor(nota,seasonNota)},
    {l:'DEFESAS',v:String(def),sub:seasonDef?`μ ${seasonDef.toFixed(1)}`:'',c:[59,130,246],ind:indColor(def,seasonDef)},
    {l:'GOLS SOFR.',v:String(gol),sub:seasonGol?`μ ${seasonGol.toFixed(1)}`:'',c:[239,68,68],ind:indColor(gol,seasonGol,false)},
    {l:'APROVEITAMENTO',v:taxaDef!==null?(taxaDef*100).toFixed(0)+'%':'—',sub:seasonTaxaDef?`μ ${(seasonTaxaDef*100).toFixed(0)}%`:'',c:[52,211,153],ind:taxaDef!==null?indColor(taxaDef,seasonTaxaDef):null},
    {l:'DIST. PRECISÃO',v:taxaDist!==null?(taxaDist*100).toFixed(0)+'%':'—',sub:seasonTaxaDist?`μ ${(seasonTaxaDist*100).toFixed(0)}%`:'',c:[245,158,11],ind:taxaDist!==null?indColor(taxaDist,seasonTaxaDist):null},
    {l:'INTERCEPTAÇÕES',v:String(intercep),sub:seasonIntercep?`μ ${seasonIntercep.toFixed(1)}`:'',c:[139,92,246],ind:indColor(intercep,seasonIntercep)},
  ];
  const cardW=(W-34)/3, cardH=30;
  kpis2.forEach((k,i)=>{
    const cx=15+(i%3)*(cardW+2), cy=y+Math.floor(i/3)*(cardH+3);
    sF(14,20,42);rr(cx,cy,cardW,cardH);
    sF(...k.c);rr(cx,cy,cardW,2.5);
    doc.setFontSize(5.5);doc.setFont('helvetica','bold');sT(100,116,139);doc.text(k.l,cx+4,cy+8);
    doc.setFontSize(17);doc.setFont('helvetica','bold');sT(...k.c);doc.text(k.v,cx+cardW/2,cy+21,{align:'center'});
    if(k.sub){doc.setFontSize(5.5);doc.setFont('helvetica','normal');sT(100,116,139);doc.text(k.sub,cx+cardW/2,cy+27,{align:'center'});}
    if(k.ind){sF(...k.ind);doc.circle(cx+cardW-5,cy+7,2.2,'F');}
  });
  y+=cardH*2+3+3+8;

  // Legend
  [[52,211,153,'Acima da média'],[245,158,11,'Na média'],[239,68,68,'Abaixo da média']].forEach(([r,g,b,l],i)=>{
    sF(r,g,b);doc.circle(15+i*45,y+2,1.5,'F');
    doc.setFontSize(6);doc.setFont('helvetica','normal');sT(100,116,139);doc.text(l,19+i*45,y+3.2);
  });
  y+=9;

  // Performance timeline
  y=sh('EVOLUÇÃO DO DESEMPENHO NA PARTIDA',y);
  const tlCV=_pdfLineChart(mcNotaHistory);
  if(tlCV){
    doc.addImage(tlCV.toDataURL('image/png'),'PNG',15,y,W-30,48);
    y+=52;
    // Phase tags
    const fases=mcDetectFases();
    if(fases.length){
      const fRGB={alta:[52,211,153],queda:[239,68,68],recuperacao:[59,130,246]};
      const fIcon={alta:'ALTA PERF.',queda:'QUEDA',recuperacao:'RECUPER.'};
      fases.slice(0,4).forEach((f,i)=>{
        const fc=fRGB[f.tipo]||[100,116,139];
        sF(...fc.map(v=>Math.round(v*0.13)));rr(15+i*47,y,44,10);
        sF(...fc);rr(15+i*47,y,3,10);
        doc.setFontSize(6.5);doc.setFont('helvetica','bold');sT(...fc);doc.text(fIcon[f.tipo]||f.tipo.toUpperCase(),22+i*47,y+4.5);
        doc.setFontSize(5.5);doc.setFont('helvetica','normal');sT(148,163,184);
        doc.text(mcFormatTime(f.inicio)+' – '+mcFormatTime(f.fim),22+i*47,y+8.5);
      });
      y+=14;
    }
  } else {
    sF(14,20,42);rr(15,y,W-30,22);
    sT(100,116,139);doc.setFontSize(8);doc.text('Timeline disponível ao usar o Match Center ao vivo',W/2,y+13,{align:'center'});
    y+=26;
  }

  // Comparison table
  y=sh('COMPARAÇÃO COM A TEMPORADA',y,[52,211,153]);
  const cW3=(W-30)/3;
  sF(20,35,72);rr(15,y,W-30,8);
  ['MÉTRICA','ESTA PARTIDA','TEMPORADA (μ)'].forEach((h,i)=>{
    doc.setFontSize(6.5);doc.setFont('helvetica','bold');sT(147,197,253);
    doc.text(h,15+i*cW3+cW3/2,y+5.5,{align:'center'});
  });
  y+=8;
  const cmpR=[
    {l:'Nota Final',p:nota.toFixed(1),t:seasonNota?.toFixed(1)||'—',cur:nota,ref:seasonNota,hi:true},
    {l:'Defesas',p:String(def),t:seasonDef?.toFixed(1)||'—',cur:def,ref:seasonDef,hi:true},
    {l:'Gols Sofridos',p:String(gol),t:seasonGol?.toFixed(1)||'—',cur:gol,ref:seasonGol,hi:false},
    {l:'Aproveitamento',p:taxaDef!==null?(taxaDef*100).toFixed(0)+'%':'—',t:seasonTaxaDef?(seasonTaxaDef*100).toFixed(0)+'%':'—',cur:taxaDef,ref:seasonTaxaDef,hi:true},
    {l:'Distribuição',p:taxaDist!==null?(taxaDist*100).toFixed(0)+'%':'—',t:seasonTaxaDist?(seasonTaxaDist*100).toFixed(0)+'%':'—',cur:taxaDist,ref:seasonTaxaDist,hi:true},
  ];
  cmpR.forEach((row,i)=>{
    sF(i%2===0?14:12,i%2===0?22:18,i%2===0?42:36);rr(15,y,W-30,9);
    doc.setFontSize(7.5);doc.setFont('helvetica','normal');sT(180,195,215);doc.text(row.l,21,y+6.2);
    const col=row.ref!==null?indColor(row.cur,row.ref,row.hi):[100,116,139];
    doc.setFont('helvetica','bold');sT(...col);doc.text(row.p,15+cW3+cW3/2,y+6.2,{align:'center'});
    doc.setFont('helvetica','normal');sT(148,163,184);doc.text(row.t,15+2*cW3+cW3/2,y+6.2,{align:'center'});
    y+=9;
  });
  y+=5;

  // ═══════════════════════════════════════════════════════════
  // PAGE 3 — ANÁLISE TÉCNICA
  // ═══════════════════════════════════════════════════════════
  doc.addPage();
  pageHeader('ANÁLISE TÉCNICA');
  y=24;

  const hW=(W-35)/2, lX=15, rX=15+hW+5;
  const chartH=Math.round(hW*130/260);
  const hmH=Math.round(hW*148/230);

  // Defense breakdown bar
  y=sh('DEFESAS POR TIPO',y);
  sh('DISTRIBUIÇÃO DE PASSES',y-9,[245,158,11],rX);
  const defCV=_pdfBarChart(
    ['Dif.D','Dif.E','1×1','Simp.','Centr.','Esq.'],
    [sum('dad'),sum('dae'),sum('d1x1'),sum('dbd')+sum('dbe'),sum('dc'),sum('esq')],
    ['#3B82F6','#6366F1','#EC4899','#10B981','#F59E0B','#EF4444']
  );
  if(defCV)doc.addImage(defCV.toDataURL('image/png'),'PNG',lX,y,hW,chartH);
  const dstCV=_pdfDonut(distC,distE,taxaDist);
  if(dstCV)doc.addImage(dstCV.toDataURL('image/png'),'PNG',rX,y,hW,chartH);
  y+=chartH+5;

  // Heatmap + season bars
  y=sh('MAPA DE CHUTES / DEFESAS',y);
  sh('VS. MÉDIA DA TEMPORADA',y-9,[52,211,153],rX);
  const hmCV=_pdfHeatmap([[sum('dae'),0,sum('dad')],[sum('dc'),sum('esq'),sum('dc')],[sum('dbe'),0,sum('dbd')]],def,gol);
  if(hmCV)doc.addImage(hmCV.toDataURL('image/png'),'PNG',lX,y,hW,hmH);

  // Heatmap analysis text
  const hmTotal=def+gol;
  const hmTexts=[];
  if(hmTotal>0){
    const pctDireito=hmTotal>0?Math.round((sum('dad')+sum('dbd'))/hmTotal*100):0;
    const pctEsq=hmTotal>0?Math.round((sum('dae')+sum('dbe'))/hmTotal*100):0;
    const pctCentro=hmTotal>0?Math.round((sum('dc')+sum('esq'))/hmTotal*100):0;
    if(pctDireito>40)hmTexts.push(`${pctDireito}% das ações pelo lado direito`);
    if(pctEsq>40)hmTexts.push(`${pctEsq}% das ações pelo lado esquerdo`);
    if(pctCentro>35)hmTexts.push(`Concentração central: ${pctCentro}% das ações`);
    if(defEsq>0)hmTexts.push(`${defEsq} defesa(s) em esquadro — alto grau de dificuldade`);
  }
  if(hmTexts.length){
    hmTexts.slice(0,3).forEach((t,i)=>{
      sF(14,22,46);rr(lX,y+hmH+3+i*8,hW,7);
      doc.setFontSize(6.5);doc.setFont('helvetica','normal');sT(180,195,215);doc.text('▸ '+t,lX+3,y+hmH+7.5+i*8,{maxWidth:hW-5});
    });
  }

  // Season comparison bars (right side)
  let cy2=y;
  const cmpBars=[
    {l:'Nota Final',cur:nota,ref:seasonNota,fmt:v=>v.toFixed(1),hi:true},
    {l:'Defesas',cur:def,ref:seasonDef,fmt:v=>String(Math.round(v)),hi:true},
    {l:'Gols Sofr.',cur:gol,ref:seasonGol,fmt:v=>String(Math.round(v)),hi:false},
    {l:'Aproveit.',cur:taxaDef!==null?taxaDef*100:null,ref:seasonTaxaDef!==null?seasonTaxaDef*100:null,fmt:v=>v.toFixed(0)+'%',hi:true},
  ];
  cmpBars.forEach(it=>{
    if(it.cur===null)return;
    sF(14,22,44);rr(rX,cy2,hW-2,14);
    const col=indColor(it.cur,it.ref,it.hi);
    doc.setFontSize(6.5);doc.setFont('helvetica','normal');sT(148,163,184);doc.text(it.l,rX+3,cy2+5.5);
    doc.setFontSize(9.5);doc.setFont('helvetica','bold');sT(...col);doc.text(String(it.fmt(it.cur)),rX+hW-5,cy2+5.5,{align:'right'});
    if(it.ref!==null&&it.ref!==undefined){doc.setFontSize(6);doc.setFont('helvetica','normal');sT(100,116,139);doc.text(`μ ${it.fmt(it.ref)}`,rX+hW-5,cy2+11,{align:'right'});}
    const ratio=it.ref?Math.min(1,it.cur/(it.ref*1.4)):0.6;
    sF(22,32,55);rr(rX+2,cy2+9,hW-7,3);
    sF(...col);rr(rX+2,cy2+9,Math.max(2,(hW-7)*ratio),3);
    cy2+=17;
  });
  y=Math.max(y+hmH+28,cy2)+6;

  // Highlights block
  if(y<230){
    y=sh('DESTAQUES DA PARTIDA',y);
    const hlItems=[
      {l:'MELHOR MOMENTO',v:`${mcMaxNota.toFixed(1)} pts`,sub:mcFormatTime(mcBestNotaSec),c:[52,211,153]},
      {l:'MAIOR PRESSÃO',v:`${mcMinNota.toFixed(1)} pts`,sub:mcFormatTime(mcWorstNotaSec),c:[239,68,68]},
      {l:'DEF. DESTAQUE',v:def1x1>0?`${def1x1} x 1×1`:defEsq>0?`${defEsq} esq.`:`${def} total`,sub:'tipo defensivo',c:[59,130,246]},
      {l:'TENDÊNCIA',v:mcMaxPosStreak>mcMaxNegStreak?'Crescimento':mcMaxNegStreak>mcMaxPosStreak?'Em Queda':'Estável',sub:`seq. +${mcMaxPosStreak} / -${mcMaxNegStreak}`,c:[139,92,246]},
    ];
    const hlW=(W-30-9)/4;
    hlItems.forEach((h,i)=>{
      const hx=15+i*(hlW+3);
      sF(...h.c.map(v=>Math.round(v*0.1)));rr(hx,y,hlW,21);
      sF(...h.c);rr(hx,y,hlW,4);
      doc.setFontSize(5);doc.setFont('helvetica','bold');sT(255,255,255);doc.text(h.l,hx+hlW/2,y+2.9,{align:'center'});
      doc.setFontSize(10);doc.setFont('helvetica','bold');sT(...h.c);doc.text(h.v,hx+hlW/2,y+13,{align:'center',maxWidth:hlW-2});
      doc.setFontSize(5.5);doc.setFont('helvetica','normal');sT(148,163,184);doc.text(h.sub,hx+hlW/2,y+19,{align:'center'});
    });
    y+=25;
  }

  // ═══════════════════════════════════════════════════════════
  // PAGE 4 — ANÁLISE + RECOMENDAÇÕES
  // ═══════════════════════════════════════════════════════════
  doc.addPage();
  pageHeader('ANÁLISE E RECOMENDAÇÕES');
  y=24;

  // Build analysis
  const forcas=[];
  if(taxaDef!==null&&taxaDef>=0.85)forcas.push(`Taxa de defesa excepcional: ${(taxaDef*100).toFixed(0)}%`);
  else if(taxaDef!==null&&taxaDef>=0.75)forcas.push(`Bom aproveitamento defensivo: ${(taxaDef*100).toFixed(0)}%`);
  if(taxaDist!==null&&taxaDist>=0.80)forcas.push(`Distribuição precisa: ${(taxaDist*100).toFixed(0)}% de acerto`);
  else if(taxaDist!==null&&taxaDist>=0.65)forcas.push(`Distribuição dentro da média: ${(taxaDist*100).toFixed(0)}%`);
  if(mcMaxStreak>=4)forcas.push(`Sequência positiva de ${mcMaxStreak} ações sem gol`);
  if(intercep>=2)forcas.push(`${intercep} interceptações — excelente leitura de jogo`);
  if(def1x1>=2)forcas.push(`${def1x1} defesa(s) 1×1 — capacidade de resposta ao drible`);
  if(defDif>=3)forcas.push(`${defDif} defesas difíceis — alto nível técnico`);
  if(!forcas.length)forcas.push('Dados insuficientes para análise completa — continue registrando partidas');

  const mels=[];
  if(taxaDef!==null&&taxaDef<0.65)mels.push(`Aproveitamento abaixo de 65% — foco em posicionamento`);
  if(taxaDist!==null&&taxaDist<0.55)mels.push(`Distribuição imprecisa: ${(taxaDist*100).toFixed(0)}% — trabalhar precisão`);
  if(sum('gpe')>=1)mels.push(`${sum('gpe')} gol(is) de pênalti — estudar padrão dos cobradores`);
  if(sum('gfl')>=1)mels.push(`${sum('gfl')} gol(is) de falta — ajustar posicionamento na barreira`);
  if(distE>distC)mels.push('Mais erros que acertos na distribuição — prioridade no treino');
  if(mcMaxNegStreak>=4)mels.push(`Sequência negativa de ${mcMaxNegStreak} — treinar resistência psicológica`);
  if(!mels.length)mels.push('Manter o nível e continuar evoluindo nos pontos de destaque');

  // Strengths + improvements cards
  y=sh('ANÁLISE DA ATUAÇÃO',y);
  const aH=Math.max(forcas.length,mels.length)*7+12;
  sF(6,18,12);rr(lX,y,hW,aH);
  sF(16,185,129);rr(lX,y,hW,5.5);
  doc.setFontSize(7.5);doc.setFont('helvetica','bold');sT(255,255,255);doc.text('PONTOS FORTES',lX+hW/2,y+4,{align:'center'});
  forcas.forEach((f,i)=>{
    sF(52,211,153);doc.circle(lX+4,y+11+i*7,1.5,'F');
    doc.setFontSize(7);doc.setFont('helvetica','normal');sT(180,240,200);doc.text(f,lX+8,y+12+i*7,{maxWidth:hW-10});
  });
  sF(22,12,6);rr(rX,y,hW,aH);
  sF(245,158,11);rr(rX,y,hW,5.5);
  doc.setFontSize(7.5);doc.setFont('helvetica','bold');sT(255,255,255);doc.text('A DESENVOLVER',rX+hW/2,y+4,{align:'center'});
  mels.forEach((m,i)=>{
    sF(245,158,11);doc.circle(rX+4,y+11+i*7,1.5,'F');
    doc.setFontSize(7);doc.setFont('helvetica','normal');sT(255,235,180);doc.text(m,rX+8,y+12+i*7,{maxWidth:hW-10});
  });
  y+=aH+6;

  // Recommendations
  y=sh('RECOMENDAÇÕES DE TREINO',y,[59,130,246]);
  const recs=[];
  if(taxaDef!==null&&taxaDef<0.75)recs.push('Trabalho de posicionamento com cones e séries de finalização variada');
  if(taxaDist!==null&&taxaDist<0.70)recs.push('Sessão de distribuição: 20 min/treino com alvos a 10m e 18m');
  if(sum('gpe')>=1)recs.push('Estudo de vídeo das cobranças de pênalti — mapeamento de lateralidade');
  if(def1x1<2&&def>=3)recs.push('Treino de saída em 1×1 — tempo de reação e leitura do finalizador');
  recs.push('Revisão em vídeo dos momentos-chave com comissão técnica');
  recs.push('Hidratação e recuperação: 48h de descanso antes do próximo treino intenso');
  recs.forEach((r,i)=>{
    if(y>262){doc.addPage();pageHeader('ANÁLISE E RECOMENDAÇÕES');y=24;}
    sF(59,130,246);rr(lX,y,7,7);
    doc.setFontSize(7.5);doc.setFont('helvetica','bold');sT(255,255,255);doc.text(String(i+1),lX+3.5,y+5,{align:'center'});
    doc.setFontSize(8);doc.setFont('helvetica','normal');sT(200,212,232);doc.text(r,lX+10,y+5,{maxWidth:W-lX-12-5});
    y+=9.5;
  });
  y+=4;

  // Technical assessment paragraph
  if(y<250){
    y=sh('PARECER TÉCNICO FINAL',y,[139,92,246]);
    const parecer=_gerarParecer(nota,taxaDef,taxaDist,def,gol,def1x1,intercep,mcMaxPosStreak,mcMaxNegStreak);
    sF(16,12,32);rr(lX,y,W-30,32);
    sF(139,92,246);rr(lX,y,3,32);
    doc.setFontSize(8);doc.setFont('helvetica','italic');sT(210,195,240);
    doc.text(parecer,lX+6,y+6,{maxWidth:W-35,lineHeightFactor:1.55});
    y+=36;
  }

  // ── EVENT TIMELINE TABLE ───────────────────────────────────
  const evts=mcLog.filter(e=>e.tipo!=='periodo'&&e.key&&MC_NOTA_PESOS[e.key]!==undefined).slice(0,30);
  if(evts.length){
    if(y>230){doc.addPage();pageHeader('LINHA DO TEMPO');y=24;}
    y=sh('LINHA DO TEMPO DA PARTIDA',y,[245,158,11]);
    doc.autoTable({
      startY:y,
      head:[['TEMPO','EVENTO','PERÍODO','PESO']],
      body:evts.map(e=>{const p=MC_NOTA_PESOS[e.key];const ps=p!==undefined?(p>=0?`+${p.toFixed(2)}`:p.toFixed(2)):'—';return[e.time||'—',e.label||'—',(e.periodo||'1')+'T',ps];}),
      styles:{textColor:[200,210,230],fillColor:[14,20,40],lineColor:[25,38,65],fontSize:7.5,cellPadding:2.5},
      headStyles:{fillColor:[20,38,80],textColor:[147,197,253],fontStyle:'bold',fontSize:7},
      alternateRowStyles:{fillColor:[18,26,50]},
      columnStyles:{0:{cellWidth:20},1:{cellWidth:'auto'},2:{cellWidth:18},3:{cellWidth:18,halign:'center'}},
      theme:'grid',margin:{left:15,right:15}
    });
    y=doc.lastAutoTable.finalY+5;
  }

  // ── FOOTER ALL PAGES ───────────────────────────────────────
  const pages=doc.internal.getNumberOfPages();
  for(let pi=1;pi<=pages;pi++){
    doc.setPage(pi);
    sF(10,15,32);rr(0,H-10,W,10);
    sD(30,50,100);doc.setLineWidth(0.3);doc.line(0,H-10,W,H-10);
    doc.setFontSize(6);doc.setFont('helvetica','normal');sT(100,116,139);
    doc.text('GK Hub — Plataforma de Análise de Goleiras de Futsal',15,H-3);
    doc.text(`${pi} / ${pages}`,W-15,H-3,{align:'right'});
    doc.text(new Date().toLocaleDateString('pt-BR'),W/2,H-3,{align:'center'});
  }

  doc.save(`GKHub_${(gk?.nome||'goleira').replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.pdf`);
  logReport({ type: 'individual', title: 'Relatório Completo — ' + (gk?.nome || 'goleira'), athlete: gk?.nome, athleteId: gk?.id });
  toast('Relatório exportado com sucesso!','success');
}

function _gerarParecer(nota,taxaDef,taxaDist,def,gol,def1x1,intercep,posStreak,negStreak){
  const nivel=nota>=9?'excepcional':nota>=7.5?'consistente e de alta qualidade':nota>=6?'dentro do esperado para o nível competitivo':'abaixo do potencial esperado';
  let texto=`A goleira apresentou atuação ${nivel} nesta partida`;
  if(taxaDef!==null){
    texto+=`, com aproveitamento defensivo de ${(taxaDef*100).toFixed(0)}%`;
    if(taxaDef>=0.80)texto+=' — índice que coloca a atleta entre as melhores da categoria';
    else if(taxaDef<0.60)texto+=' — número que requer atenção imediata na fase de treinos';
  }
  texto+='.';
  if(def1x1>=2)texto+=` Destacou-se nas ações de 1×1, demonstrando leitura de jogo e tempo de reação elevados.`;
  if(intercep>=2)texto+=` As ${intercep} interceptações revelam excelente antecipação e participação na construção ofensiva.`;
  if(taxaDist!==null&&taxaDist>=0.70)texto+=` A distribuição precisa (${(taxaDist*100).toFixed(0)}%) contribuiu para a posse de bola da equipe.`;
  else if(taxaDist!==null&&taxaDist<0.55)texto+=` A distribuição imprecisa (${(taxaDist*100).toFixed(0)}%) foi o ponto mais crítico da atuação.`;
  if(posStreak>=4)texto+=` A sequência positiva de ${posStreak} ações evidencia capacidade de manter alto rendimento sob pressão.`;
  texto+=` Recomenda-se continuidade no monitoramento estatístico e revisão em vídeo dos momentos críticos para potencializar a evolução individual.`;
  return texto;
}

// ═══════════════════════════════════════════════════════════
// GOOGLE AUTH via Firebase Authentication
// ═══════════════════════════════════════════════════════════
let   _firebaseApp   = null;
let   _firebaseAuth  = null;

const _FB_DEFAULT_CONFIG = {
  apiKey: "AIzaSyCtqk0eP9a3ZlLF__OaWS2jUJuN2KgH10o",
  authDomain: "gkhub-4717d.firebaseapp.com",
  databaseURL: "https://gkhub-4717d-default-rtdb.firebaseio.com",
  projectId: "gkhub-4717d",
  storageBucket: "gkhub-4717d.firebasestorage.app",
  messagingSenderId: "338475414522",
  appId: "1:338475414522:web:d9f5e20ea1f583dd392a43"
};

function _initFirebaseAuth() {
  try {
    const cfg = _FB_DEFAULT_CONFIG;
    if (!_firebaseAuth) {
      // Evita "app already exists" em re-inicializações
      _firebaseApp  = firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg);
      _firebaseAuth = firebase.auth(_firebaseApp);
      _firebaseAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(()=>{});
      // Resultado de redirect (iOS usa signInWithRedirect)
      _firebaseAuth.getRedirectResult().then(result => {
        localStorage.removeItem('gkhub_google_redirect');
        if (result?.user) _googleLoginSuccess(result.user);
      }).catch(() => { localStorage.removeItem('gkhub_google_redirect'); });
      // Observer: usuário já logado (restaura sessão Firebase ao reabrir o app)
      _firebaseAuth.onAuthStateChanged(user => {
        if (user && !_loggedUser && !_googleLoginInProgress) _googleLoginSuccess(user);
      });
      // Init FCM após auth estar pronto
      setTimeout(_initFCM, 500);
    }
    return true;
  } catch(e) { console.error('Firebase init error:', e); return false; }
}

let _googleLoginInProgress = false;
async function _googleLoginSuccess(user) {
  // Guard: prevent double-call from popup result + onAuthStateChanged racing
  if (_googleLoginInProgress) return;
  _googleLoginInProgress = true;
  try {
    _loggedUser   = user.displayName || user.email;
    _sessionToken = _randToken();
    localStorage.setItem(_AUTH_SESSION, JSON.stringify({
      user: _loggedUser, token: _sessionToken,
      expiresAt: Date.now() + 86400000,
    }));
    const overlay = document.getElementById('auth-overlay');
    if (overlay) overlay.classList.add('hidden');
    _updateSidebarUser();
    // Exchange the Firebase ID token for a backend JWT so authed API calls work.
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(_API_URL + '/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      if (res.ok) {
        const data = await res.json();
        const payload = data?.data || data || {};
        const tok = payload.access_token || payload.accessToken;
        if (tok) localStorage.setItem(_API_TOKEN_KEY, tok);
      } else {
        console.warn('[GKHub] /auth/google failed:', res.status);
      }
    } catch (e) {
      console.warn('[GKHub] backend token exchange error:', e);
    }
    const token = _apiToken();
    if (token) {
      await _afterLoginLoadClubs();
    } else {
      navigate('dashboard');
    }
  } catch(e) {
    console.error('[GKHub] _googleLoginSuccess error:', e);
    // Force navigation even if something fails
    const overlay = document.getElementById('auth-overlay');
    if (overlay) overlay.classList.add('hidden');
    navigate('dashboard');
  } finally {
    // Allow future logins (e.g. after logout + re-login)
    setTimeout(() => { _googleLoginInProgress = false; }, 2000);
  }
}

async function authGoogle() {
  const errEl  = document.getElementById('auth-err');
  const btn    = document.querySelector('.btn-google');
  const _setBtnText = t => { if (btn) btn.innerHTML = t; };

  _setBtnText('Carregando…');
  if (errEl) errEl.style.display = 'none';

  if (typeof firebase === 'undefined') {
    _setBtnText('<svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> Entrar com Google');
    if (errEl) { errEl.textContent = 'Firebase não carregado. Faça Ctrl+Shift+R e tente novamente.'; errEl.style.display = 'block'; }
    return;
  }

  const ready = _initFirebaseAuth();
  if (!ready) {
    _setBtnText('Entrar com Google');
    if (errEl) { errEl.textContent = 'Erro ao inicializar Firebase. Verifique o console (F12).'; errEl.style.display = 'block'; }
    return;
  }

  const _googleBtnHtml = `<svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> Entrar com Google`;
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');
    provider.setCustomParameters({ prompt: 'select_account' });
    _setBtnText('Abrindo Google…');
    try {
      const result = await _firebaseAuth.signInWithPopup(provider);
      if (result?.user) await _googleLoginSuccess(result.user);
    } catch(popupErr) {
      console.warn('[GKHub] popup error:', popupErr.code, popupErr.message);
      if (popupErr.code === 'auth/popup-blocked' ||
          popupErr.code === 'auth/cancelled-popup-request' ||
          popupErr.code === 'auth/popup-closed-by-user') {
        if (popupErr.code !== 'auth/popup-closed-by-user') {
          // Fallback para redirect quando popup é bloqueado
          _setBtnText('Redirecionando…');
          localStorage.setItem('gkhub_google_redirect', '1');
          await _firebaseAuth.signInWithRedirect(provider);
        } else {
          if (errEl) { errEl.textContent = 'Login cancelado. Tente novamente.'; errEl.style.display = 'block'; }
        }
      } else {
        throw popupErr;
      }
    }
  } catch(e) {
    console.error('[GKHub] authGoogle error:', e.code, e.message);
    const msg = e.code === 'auth/unauthorized-domain'
              ? `Domínio não autorizado no Firebase. Acesse o Firebase Console → Authentication → Authorized domains e adicione: pedro03376-droid.github.io`
              : e.code === 'auth/internal-error'
              ? 'Erro interno do Firebase. Verifique se o domínio está autorizado no Firebase Console.'
              : e.code === 'auth/network-request-failed'
              ? 'Sem conexão com a internet. Verifique sua rede e tente novamente.'
              : `Erro: ${e.message || e.code}`;
    if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
  } finally {
    _setBtnText(_googleBtnHtml);
  }
}

function _checkGoogleConfigured() {
  return true; // config embutida no código
}

// ═══════════════════════════════════════════════════════════
// AUTH — Sessão
// ═══════════════════════════════════════════════════════════
const _AUTH_SESSION = 'gkhub_session';

let _loggedUser     = null;
let _sessionToken   = null;

function _randToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2,'0')).join('');
}

function _esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ═══════════════════════════════════════════════════════════
   AUTENTICAÇÃO DE 2 FATORES (TOTP — app autenticador)
   Verificação por app (Google Authenticator/Authy) na abertura.
   Segundo fator no dispositivo (segredo no navegador) + códigos
   de recuperação. Padrão TOTP RFC 6238, verificado localmente.
   ═══════════════════════════════════════════════════════════ */
function gk2fa() { try { return JSON.parse(localStorage.getItem('gkhub_2fa') || '{}'); } catch (e) { return {}; } }
function gk2faEnabled() { return !!gk2fa().enabled; }
const _B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function _b32encode(bytes) { let bits = 0, val = 0, out = ''; for (const b of bytes) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += _B32[(val >>> (bits - 5)) & 31]; bits -= 5; } } if (bits > 0) out += _B32[(val << (5 - bits)) & 31]; return out; }
function _b32decode(s) { s = (s || '').toUpperCase().replace(/[^A-Z2-7]/g, ''); let bits = 0, val = 0; const out = []; for (const c of s) { const i = _B32.indexOf(c); if (i < 0) continue; val = (val << 5) | i; bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 0xff); bits -= 8; } } return new Uint8Array(out); }
async function _hotp(keyBytes, counter) {
  const buf = new ArrayBuffer(8), dv = new DataView(buf);
  dv.setUint32(0, Math.floor(counter / 0x100000000)); dv.setUint32(4, counter >>> 0);
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf));
  const off = sig[19] & 0xf;
  const code = ((sig[off] & 0x7f) << 24) | (sig[off + 1] << 16) | (sig[off + 2] << 8) | sig[off + 3];
  return (code % 1000000).toString().padStart(6, '0');
}
async function _totpNow(secretB32, skew) { return _hotp(_b32decode(secretB32), Math.floor(Date.now() / 30000) + (skew || 0)); }
async function _totpVerify(secretB32, code) {
  code = (code || '').replace(/\D/g, '');
  if (code.length !== 6) return false;
  for (const s of [-1, 0, 1]) { if (await _totpNow(secretB32, s) === code) return true; }
  return false;
}
function _gen2FASecret() { const b = new Uint8Array(20); crypto.getRandomValues(b); return _b32encode(b); }
function _genRecovery() { const out = []; for (let i = 0; i < 5; i++) { const b = new Uint8Array(5); crypto.getRandomValues(b); out.push(_b32encode(b).slice(0, 8)); } return out; }

let _pending2FASecret = null;
function openTwoFactorSetup() {
  let modal = document.getElementById('twofa-modal');
  if (!modal) { modal = document.createElement('div'); modal.id = 'twofa-modal'; modal.className = 'modal-backdrop'; document.body.appendChild(modal); }
  if (gk2faEnabled()) {
    modal.innerHTML = `
      <div class="modal" style="max-width:440px;">
        <div class="modal-header"><span class="modal-title">🔒 2FA ativado</span><button class="modal-close" onclick="closeModal('twofa-modal')">&times;</button></div>
        <div class="modal-body" style="font-size:13px;line-height:1.6;">
          <p>A verificação em duas etapas está <b style="color:var(--success);">ativa</b>. Ao abrir o app, será pedido o código do seu app autenticador.</p>
          <p style="color:var(--muted);margin-top:8px;">Para desativar, informe um código atual:</p>
          <input id="twofa-off-code" class="form-input" inputmode="numeric" maxlength="6" placeholder="Código de 6 dígitos" style="margin-top:6px;">
          <div id="twofa-off-err" style="color:var(--error);font-size:12px;margin-top:6px;"></div>
        </div>
        <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal('twofa-modal')">Fechar</button><button class="btn btn-danger" onclick="disable2FA()">Desativar 2FA</button></div>
      </div>`;
    openModal('twofa-modal');
    return;
  }
  _pending2FASecret = _gen2FASecret();
  const user = (typeof _loggedUser === 'string' && _loggedUser) || 'goleiro';
  const otpauth = `otpauth://totp/GK%20Hub:${encodeURIComponent(user)}?secret=${_pending2FASecret}&issuer=GK%20Hub&period=30&digits=6`;
  modal.innerHTML = `
    <div class="modal" style="max-width:460px;">
      <div class="modal-header"><span class="modal-title">🔒 Ativar 2FA</span><button class="modal-close" onclick="closeModal('twofa-modal')">&times;</button></div>
      <div class="modal-body" style="font-size:13px;line-height:1.6;">
        <p>1. Abra seu app autenticador (Google Authenticator, Authy, Microsoft Authenticator…) e adicione uma conta com <b>"inserir chave de configuração"</b>.</p>
        <p style="margin-top:8px;">2. Nome: <b>GK Hub</b> · Tipo: <b>Baseado em tempo</b> · Chave:</p>
        <div style="display:flex;gap:8px;align-items:center;margin:8px 0;">
          <code style="flex:1;background:var(--bg);padding:10px;border-radius:8px;font-size:15px;letter-spacing:2px;word-break:break-all;">${_pending2FASecret}</code>
          <button class="btn btn-secondary btn-sm" onclick="navigator.clipboard&&navigator.clipboard.writeText('${_pending2FASecret}');toast('Chave copiada.','success')">Copiar</button>
        </div>
        <details style="margin:6px 0;"><summary style="cursor:pointer;color:var(--muted);font-size:12px;">Link otpauth (avançado)</summary><code style="font-size:11px;word-break:break-all;color:var(--muted);">${_esc(otpauth)}</code></details>
        <p style="margin-top:10px;">3. Digite o código de 6 dígitos que aparecer no app para confirmar:</p>
        <input id="twofa-confirm" class="form-input" inputmode="numeric" maxlength="6" placeholder="000000" style="margin-top:6px;font-size:18px;letter-spacing:4px;text-align:center;">
        <div id="twofa-confirm-err" style="color:var(--error);font-size:12px;margin-top:6px;"></div>
      </div>
      <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal('twofa-modal')">Cancelar</button><button class="btn btn-primary" onclick="confirm2FA()">Ativar</button></div>
    </div>`;
  openModal('twofa-modal');
}
async function confirm2FA() {
  const code = (document.getElementById('twofa-confirm')?.value || '').trim();
  const err = document.getElementById('twofa-confirm-err');
  if (!_pending2FASecret) return;
  if (!(await _totpVerify(_pending2FASecret, code))) { if (err) err.textContent = 'Código incorreto. Verifique a hora do celular e tente de novo.'; return; }
  const recovery = _genRecovery();
  localStorage.setItem('gkhub_2fa', JSON.stringify({ enabled: true, secret: _pending2FASecret, recovery }));
  sessionStorage.setItem('gkhub_2fa_ok', '1');
  _pending2FASecret = null;
  logAudit('Segurança', 'Ativou a autenticação de 2 fatores');
  const modal = document.getElementById('twofa-modal');
  modal.innerHTML = `
    <div class="modal" style="max-width:440px;">
      <div class="modal-header"><span class="modal-title">✅ 2FA ativado</span><button class="modal-close" onclick="closeModal('twofa-modal')">&times;</button></div>
      <div class="modal-body" style="font-size:13px;line-height:1.6;">
        <p style="color:var(--warning);"><b>Guarde estes códigos de recuperação</b> em local seguro. Cada um funciona uma vez, caso você perca o celular:</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0;">
          ${recovery.map(c => `<code style="background:var(--bg);padding:8px;border-radius:6px;text-align:center;letter-spacing:2px;">${c}</code>`).join('')}
        </div>
        <p style="color:var(--muted);font-size:12px;">A partir de agora, ao abrir o app será pedido o código do autenticador.</p>
      </div>
      <div class="modal-footer"><button class="btn btn-primary" onclick="closeModal('twofa-modal')">Concluir</button></div>
    </div>`;
}
async function disable2FA() {
  const code = (document.getElementById('twofa-off-code')?.value || '').trim();
  const err = document.getElementById('twofa-off-err');
  const cfg = gk2fa();
  const ok = await _totpVerify(cfg.secret, code) || (cfg.recovery || []).includes(code.toUpperCase());
  if (!ok) { if (err) err.textContent = 'Código inválido.'; return; }
  localStorage.removeItem('gkhub_2fa'); sessionStorage.removeItem('gkhub_2fa_ok');
  logAudit('Segurança', 'Desativou a autenticação de 2 fatores');
  closeModal('twofa-modal'); toast('2FA desativado.', 'info');
}

// Bloqueio na abertura — mostrado quando o app é revelado (via observer)
function _maybeShow2FA() {
  if (!gk2faEnabled() || sessionStorage.getItem('gkhub_2fa_ok')) return;
  if (document.getElementById('twofa-lock')) return;
  const lock = document.createElement('div');
  lock.id = 'twofa-lock';
  lock.style.cssText = 'position:fixed;inset:0;z-index:9000;background:var(--bg);display:flex;align-items:center;justify-content:center;padding:20px;';
  lock.innerHTML = `
    <div style="max-width:340px;width:100%;text-align:center;">
      <div style="font-size:40px;">🔒</div>
      <h2 style="font-size:20px;font-weight:800;margin:10px 0 4px;">Verificação em 2 etapas</h2>
      <p style="color:var(--muted);font-size:13px;margin-bottom:18px;">Digite o código do seu app autenticador.</p>
      <input id="twofa-code" class="form-input" inputmode="numeric" maxlength="6" placeholder="000000" style="font-size:22px;letter-spacing:6px;text-align:center;" onkeydown="if(event.key==='Enter')_verify2FALogin()">
      <div id="twofa-err" style="color:var(--error);font-size:12px;margin-top:8px;min-height:16px;"></div>
      <button class="btn btn-primary" style="width:100%;margin-top:10px;" onclick="_verify2FALogin()">Verificar</button>
      <div style="margin-top:14px;"><a onclick="_use2FARecovery()" style="color:var(--muted);font-size:12px;cursor:pointer;text-decoration:underline;">Usar código de recuperação</a></div>
      <div style="margin-top:8px;"><a onclick="authLogout()" style="color:var(--muted);font-size:12px;cursor:pointer;">Sair</a></div>
    </div>`;
  document.body.appendChild(lock);
  setTimeout(() => document.getElementById('twofa-code')?.focus(), 60);
}
function _use2FARecovery() {
  const p = document.getElementById('twofa-code');
  if (p) { p.maxLength = 8; p.placeholder = 'Código de recuperação'; p.style.letterSpacing = '2px'; p.value = ''; p.focus(); }
  const e = document.getElementById('twofa-err'); if (e) e.textContent = '';
}
async function _verify2FALogin() {
  const code = (document.getElementById('twofa-code')?.value || '').trim();
  const cfg = gk2fa();
  let ok = false;
  if (/^\d{6}$/.test(code)) ok = await _totpVerify(cfg.secret, code);
  if (!ok && (cfg.recovery || []).includes(code.toUpperCase())) {
    ok = true; cfg.recovery = cfg.recovery.filter(c => c !== code.toUpperCase());
    localStorage.setItem('gkhub_2fa', JSON.stringify(cfg));
    toast('Código de recuperação usado. Restam ' + cfg.recovery.length + '.', 'info');
  }
  if (ok) { sessionStorage.setItem('gkhub_2fa_ok', '1'); document.getElementById('twofa-lock')?.remove(); }
  else { const e = document.getElementById('twofa-err'); if (e) e.textContent = 'Código inválido. Tente novamente.'; }
}
function _init2FA() {
  const ov = document.getElementById('auth-overlay');
  if (ov && 'MutationObserver' in window) {
    new MutationObserver(() => { if (ov.classList.contains('hidden')) _maybeShow2FA(); }).observe(ov, { attributes: true, attributeFilter: ['class'] });
  }
  if (ov && ov.classList.contains('hidden')) _maybeShow2FA();
}

function initAuth() {
  // Verifica sessão IMEDIATAMENTE (síncrono) — não bloqueia a UI
  try {
    const stored = JSON.parse(localStorage.getItem(_AUTH_SESSION) || 'null');
    if (stored?.token && stored?.user) {
      if (stored.expiresAt && Date.now() > stored.expiresAt) {
        localStorage.removeItem(_AUTH_SESSION);
      } else {
        _loggedUser   = stored.user;
        _sessionToken = stored.token;
        document.getElementById('auth-overlay').classList.add('hidden');
        _updateSidebarUser();
        navigate('dashboard');
      }
    }
  } catch(e) {
    localStorage.removeItem(_AUTH_SESSION);
  }
  // Inicializa Firebase Auth com config embutida
  _initFirebaseAuth();
  // Mostra botão de biometria se cadastrado
  _initBioButton();

  // Hash routing para atalhos PWA (#matchcenter, #scout, etc.)
  const hash = window.location.hash.replace('#','');
  if (hash && document.getElementById('page-'+hash)) {
    setTimeout(() => navigate(hash), 0);
  }
}


function _updateSidebarUser() {
  const el = document.getElementById('auth-sidebar-user');
  if (el && _loggedUser) el.textContent = _loggedUser;
  // Topbar avatar initial
  const avatar = document.getElementById('topbar-user-avatar');
  if (avatar && _loggedUser) {
    avatar.innerHTML = `<span style="font-size:13px;font-weight:700;">${(_loggedUser[0]||'?').toUpperCase()}</span>`;
  }
  // Topbar date
  const dateEl = document.getElementById('topbar-date');
  if (dateEl) {
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  }
  // Restore active workspace in sidebar
  const saved = localStorage.getItem('gkhub_active_workspace');
  if (saved) {
    try {
      const ws = JSON.parse(saved);
      _activeWorkspaceId = ws.teamId;
      const nameEl = document.getElementById('sidebar-club-name');
      const subEl  = document.getElementById('sidebar-club-sub');
      if (nameEl) nameEl.textContent = ws.teamName;
      if (subEl)  subEl.textContent  = 'GK Hub';
      // Update topbar team name
      const seasonBadge = document.getElementById('topbar-season');
      if (seasonBadge) seasonBadge.textContent = ws.teamName;
    } catch(e) {}
  }
}

// ── WebAuthn / Face ID ─────────────────────────────────────
const _BIO_KEY = 'gkhub_biometric';

function _bioSupported() {
  return !!(window.PublicKeyCredential && navigator.credentials?.create);
}

function _bioStored() {
  try { return JSON.parse(localStorage.getItem(_BIO_KEY) || 'null'); } catch(e) { return null; }
}

function _initBioButton() {
  const sec = document.getElementById('auth-bio-section');
  if (sec) sec.style.display = (_bioSupported() && _bioStored()) ? 'block' : 'none';
}

async function authBiometric() {
  const stored = _bioStored();
  if (!stored) return;
  const errEl = document.getElementById('auth-err');
  try {
    const credIdBytes = Uint8Array.from(atob(stored.credId), c => c.charCodeAt(0));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ id: credIdBytes, type: 'public-key' }],
        userVerification: 'required',
        timeout: 60000
      }
    });
    if (assertion) {
      _loggedUser = stored.user;
      _sessionToken = _randToken();
      localStorage.setItem(_AUTH_SESSION, JSON.stringify({ user: _loggedUser, token: _sessionToken, expiresAt: Date.now() + 86400000 }));
      document.getElementById('auth-overlay').classList.add('hidden');
      _updateSidebarUser();
      navigate('dashboard');
      if (errEl) errEl.style.display = 'none';
    }
  } catch(e) {
    if (errEl) { errEl.textContent = 'Biometria cancelada ou não reconhecida.'; errEl.style.display = 'block'; }
  }
}

async function _registerBiometric(userName) {
  if (!_bioSupported()) return false;
  try {
    const userId = crypto.getRandomValues(new Uint8Array(16));
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'GK Hub', id: window.location.hostname },
        user: { id: userId, name: userName, displayName: userName },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
        timeout: 60000
      }
    });
    if (credential) {
      const credId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
      localStorage.setItem(_BIO_KEY, JSON.stringify({ credId, user: userName }));
      return true;
    }
  } catch(e) {}
  return false;
}

async function _offerBiometric(userName) {
  if (!_bioSupported() || _bioStored()) return;
  const ok = confirm('Deseja habilitar o Face ID / biometria para entrar mais rápido na próxima vez?');
  if (!ok) return;
  const registered = await _registerBiometric(userName);
  if (registered) alert('Face ID habilitado! Na próxima vez use o botão de biometria.');
}
// ───────────────────────────────────────────────────────────

let _loginBusy = false;
async function authLogin() {
  if (_loginBusy) return;
  _loginBusy = true;
  const email  = (document.getElementById('auth-email')?.value || '').trim();
  const pass   = (document.getElementById('auth-pass')?.value || '');
  const errEl  = document.getElementById('auth-err');
  const btn    = document.getElementById('auth-login-btn');

  errEl.style.display = 'none';
  if (!email || !pass) {
    errEl.textContent = 'Preencha email e senha.';
    errEl.style.display = 'block';
    _loginBusy = false;
    return;
  }
  if (btn) { btn.disabled = true; btn.textContent = 'Entrando…'; }

  try {
    const result = await apiLogin(email, pass);
    if (result) {
      localStorage.setItem('gkhub_backend_email', email);
      _loggedUser   = result.user?.name || email;
      _sessionToken = result.accessToken;
      localStorage.setItem(_AUTH_SESSION, JSON.stringify({
        user: _loggedUser, token: _sessionToken,
        expiresAt: Date.now() + 86400000,
        isBackend: true,
      }));
      document.getElementById('auth-overlay').classList.add('hidden');
      _updateSidebarUser();
      await _afterLoginLoadClubs();
    } else {
      errEl.textContent = 'Email ou senha incorretos.';
      errEl.style.display = 'block';
      document.getElementById('auth-pass').value = '';
    }
  } catch(e) {
    errEl.textContent = 'Erro de conexão com o servidor. Verifique sua internet.';
    errEl.style.display = 'block';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
    _loginBusy = false;
  }
}

/* ── Post-login: load clubs and show selector or go directly ── */
async function _afterLoginLoadClubs() {
  try {
    const workspaces = await api.get('/teams/my-workspaces');
    _workspaces = Array.isArray(workspaces) ? workspaces : (workspaces?.data || []);
  } catch(e) { _workspaces = []; }

  if (_workspaces.length === 0) {
    // No clubs — go to dashboard directly
    navigate('dashboard');
    toast('Bem-vindo! Nenhum clube vinculado ainda.', 'info');
  } else if (_workspaces.length === 1) {
    // Single club — auto-select
    _setActiveWorkspace(_workspaces[0].teamId, _workspaces[0].teamName);
    navigate('dashboard');
  } else {
    // Multiple clubs — show selector
    showClubSelector();
  }
}

function showClubSelector() {
  if (!_workspaces.length) {
    // Load first
    api.get('/teams/my-workspaces').then(data => {
      _workspaces = Array.isArray(data) ? data : (data?.data || []);
      _renderClubSelector();
    }).catch(() => { navigate('dashboard'); });
    return;
  }
  _renderClubSelector();
}

function _renderClubSelector() {
  const overlay = document.getElementById('club-selector-overlay');
  const list    = document.getElementById('club-selector-list');
  if (!overlay || !list) return;
  const roleLabel = { admin:'Administrador', coach:'Preparador', viewer:'Visualizador' };
  list.innerHTML = _workspaces.map(w => `
    <button onclick="switchWorkspace('${_esc(w.teamId)}','${_esc(w.teamName)}')"
      style="width:100%;text-align:left;padding:16px 18px;background:var(--card);
             border:1px solid ${_activeWorkspaceId===w.teamId?'var(--primary)':'var(--border)'};
             border-radius:var(--radius);cursor:pointer;transition:border-color .2s;
             display:flex;align-items:center;gap:14px;">
      <div style="width:42px;height:42px;border-radius:10px;background:var(--primary-g);
                  display:flex;align-items:center;justify-content:center;
                  font-size:18px;font-weight:800;color:#fff;flex-shrink:0;">
        ${_esc(w.teamName[0].toUpperCase())}
      </div>
      <div style="flex:1;">
        <div style="font-weight:700;font-size:15px;">${_esc(w.teamName)}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px;">${roleLabel[w.role]||w.role}</div>
      </div>
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" width="16" height="16"><polyline points="9 18 15 12 9 6"/></svg>
    </button>`).join('');
  // Create options
  list.innerHTML += `
    <button onclick="createWorkspace('Clube')"
      style="width:100%;text-align:left;padding:14px 18px;background:transparent;
             border:1px dashed var(--border);border-radius:var(--radius);cursor:pointer;
             display:flex;align-items:center;gap:14px;color:var(--text);">
      <div style="width:42px;height:42px;border-radius:10px;border:1px dashed var(--muted);
                  display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--muted);flex-shrink:0;">+</div>
      <div style="font-weight:700;font-size:15px;">Criar clube</div>
    </button>
    <button onclick="createWorkspace('Seleção')"
      style="width:100%;text-align:left;padding:14px 18px;background:transparent;
             border:1px dashed var(--border);border-radius:var(--radius);cursor:pointer;
             display:flex;align-items:center;gap:14px;color:var(--text);">
      <div style="width:42px;height:42px;border-radius:10px;border:1px dashed var(--muted);
                  display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">🏆</div>
      <div style="font-weight:700;font-size:15px;">Criar seleção</div>
    </button>`;
  overlay.style.display = 'flex';
}

/* Creates a club or national team for the current user, then switches to it. */
async function createWorkspace(category) {
  const label = category === 'Seleção' ? 'seleção' : 'clube';
  const name = (prompt('Nome do(a) ' + label + ':') || '').trim();
  if (!name) return;
  try {
    toast('Criando ' + label + '…', 'info');
    const result = await api.post('/teams/mine', { name, category });
    const team = (result && result.data) ? result.data : result;
    const teamId = team && (team.id || team.teamId);
    if (!teamId) throw new Error('no team id');
    await switchWorkspace(teamId, name);
  } catch (e) {
    toast('Não foi possível criar. Tente novamente.', 'error');
  }
}

function _setActiveWorkspace(teamId, teamName) {
  _activeWorkspaceId = teamId;
  localStorage.setItem('gkhub_active_workspace', JSON.stringify({ teamId, teamName }));
  document.getElementById('sidebar-club-name').textContent = teamName;
  document.getElementById('sidebar-club-sub').textContent = 'GK Hub';
  document.getElementById('club-selector-overlay').style.display = 'none';
}

function authLogout() {
  _loggedUser   = null;
  _sessionToken = null;
  _activeWorkspaceId = null;
  _workspaces = [];
  localStorage.removeItem(_AUTH_SESSION);
  localStorage.removeItem(_API_TOKEN_KEY);
  localStorage.removeItem('gkhub_backend_email');
  localStorage.removeItem('gkhub_active_workspace');
  document.getElementById('auth-overlay').classList.remove('hidden');
  document.getElementById('club-selector-overlay').style.display = 'none';
  if (document.getElementById('auth-email')) document.getElementById('auth-email').value = '';
  if (document.getElementById('auth-pass'))  document.getElementById('auth-pass').value  = '';
  document.getElementById('auth-err').style.display = 'none';
  document.getElementById('sidebar-club-name').textContent = 'GKHub';
  document.getElementById('sidebar-club-sub').textContent  = 'Goalkeeper Performance Platform';
}

/* ── Club Registration ───────────────────────────────── */
function openRegister() {
  document.getElementById('register-overlay').classList.remove('hidden');
}
function closeRegister() {
  document.getElementById('register-overlay').classList.add('hidden');
  document.getElementById('register-err').style.display = 'none';
  document.getElementById('register-success').style.display = 'none';
}
function updateSlugPreview() {
  const name = document.getElementById('reg-clubname').value;
  const slug = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  document.getElementById('reg-slug').value = slug;
  document.getElementById('slug-preview').textContent = slug ? 'Identificador: ' + slug : '';
}
function sanitizeSlug() {
  const el = document.getElementById('reg-slug');
  el.value = el.value.toLowerCase().replace(/[^a-z0-9-]/g,'');
  document.getElementById('slug-preview').textContent = el.value ? 'Identificador: ' + el.value : '';
}
async function submitRegisterClub() {
  const clubName = document.getElementById('reg-clubname').value.trim();
  const slug     = document.getElementById('reg-slug').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const sport    = document.getElementById('reg-sport').value.trim() || 'Futsal';
  const errEl    = document.getElementById('register-err');
  const okEl     = document.getElementById('register-success');
  const btn      = document.getElementById('reg-btn');

  errEl.style.display = 'none';
  okEl.style.display  = 'none';

  if (!clubName) { errEl.textContent = 'Informe o nome do clube.'; errEl.style.display='block'; return; }
  if (!slug)     { errEl.textContent = 'Informe o identificador do clube.'; errEl.style.display='block'; return; }
  if (!email)    { errEl.textContent = 'Informe o email do administrador.'; errEl.style.display='block'; return; }
  if (password.length < 8) { errEl.textContent = 'A senha deve ter ao menos 8 caracteres.'; errEl.style.display='block'; return; }

  btn.disabled = true;
  btn.textContent = 'Criando...';
  try {
    const res = await fetch(_API_URL + '/teams/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubName, slug, ownerEmail: email, password, sport }),
    });
    const data = await res.json();
    if (!res.ok) {
      errEl.textContent = data.message || ('Erro ' + res.status);
      errEl.style.display = 'block';
    } else {
      okEl.innerHTML = '✅ <strong>Clube cadastrado com sucesso!</strong><br>Período de teste: 30 dias.<br><br>Faça login com o email e senha cadastrados.';
      okEl.style.display = 'block';
      document.getElementById('reg-clubname').value = '';
      document.getElementById('reg-slug').value     = '';
      document.getElementById('reg-email').value    = '';
      document.getElementById('reg-password').value = '';
    }
  } catch(e) {
    errEl.textContent = 'Erro de conexão com o servidor. Verifique sua internet.';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Criar Conta do Clube';
  }
}

/* ── Workspace Switcher ──────────────────────────────── */
let _workspaces = [];
let _activeWorkspaceId = null;

function toggleWorkspaceMenu() {
  const menu = document.getElementById('workspace-menu');
  const isOpen = menu.style.display === 'block';
  menu.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) loadWorkspaces();
}

async function loadWorkspaces() {
  const token = _apiToken();
  if (!token) return;
  try {
    const data = await api.get('/teams/my-workspaces');
    _workspaces = Array.isArray(data) ? data : (data.data || []);
    const list = document.getElementById('workspace-list');
    if (!_workspaces.length) {
      list.innerHTML = '<div style="padding:6px 8px;font-size:12px;color:var(--muted);">Nenhum workspace encontrado</div>';
      return;
    }
    list.innerHTML = _workspaces.map(w => `
      <button onclick="switchWorkspace('${_esc(w.teamId)}','${_esc(w.teamName)}')"
        style="width:100%;text-align:left;padding:7px 8px;font-size:12px;border-radius:6px;
               background:${_activeWorkspaceId===w.teamId?'rgba(59,130,246,.12)':'none'};
               border:none;cursor:pointer;color:var(--text);display:flex;align-items:center;gap:6px;">
        <span style="width:6px;height:6px;border-radius:50%;background:${_activeWorkspaceId===w.teamId?'var(--primary)':'var(--muted)'};flex-shrink:0;"></span>
        <span style="flex:1;">${_esc(w.teamName)}</span>
        <span style="font-size:10px;color:var(--muted);">${_esc(w.role)}</span>
      </button>`).join('');
    document.getElementById('workspace-switcher').style.display = 'block';
  } catch(e) { /* API not available or user has no memberships */ }
}

async function switchWorkspace(teamId, teamName) {
  const menu = document.getElementById('workspace-menu');
  if (menu) menu.style.display = 'none';
  const overlay = document.getElementById('club-selector-overlay');

  // Same team — just set it locally, no reload needed.
  if (teamId === _activeWorkspaceId) {
    _activeWorkspaceId = teamId;
    localStorage.setItem('gkhub_active_workspace', JSON.stringify({ teamId, teamName }));
    const nameEl = document.getElementById('workspace-name');
    if (nameEl) nameEl.textContent = teamName;
    if (overlay) overlay.style.display = 'none';
    navigate('dashboard');
    return;
  }

  // Different team — ask the backend for a token scoped to it, then hard-reload
  // so every screen (goalkeepers, matches, training, …) shows that team's data.
  try {
    toast('Trocando de clube…', 'info');
    const result = await api.post('/auth/switch-team', { teamId });
    const payload = (result && result.data) ? result.data : (result || {});
    const newToken = payload.accessToken || payload.access_token
      || (result && (result.accessToken || result.access_token));
    if (!newToken) throw new Error('no token');
    localStorage.setItem(_API_TOKEN_KEY, newToken);
    localStorage.setItem('gkhub_active_workspace', JSON.stringify({ teamId, teamName }));
    if (overlay) overlay.style.display = 'none';
    location.reload();
  } catch (e) {
    toast('Não foi possível trocar de clube. Tente novamente.', 'error');
  }
}

function initWorkspaceSwitcher() {
  const token = _apiToken();
  if (!token) return;
  const saved = localStorage.getItem('gkhub_active_workspace');
  if (saved) {
    try {
      const ws = JSON.parse(saved);
      _activeWorkspaceId = ws.teamId;
      document.getElementById('workspace-name').textContent = ws.teamName;
      document.getElementById('workspace-switcher').style.display = 'block';
    } catch(e) {}
  }
  loadWorkspaces();
}

/* ── Club Members ────────────────────────────────────── */
async function loadClubMembers() {
  const token = _apiToken();
  const container = document.getElementById('club-members-list');
  if (!container) return;
  if (!token) {
    container.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:8px 0;">Faça login para ver os membros do clube.</div>';
    return;
  }
  // Auto-resolve workspace if not set yet
  if (!_activeWorkspaceId) {
    try {
      const ws = await api.get('/teams/my-workspaces');
      _workspaces = Array.isArray(ws) ? ws : (ws?.data || []);
      if (_workspaces.length > 0) {
        const first = _workspaces[0];
        _setActiveWorkspace(first.teamId, first.teamName);
      }
    } catch(e) {}
  }
  if (!_activeWorkspaceId) {
    container.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:8px 0;">Nenhum clube vinculado à sua conta.</div>';
    return;
  }
  container.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:8px 0;">Carregando...</div>';
  try {
    const data = await api.get('/teams/' + _activeWorkspaceId + '/members');
    const members = Array.isArray(data) ? data : (data.data || []);
    if (!members.length) {
      container.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:8px 0;">Nenhum membro cadastrado.</div>';
      return;
    }
    const roleLabel = { admin:'Admin', coach:'Preparador', viewer:'Visualizador' };
    const roleColor = { admin:'var(--primary)', coach:'var(--success)', viewer:'var(--muted)' };
    container.innerHTML = members.map(m => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
        <div style="width:34px;height:34px;border-radius:50%;background:var(--primary-g);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:#fff;flex-shrink:0;">
          ${_esc((m.name||m.email||'?')[0].toUpperCase())}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_esc(m.name||'—')}</div>
          <div style="font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_esc(m.email||'')}</div>
        </div>
        <span style="font-size:10px;font-weight:700;color:${roleColor[m.role]||'var(--muted)'};background:rgba(255,255,255,.06);padding:2px 8px;border-radius:20px;white-space:nowrap;">${roleLabel[m.role]||m.role}</span>
        <button onclick="removeMember('${_esc(m.userId)}')" title="Remover" style="background:none;border:none;cursor:pointer;color:var(--muted);padding:4px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </div>`).join('');
  } catch(e) {
    container.innerHTML = '<div style="color:var(--error);font-size:13px;padding:8px 0;">Erro ao carregar membros. Verifique o backend.</div>';
  }
}

function openAddMemberModal() {
  const modal = document.getElementById('add-member-modal');
  modal.style.display = 'flex';
  document.getElementById('add-member-email').value = '';
  document.getElementById('add-member-err').style.display = 'none';
}
function closeAddMemberModal() {
  document.getElementById('add-member-modal').style.display = 'none';
}

async function submitAddMember() {
  const email = document.getElementById('add-member-email').value.trim();
  const role  = document.getElementById('add-member-role').value;
  const errEl = document.getElementById('add-member-err');
  if (!email) { errEl.textContent='Informe o email.'; errEl.style.display='block'; return; }
  if (!_activeWorkspaceId) { errEl.textContent='Selecione um workspace primeiro.'; errEl.style.display='block'; return; }
  try {
    await api.post('/teams/' + _activeWorkspaceId + '/members', { email, role });
    closeAddMemberModal();
    loadClubMembers();
    toast('Membro adicionado com sucesso!', 'success');
  } catch(e) {
    errEl.textContent = e.message || 'Erro ao adicionar membro.';
    errEl.style.display = 'block';
  }
}

async function removeMember(userId) {
  if (!confirm('Remover este membro do clube?')) return;
  try {
    await api.delete('/teams/' + _activeWorkspaceId + '/members/' + userId);
    loadClubMembers();
    toast('Membro removido.', 'info');
  } catch(e) {
    toast('Erro ao remover membro.', 'error');
  }
}


// ═══════════════════════════════════════════════════════════
// FIREBASE REALTIME DATABASE — REST API (sem SDK)
// ═══════════════════════════════════════════════════════════
let rtdbUrl = null;

function setCloudStatus(connected, label) {
  const dot = document.getElementById('cloud-dot');
  const lbl = document.getElementById('cloud-label');
  if (dot) dot.style.background = connected ? 'var(--success)' : 'var(--muted)';
  if (lbl) lbl.textContent = 'Nuvem: ' + (label || (connected ? 'conectada' : 'offline'));
}

function rtdbPath(path) {
  return rtdbUrl + path + '.json';
}

// ═══════════════════════════════════════════════════════════
// TREINOS (Training Plus module) — Phase 2 dashboard
// ═══════════════════════════════════════════════════════════
let tpWorkloadChart = null;

function _tpUnwrap(x, fallback) {
  if (Array.isArray(x)) return x;
  if (x && typeof x === 'object' && 'data' in x) return x.data;
  return x != null ? x : fallback;
}

function _tpTeamId() {
  return (typeof _activeWorkspaceId !== 'undefined' && _activeWorkspaceId) || '';
}

const TP_STATUS_LABEL = {
  scheduled: 'Agendado', ongoing: 'Em andamento', finished: 'Concluído', cancelled: 'Cancelado',
};
const TP_STATUS_COLOR = {
  scheduled: 'var(--muted)', ongoing: 'var(--warning,#f59e0b)', finished: 'var(--success)', cancelled: '#ef4444',
};
const TP_BLOCK_TYPES = [
  { v: 'warmup', l: 'Aquecimento' }, { v: 'technical', l: 'Parte Técnica' },
  { v: 'physical', l: 'Parte Física' }, { v: 'tactical', l: 'Parte Tática' },
  { v: 'game', l: 'Jogo Aplicado' }, { v: 'stretching', l: 'Alongamento' },
];
const TP_BLOCK_LABEL = TP_BLOCK_TYPES.reduce((m, b) => (m[b.v] = b.l, m), {});

const TP_EX_CATEGORIES = [
  { v: 'reflex', l: 'Reflexo' }, { v: 'aerial', l: 'Bola aérea' },
  { v: 'lateral_dive', l: 'Mergulho lateral' }, { v: 'positioning', l: 'Posicionamento' },
  { v: 'goal_exit', l: 'Saída do gol' }, { v: 'one_v_one', l: '1x1' },
  { v: 'short_distribution', l: 'Reposição curta' }, { v: 'long_distribution', l: 'Reposição longa' },
  { v: 'communication', l: 'Comunicação' }, { v: 'decision_making', l: 'Tomada de decisão' },
  { v: 'coordination', l: 'Coordenação' }, { v: 'agility', l: 'Agilidade' },
  { v: 'explosiveness', l: 'Explosão' }, { v: 'endurance', l: 'Resistência' },
];
const TP_EX_LABEL = TP_EX_CATEGORIES.reduce((m, c) => (m[c.v] = c.l, m), {});

const TP_ATT_STATUS = [
  { v: 'present', l: 'Presente', c: 'var(--success)' },
  { v: 'partial', l: 'Parcial', c: 'var(--warning,#f59e0b)' },
  { v: 'absent', l: 'Ausente', c: '#ef4444' },
  { v: 'injured', l: 'Lesionada', c: '#a855f7' },
];
const TP_EVAL_FUNDAMENTALS = {
  technical: ['Reflexo', 'Saída de gol', 'Jogo de pés', 'Reposição', 'Bola aérea', '1x1'],
  physical: ['Explosão', 'Agilidade', 'Resistência', 'Força'],
  mental: ['Concentração', 'Comunicação', 'Tomada de decisão', 'Confiança'],
};
const TP_EVAL_GROUP_LABEL = { technical: 'Técnico', physical: 'Físico', mental: 'Mental' };

let _tpExercisesCache = [];

async function renderTpExercises() {
  const el = document.getElementById('tp-exercises');
  if (!el) return;
  const teamId = _tpTeamId();
  const search = (document.getElementById('tp-ex-search')?.value || '').trim();
  const params = [];
  if (teamId) params.push('teamId=' + encodeURIComponent(teamId));
  if (search) params.push('search=' + encodeURIComponent(search));
  const q = params.length ? '?' + params.join('&') : '';
  let list = [];
  try { list = _tpUnwrap(await api.get('/training-plus/exercises' + q), []) || []; } catch (e) { list = []; }
  _tpExercisesCache = list;
  if (!list.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:16px 0;">Nenhum exercício cadastrado.</div>';
    return;
  }
  el.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;">' +
    list.map(x => `
      <div class="stat-card" style="padding:12px;">
        <div style="display:flex;justify-content:space-between;gap:6px;align-items:start;">
          <div style="font-weight:700;font-size:14px;">${_esc(x.name || 'Exercício')}</div>
          <button class="btn btn-ghost btn-sm" style="color:#ef4444;padding:2px 6px;" onclick="tpDeleteExercise('${_esc(x.id)}')">✕</button>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px;">${_esc(TP_EX_LABEL[x.category] || x.category || '—')}${x.estimatedMinutes ? ' · ' + x.estimatedMinutes + ' min' : ''}${x.difficulty ? ' · dif. ' + x.difficulty : ''}</div>
        ${x.objective ? `<div style="font-size:12px;margin-top:6px;">${_esc(x.objective)}</div>` : ''}
        ${x.materials ? `<div style="font-size:11px;color:var(--muted);margin-top:4px;">🎒 ${_esc(x.materials)}</div>` : ''}
      </div>`).join('') + '</div>';
}

function openTpExerciseForm() {
  let modal = document.getElementById('tp-exercise-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'tp-exercise-modal';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal" style="max-width:480px;">
        <div class="modal-header">
          <span class="modal-title">Novo exercício</span>
          <button class="modal-close" onclick="closeModal('tp-exercise-modal')">&times;</button>
        </div>
        <div class="modal-body" style="display:grid;gap:12px;">
          <div><label class="form-label">Nome</label><input id="tp-ex-name" class="form-input"></div>
          <div><label class="form-label">Categoria</label>
            <select id="tp-ex-category" class="form-input">${TP_EX_CATEGORIES.map(c => `<option value="${c.v}">${c.l}</option>`).join('')}</select>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div><label class="form-label">Duração (min)</label><input id="tp-ex-minutes" type="number" min="0" class="form-input" value="10"></div>
            <div><label class="form-label">Dificuldade (1-5)</label><input id="tp-ex-difficulty" type="number" min="1" max="5" class="form-input" value="3"></div>
          </div>
          <div><label class="form-label">Objetivo</label><input id="tp-ex-objective" class="form-input"></div>
          <div><label class="form-label">Materiais</label><input id="tp-ex-materials" class="form-input" placeholder="Ex.: cones, bolas"></div>
          <div><label class="form-label">Descrição</label><textarea id="tp-ex-description" class="form-input" rows="2"></textarea></div>
        </div>
        <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:8px;">
          <button class="btn btn-secondary" onclick="closeModal('tp-exercise-modal')">Cancelar</button>
          <button class="btn btn-primary" onclick="createTpExercise()">Salvar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }
  ['name', 'objective', 'materials', 'description'].forEach(f => { const el = document.getElementById('tp-ex-' + f); if (el) el.value = ''; });
  openModal('tp-exercise-modal');
}

async function createTpExercise() {
  const val = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const name = val('tp-ex-name');
  if (!name) { toast('Informe o nome do exercício.', 'error'); return; }
  const body = {
    teamId: _tpTeamId() || undefined,
    name,
    category: document.getElementById('tp-ex-category')?.value,
    estimatedMinutes: parseInt(val('tp-ex-minutes'), 10) || undefined,
    difficulty: parseInt(val('tp-ex-difficulty'), 10) || undefined,
    objective: val('tp-ex-objective') || undefined,
    materials: val('tp-ex-materials') || undefined,
    description: val('tp-ex-description') || undefined,
  };
  try {
    toast('Salvando exercício…', 'info');
    await api.post('/training-plus/exercises', body);
    closeModal('tp-exercise-modal');
    toast('Exercício criado!', 'success');
    renderTpExercises();
  } catch (e) { toast('Não foi possível salvar.', 'error'); }
}

async function tpDeleteExercise(id) {
  if (!confirm('Excluir este exercício?')) return;
  try { await api.delete('/training-plus/exercises/' + id); toast('Exercício excluído.', 'success'); renderTpExercises(); }
  catch (e) { toast('Não foi possível excluir.', 'error'); }
}

// Calendar state — sessions cache for the current view + month offset
let _tpSessionsCache = [];
let _tpCalOffset = 0; // months from current

function _tpMonthDate() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + _tpCalOffset, 1);
}

function tpCalMove(delta) {
  _tpCalOffset += delta;
  tpRenderCalendar();
}

function tpRenderCalendar() {
  const title = document.getElementById('tp-cal-title');
  const grid = document.getElementById('tp-calendar');
  if (!grid) return;
  const base = _tpMonthDate();
  const year = base.getFullYear(), month = base.getMonth();
  const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  if (title) title.textContent = MONTHS[month] + ' ' + year;

  // Merge two event kinds by yyyy-mm-dd: training sessions + matches (jogos).
  const byDay = {};
  const push = (key, ev) => { (byDay[key] = byDay[key] || []).push(ev); };
  _tpSessionsCache.forEach(s => {
    if (!s.date) return;
    push(String(s.date).slice(0, 10), {
      kind: 'training',
      color: TP_STATUS_COLOR[s.status] || 'var(--muted)',
      label: s.title || 'Treino',
      onclick: `tpOpenSession('${_esc(s.id)}')`,
    });
  });
  const partidas = (typeof DB !== 'undefined' && DB.partidas) ? DB.partidas : [];
  partidas.forEach(p => {
    if (!p.data) return;
    const played = (p.gf != null && p.gc != null);
    const label = 'vs ' + (p.adversario || 'Adversário') + (played ? ` (${p.gf}×${p.gc})` : '');
    push(String(p.data).slice(0, 10), {
      kind: 'match',
      color: '#00D4FF',
      label,
      onclick: `tpOpenMatchFromCalendar('${_esc(p.id)}')`,
    });
  });

  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const DOW = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const pad = (n) => String(n).padStart(2, '0');

  let cells = DOW.map(d => `<div style="text-align:center;font-size:11px;color:var(--muted);font-weight:600;padding:4px 0;">${d}</div>`).join('');
  for (let i = 0; i < firstDow; i++) cells += '<div></div>';
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${year}-${pad(month + 1)}-${pad(day)}`;
    const list = byDay[key] || [];
    const chips = list.slice(0, 3).map(ev =>
      `<div onclick="event.stopPropagation();${ev.onclick}" title="${_esc(ev.label)}" style="cursor:pointer;display:flex;align-items:center;gap:4px;font-size:10px;line-height:1.3;padding:1px 3px;border-radius:4px;background:var(--bg);margin-top:2px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">
        <span style="flex:none;">${ev.kind === 'match' ? '⚽' : `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${ev.color};"></span>`}</span>
        <span style="overflow:hidden;text-overflow:ellipsis;color:${ev.kind === 'match' ? '#00D4FF' : 'inherit'};">${_esc(ev.label)}</span>
      </div>`).join('');
    cells += `<div style="min-height:56px;border:1px solid var(--border,#2a2a3a);border-radius:8px;padding:4px;">
      <div style="font-size:12px;font-weight:600;">${day}</div>
      ${chips}
      ${list.length > 3 ? `<div style="font-size:10px;color:var(--muted);margin-top:2px;">+${list.length - 3}</div>` : ''}
    </div>`;
  }
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(7,1fr)';
  grid.style.gap = '4px';
  grid.innerHTML = cells;

  // Legend
  const legend = document.getElementById('tp-cal-legend');
  if (legend) legend.innerHTML = `
    <span style="display:inline-flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:var(--success);display:inline-block;"></span>Treino concluído</span>
    <span style="display:inline-flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:var(--muted);display:inline-block;"></span>Treino agendado</span>
    <span style="display:inline-flex;align-items:center;gap:4px;">⚽ Jogo</span>`;
}

// Open a match from the training calendar: jump to Partidas and open its editor.
function tpOpenMatchFromCalendar(id) {
  if (typeof navigate === 'function') navigate('partidas');
  if (typeof editarPartida === 'function') editarPartida(id);
}

async function renderTreinos() {
  const teamId = _tpTeamId();
  const q = teamId ? ('?teamId=' + encodeURIComponent(teamId)) : '';
  const kpis = document.getElementById('tp-kpis');
  const nextEl = document.getElementById('tp-next');
  const sessEl = document.getElementById('tp-sessions');
  if (kpis) kpis.innerHTML = '<div style="color:var(--muted);font-size:13px;">Carregando…</div>';

  let dash = {}, sessions = [];
  try {
    dash = _tpUnwrap(await api.get('/training-plus/dashboard' + q), {}) || {};
  } catch (e) {
    if (kpis) kpis.innerHTML = '<div style="color:var(--muted);font-size:13px;">Não foi possível carregar os treinos. Verifique a conexão com o servidor.</div>';
    return;
  }
  try {
    sessions = _tpUnwrap(await api.get('/training-plus/sessions' + q), []) || [];
  } catch (e) { sessions = []; }
  _tpSessionsCache = sessions;
  _tpDashCache = dash;
  tpRenderCalendar();
  renderTpExercises();
  tpRenderCorrelation(sessions);
  tpRenderInsights(dash, sessions);

  // KPI cards
  const pct = (v) => (v == null ? '—' : Math.round(v) + '%');
  const num = (v) => (v == null ? '—' : (Math.round(v * 10) / 10));
  const cards = [
    { label: 'Sessões totais', value: dash.totalSessions ?? 0 },
    { label: 'Concluídas', value: dash.finishedSessions ?? 0 },
    { label: 'Presença média', value: pct(dash.attendanceRate) },
    { label: 'Avaliação média', value: num(dash.avgEvaluation) },
    { label: 'PSE média', value: num(dash.avgRpe) },
    { label: 'Carga semanal', value: dash.weeklyWorkload ?? 0 },
  ];
  if (kpis) kpis.innerHTML = cards.map(c => `
    <div class="stat-card" style="padding:14px 16px;">
      <div style="font-size:12px;color:var(--muted);font-weight:600;">${_esc(c.label)}</div>
      <div style="font-size:24px;font-weight:800;margin-top:4px;">${_esc(String(c.value))}</div>
    </div>`).join('');

  // Next session card
  if (nextEl) {
    const n = dash.nextSession;
    nextEl.innerHTML = n ? `
      <div style="font-size:15px;font-weight:700;">${_esc(n.title || 'Treino')}</div>
      <div style="color:var(--muted);font-size:13px;margin-top:4px;">${n.date ? formatDate(n.date) : '—'}${n.time ? ' · ' + _esc(n.time) : ''}</div>
      ${n.location ? `<div style="color:var(--muted);font-size:13px;">📍 ${_esc(n.location)}</div>` : ''}
      <button class="btn btn-secondary btn-sm" style="margin-top:10px;" onclick="tpOpenSession('${_esc(n.id)}')">Ver detalhes</button>
    ` : '<div style="color:var(--muted);font-size:13px;">Nenhum treino agendado.</div>';
  }

  // Workload chart (last sessions by workload proxy = duration × intensity)
  const canvas = document.getElementById('tp-chart-workload');
  if (canvas && typeof Chart !== 'undefined') {
    const recent = [...sessions]
      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
      .slice(-10);
    const labels = recent.map(s => s.date ? formatDate(s.date) : '—');
    const values = recent.map(s => (s.durationMinutes || 0) * (s.plannedIntensity || 0));
    if (tpWorkloadChart) tpWorkloadChart.destroy();
    if (recent.length) {
      tpWorkloadChart = new Chart(canvas, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Carga planejada', data: values, backgroundColor: 'rgba(59,130,246,.55)', borderRadius: 4 }] },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
      });
    } else {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  // Sessions list
  if (sessEl) {
    if (!sessions.length) {
      sessEl.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:20px 0;">Nenhuma sessão cadastrada. Clique em “+ Nova sessão” para começar.</div>';
    } else {
      const rows = [...sessions]
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
        .map(s => {
          const st = s.status || 'scheduled';
          return `<tr style="cursor:pointer;" onclick="tpOpenSession('${_esc(s.id)}')">
            <td>${s.date ? formatDate(s.date) : '—'}${s.time ? '<br><span style="color:var(--muted);font-size:12px;">' + _esc(s.time) + '</span>' : ''}</td>
            <td>${_esc(s.title || 'Treino')}${s.category ? '<br><span style="color:var(--muted);font-size:12px;">' + _esc(s.category) + '</span>' : ''}</td>
            <td>${s.location ? _esc(s.location) : '—'}</td>
            <td>${s.durationMinutes ? s.durationMinutes + ' min' : '—'}</td>
            <td><span style="color:${TP_STATUS_COLOR[st] || 'var(--muted)'};font-weight:600;font-size:12px;">${TP_STATUS_LABEL[st] || st}</span></td>
          </tr>`;
        }).join('');
      sessEl.innerHTML = `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead><tr style="text-align:left;color:var(--muted);font-size:12px;">
          <th style="padding:8px 6px;">Data</th><th style="padding:8px 6px;">Título</th>
          <th style="padding:8px 6px;">Local</th><th style="padding:8px 6px;">Duração</th><th style="padding:8px 6px;">Status</th>
        </tr></thead><tbody>${rows}</tbody></table></div>`;
    }
  }
}

function openTpSessionForm() {
  let modal = document.getElementById('tp-session-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'tp-session-modal';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal" style="max-width:520px;">
        <div class="modal-header">
          <span class="modal-title">Nova sessão de treino</span>
          <button class="modal-close" onclick="closeModal('tp-session-modal')">&times;</button>
        </div>
        <div class="modal-body" style="display:grid;gap:12px;">
          <div><label class="form-label">Título</label><input id="tp-f-title" class="form-input" placeholder="Ex.: Treino de reflexo"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div><label class="form-label">Data</label><input id="tp-f-date" type="date" class="form-input"></div>
            <div><label class="form-label">Horário</label><input id="tp-f-time" type="time" class="form-input"></div>
          </div>
          <div><label class="form-label">Local</label><input id="tp-f-location" class="form-input" placeholder="Ex.: CT / Campo 2"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div><label class="form-label">Duração (min)</label><input id="tp-f-duration" type="number" min="0" class="form-input" value="60"></div>
            <div><label class="form-label">Intensidade planejada (0-10)</label><input id="tp-f-intensity" type="number" min="0" max="10" class="form-input" value="5"></div>
          </div>
          <div><label class="form-label">Categoria</label><input id="tp-f-category" class="form-input" placeholder="Ex.: Técnico / Físico"></div>
          <div><label class="form-label">Objetivo</label><textarea id="tp-f-objective" class="form-input" rows="2" placeholder="Objetivo da sessão"></textarea></div>
        </div>
        <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:8px;">
          <button class="btn btn-secondary" onclick="closeModal('tp-session-modal')">Cancelar</button>
          <button class="btn btn-primary" onclick="createTpSession()">Salvar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }
  ['title','location','category','objective'].forEach(f => { const el = document.getElementById('tp-f-' + f); if (el) el.value = ''; });
  openModal('tp-session-modal');
}

async function createTpSession() {
  const val = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const title = val('tp-f-title');
  const date = val('tp-f-date');
  if (!title) { toast('Informe um título.', 'error'); return; }
  if (!date) { toast('Informe a data.', 'error'); return; }
  const body = {
    teamId: _tpTeamId() || undefined,
    title,
    date,
    time: val('tp-f-time') || undefined,
    location: val('tp-f-location') || undefined,
    category: val('tp-f-category') || undefined,
    objective: val('tp-f-objective') || undefined,
    durationMinutes: parseInt(val('tp-f-duration'), 10) || 0,
    plannedIntensity: parseInt(val('tp-f-intensity'), 10) || 0,
  };
  try {
    toast('Salvando sessão…', 'info');
    await api.post('/training-plus/sessions', body);
    closeModal('tp-session-modal');
    toast('Sessão criada!', 'success');
    renderTreinos();
  } catch (e) {
    toast('Não foi possível salvar. Verifique a conexão.', 'error');
  }
}

let _tpDetailSession = null;
let _tpPlannerBlocks = [];
let _tpDetailTab = 'plan';

async function tpOpenSession(id) {
  let s;
  try { s = _tpUnwrap(await api.get('/training-plus/sessions/' + id), null); } catch (e) { toast('Não foi possível abrir a sessão.', 'error'); return; }
  if (!s) return;
  _tpDetailSession = s;
  _tpDetailTab = 'plan';
  _tpEvalGkId = null;
  // Seed attendance state from what's already stored so a save keeps everyone.
  Object.keys(_tpAttState).forEach(k => delete _tpAttState[k]);
  (s.attendance || []).forEach(a => { _tpAttState[a.goalkeeperId] = a.status; });
  _tpPlannerBlocks = (s.blocks || []).map(b => ({ type: b.type, plannedMinutes: b.plannedMinutes || 0, objective: b.objective || '' }));
  let modal = document.getElementById('tp-detail-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'tp-detail-modal';
    modal.className = 'modal-backdrop';
    document.body.appendChild(modal);
  }
  tpRenderDetail();
  openModal('tp-detail-modal');
}

function tpSetTab(tab) { _tpDetailTab = tab; tpRenderDetail(); }

// Attendance tab — one status row per goalkeeper
function _tpAttendanceHtml(s) {
  const gks = (typeof DB !== 'undefined' && DB.goleiras) ? DB.goleiras : [];
  if (!gks.length) return '<div style="color:var(--muted);font-size:13px;">Cadastre goleiras primeiro.</div>';
  const existing = {}; (s.attendance || []).forEach(a => existing[a.goalkeeperId] = a.status);
  const rows = gks.map(g => {
    const cur = existing[g.id] || '';
    const btns = TP_ATT_STATUS.map(st =>
      `<button class="btn btn-sm ${cur === st.v ? 'btn-primary' : 'btn-secondary'}" style="${cur === st.v ? 'background:' + st.c + ';border-color:' + st.c + ';' : ''}" onclick="_tpSetAtt('${_esc(g.id)}','${st.v}',this)">${st.l}</button>`
    ).join(' ');
    return `<div data-gk="${_esc(g.id)}" style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 0;border-bottom:1px solid var(--border,#2a2a3a);">
      <div style="font-weight:600;font-size:13px;">${_esc(g.nome)}</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;">${btns}</div>
    </div>`;
  }).join('');
  return `<div>${rows}</div>
    <button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="tpSaveAttendance('${_esc(s.id)}')">Salvar presença</button>`;
}
const _tpAttState = {};
function _tpSetAtt(gkId, status, btn) {
  _tpAttState[gkId] = status;
  const row = btn.closest('[data-gk]');
  if (row) row.querySelectorAll('button').forEach(b => { b.className = 'btn btn-sm btn-secondary'; b.style.background = ''; b.style.borderColor = ''; });
  const st = TP_ATT_STATUS.find(x => x.v === status);
  btn.className = 'btn btn-sm btn-primary';
  if (st) { btn.style.background = st.c; btn.style.borderColor = st.c; }
}
async function tpSaveAttendance(id) {
  const entries = Object.keys(_tpAttState).map(gk => ({ goalkeeperId: gk, status: _tpAttState[gk] }));
  if (!entries.length) { toast('Marque ao menos uma goleira.', 'info'); return; }
  try {
    toast('Salvando presença…', 'info');
    const updated = _tpUnwrap(await api.post('/training-plus/sessions/' + id + '/attendance', { entries }), null);
    if (updated) _tpDetailSession.attendance = updated;
    toast('Presença salva!', 'success');
    renderTreinos();
  } catch (e) { toast('Não foi possível salvar a presença.', 'error'); }
}

// PSE/RPE tab — 0-10 per goalkeeper
function _tpRpeHtml(s) {
  const gks = (typeof DB !== 'undefined' && DB.goleiras) ? DB.goleiras : [];
  if (!gks.length) return '<div style="color:var(--muted);font-size:13px;">Cadastre goleiras primeiro.</div>';
  const existing = {}; (s.rpe || []).forEach(r => existing[r.goalkeeperId] = r);
  const dur = s.durationMinutes || 0;
  const rows = gks.map(g => {
    const r = existing[g.id];
    const val = r ? r.value : '';
    const load = r && r.workload != null ? r.workload : (dur && val !== '' ? dur * val : '');
    return `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border,#2a2a3a);">
      <div style="font-weight:600;font-size:13px;flex:1;">${_esc(g.nome)}</div>
      <input class="form-input" style="width:70px;padding:6px;" type="number" min="0" max="10" placeholder="0-10" value="${val}" data-rpe="${_esc(g.id)}">
      <div style="width:80px;text-align:right;font-size:12px;color:var(--muted);" data-load="${_esc(g.id)}">${load !== '' ? 'Carga ' + load : ''}</div>
    </div>`;
  }).join('');
  return `<div style="font-size:12px;color:var(--muted);margin-bottom:8px;">PSE 0-10 · Carga interna = duração (${dur} min) × PSE</div>
    <div>${rows}</div>
    <button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="tpSaveRpe('${_esc(s.id)}')">Salvar PSE</button>`;
}
async function tpSaveRpe(id) {
  const inputs = document.querySelectorAll('#tp-detail-modal [data-rpe]');
  const jobs = [];
  inputs.forEach(inp => {
    const v = inp.value.trim();
    if (v !== '') jobs.push({ goalkeeperId: inp.getAttribute('data-rpe'), value: Math.max(0, Math.min(10, parseFloat(v))) });
  });
  if (!jobs.length) { toast('Informe ao menos uma PSE.', 'info'); return; }
  try {
    toast('Salvando PSE…', 'info');
    for (const j of jobs) await api.post('/training-plus/sessions/' + id + '/rpe', j);
    const fresh = _tpUnwrap(await api.get('/training-plus/sessions/' + id), null);
    if (fresh) { _tpDetailSession = fresh; }
    toast('PSE salva!', 'success');
    tpRenderDetail();
    renderTreinos();
  } catch (e) { toast('Não foi possível salvar a PSE.', 'error'); }
}

// Evaluation tab — pick a goalkeeper, score fundamentals
function _tpEvalHtml(s) {
  const gks = (typeof DB !== 'undefined' && DB.goleiras) ? DB.goleiras : [];
  if (!gks.length) return '<div style="color:var(--muted);font-size:13px;">Cadastre goleiras primeiro.</div>';
  const gkId = _tpEvalGkId || gks[0].id;
  const existing = (s.evaluations || []).find(e => e.goalkeeperId === gkId) || {};
  const groups = Object.keys(TP_EVAL_FUNDAMENTALS).map(grp => {
    const stored = existing[grp] || {};
    const items = TP_EVAL_FUNDAMENTALS[grp].map(f =>
      `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 0;">
        <div style="font-size:13px;">${f}</div>
        <input class="form-input" style="width:64px;padding:5px;" type="number" min="0" max="10" value="${stored[f] != null ? stored[f] : ''}" data-eval-grp="${grp}" data-eval-key="${_esc(f)}">
      </div>`).join('');
    return `<div style="margin-bottom:10px;"><div style="font-weight:700;font-size:13px;margin-bottom:4px;">${TP_EVAL_GROUP_LABEL[grp]}</div>${items}</div>`;
  }).join('');
  const gkOpts = gks.map(g => `<option value="${_esc(g.id)}"${g.id === gkId ? ' selected' : ''}>${_esc(g.nome)}</option>`).join('');
  return `<div style="margin-bottom:10px;"><select class="form-input" onchange="_tpEvalPick(this.value)">${gkOpts}</select></div>
    ${groups}
    <button class="btn btn-primary btn-sm" style="margin-top:8px;" onclick="tpSaveEvaluation('${_esc(s.id)}')">Salvar avaliação</button>`;
}
let _tpEvalGkId = null;
function _tpEvalPick(gkId) { _tpEvalGkId = gkId; tpRenderDetail(); }
async function tpSaveEvaluation(id) {
  const gks = (typeof DB !== 'undefined' && DB.goleiras) ? DB.goleiras : [];
  const gkId = _tpEvalGkId || (gks[0] && gks[0].id);
  if (!gkId) return;
  const payload = { goalkeeperId: gkId, technical: {}, physical: {}, mental: {} };
  document.querySelectorAll('#tp-detail-modal [data-eval-grp]').forEach(inp => {
    const v = inp.value.trim();
    if (v !== '') payload[inp.getAttribute('data-eval-grp')][inp.getAttribute('data-eval-key')] = Math.max(0, Math.min(10, parseFloat(v)));
  });
  try {
    toast('Salvando avaliação…', 'info');
    await api.post('/training-plus/sessions/' + id + '/evaluation', payload);
    const fresh = _tpUnwrap(await api.get('/training-plus/sessions/' + id), null);
    if (fresh) _tpDetailSession = fresh;
    toast('Avaliação salva!', 'success');
    renderTreinos();
  } catch (e) { toast('Não foi possível salvar a avaliação.', 'error'); }
}

function tpStatusButtons(s) {
  const opts = ['scheduled', 'ongoing', 'finished', 'cancelled'];
  return opts.map(o => {
    const active = (s.status || 'scheduled') === o;
    return `<button class="btn btn-sm ${active ? 'btn-primary' : 'btn-secondary'}" onclick="tpSetStatus('${_esc(s.id)}','${o}')">${TP_STATUS_LABEL[o]}</button>`;
  }).join(' ');
}

function _tpPlannedTotal() {
  return _tpPlannerBlocks.reduce((sum, b) => sum + (parseInt(b.plannedMinutes, 10) || 0), 0);
}

function tpRenderDetail() {
  const s = _tpDetailSession;
  const modal = document.getElementById('tp-detail-modal');
  if (!s || !modal) return;
  const st = s.status || 'scheduled';
  const typeOpts = (sel) => TP_BLOCK_TYPES.map(t => `<option value="${t.v}"${t.v === sel ? ' selected' : ''}>${t.l}</option>`).join('');
  const blockRows = _tpPlannerBlocks.map((b, i) => `
    <div style="display:grid;grid-template-columns:1.2fr 70px 1.6fr 32px;gap:6px;align-items:center;margin-bottom:6px;">
      <select class="form-input" style="padding:6px;" onchange="_tpBlockField(${i},'type',this.value)">${typeOpts(b.type)}</select>
      <input class="form-input" style="padding:6px;" type="number" min="0" value="${b.plannedMinutes}" onchange="_tpBlockField(${i},'plannedMinutes',this.value)" title="minutos">
      <input class="form-input" style="padding:6px;" value="${_esc(b.objective || '')}" placeholder="Objetivo do bloco" onchange="_tpBlockField(${i},'objective',this.value)">
      <button class="btn btn-secondary btn-sm" style="color:#ef4444;padding:6px;" onclick="_tpRemoveBlock(${i})">✕</button>
    </div>`).join('');
  const planHtml = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <div style="font-weight:700;">Planejamento (blocos)</div>
      <div style="font-size:12px;color:var(--muted);">Total: ${_tpPlannedTotal()} min${s.durationMinutes ? ' / ' + s.durationMinutes + ' min' : ''}</div>
    </div>
    ${_tpPlannerBlocks.length ? blockRows : '<div style="color:var(--muted);font-size:13px;margin-bottom:8px;">Nenhum bloco. Adicione para estruturar a sessão.</div>'}
    <div style="display:flex;gap:8px;margin-top:6px;">
      <button class="btn btn-secondary btn-sm" onclick="_tpAddBlock()">+ Bloco</button>
      <button class="btn btn-primary btn-sm" onclick="tpSaveBlocks('${_esc(s.id)}')">Salvar blocos</button>
    </div>`;

  const TABS = [['plan', 'Planejamento'], ['attendance', 'Presença'], ['eval', 'Avaliação'], ['rpe', 'PSE']];
  const tabBar = TABS.map(([k, l]) =>
    `<button class="btn btn-sm ${_tpDetailTab === k ? 'btn-primary' : 'btn-secondary'}" onclick="tpSetTab('${k}')">${l}</button>`).join(' ');
  let tabBody = planHtml;
  if (_tpDetailTab === 'attendance') tabBody = _tpAttendanceHtml(s);
  else if (_tpDetailTab === 'eval') tabBody = _tpEvalHtml(s);
  else if (_tpDetailTab === 'rpe') tabBody = _tpRpeHtml(s);

  modal.innerHTML = `
    <div class="modal" style="max-width:600px;">
      <div class="modal-header">
        <span class="modal-title">${_esc(s.title || 'Treino')}</span>
        <button class="modal-close" onclick="closeModal('tp-detail-modal')">&times;</button>
      </div>
      <div class="modal-body" style="display:grid;gap:12px;font-size:14px;">
        <div><b>Data:</b> ${s.date ? formatDate(s.date) : '—'}${s.time ? ' · ' + _esc(s.time) : ''}</div>
        <div><b>Local:</b> ${s.location ? _esc(s.location) : '—'} · <b>Categoria:</b> ${s.category ? _esc(s.category) : '—'}</div>
        <div><b>Duração:</b> ${s.durationMinutes ? s.durationMinutes + ' min' : '—'} · <b>Intensidade:</b> ${s.plannedIntensity ?? '—'}</div>
        ${s.objective ? `<div><b>Objetivo:</b> ${_esc(s.objective)}</div>` : ''}
        <div>
          <div style="font-weight:600;margin-bottom:6px;">Status</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">${tpStatusButtons(s)}</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;border-top:1px solid var(--border,#2a2a3a);padding-top:12px;">${tabBar}</div>
        <div>${tabBody}</div>
      </div>
      <div class="modal-footer" style="display:flex;justify-content:space-between;gap:8px;">
        <button class="btn btn-secondary" onclick="tpDeleteSession('${_esc(s.id)}')" style="color:#ef4444;">Excluir</button>
        <button class="btn btn-primary" onclick="closeModal('tp-detail-modal')">Fechar</button>
      </div>
    </div>`;
}

function _tpBlockField(i, field, value) {
  // Mutate in place; the total line refreshes on next add/remove/save.
  if (_tpPlannerBlocks[i]) _tpPlannerBlocks[i][field] = value;
}

function _tpAddBlock() {
  _tpPlannerBlocks.push({ type: 'warmup', plannedMinutes: 10, objective: '' });
  tpRenderDetail();
}

function _tpRemoveBlock(i) {
  _tpPlannerBlocks.splice(i, 1);
  tpRenderDetail();
}

async function tpSaveBlocks(id) {
  const blocks = _tpPlannerBlocks.map((b, i) => ({
    type: b.type,
    plannedMinutes: parseInt(b.plannedMinutes, 10) || 0,
    objective: (b.objective || '').trim() || undefined,
    order: i,
  }));
  try {
    toast('Salvando blocos…', 'info');
    const updated = _tpUnwrap(await api.post('/training-plus/sessions/' + id + '/blocks', { blocks }), null);
    if (updated) { _tpDetailSession = updated; _tpPlannerBlocks = (updated.blocks || []).map(b => ({ type: b.type, plannedMinutes: b.plannedMinutes || 0, objective: b.objective || '' })); tpRenderDetail(); }
    toast('Planejamento salvo!', 'success');
  } catch (e) { toast('Não foi possível salvar os blocos.', 'error'); }
}

async function tpSetStatus(id, status) {
  try {
    const updated = _tpUnwrap(await api.patch('/training-plus/sessions/' + id, { status }), null);
    if (updated) _tpDetailSession = updated;
    else _tpDetailSession.status = status;
    tpRenderDetail();
    toast('Status atualizado.', 'success');
    renderTreinos();
  } catch (e) { toast('Não foi possível atualizar o status.', 'error'); }
}

async function tpDeleteSession(id) {
  if (!confirm('Excluir esta sessão de treino?')) return;
  try {
    await api.delete('/training-plus/sessions/' + id);
    closeModal('tp-detail-modal');
    toast('Sessão excluída.', 'success');
    renderTreinos();
  } catch (e) { toast('Não foi possível excluir.', 'error'); }
}

// ── Treinos: goalkeeper profile tab (Phase 5) ─────────────────
let perfilTpChart = null;
let _tpProfileGkId = null;

async function renderPerfilTreinos(gkId) {
  _tpProfileGkId = gkId;
  const kpis = document.getElementById('perfil-tp-kpis');
  const goalsEl = document.getElementById('perfil-tp-goals');
  const label = document.getElementById('perfil-tp-label');
  if (!kpis) return;
  let sum = null;
  try { sum = _tpUnwrap(await api.get('/training-plus/goalkeeper/' + gkId + '/summary'), null); } catch (e) { sum = null; }
  renderPerfilIGD(gkId, sum);
  if (!sum) {
    kpis.innerHTML = '<div style="color:var(--muted);font-size:13px;">Sem dados de treino (ou servidor indisponível).</div>';
    if (goalsEl) goalsEl.innerHTML = '';
    if (perfilTpChart) { perfilTpChart.destroy(); perfilTpChart = null; }
    return;
  }
  if (label) label.textContent = (sum.trainings || 0) + ' treinos';
  const cards = [
    ['Presença', (sum.attendanceRate ?? 0) + '%'],
    ['Técnico', sum.avgTechnical ?? '—'],
    ['Físico', sum.avgPhysical ?? '—'],
    ['Mental', sum.avgMental ?? '—'],
    ['PSE média', sum.avgRpe ?? '—'],
    ['Carga acum.', sum.accumulatedWorkload ?? 0],
  ];
  kpis.innerHTML = cards.map(([k, v]) => `
    <div style="text-align:center;padding:10px;background:var(--bg);border-radius:8px;">
      <div style="font-size:18px;font-weight:800;color:var(--primary);">${_esc(String(v))}</div>
      <div style="font-size:10px;color:var(--muted);margin-top:2px;text-transform:uppercase;letter-spacing:.5px;">${k}</div>
    </div>`).join('');

  // Evolution chart per fundamental from recentEvaluations (reverse to chrono)
  const evals = [...(sum.recentEvaluations || [])].reverse();
  const avgMap = (m) => { const v = Object.values(m || {}).filter(n => typeof n === 'number'); return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : null; };
  const canvas = document.getElementById('chart-perfil-tp');
  if (canvas && typeof Chart !== 'undefined') {
    if (perfilTpChart) perfilTpChart.destroy();
    if (evals.length) {
      const labels = evals.map((_, i) => 'A' + (i + 1));
      perfilTpChart = new Chart(canvas, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'Técnico', data: evals.map(e => avgMap(e.technical)), borderColor: '#3B82F6', tension: .4, spanGaps: true },
            { label: 'Físico', data: evals.map(e => avgMap(e.physical)), borderColor: '#10B981', tension: .4, spanGaps: true },
            { label: 'Mental', data: evals.map(e => avgMap(e.mental)), borderColor: '#A855F7', tension: .4, spanGaps: true },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#8A8AAA', font: { size: 10 } } } }, scales: { x: { grid: { color: '#1E1E3A' }, ticks: { color: '#5A5A7A' } }, y: { min: 0, max: 10, grid: { color: '#1E1E3A' }, ticks: { color: '#5A5A7A' } } } },
      });
    } else {
      const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  // Goals
  if (goalsEl) {
    const goals = sum.goals || [];
    goalsEl.innerHTML = goals.length ? goals.map(g => {
      const prog = g.progress ?? 0;
      const done = g.status === 'achieved';
      return `<div style="padding:8px 0;border-bottom:1px solid var(--border,#2a2a3a);">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
          <div style="font-weight:600;font-size:13px;${done ? 'text-decoration:line-through;opacity:.6;' : ''}">${_esc(g.title || 'Meta')}</div>
          <div style="display:flex;gap:4px;">
            <button class="btn btn-ghost btn-sm" style="padding:2px 6px;" onclick="tpGoalProgress('${_esc(g.id)}',${Math.min(100, prog + 25)})" title="+25%">+</button>
            <button class="btn btn-ghost btn-sm" style="padding:2px 6px;color:#ef4444;" onclick="tpDeleteGoal('${_esc(g.id)}')">✕</button>
          </div>
        </div>
        ${g.fundamental ? `<div style="font-size:11px;color:var(--muted);">${_esc(g.fundamental)}</div>` : ''}
        <div style="height:6px;background:var(--bg);border-radius:4px;margin-top:6px;overflow:hidden;">
          <div style="height:100%;width:${prog}%;background:${done ? 'var(--success)' : 'var(--primary)'};"></div>
        </div>
        <div style="font-size:10px;color:var(--muted);margin-top:2px;">${prog}%</div>
      </div>`;
    }).join('') : '<div style="color:var(--muted);font-size:13px;">Nenhuma meta. Clique em “+ Meta”.</div>';
  }
}

function openTpGoalForm() {
  if (!_tpProfileGkId) { toast('Selecione uma goleira.', 'info'); return; }
  const title = (prompt('Título da meta (ex.: Melhorar reposição longa):') || '').trim();
  if (!title) return;
  const fundamental = (prompt('Fundamento relacionado (opcional):') || '').trim();
  api.post('/training-plus/goals', { goalkeeperId: _tpProfileGkId, title, fundamental: fundamental || undefined, progress: 0 })
    .then(() => { toast('Meta criada!', 'success'); renderPerfilTreinos(_tpProfileGkId); })
    .catch(() => toast('Não foi possível criar a meta.', 'error'));
}

function tpGoalProgress(id, progress) {
  const body = { progress };
  if (progress >= 100) body.status = 'achieved';
  api.patch('/training-plus/goals/' + id, body)
    .then(() => renderPerfilTreinos(_tpProfileGkId))
    .catch(() => toast('Não foi possível atualizar.', 'error'));
}

function tpDeleteGoal(id) {
  if (!confirm('Excluir esta meta?')) return;
  api.delete('/training-plus/goals/' + id)
    .then(() => { toast('Meta excluída.', 'success'); renderPerfilTreinos(_tpProfileGkId); })
    .catch(() => toast('Não foi possível excluir.', 'error'));
}

// ── Treinos: correlation, insights, PDF (Phase 6) ─────────────
let _tpDashCache = {};
let tpCorrelationChart = null;

// Plot training load (planned = duration × intensity) in the 7 days before
// each match against that match's goalkeeper rating. Reveals if heavier
// training weeks precede better/worse performances.
function tpRenderCorrelation(sessions) {
  const canvas = document.getElementById('tp-chart-correlation');
  if (!canvas || typeof Chart === 'undefined') return;
  const partidas = (typeof DB !== 'undefined' && DB.partidas) ? DB.partidas : [];
  const points = [];
  partidas.forEach(p => {
    if (!p.data) return;
    const nota = (typeof calcPerformance === 'function' && typeof _mergeScouts === 'function')
      ? (() => { const sc = _mergeScouts(DB.scouts.filter(s => s.partidaId === p.id)); return sc.length ? calcPerformance(sc[0]) : null; })()
      : null;
    if (nota == null) return;
    const matchDay = new Date(p.data + 'T00:00:00').getTime();
    const weekBefore = matchDay - 7 * 864e5;
    const load = sessions.reduce((sum, s) => {
      if (!s.date) return sum;
      const d = new Date(String(s.date).slice(0, 10) + 'T00:00:00').getTime();
      return (d >= weekBefore && d < matchDay) ? sum + (s.durationMinutes || 0) * (s.plannedIntensity || 0) : sum;
    }, 0);
    points.push({ x: load, y: nota });
  });
  if (tpCorrelationChart) tpCorrelationChart.destroy();
  if (!points.length) {
    const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  tpCorrelationChart = new Chart(canvas, {
    type: 'scatter',
    data: { datasets: [{ label: 'Partidas', data: points, backgroundColor: 'rgba(168,85,247,.7)', pointRadius: 5 }] },
    options: {
      responsive: true, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `Carga ${c.parsed.x} · Nota ${c.parsed.y}` } } },
      scales: { x: { title: { display: true, text: 'Carga de treino (semana)', color: '#8A8AAA' }, grid: { color: '#1E1E3A' }, ticks: { color: '#5A5A7A' } }, y: { min: 0, max: 10, title: { display: true, text: 'Nota', color: '#8A8AAA' }, grid: { color: '#1E1E3A' }, ticks: { color: '#5A5A7A' } } },
    },
  });
}

// Heuristic insight engine (structured for a future LLM upgrade — same shape
// of {level, text} the AI backend could later return). Rules over dashboard.
function tpBuildInsights(dash, sessions) {
  const out = [];
  const att = dash.attendanceRate;
  if (att != null) {
    if (att >= 90) out.push({ level: 'good', text: `Presença excelente (${att}%). Grupo engajado.` });
    else if (att < 70) out.push({ level: 'warn', text: `Presença baixa (${att}%). Avalie horários/comunicação.` });
  }
  if (dash.avgRpe != null && dash.avgRpe >= 8) out.push({ level: 'warn', text: `PSE média alta (${dash.avgRpe}). Atenção ao risco de sobrecarga.` });
  if (dash.avgRpe != null && dash.avgRpe > 0 && dash.avgRpe <= 3) out.push({ level: 'info', text: `PSE média baixa (${dash.avgRpe}). Há espaço para intensificar.` });
  if (dash.avgEvaluation != null && dash.avgEvaluation > 0) {
    if (dash.avgEvaluation >= 8) out.push({ level: 'good', text: `Avaliação técnica média forte (${dash.avgEvaluation}).` });
    else if (dash.avgEvaluation < 6) out.push({ level: 'warn', text: `Avaliação média abaixo do ideal (${dash.avgEvaluation}). Priorize fundamentos fracos.` });
  }
  // Workload trend: compare last 3 vs previous 3 sessions (planned load)
  const load = [...sessions].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
    .map(s => (s.durationMinutes || 0) * (s.plannedIntensity || 0));
  if (load.length >= 4) {
    const recent = load.slice(-3).reduce((a, b) => a + b, 0);
    const prev = load.slice(-6, -3).reduce((a, b) => a + b, 0);
    if (prev > 0) {
      const chg = Math.round((recent - prev) / prev * 100);
      if (chg >= 30) out.push({ level: 'warn', text: `Carga subiu ${chg}% nas últimas sessões. Monitore recuperação.` });
      else if (chg <= -30) out.push({ level: 'info', text: `Carga caiu ${Math.abs(chg)}%. Semana de recuperação?` });
    }
  }
  if (dash.nextSession) out.push({ level: 'info', text: `Próximo treino: ${dash.nextSession.title || 'Treino'} em ${dash.nextSession.date ? formatDate(dash.nextSession.date) : '—'}.` });
  if (!out.length) out.push({ level: 'info', text: 'Registre presença, PSE e avaliações para gerar insights automáticos.' });
  return out;
}

function tpRenderInsights(dash, sessions) {
  const el = document.getElementById('tp-insights');
  if (!el) return;
  const colors = { good: 'var(--success)', warn: 'var(--warning,#f59e0b)', info: 'var(--muted)' };
  const icons = { good: '✅', warn: '⚠️', info: 'ℹ️' };
  el.innerHTML = tpBuildInsights(dash || {}, sessions || []).map(i =>
    `<div style="display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--border,#2a2a3a);">
      <span>${icons[i.level] || 'ℹ️'}</span>
      <span style="font-size:13px;color:${colors[i.level] || 'var(--muted)'};">${_esc(i.text)}</span>
    </div>`).join('');
}

async function tpExportPdf() {
  if (!window.jspdf) { toast('Biblioteca PDF não carregada', 'error'); return; }
  const dash = _tpDashCache || {};
  const sessions = _tpSessionsCache || [];
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  pdfHeader(doc, 'Relatório de Treinos');
  const num = (v) => (v == null ? '—' : v);
  doc.autoTable({
    startY: 52,
    head: [['Indicador', 'Valor']],
    body: [
      ['Sessões totais', num(dash.totalSessions)],
      ['Sessões concluídas', num(dash.finishedSessions)],
      ['Presença média', dash.attendanceRate != null ? dash.attendanceRate + '%' : '—'],
      ['Avaliação média', num(dash.avgEvaluation)],
      ['PSE média', num(dash.avgRpe)],
      ['Carga semanal', num(dash.weeklyWorkload)],
      ['Próximo treino', dash.nextSession ? ((dash.nextSession.title || 'Treino') + ' · ' + (dash.nextSession.date ? formatDate(dash.nextSession.date) : '—')) : '—'],
    ],
    headStyles: { fillColor: [30, 30, 53], textColor: [0, 212, 255] }, styles: { fontSize: 9 },
  });
  if (sessions.length) {
    doc.text('Sessões', 14, doc.lastAutoTable.finalY + 12);
    const rows = [...sessions].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 30).map(s => [
      s.date ? formatDate(s.date) : '—',
      s.title || 'Treino',
      s.location || '—',
      s.durationMinutes ? s.durationMinutes + ' min' : '—',
      TP_STATUS_LABEL[s.status || 'scheduled'] || s.status || '—',
    ]);
    doc.autoTable({ startY: doc.lastAutoTable.finalY + 16, head: [['Data', 'Título', 'Local', 'Duração', 'Status']], body: rows, headStyles: { fillColor: [30, 30, 53], textColor: [0, 212, 255] }, styles: { fontSize: 8 } });
  }
  const insights = tpBuildInsights(dash, sessions);
  doc.text('Insights', 14, doc.lastAutoTable.finalY + 12);
  doc.autoTable({ startY: doc.lastAutoTable.finalY + 16, head: [['Observação']], body: insights.map(i => [i.text]), headStyles: { fillColor: [30, 30, 53], textColor: [0, 212, 255] }, styles: { fontSize: 9 } });
  doc.save('gkhub_treinos_' + new Date().toISOString().slice(0, 10) + '.pdf');
  logReport({ type: 'treinos', title: 'Relatório de Treinos' });
  toast('PDF gerado!', 'success');
}

// ── Backend API Client ────────────────────────────────────────
const _API_URL = 'https://litwinski-production.up.railway.app/api/v1';
const _API_TOKEN_KEY = 'gkhub_api_token';

function _apiToken() { return localStorage.getItem(_API_TOKEN_KEY); }

async function apiRequest(method, path, body) {
  const token = _apiToken();
  const res = await fetch(_API_URL + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error('API ' + res.status + ' ' + path);
  return res.json();
}

const api = {
  get:    (path)       => apiRequest('GET',    path),
  post:   (path, body) => apiRequest('POST',   path, body),
  patch:  (path, body) => apiRequest('PATCH',  path, body),
  delete: (path)       => apiRequest('DELETE', path),
};

/* ── Backend Connect UI ──────────────────────────────── */
function _renderBackendStatus() {
  const token  = _apiToken();
  const badge  = document.getElementById('backend-status-badge');
  const info   = document.getElementById('backend-connected-info');
  const form   = document.getElementById('backend-login-form');
  if (!badge) return;
  if (token) {
    badge.textContent = 'Conectado';
    badge.style.background = 'rgba(16,185,129,.12)';
    badge.style.color = 'var(--success)';
    if (info) info.style.display = 'block';
    if (form) form.style.display = 'none';
    const emailEl = document.getElementById('backend-logged-email');
    if (emailEl) emailEl.textContent = localStorage.getItem('gkhub_backend_email') || '—';
  } else {
    badge.textContent = 'Desconectado';
    badge.style.background = 'rgba(239,68,68,.12)';
    badge.style.color = 'var(--error)';
    if (info) info.style.display = 'none';
    if (form) form.style.display = 'block';
  }
}

async function backendConnect() {
  const email = document.getElementById('backend-email').value.trim();
  const pass  = document.getElementById('backend-pass').value;
  const errEl = document.getElementById('backend-err');
  const btn   = document.getElementById('backend-connect-btn');
  errEl.style.display = 'none';
  if (!email || !pass) { errEl.textContent='Preencha email e senha.'; errEl.style.display='block'; return; }
  btn.disabled = true; btn.textContent = 'Conectando...';
  try {
    const result = await apiLogin(email, pass);
    if (result) {
      localStorage.setItem('gkhub_backend_email', email);
      _renderBackendStatus();
      loadWorkspaces();
      loadClubMembers();
      toast('Backend conectado com sucesso!', 'success');
    } else {
      errEl.textContent = 'Email ou senha incorretos.';
      errEl.style.display = 'block';
    }
  } catch(e) {
    errEl.textContent = 'Erro de conexão com o servidor.';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = 'Conectar ao Backend';
  }
}

function backendDisconnect() {
  localStorage.removeItem(_API_TOKEN_KEY);
  localStorage.removeItem('gkhub_backend_email');
  localStorage.removeItem('gkhub_active_workspace');
  document.getElementById('workspace-switcher').style.display = 'none';
  _renderBackendStatus();
  loadClubMembers();
  toast('Backend desconectado.', 'info');
}

async function apiLogin(email, password) {
  const res = await fetch(_API_URL + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const payload = data?.data || data || {};
  // Backend returns snake_case access_token (wrapped in {data}); tolerate both.
  const tok = payload.access_token || payload.accessToken
    || data?.access_token || data?.accessToken;
  if (tok) {
    localStorage.setItem(_API_TOKEN_KEY, tok);
    // Normalize so callers can read .accessToken regardless of source casing.
    return { ...payload, accessToken: tok };
  }
  return null;
}

async function apiPing() {
  try {
    const res = await fetch(_API_URL.replace('/api/v1','') + '/api/docs-json', { method: 'HEAD' });
    return res.ok || res.status === 404;
  } catch { return false; }
}

// Anexa o token do Firebase (quando logado via Google) para que regras do
// tipo "auth != null" aceitem as chamadas REST ao Realtime Database.
async function _rtdbToken() {
  try { const u = (typeof _firebaseAuth !== 'undefined' && _firebaseAuth) ? _firebaseAuth.currentUser : null; if (u) return await u.getIdToken(); } catch (e) {}
  return null;
}
async function _rtdbUrl(path) {
  const t = await _rtdbToken();
  return rtdbUrl + path + '.json' + (t ? '?auth=' + encodeURIComponent(t) : '');
}
function _rtdbErr(status) {
  // 401/403 = regras do banco negando (comum quando as regras de teste expiram)
  return new Error((status === 401 || status === 403) ? 'PERMISSAO' : ('HTTP ' + status));
}
async function rtdbGet(path) {
  const res = await fetch(await _rtdbUrl(path));
  if (!res.ok) throw _rtdbErr(res.status);
  return res.json();
}
async function rtdbPut(path, data) {
  const res = await fetch(await _rtdbUrl(path), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw _rtdbErr(res.status);
}
async function rtdbDelete(path) {
  const res = await fetch(await _rtdbUrl(path), { method: 'DELETE' });
  if (!res.ok) throw _rtdbErr(res.status);
}

/* ═══════════════════════════════════════════════════════════
   BACKUP & DADOS — exportar/importar arquivo + nuvem + exemplos
   Proteção contra perda de dados (tudo local vira 1 snapshot).
   ═══════════════════════════════════════════════════════════ */
// Chaves efêmeras/de dispositivo que NÃO devem ir no backup
const _BACKUP_SKIP = ['gkhub_session', 'gkhub_google_redirect', 'gkhub_fcm_token', 'gkhub_push_sub', 'gkhub_2fa_ok'];
function _gkSnapshot() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('gkhub_') && !_BACKUP_SKIP.includes(k)) data[k] = localStorage.getItem(k);
  }
  return { _meta: { app: 'GK Hub', v: 38, exportedAt: new Date().toISOString() }, data };
}
function _gkRestore(snapshot) {
  const data = (snapshot && snapshot.data) ? snapshot.data : snapshot;
  if (!data || typeof data !== 'object') throw new Error('formato inválido');
  Object.keys(data).forEach(k => { if (k.startsWith('gkhub_') && !_BACKUP_SKIP.includes(k)) localStorage.setItem(k, data[k]); });
}
function exportBackup() {
  const blob = new Blob([JSON.stringify(_gkSnapshot(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'gkhub_backup_' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
  URL.revokeObjectURL(url);
  try { logAudit('Dados', 'Exportou backup completo'); } catch (e) {}
  toast('Backup exportado. Guarde o arquivo em local seguro.', 'success');
}
function importBackupFile(input) {
  const f = input.files && input.files[0]; if (!f) return;
  if (!confirm('Importar vai SOBRESCREVER os dados atuais deste navegador com o backup. Deseja continuar?')) { input.value = ''; return; }
  const r = new FileReader();
  r.onload = () => {
    try { _gkRestore(JSON.parse(r.result)); try { logAudit('Dados', 'Importou backup'); } catch (e) {} toast('Backup restaurado! Recarregando…', 'success'); setTimeout(() => location.reload(), 900); }
    catch (e) { toast('Arquivo de backup inválido.', 'error'); }
  };
  r.readAsText(f);
}
async function cloudBackup() {
  if (!rtdbUrl) { toast('Conecte o Firebase (aba Nuvem) para usar backup na nuvem.', 'info'); return; }
  try { netSetStatus('syncing'); await rtdbPut('/backups/latest', _gkSnapshot()); netMarkSynced(); try { logAudit('Dados', 'Enviou backup para a nuvem'); } catch (e) {} toast('Backup salvo na nuvem.', 'success'); }
  catch (e) { toast(e.message==="PERMISSAO" ? "Sincronização bloqueada pelas regras do Firebase (veja as instruções). Seus dados continuam salvos neste aparelho." : 'Não foi possível enviar o backup.', 'error'); netSetStatus(navigator.onLine ? 'online' : 'offline'); }
}
async function cloudRestore() {
  if (!rtdbUrl) { toast('Conecte o Firebase (aba Nuvem) primeiro.', 'info'); return; }
  if (!confirm('Restaurar da nuvem vai SOBRESCREVER os dados locais. Continuar?')) return;
  try { const snap = await rtdbGet('/backups/latest'); if (!snap) { toast('Nenhum backup na nuvem ainda.', 'info'); return; } _gkRestore(snap); toast('Restaurado da nuvem! Recarregando…', 'success'); setTimeout(() => location.reload(), 900); }
  catch (e) { toast(e.message==="PERMISSAO" ? "Sincronização bloqueada pelas regras do Firebase (veja as instruções). Seus dados continuam salvos neste aparelho." : 'Não foi possível restaurar da nuvem.', 'error'); }
}
/* ── Privacidade / LGPD — export e exclusão por atleta ─────── */
function _athleteData(gkId) {
  const gk = DB.goleiras.find(g => g.id === gkId) || {};
  const scouts = DB.scouts.filter(s => s.goalkeeperId === gkId);
  const pIds = new Set(scouts.map(s => s.partidaId));
  return {
    _meta: { app: 'GK Hub', tipo: 'dados_da_atleta_LGPD', exportadoEm: new Date().toISOString() },
    goleira: gk,
    partidas: DB.partidas.filter(p => p.goalkeeperId === gkId || pIds.has(p.id)),
    scouts, lesoes: DB.lesoes.filter(l => l.gkId === gkId),
    pid: DB.pid.filter(o => o.gkId === gkId),
    analisesIA: DB.aianalyses.filter(a => a.gkId === gkId),
  };
}
function exportAthleteData() {
  const gkId = document.getElementById('lgpd-gk')?.value;
  if (!gkId) { toast('Selecione a atleta.', 'info'); return; }
  const gk = DB.goleiras.find(g => g.id === gkId);
  const blob = new Blob([JSON.stringify(_athleteData(gkId), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'dados_' + (gk ? gk.nome.replace(/\s+/g, '_') : gkId) + '.json'; a.click();
  URL.revokeObjectURL(url);
  logAudit('LGPD', 'Exportou os dados da atleta ' + (gk ? gk.nome : gkId));
  toast('Dados da atleta exportados.', 'success');
}
function forgetAthlete() {
  const gkId = document.getElementById('lgpd-gk')?.value;
  if (!gkId) { toast('Selecione a atleta.', 'info'); return; }
  const gk = DB.goleiras.find(g => g.id === gkId);
  const nome = gk ? gk.nome : gkId;
  if (!confirm('DIREITO AO ESQUECIMENTO\n\nIsto apaga PERMANENTEMENTE todos os dados de "' + nome + '" (cadastro, scouts, lesões, PID, análises de IA) deste dispositivo e da nuvem. Recomenda-se exportar antes. Continuar?')) return;
  if (!confirm('Tem certeza? Esta ação não pode ser desfeita.')) return;
  const scouts = DB.scouts.filter(s => s.goalkeeperId === gkId);
  DB.saveScouts(DB.scouts.filter(s => s.goalkeeperId !== gkId));
  DB.saveGoleiras(DB.goleiras.filter(g => g.id !== gkId));
  DB.saveLesoes(DB.lesoes.filter(l => l.gkId !== gkId));
  DB.savePID(DB.pid.filter(o => o.gkId !== gkId));
  DB.saveAianalyses(DB.aianalyses.filter(a => a.gkId !== gkId));
  try { cloudDelete('goleiras', gkId); scouts.forEach(s => cloudDelete('scouts', s.id)); } catch (e) {}
  logAudit('LGPD', 'Exclusão total (direito ao esquecimento) de ' + nome);
  toast('Dados de ' + nome + ' apagados.', 'success');
  updateGoleiraSelects();
  _lgpdPopulate();
}
function _lgpdPopulate() {
  const sel = document.getElementById('lgpd-gk');
  if (!sel) return;
  sel.innerHTML = '<option value="">Selecionar atleta…</option>' + DB.goleiras.map(g => `<option value="${g.id}">${_esc(g.nome)}${g.consent ? ' ✓' : ''}</option>`).join('');
}

function loadSampleData() {
  if (DB.goleiras.length && !confirm('Já existem dados. Adicionar goleiras de exemplo mesmo assim?')) return;
  const mk = (n) => 'x' + Date.now().toString(36) + n + Math.floor(Math.random() * 1e5).toString(36);
  const g1 = mk('a'), g2 = mk('b');
  const gks = DB.goleiras.concat([
    { id: g1, nome: 'Ana (exemplo)', equipe: 'Time Exemplo', categoria: 'Sub-17', naipe: 'feminino', pe: 'Direito', mao: 'Direita', criadoEm: new Date().toISOString() },
    { id: g2, nome: 'Bia (exemplo)', equipe: 'Time Exemplo', categoria: 'Adulto', naipe: 'feminino', pe: 'Esquerdo', mao: 'Esquerda', criadoEm: new Date().toISOString() },
  ]);
  DB.saveGoleiras(gks);
  const pts = DB.partidas.slice(), scs = DB.scouts.slice();
  const base = new Date();
  for (let i = 0; i < 6; i++) {
    const pid = mk('p' + i); const gid = i % 2 ? g2 : g1;
    const d = new Date(base); d.setDate(d.getDate() - (i * 7));
    const gf = 2 + (i % 3), gc = i % 3;
    pts.push({ id: pid, adversario: 'Adversário ' + (i + 1), competicao: 'Liga Exemplo', data: d.toISOString().slice(0, 10), goalkeeperId: gid, gf, gc });
    scs.push({ id: mk('s' + i), goalkeeperId: gid, partidaId: pid, dad: 3 + (i % 3), dae: 2, dbd: 2, dbe: 1, dc: 1, d1x1: 1, esq: 0, gda: gc, gfa: 0, gpe: 0, gfl: 0, dpc: 7 + i, dpe: 2, dmc: 3, dme: 1, int: 2, sai: 1 });
  }
  DB.savePartidas(pts); DB.saveScouts(scs);
  try { logAudit('Dados', 'Carregou dados de exemplo'); } catch (e) {}
  toast('Dados de exemplo carregados! Recarregando…', 'success');
  setTimeout(() => location.reload(), 900);
}

function initFirebaseFromStorage() {
  // Auto-connect using embedded Firebase databaseURL
  rtdbUrl = _FB_DEFAULT_CONFIG.databaseURL;
  setCloudStatus(true, 'conectada');
}



async function sincronizarNuvem() {
  if (!rtdbUrl) { toast('Conecte à nuvem primeiro', 'error'); return; }
  try {
    // Baixa dados da nuvem e mescla com local, depois envia tudo
    for (const col of ['goleiras', 'partidas', 'scouts']) {
      const remote = await rtdbGet('/' + col);
      if (remote && typeof remote === 'object') {
        const remoteItems = Object.entries(remote).map(([id, val]) => ({ id: isNaN(id) ? id : Number(id), ...val }));
        const local = DB.load(col);
        const merged = [...local];
        for (const ri of remoteItems) {
          if (!merged.find(l => String(l.id) === String(ri.id))) merged.push(ri);
        }
        DB.save(col, merged);
      }
      // Envia tudo para a nuvem
      const items = DB.load(col);
      for (const item of items) {
        const { id, ...rest } = item;
        await rtdbPut('/' + col + '/' + id, rest);
      }
    }
    updateGoleiraSelects();
    refreshDashboard();
    const active = document.querySelector('.page.active')?.id?.replace('page-', '');
    if (active === 'goleiras') renderGoleiras();
    if (active === 'partidas') renderPartidas();
    if (active === 'scout') renderScouts();
    if (active === 'performance') renderPerformance();
    if (active === 'heatmap') renderHeatmap();
    const fbSt = document.getElementById('fb-status');
    if (fbSt) fbSt.innerHTML = '<span style="color:var(--success)">✓ Dados sincronizados com a nuvem!</span>';
    toast('Sincronizado!', 'success');
  } catch(e) { toast(e.message==="PERMISSAO" ? "Sincronização bloqueada pelas regras do Firebase (veja as instruções). Seus dados continuam salvos neste aparelho." : ('Erro na sincronização: '+e.message), 'error'); }
}

function cloudSet(col, item) {
  if (!rtdbUrl) return;
  const { id, ...rest } = item;
  netSetStatus('syncing');
  rtdbPut('/' + col + '/' + id, rest).then(() => netMarkSynced()).catch(e => { console.warn('cloudSet', e); netSetStatus(navigator.onLine ? 'online' : 'offline'); });
}

function cloudDelete(col, id) {
  if (!rtdbUrl) return;
  netSetStatus('syncing');
  rtdbDelete('/' + col + '/' + id).then(() => netMarkSynced()).catch(e => { console.warn('cloudDelete', e); netSetStatus(navigator.onLine ? 'online' : 'offline'); });
}

/* ═══════════════════════════════════════════════════════════
   SYNC EM NUVEM das coleções novas (lesões, PID, análises IA,
   notificações). Push automático ao salvar (debounced) + pull
   com mesclagem ao abrir. Último a escrever vence por coleção.
   Observação: 2FA e sessão nunca vão para a nuvem, por segurança.
   ═══════════════════════════════════════════════════════════ */
const _NEW_SYNC = ['lesoes', 'pid', 'aianalyses', 'notifications'];
const _syncTimers = {};
function _mapById(arr) { const m = {}; (arr || []).forEach(it => { if (it && it.id) { const { id, ...rest } = it; m[String(id)] = rest; } }); return m; }
function _schedulePush(col, arr) {
  if (!rtdbUrl) return;
  clearTimeout(_syncTimers[col]);
  _syncTimers[col] = setTimeout(() => {
    netSetStatus('syncing');
    rtdbPut('/' + col, _mapById(arr)).then(() => netMarkSynced()).catch(() => netSetStatus(navigator.onLine ? 'online' : 'offline'));
  }, 700);
}
async function cloudPullNew(silent) {
  if (!rtdbUrl) return 0;
  let changed = 0;
  for (const col of _NEW_SYNC) {
    try {
      const remote = await rtdbGet('/' + col);
      if (remote && typeof remote === 'object') {
        const byId = {};
        DB.load(col).forEach(l => { if (l && l.id) byId[String(l.id)] = l; });
        Object.entries(remote).forEach(([id, val]) => { byId[String(id)] = { id, ...(val || {}) }; }); // remoto vence
        DB._suppressSync = true; // evita re-push durante o pull
        DB.save(col, Object.values(byId));
        DB._suppressSync = false;
        changed++;
      }
    } catch (e) { /* ignora coleção ausente/erro */ }
  }
  if (changed && !silent) { try { updateNotifBadge(); } catch (e) {} }
  return changed;
}
async function cloudSyncNow() {
  if (!rtdbUrl) { toast('Nuvem não conectada.', 'info'); return; }
  toast('Sincronizando…', 'info');
  try {
    await cloudPullNew(true);               // baixa o que há na nuvem (mescla)
    for (const col of _NEW_SYNC) { if (rtdbUrl) await rtdbPut('/' + col, _mapById(DB.load(col))); } // envia o estado local
    netMarkSynced();
    toast('Tudo sincronizado com a nuvem.', 'success');
    const active = document.querySelector('.page.active')?.id?.replace('page-', '');
    if (active === 'lesoes') renderLesoes();
    if (active === 'pid') renderPID();
    if (active === 'notificacoes') renderNotificacoes();
    updateNotifBadge();
  } catch (e) { toast(e.message==="PERMISSAO" ? "Sincronização bloqueada pelas regras do Firebase (veja as instruções). Seus dados continuam salvos neste aparelho." : 'Falha na sincronização.', 'error'); }
}

/* ═══════════════════════════════════════════════════════════
   MODO OFFLINE — indicador de conectividade + última sincronização
   Dados locais persistem em localStorage e funcionam offline; este
   bloco mostra o estado e o horário da última sincronização.
   ═══════════════════════════════════════════════════════════ */
function netSetStatus(state) {
  const el = document.getElementById('net-status');
  if (!el) return;
  const map = {
    online:  { dot: 'var(--success)', label: 'Online' },
    syncing: { dot: 'var(--warning)', label: 'Sincronizando…' },
    offline: { dot: 'var(--error)', label: 'Offline' },
  };
  const m = map[state] || map.online;
  const last = localStorage.getItem('gkhub_last_sync');
  const lastTxt = last ? ' · sync ' + _relTime(+last) : '';
  el.querySelector('#net-dot').style.background = m.dot;
  if (state === 'syncing') el.querySelector('#net-dot').style.animation = 'pulse 1s infinite';
  else el.querySelector('#net-dot').style.animation = '';
  el.querySelector('#net-label').textContent = m.label + lastTxt;
  el.title = m.label + (last ? ' · última sincronização: ' + new Date(+last).toLocaleString('pt-BR') : '');
}
function netMarkSynced() {
  localStorage.setItem('gkhub_last_sync', String(Date.now()));
  netSetStatus('online');
}
function netInit() {
  window.addEventListener('online', () => { netSetStatus('online'); toast('Conexão restabelecida — sincronizando.', 'success'); });
  window.addEventListener('offline', () => { netSetStatus('offline'); toast('Sem conexão — trabalhando offline. Seus dados estão salvos.', 'info'); });
  netSetStatus(navigator.onLine ? 'online' : 'offline');
}

function renderConfigStatus() {}

function topbarSearch(val) {
  const box = document.getElementById('topbar-search-results');
  if (!box) return;
  const q = val.trim().toLowerCase();
  if (!q) { box.style.display = 'none'; return; }

  const gks = DB.goleiras.filter(g =>
    (g.nome||'').toLowerCase().includes(q) ||
    (g.equipe||'').toLowerCase().includes(q) ||
    (g.categoria||'').toLowerCase().includes(q));

  const pts = DB.partidas.filter(p =>
    (p.adversario||'').toLowerCase().includes(q) ||
    (p.competicao||'').toLowerCase().includes(q) ||
    (p.local||'').toLowerCase().includes(q));

  const scRaw = DB.scouts.filter(s => {
    const gk = DB.goleiras.find(g => g.id === s.goalkeeperId);
    const pt = DB.partidas.find(p => p.id === s.partidaId);
    return (gk?.nome||'').toLowerCase().includes(q) ||
           (pt?.adversario||'').toLowerCase().includes(q);
  });
  const scUniq = [...new Map(scRaw.map(s => [`${s.goalkeeperId}__${s.partidaId}`, s])).values()];

  // Extra modules (populated once the user has opened Treinos)
  const exs = (typeof _tpExercisesCache !== 'undefined' ? _tpExercisesCache : [])
    .filter(x => (x.name || '').toLowerCase().includes(q) || (x.objective || '').toLowerCase().includes(q));
  const sess = (typeof _tpSessionsCache !== 'undefined' ? _tpSessionsCache : [])
    .filter(s => (s.title || '').toLowerCase().includes(q) || (s.location || '').toLowerCase().includes(q) || (s.category || '').toLowerCase().includes(q));

  if (!gks.length && !pts.length && !scUniq.length && !exs.length && !sess.length) {
    box.innerHTML = `<div style="padding:14px 16px;font-size:12px;color:var(--muted);">Nenhum resultado para "<strong style="color:var(--text);">${_esc(val)}</strong>"</div>`;
    box.style.display = 'block';
    return;
  }

  let html = '';
  if (gks.length) {
    html += `<div style="padding:8px 12px 4px;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;">Goleiras</div>`;
    html += gks.slice(0,5).map(g => `
      <div class="sr-item" onclick="clearTopbarSearch();navigate('goleiras');setTimeout(()=>{const i=document.getElementById('search-goleiras');if(i){i.value='${_esc(g.nome.replace(/'/g,"\\'"))}';i.dispatchEvent(new Event('input'));}},200)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <div>
          <div style="font-size:13px;font-weight:600;">${_esc(g.nome)}</div>
          ${g.equipe||g.categoria ? `<div style="font-size:11px;color:var(--muted);">${_esc([g.equipe,g.categoria].filter(Boolean).join(' · '))}</div>` : ''}
        </div>
      </div>`).join('');
  }
  if (pts.length) {
    html += `<div style="padding:8px 12px 4px;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;border-top:1px solid rgba(255,255,255,.05);margin-top:4px;">Partidas</div>`;
    html += pts.slice(0,5).map(p => {
      const gk = DB.goleiras.find(g => g.id === p.goalkeeperId);
      return `
      <div class="sr-item" onclick="clearTopbarSearch();navigate('partidas');setTimeout(()=>{const i=document.getElementById('search-partidas');if(i){i.value='${_esc((p.adversario||'').replace(/'/g,"\\'"))}';i.dispatchEvent(new Event('input'));}},200)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="10"/></svg>
        <div>
          <div style="font-size:13px;font-weight:600;">${_esc(p.adversario||'—')}</div>
          <div style="font-size:11px;color:var(--muted);">${p.competicao ? _esc(p.competicao)+' · ' : ''}${gk ? _esc(gk.nome) : ''}${p.data ? ' · '+formatDate(p.data) : ''}</div>
        </div>
      </div>`}).join('');
  }
  if (scUniq.length) {
    html += `<div style="padding:8px 12px 4px;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;border-top:1px solid rgba(255,255,255,.05);margin-top:4px;">Scouts</div>`;
    html += scUniq.slice(0,4).map(s => {
      const gk = DB.goleiras.find(g => g.id === s.goalkeeperId);
      const pt = DB.partidas.find(p => p.id === s.partidaId);
      return `
      <div class="sr-item" onclick="clearTopbarSearch();navigate('scout');setTimeout(()=>{const i=document.getElementById('search-goleiras');},200)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        <div>
          <div style="font-size:13px;font-weight:600;">${_esc(gk?.nome||'—')}</div>
          <div style="font-size:11px;color:var(--muted);">${_esc(pt?.adversario||'—')}${pt?.data?' · '+formatDate(pt.data):''}</div>
        </div>
      </div>`}).join('');
  }
  if (sess.length) {
    html += `<div style="padding:8px 12px 4px;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;border-top:1px solid rgba(255,255,255,.05);margin-top:4px;">Treinos</div>`;
    html += sess.slice(0,4).map(s => `
      <div class="sr-item" onclick="clearTopbarSearch();navigate('treinos');">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M6 3v18M18 3v18M3 8h4M17 8h4M3 16h4M17 16h4"/></svg>
        <div><div style="font-size:13px;font-weight:600;">${_esc(s.title||'Treino')}</div>
        <div style="font-size:11px;color:var(--muted);">${s.date?formatDate(String(s.date).slice(0,10)):''}${s.location?' · '+_esc(s.location):''}</div></div>
      </div>`).join('');
  }
  if (exs.length) {
    html += `<div style="padding:8px 12px 4px;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;border-top:1px solid rgba(255,255,255,.05);margin-top:4px;">Exercícios</div>`;
    html += exs.slice(0,4).map(x => `
      <div class="sr-item" onclick="clearTopbarSearch();navigate('treinos');">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
        <div><div style="font-size:13px;font-weight:600;">${_esc(x.name||'Exercício')}</div>
        <div style="font-size:11px;color:var(--muted);">${_esc((typeof TP_EX_LABEL!=='undefined'&&TP_EX_LABEL[x.category])||x.category||'')}</div></div>
      </div>`).join('');
  }
  html += `<div style="padding:8px 12px;border-top:1px solid rgba(255,255,255,.05);text-align:right;">
    <span style="font-size:11px;color:var(--muted);">${gks.length+pts.length+scUniq.length+exs.length+sess.length} resultado(s)</span>
  </div>`;

  box.innerHTML = html;
  box.style.display = 'block';
  // close on outside click
  setTimeout(() => document.addEventListener('click', _closeSearch, true), 0);
}
function _closeSearch(e) {
  const wrap = document.getElementById('topbar-search-input')?.closest('.topbar-search');
  if (wrap && !wrap.contains(e.target)) { clearTopbarSearch(); document.removeEventListener('click', _closeSearch, true); }
}
function clearTopbarSearch() {
  const inp = document.getElementById('topbar-search-input');
  const box = document.getElementById('topbar-search-results');
  if (inp) inp.value = '';
  if (box) box.style.display = 'none';
  document.removeEventListener('click', _closeSearch, true);
}

// ═══════════════════════════════════════════════════════════
// USER AREA
// ═══════════════════════════════════════════════════════════
const _PROFILE_KEY    = 'gkhub_user_profile';
const _ACTIVITY_KEY   = 'gkhub_activity_log';
const _FAVORITES_KEY  = 'gkhub_favorites';
const _PREFS_KEY      = 'gkhub_prefs';

// ── Dropdown ─────────────────────────────────────────────
function toggleUserMenu() {
  const el = document.getElementById('user-dropdown');
  if (!el) return;
  if (el.style.display === 'none' || !el.style.display) {
    el.style.display = 'block';
    document.addEventListener('click', _closeMenuOutside, true);
  } else {
    closeUserMenu();
  }
}
function closeUserMenu() {
  const el = document.getElementById('user-dropdown');
  if (el) el.style.display = 'none';
  document.removeEventListener('click', _closeMenuOutside, true);
}
function _closeMenuOutside(e) {
  const wrap = document.getElementById('user-dropdown')?.parentElement;
  if (wrap && !wrap.contains(e.target)) closeUserMenu();
}

// ── Profile ───────────────────────────────────────────────
function loadProfile() {
  try { return JSON.parse(localStorage.getItem(_PROFILE_KEY) || '{}'); } catch(e) { return {}; }
}
function saveProfile() {
  const profile = {
    nome:      document.getElementById('up-nome')?.value.trim() || '',
    email:     document.getElementById('up-email')?.value.trim() || '',
    telefone:  document.getElementById('up-telefone')?.value.trim() || '',
    cargo:     document.getElementById('up-cargo')?.value.trim() || '',
    clube:     document.getElementById('up-clube')?.value.trim() || '',
    categoria: document.getElementById('up-categoria')?.value.trim() || '',
    bio:       document.getElementById('up-bio')?.value.trim() || '',
    updatedAt: new Date().toISOString(),
  };
  const existing = loadProfile();
  const merged = { ...existing, ...profile };
  localStorage.setItem(_PROFILE_KEY, JSON.stringify(merged));
  _refreshProfileUI(merged);
  const st = document.getElementById('up-status');
  if (st) st.innerHTML = '<span style="color:var(--success)">✓ Perfil salvo!</span>';
  setTimeout(() => { if (st) st.innerHTML = ''; }, 3000);
  toast('Perfil atualizado!', 'success');
  _logAction('Perfil atualizado', 'primary');
}
function handleProfilePhoto(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const dataUrl = e.target.result;
    const profile = loadProfile();
    profile.foto = dataUrl;
    profile.updatedAt = new Date().toISOString();
    localStorage.setItem(_PROFILE_KEY, JSON.stringify(profile));
    _applyProfilePhoto(dataUrl);
    toast('Foto atualizada!', 'success');
  };
  reader.readAsDataURL(file);
}
function _applyProfilePhoto(dataUrl) {
  const preview = document.getElementById('up-foto-preview');
  if (preview) preview.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;">`;
  const avatar = document.getElementById('topbar-user-avatar');
  if (avatar) avatar.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  const udAv = document.getElementById('ud-avatar');
  if (udAv) udAv.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
}
function _refreshProfileUI(profile) {
  // Header
  const nameEl = document.getElementById('up-display-name');
  const roleEl = document.getElementById('up-display-role');
  const clubEl = document.getElementById('up-display-club');
  if (nameEl) nameEl.textContent = profile.nome || _loggedUser || '—';
  if (roleEl) roleEl.textContent = profile.cargo || '';
  if (clubEl) clubEl.textContent = profile.clube || '';
  // Initial in photo
  const initial = document.getElementById('up-foto-initial');
  if (initial && !profile.foto) initial.textContent = (profile.nome || _loggedUser || '?')[0].toUpperCase();
  if (profile.foto) _applyProfilePhoto(profile.foto);
  // Topbar avatar
  const avatar = document.getElementById('topbar-user-avatar');
  if (avatar && !profile.foto) {
    avatar.innerHTML = `<span style="font-size:13px;font-weight:700;">${(profile.nome || _loggedUser || '?')[0].toUpperCase()}</span>`;
  }
  // Dropdown
  const udName = document.getElementById('ud-name');
  const udRole = document.getElementById('ud-role');
  const udAv   = document.getElementById('ud-avatar');
  if (udName) udName.textContent = profile.nome || _loggedUser || '—';
  if (udRole) udRole.textContent = profile.cargo || profile.clube || 'GK Hub';
  if (udAv && !profile.foto) udAv.textContent = (profile.nome || _loggedUser || '?')[0].toUpperCase();
}
function loadUserPage() {
  const profile = loadProfile();
  // Fill form fields
  ['nome','email','telefone','cargo','clube','categoria','bio'].forEach(k => {
    const el = document.getElementById('up-'+k);
    if (el) el.value = profile[k] || '';
  });
  _refreshProfileUI(profile);
  // Account summary
  const joinDate = profile.createdAt || new Date().toISOString();
  if (!profile.createdAt) {
    profile.createdAt = joinDate;
    localStorage.setItem(_PROFILE_KEY, JSON.stringify(profile));
  }
  profile.lastAccess = new Date().toISOString();
  localStorage.setItem(_PROFILE_KEY, JSON.stringify(profile));
  const fmt = s => s ? new Date(s).toLocaleDateString('pt-BR', {day:'2-digit',month:'short',year:'numeric'}) : '—';
  const infoJoin  = document.getElementById('up-info-join');
  const infoLast  = document.getElementById('up-info-last');
  const infoClub  = document.getElementById('up-info-club');
  const infoScout = document.getElementById('up-info-scouts');
  const infoMatch = document.getElementById('up-info-matches');
  const infoGks   = document.getElementById('up-info-gks');
  const upJoin    = document.getElementById('up-display-join');
  if (infoJoin)  infoJoin.textContent  = fmt(profile.createdAt);
  if (infoLast)  infoLast.textContent  = fmt(profile.lastAccess);
  if (infoClub)  infoClub.textContent  = _activeWorkspaceId ? (document.getElementById('sidebar-club-name')?.textContent || '—') : (profile.clube || '—');
  if (infoScout) infoScout.textContent = DB.scouts.length;
  if (infoMatch) infoMatch.textContent = DB.partidas.length;
  if (infoGks)   infoGks.textContent   = DB.goleiras.length;
  if (upJoin)    upJoin.textContent    = 'Membro desde ' + fmt(profile.createdAt);
  // Session info
  const ua = navigator.userAgent;
  const browser = ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : ua.includes('Safari') ? 'Safari' : 'Navegador';
  const device  = /Mobi|Android/i.test(ua) ? 'Dispositivo móvel' : 'Computador / Desktop';
  const secDev  = document.getElementById('sec-device');
  const secBrow = document.getElementById('sec-browser');
  const secSess = document.getElementById('sec-session-start');
  if (secDev)  secDev.textContent  = device;
  if (secBrow) secBrow.textContent = browser;
  if (secSess) secSess.textContent = fmt(new Date().toISOString());
  // Activity stats
  const actS = document.getElementById('act-scouts');
  const actP = document.getElementById('act-partidas');
  const actG = document.getElementById('act-gks');
  const actPdf = document.getElementById('act-pdfs');
  if (actS) actS.textContent = DB.scouts.length;
  if (actP) actP.textContent = DB.partidas.length;
  if (actG) actG.textContent = DB.goleiras.length;
  const log = loadActivityLog();
  if (actPdf) actPdf.textContent = log.filter(l => l.text.toLowerCase().includes('pdf')).length;
  renderActivityLog();
  renderFavorites();
  loadPreferences();
  _updateNotifPermUI();
}

// ── Activity Log ──────────────────────────────────────────
function loadActivityLog() {
  try { return JSON.parse(localStorage.getItem(_ACTIVITY_KEY) || '[]'); } catch(e) { return []; }
}
function _logAction(text, color) {
  const log = loadActivityLog();
  log.unshift({ text, color: color || 'primary', time: new Date().toISOString() });
  if (log.length > 50) log.length = 50;
  localStorage.setItem(_ACTIVITY_KEY, JSON.stringify(log));
}
function renderActivityLog() {
  const el = document.getElementById('activity-log');
  if (!el) return;
  const log = loadActivityLog();
  if (!log.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:12px 0;">Nenhuma atividade registrada ainda.</div>';
    return;
  }
  const colorMap = { primary: 'var(--primary)', success: 'var(--success)', warning: 'var(--warning)', error: 'var(--error)' };
  el.innerHTML = log.map(l => {
    const d = new Date(l.time);
    const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    return `<div class="activity-item">
      <div class="activity-dot" style="background:${colorMap[l.color]||'var(--primary)'};"></div>
      <div style="flex:1;">
        <div style="font-size:13px;">${_esc(l.text)}</div>
        <div class="activity-time">${timeStr} · ${dateStr}</div>
      </div>
    </div>`;
  }).join('');
}
function exportActivityCSV() {
  const log = loadActivityLog();
  if (!log.length) { toast('Nenhuma atividade para exportar', 'info'); return; }
  const header = 'Data,Hora,Tipo,Atividade';
  const rows = log.map(l => {
    const d = new Date(l.time);
    const date = d.toLocaleDateString('pt-BR');
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const text = (l.text || '').replace(/"/g, '""');
    return `"${date}","${time}","${l.color || 'primary'}","${text}"`;
  });
  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `gkhub_atividade_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
  toast('CSV exportado!', 'success');
  if (loadPreferences().notifPdf) _sendNotif('Exportação concluída', 'Histórico de atividade exportado como CSV', 'csv');
}
function clearActivityLog() {
  localStorage.removeItem(_ACTIVITY_KEY);
  renderActivityLog();
  toast('Histórico limpo', 'info');
}

// ── Push Notifications (Web Push + FCM) ───────────────────
const _VAPID_PUBLIC_KEY = 'BA1ON1Kuq002EkI8JPPugpET2cpTqNwTrswuPx5WhSlzHLmou4X1AlwgwmDwQK4WM4vdLsyi6sfJ7O0QwO9uDXE';
let _fcmMessaging = null;
let _pushSubscription = null;

function _initFCM() {
  try {
    if (!firebase.apps.length || !window.firebase?.messaging) return;
    _fcmMessaging = firebase.messaging();
    // Mensagens recebidas em foreground
    _fcmMessaging.onMessage(payload => {
      const { title = 'GK Hub', body = '' } = payload.notification || {};
      _sendNotifDirect(title, body, payload.data?.tag);
    });
  } catch(e) { console.warn('[GKHub] FCM init:', e.message); }
}

async function requestNotifPermission() {
  if (!('Notification' in window)) {
    toast('Este navegador não suporta notificações', 'error'); return;
  }
  const permission = await Notification.requestPermission();
  _updateNotifPermUI();
  if (permission === 'granted') {
    toast('Notificações ativadas!', 'success');
    await _subscribePush();
  } else if (permission === 'denied') {
    toast('Permissão de notificações negada. Desbloqueie nas configurações do navegador.', 'error');
  }
}

async function _subscribePush() {
  try {
    const sw = await navigator.serviceWorker.ready;

    // 1. FCM token (se Firebase Messaging disponível)
    if (_fcmMessaging) {
      try {
        const token = await _fcmMessaging.getToken({ vapidKey: _VAPID_PUBLIC_KEY, serviceWorkerRegistration: sw });
        if (token) {
          localStorage.setItem('gkhub_fcm_token', token);
          // Envia token para o backend (best-effort)
          const session = _getSession();
          if (session?.token) {
            apiRequest('POST', '/notifications/subscribe', { token, platform: 'web' }).catch(() => {});
          }
        }
      } catch(e) { console.warn('[GKHub] FCM token:', e.message); }
    }

    // 2. Web Push subscription (fallback e redundância)
    try {
      const sub = await sw.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: _urlBase64ToUint8Array(_VAPID_PUBLIC_KEY)
      });
      _pushSubscription = sub;
      localStorage.setItem('gkhub_push_sub', JSON.stringify(sub.toJSON()));
    } catch(e) { /* Push API pode não estar disponível em todos os browsers */ }

  } catch(e) { console.warn('[GKHub] Push subscribe:', e.message); }
}

function _urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

function _updateNotifPermUI() {
  const btn = document.getElementById('btn-req-notif');
  const status = document.getElementById('notif-perm-status');
  if (!('Notification' in window)) {
    if (btn) btn.style.display = 'none';
    if (status) status.textContent = 'Notificações não suportadas neste navegador.';
    return;
  }
  const p = Notification.permission;
  if (btn) btn.style.display = p === 'granted' ? 'none' : '';
  if (status) {
    status.textContent = p === 'granted' ? '✅ Notificações push ativadas' :
                         p === 'denied'  ? '🚫 Notificações bloqueadas — desbloqueie nas configurações do navegador' : '';
    status.style.color = p === 'granted' ? 'var(--success)' : 'var(--error)';
  }
}

function _sendNotifDirect(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    if (navigator.serviceWorker.controller) {
      // Usa Service Worker para mostrar notificação (funciona em background)
      navigator.serviceWorker.ready.then(sw => {
        sw.showNotification(title, {
          body,
          tag: tag || 'gkhub',
          icon: './icons/icon-192.png',
          badge: './icons/icon-192.png',
          vibrate: [200, 100, 200],
          data: { url: './' }
        });
      });
    } else {
      new Notification(title, { body, tag: tag || 'gkhub', icon: './icons/icon-192.png', badge: './icons/icon-192.png' });
    }
  } catch(e) {}
}

function _sendNotif(title, body, tag) {
  // Always record in-app (Notification Center) + audit for user actions,
  // independent of OS notification permission/preferences.
  try {
    pushNotif(tag || 'info', title, body);
    const auditMods = { partida: 'Partidas', scout: 'Scouts', pdf: 'Relatórios', match: 'Partidas' };
    if (auditMods[tag]) logAudit(auditMods[tag], body || title);
  } catch (e) {}
  const prefs = loadPreferences();
  if (!prefs) { _sendNotifDirect(title, body, tag); return; }
  // Respeita preferências do usuário por tipo de notificação
  const tagMap = { scout: 'notifScout', pdf: 'notifPdf', sync: 'notifSync', match: 'notifMatch' };
  const prefKey = tagMap[tag];
  if (prefKey && !prefs[prefKey]) return;
  _sendNotifDirect(title, body, tag);
}

// ── Favorites ─────────────────────────────────────────────
function loadFavorites() {
  try { return JSON.parse(localStorage.getItem(_FAVORITES_KEY) || '{"goleiras":[],"partidas":[]}'); } catch(e) { return {goleiras:[],partidas:[]}; }
}
function toggleFavorite(type, id) {
  const favs = loadFavorites();
  if (!favs[type]) favs[type] = [];
  const idx = favs[type].indexOf(id);
  if (idx >= 0) { favs[type].splice(idx, 1); } else { favs[type].push(id); }
  localStorage.setItem(_FAVORITES_KEY, JSON.stringify(favs));
  return idx < 0;
}
function isFavorite(type, id) {
  const favs = loadFavorites();
  return (favs[type] || []).includes(id);
}
function renderFavorites() {
  const favs = loadFavorites();
  const gkEl = document.getElementById('fav-goleiras-list');
  const ptEl = document.getElementById('fav-partidas-list');
  const gks  = DB.goleiras.filter(g => favs.goleiras?.includes(g.id));
  const pts  = DB.partidas.filter(p => favs.partidas?.includes(p.id));
  if (gkEl) {
    gkEl.innerHTML = gks.length
      ? gks.map(g => `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);">
          <div style="font-size:13px;font-weight:600;">${_esc(g.nome)}</div>
          <button class="btn btn-ghost btn-sm" onclick="toggleFavorite('goleiras','${g.id}');renderFavorites();" style="color:var(--warning);">★</button>
        </div>`).join('')
      : '<div style="color:var(--muted);font-size:13px;padding:12px 0;">Nenhuma goleira favoritada.<br><small>Clique ★ na lista de goleiras.</small></div>';
  }
  if (ptEl) {
    ptEl.innerHTML = pts.length
      ? pts.map(p => `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);">
          <div style="font-size:13px;font-weight:600;">${_esc(p.adversario||'—')}</div>
          <div style="font-size:11px;color:var(--muted);">${p.data||''}</div>
          <button class="btn btn-ghost btn-sm" onclick="toggleFavorite('partidas','${p.id}');renderFavorites();" style="color:var(--warning);">★</button>
        </div>`).join('')
      : '<div style="color:var(--muted);font-size:13px;padding:12px 0;">Nenhuma partida favoritada.</div>';
  }
}

// ── Preferences ───────────────────────────────────────────
function loadPreferences() {
  try { return JSON.parse(localStorage.getItem(_PREFS_KEY) || '{}'); } catch(e) { return {}; }
}
function savePreferences() {
  const prefs = {
    theme:      document.querySelector('.theme-btn.active')?.dataset.theme || 'dark',
    color:      document.querySelector('.color-swatch.active')?.dataset.color || 'blue',
    homePage:   document.getElementById('pref-home')?.value || 'dashboard',
    categoria:  document.getElementById('pref-categoria')?.value || '',
    notifScouts:  !!(document.getElementById('notif-scouts')?.checked),
    notifPartidas:!!(document.getElementById('notif-partidas')?.checked),
    notifPdf:     !!(document.getElementById('notif-pdf')?.checked),
    notifMatch:   !!(document.getElementById('notif-match')?.checked),
  };
  localStorage.setItem(_PREFS_KEY, JSON.stringify(prefs));
  toast('Preferências salvas!', 'success');
}
function applyPreferences() {
  const prefs = loadPreferences();
  if (prefs.theme) _applyTheme(prefs.theme);
  if (prefs.color) {
    const colorMap = { blue:['#3B82F6','#2563EB'], green:['#10B981','#059669'], purple:['#8B5CF6','#7C3AED'], red:['#EF4444','#DC2626'], orange:['#F59E0B','#D97706'] };
    const c = colorMap[prefs.color];
    if (c) _applyPrimaryColor(c[0], c[1]);
  }
  // Restore UI state when preferences page is open
  const homeEl = document.getElementById('pref-home');
  const catEl  = document.getElementById('pref-categoria');
  if (homeEl && prefs.homePage) homeEl.value = prefs.homePage;
  if (catEl  && prefs.categoria) catEl.value = prefs.categoria;
  ['notif-scouts','notif-partidas','notif-pdf','notif-match'].forEach(id => {
    const key = id.replace('-','').replace('notif','notif').replace(/-/g,'');
    const el = document.getElementById(id);
    const prefKey = 'notif' + id.replace('notif-','').replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
    if (el && prefs[prefKey] !== undefined) el.checked = prefs[prefKey];
  });
  document.querySelectorAll('.theme-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.theme === (prefs.theme || 'dark'));
  });
  document.querySelectorAll('.color-swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.color === (prefs.color || 'blue'));
  });
}

// ── Theme ─────────────────────────────────────────────────
function setAppTheme(theme) {
  _applyTheme(theme);
  document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
  const prefs = loadPreferences();
  prefs.theme = theme;
  localStorage.setItem(_PREFS_KEY, JSON.stringify(prefs));
}
function _applyTheme(theme) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'auto' && prefersDark);
  document.body.classList.toggle('theme-light', !isDark);
}

// ── Primary Color ─────────────────────────────────────────
function setPrimaryColor(name, color, dark) {
  _applyPrimaryColor(color, dark);
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.toggle('active', s.dataset.color === name));
  const prefs = loadPreferences();
  prefs.color = name;
  localStorage.setItem(_PREFS_KEY, JSON.stringify(prefs));
}
function _applyPrimaryColor(color, dark) {
  const root = document.documentElement;
  root.style.setProperty('--primary', color);
  root.style.setProperty('--primary-d', dark);
  root.style.setProperty('--primary-g', `linear-gradient(135deg,${color},${dark})`);
}

// ── Security ──────────────────────────────────────────────
async function changePassword() {
  const oldPass = document.getElementById('sec-pass-old')?.value;
  const newPass = document.getElementById('sec-pass-new')?.value;
  const confirm = document.getElementById('sec-pass-confirm')?.value;
  const st = document.getElementById('sec-pass-status');
  if (!oldPass || !newPass) { if(st) st.innerHTML='<span style="color:var(--error)">Preencha todos os campos.</span>'; return; }
  if (newPass.length < 6) { if(st) st.innerHTML='<span style="color:var(--error)">Nova senha precisa ter ao menos 6 caracteres.</span>'; return; }
  if (newPass !== confirm) { if(st) st.innerHTML='<span style="color:var(--error)">As senhas não coincidem.</span>'; return; }
  const token = _apiToken();
  if (!token) { if(st) st.innerHTML='<span style="color:var(--error)">Faça login no backend para alterar a senha.</span>'; return; }
  try {
    await api.patch('/auth/change-password', { currentPassword: oldPass, newPassword: newPass });
    if(st) st.innerHTML='<span style="color:var(--success)">✓ Senha alterada com sucesso!</span>';
    document.getElementById('sec-pass-old').value='';
    document.getElementById('sec-pass-new').value='';
    document.getElementById('sec-pass-confirm').value='';
    toast('Senha alterada!', 'success');
    _logAction('Senha alterada', 'success');
  } catch(e) {
    if(st) st.innerHTML='<span style="color:var(--error)">Erro ao alterar senha. Verifique a senha atual.</span>';
  }
}

// ── Tab switcher ──────────────────────────────────────────
function switchUserTab(tab) {
  document.querySelectorAll('.user-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.user-tab-content').forEach(c => {
    const match = c.id === 'user-tab-' + tab;
    c.classList.toggle('active', match);
  });
  if (tab === 'preferencias') applyPreferences();
  if (tab === 'seguranca') _render2FAStatus();
}
function _render2FAStatus() {
  const badge = document.getElementById('sec-2fa-status');
  const label = document.getElementById('sec-2fa-btn-label');
  if (!badge) return;
  const on = gk2faEnabled();
  badge.textContent = on ? 'Ativado' : 'Desativado';
  badge.style.background = on ? 'rgba(16,185,129,.12)' : 'rgba(148,163,184,.14)';
  badge.style.color = on ? 'var(--success)' : 'var(--muted)';
  if (label) label.textContent = on ? 'Gerenciar 2FA' : 'Ativar 2FA';
}

function setDashPeriod(key) {
  document.querySelectorAll('.dash-period-btn').forEach(b => b.classList.remove('active'));
  const today = new Date();
  if (key === 'all') {
    dashFilterFrom = ''; dashFilterTo = '';
    document.getElementById('dash-from').value = '';
    document.getElementById('dash-to').value = '';
    document.getElementById('dpb-all')?.classList.add('active');
  } else {
    const days = parseInt(key);
    const from = new Date(today); from.setDate(from.getDate() - days);
    dashFilterFrom = from.toISOString().slice(0,10);
    dashFilterTo   = today.toISOString().slice(0,10);
    document.getElementById('dash-from').value = dashFilterFrom;
    document.getElementById('dash-to').value   = dashFilterTo;
    document.getElementById('dpb-'+key)?.classList.add('active');
  }
  refreshDashboard();
}
function setDashCustomPeriod() {
  dashFilterFrom = document.getElementById('dash-from')?.value || '';
  dashFilterTo   = document.getElementById('dash-to')?.value   || '';
  document.querySelectorAll('.dash-period-btn').forEach(b => b.classList.remove('active'));
  refreshDashboard();
}

// INIT
try { _init2FA(); } catch (e) {}
initAuth();
applyPreferences();
try { applyClubBranding(); } catch (e) {}
updateGoleiraSelects();
refreshDashboard();
updateNotifBadge();
try { netInit(); } catch (e) {}
try { _updateScrollUI(); setTimeout(_updateScrollUI, 700); } catch (e) {}
initFirebaseFromStorage();
// Puxa (mescla) as coleções novas da nuvem ao abrir
try { cloudPullNew(true).then(c => { if (c) { const a = document.querySelector('.page.active')?.id?.replace('page-', ''); if (a === 'dashboard') refreshDashboard(); updateNotifBadge(); } }); } catch (e) {}

// ═══════════════════════════════════════════════════════════
// PWA — SERVICE WORKER + OFFLINE + AUTO-SYNC
// ═══════════════════════════════════════════════════════════
let deferredInstallPrompt = null;

// Shows a dismissible "new version available" banner for logged-in users, so
// updates (like layout fixes) reach them without silently waiting for a manual
// refresh. Reloading is safe — the session lives in localStorage.
function _showUpdateBanner() {
  // Show once per session; don't reappear after the user dismisses it (avoids
  // the banner flickering when controllerchange fires more than once).
  if (document.getElementById('gkhub-update-banner')) return;
  if (sessionStorage.getItem('gkhub_update_dismissed')) return;
  const b = document.createElement('div');
  b.id = 'gkhub-update-banner';
  b.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:700;display:flex;align-items:center;gap:14px;background:var(--card);border:1px solid var(--border-h);border-radius:14px;padding:12px 16px;box-shadow:0 12px 32px rgba(0,0,0,.4);font-size:13px;max-width:92vw;';
  b.innerHTML = '<span>✨ Nova versão disponível.</span>'
    + '<button class="btn btn-primary btn-sm" onclick="location.reload()">Atualizar</button>'
    + '<button class="btn btn-ghost btn-sm" onclick="sessionStorage.setItem(\'gkhub_update_dismissed\',\'1\');this.parentElement.remove()">Depois</button>';
  document.body.appendChild(b);
}

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Só recarrega para aplicar novo SW se o usuário NÃO estiver autenticado
    const _swSafeReload = () => {
      try {
        const s = JSON.parse(localStorage.getItem('gkhub_session') || 'null');
        // Sem sessão: recarrega direto. Com sessão: oferece atualização manual
        // (recarregar preserva a sessão, que fica no localStorage).
        if (!s?.token && !localStorage.getItem('gkhub_google_redirect')) window.location.reload();
        else _showUpdateBanner();
      } catch(e) { window.location.reload(); }
    };

    // Registra SW principal
    navigator.serviceWorker.register('./sw.js').then(reg => {
      if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (sw) sw.addEventListener('statechange', () => {
          if (sw.state === 'installed') sw.postMessage({ type: 'SKIP_WAITING' });
        });
      });
    }).catch(e => console.warn('[GKHub] SW registration failed:', e));
    // Registra SW do Firebase Messaging (para push em background)
    navigator.serviceWorker.register('./firebase-messaging-sw.js', { scope: './' })
      .catch(e => console.warn('[GKHub] FCM SW registration failed:', e));
    // Reload quando novo SW assume controle — só se não houver sessão ativa
    navigator.serviceWorker.addEventListener('controllerchange', _swSafeReload);
  });
}

// Install prompt
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  document.getElementById('btn-install').style.display = 'flex';
});

// Show install button on iOS Safari (no beforeinstallprompt support)
if (_isIOS() && !_isInStandaloneMode()) {
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn-install');
    if (btn) btn.style.display = 'flex';
  });
}

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  document.getElementById('btn-install').style.display = 'none';
  toast('GK Hub instalado com sucesso!', 'success');
});

function installPWA() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(result => {
      deferredInstallPrompt = null;
      document.getElementById('btn-install').style.display = 'none';
      if (result.outcome === 'accepted') toast('GK Hub instalado!', 'success');
    });
  } else {
    showInstallGuide();
  }
}

function _isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function _isInStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
}

function showInstallGuide() {
  if (document.getElementById('modal-install-guide')) return;
  const isIOS = _isIOS();
  const overlay = document.createElement('div');
  overlay.id = 'modal-install-guide';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);animation:fadeIn .2s ease;';
  overlay.innerHTML = `
    <div style="background:var(--card);border-radius:20px 20px 0 0;padding:28px 24px 36px;width:100%;max-width:480px;box-shadow:0 -20px 60px rgba(0,0,0,.4);border-top:1px solid rgba(255,255,255,.08);animation:slideUp .25s ease;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <img src="./icons/icon-192.png" style="width:44px;height:44px;border-radius:10px;">
          <div>
            <div style="font-size:15px;font-weight:800;">Instalar GK Hub</div>
            <div style="font-size:12px;color:var(--muted);">Acesso rápido na tela inicial</div>
          </div>
        </div>
        <button onclick="document.getElementById('modal-install-guide').remove()" style="background:rgba(255,255,255,.08);border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;color:var(--text);font-size:18px;display:flex;align-items:center;justify-content:center;">&times;</button>
      </div>
      ${isIOS ? `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div style="font-size:12px;color:var(--muted);margin-bottom:4px;">Siga os passos no <strong style="color:var(--text);">Safari</strong>:</div>
        <div style="display:flex;align-items:center;gap:14px;padding:12px 14px;background:var(--bg);border-radius:12px;">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--primary-g);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;font-weight:800;color:#fff;">1</div>
          <div>
            <div style="font-size:13px;font-weight:600;">Toque em Compartilhar</div>
            <div style="font-size:11px;color:var(--muted);">Ícone <svg style="vertical-align:middle;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> na barra inferior do Safari</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:14px;padding:12px 14px;background:var(--bg);border-radius:12px;">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--primary-g);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;font-weight:800;color:#fff;">2</div>
          <div>
            <div style="font-size:13px;font-weight:600;">Selecione "Adicionar à Tela de Início"</div>
            <div style="font-size:11px;color:var(--muted);">Role a lista de opções para baixo</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:14px;padding:12px 14px;background:var(--bg);border-radius:12px;">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--primary-g);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;font-weight:800;color:#fff;">3</div>
          <div>
            <div style="font-size:13px;font-weight:600;">Toque em "Adicionar"</div>
            <div style="font-size:11px;color:var(--muted);">O ícone do GK Hub aparecerá na tela inicial</div>
          </div>
        </div>
      </div>
      <div style="margin-top:16px;padding:10px 14px;background:rgba(59,130,246,.08);border-radius:10px;font-size:11px;color:var(--muted);">
        ⚠️ Abra este link no <strong style="color:var(--primary);">Safari</strong> — Chrome e Firefox no iOS não suportam instalação de PWA.
      </div>
      ` : `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div style="font-size:12px;color:var(--muted);margin-bottom:4px;">Siga os passos no navegador:</div>
        <div style="display:flex;align-items:center;gap:14px;padding:12px 14px;background:var(--bg);border-radius:12px;">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--primary-g);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;font-weight:800;color:#fff;">1</div>
          <div>
            <div style="font-size:13px;font-weight:600;">Abra o menu do Chrome/Edge</div>
            <div style="font-size:11px;color:var(--muted);">Ícone ⋮ no canto superior direito</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:14px;padding:12px 14px;background:var(--bg);border-radius:12px;">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--primary-g);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;font-weight:800;color:#fff;">2</div>
          <div>
            <div style="font-size:13px;font-weight:600;">Selecione "Instalar app" ou "Adicionar à tela inicial"</div>
            <div style="font-size:11px;color:var(--muted);">Ou clique no ícone ⊕ na barra de endereço</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:14px;padding:12px 14px;background:var(--bg);border-radius:12px;">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--primary-g);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;font-weight:800;color:#fff;">3</div>
          <div>
            <div style="font-size:13px;font-weight:600;">Confirme a instalação</div>
            <div style="font-size:11px;color:var(--muted);">O app abrirá em janela própria sem barra do navegador</div>
          </div>
        </div>
      </div>
      `}
      <button onclick="document.getElementById('modal-install-guide').remove()" class="btn btn-primary" style="width:100%;margin-top:20px;justify-content:center;">
        Entendi
      </button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// Auto-show iOS install tip once (after 30s, if not installed and is iOS Safari)
window.addEventListener('load', () => {
  if (_isIOS() && !_isInStandaloneMode() && !localStorage.getItem('gkhub_ios_tip_shown')) {
    setTimeout(() => {
      if (!_isInStandaloneMode()) {
        localStorage.setItem('gkhub_ios_tip_shown', '1');
        document.getElementById('btn-install').style.display = 'flex';
        // Show a subtle nudge after 30s
        const nudge = document.createElement('div');
        nudge.id = 'ios-nudge';
        nudge.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--card);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:12px 18px;display:flex;align-items:center;gap:12px;box-shadow:0 8px 32px rgba(0,0,0,.4);z-index:8000;cursor:pointer;max-width:340px;animation:slideUp .3s ease;';
        nudge.innerHTML = `
          <img src="./icons/icon-192.png" style="width:36px;height:36px;border-radius:8px;flex-shrink:0;">
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:700;">Instalar GK Hub</div>
            <div style="font-size:11px;color:var(--muted);">Adicione à tela inicial para acesso rápido</div>
          </div>
          <button onclick="event.stopPropagation();document.getElementById('ios-nudge').remove()" style="background:rgba(255,255,255,.08);border:none;border-radius:50%;width:24px;height:24px;cursor:pointer;color:var(--text);font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">&times;</button>
        `;
        nudge.addEventListener('click', () => { nudge.remove(); showInstallGuide(); });
        document.body.appendChild(nudge);
        setTimeout(() => nudge?.remove(), 10000);
      }
    }, 30000);
  }
});

// Offline / Online status
let offlineBanner = null;

function showOfflineBanner(show) {
  if (show && !offlineBanner) {
    offlineBanner = document.createElement('div');
    offlineBanner.className = 'offline-banner';
    offlineBanner.innerHTML = '<div class="offline-dot"></div> Modo offline — dados salvos localmente';
    document.body.appendChild(offlineBanner);
  } else if (!show && offlineBanner) {
    offlineBanner.remove();
    offlineBanner = null;
  }
}

async function syncAllToCloud() {
  if (!rtdbUrl) return;
  const goleiras = DB.goleiras;
  const partidas = DB.partidas;
  const scouts   = DB.scouts;
  if (!goleiras.length && !partidas.length && !scouts.length) return;

  toast('Sincronizando dados com a nuvem…', 'info');
  try {
    await Promise.all([
      ...goleiras.map(g => { const {id,...r} = g; return rtdbPut('/goleiras/'+id, r); }),
      ...partidas.map(p => { const {id,...r} = p; return rtdbPut('/partidas/'+id, r); }),
      ...scouts.map(s  => { const {id,...r} = s; return rtdbPut('/scouts/'+id, r); }),
    ]);
    // Visual flash to signal success
    const flash = document.createElement('div');
    flash.className = 'sync-flash';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 900);
    toast('Sincronização automática concluída!', 'success');
    renderConfigStatus();
  } catch(e) {
    toast(e.message==="PERMISSAO" ? "Sincronização bloqueada pelas regras do Firebase (veja as instruções). Seus dados continuam salvos neste aparelho." : ('Erro na sincronização: '+e.message), 'error');
  }
}

window.addEventListener('online', () => {
  showOfflineBanner(false);
  // Update cloud dot
  const dot = document.getElementById('cloud-dot');
  const lbl = document.getElementById('cloud-label');
  if (dot) dot.style.background = 'var(--muted)';
  if (lbl) lbl.textContent = 'Reconectado…';
  // Auto-sync pending data
  setTimeout(syncAllToCloud, 800);
});

window.addEventListener('offline', () => {
  showOfflineBanner(true);
  const dot = document.getElementById('cloud-dot');
  const lbl = document.getElementById('cloud-label');
  if (dot) dot.style.background = 'var(--warning)';
  if (lbl) lbl.textContent = 'Offline';
});

// Initial check
if (!navigator.onLine) showOfflineBanner(true);

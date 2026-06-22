// ═══════════════════════════════════════════════════════════════
// EXIT GAMES — KEYO INTEGRATION / HEALTH-CHECK v1.0
// Arquivo: keyo-10-integration.js
// Injetar via: <script src="keyo-10-integration.js"></script>  (SEMPRE O ÚLTIMO)
// Inserir no index.html APÓS todos os outros keyo-*.js, antes de </body>.
//
// NATUREZA: 100% ADITIVO. Este módulo NÃO injeta navegação, NÃO dá patch
// em renderPage/goTo/rSb e NÃO toca em #keyo-agents-modulos. Ele apenas
// LÊ o estado (flags + DOM) e mostra um selo de saúde isolado.
// Remover este <script> volta o sistema exatamente ao estado anterior.
// ═══════════════════════════════════════════════════════════════
(function _KEYO_INTEGRATION() {
'use strict';

// ── GUARD: bloqueia dupla injeção ───────────────────────────────
if (window.__KEYO_10_LOADED__) {
  console.warn('[KEYO-10] Já carregado. Ignorando.');
  return;
}
window.__KEYO_10_LOADED__ = true;
window.__KEYO_INTEGRATION_LOADED__ = true; // alias p/ diagnóstico

// ════════════════════════════════════════════════════════════════
// REGISTRO DE MÓDULOS ESPERADOS
// flag  : variável global setada no topo de cada módulo
// btnId : id do botão no menu KEYO (só existe com a aba KEYO aberta)
// ════════════════════════════════════════════════════════════════
var _MODULOS = [
  { nome: 'Core',         flag: '__KEYO_00_LOADED__',   btnId: null },
  { nome: 'UI / Chat',    flag: '__KEYO_01_LOADED__',   btnId: null },
  { nome: 'Campanhas',    flag: '__KEYO_M12_LOADED__',  btnId: 'keyo-mod-campanhas' },
  { nome: 'Churn',        flag: '__KEYO_M13_LOADED__',  btnId: 'keyo-mod-churn' },
  { nome: 'Propostas',    flag: '__KEYO_M14_LOADED__',  btnId: 'keyo-mod-propostas' },
  { nome: 'KPIs',         flag: '__KEYO_M15_LOADED__',  btnId: 'keyo-mod-kpis' },
  { nome: 'Precificação', flag: '__KEYO_M16_LOADED__',  btnId: 'keyo-mod-precos' },
  { nome: 'CRM',          flag: '__KEYO_CRM_LOADED__',  btnId: null },
  { nome: 'Cientista',    flag: '__KEYO_MPROS_LOADED__', btnId: 'keyo-mod-mpros' },
  { nome: 'Instagram',    flag: '__KEYO_IG_LOADED__',   btnId: 'keyo-mod-instagram' },
];

// Funções do ERP base que precisam continuar existindo (nav e persistência)
var _ERP_CRITICAS = ['goTo', 'renderPage', 'rSb', 'toast', 'sDB', 'san', 'uid', 'hoje', 'fM'];

// ════════════════════════════════════════════════════════════════
// CHECAGEM (pura — não muta nada)
// ════════════════════════════════════════════════════════════════
function _checar() {
  var menuAberto = !!document.getElementById('keyo-agents-modulos');

  var modulos = _MODULOS.map(function (m) {
    var carregado = (typeof window[m.flag] !== 'undefined');
    var botao = null; // null = não aplicável; true/false = presente/ausente
    if (m.btnId && menuAberto) {
      botao = !!document.getElementById(m.btnId);
    }
    return { nome: m.nome, carregado: carregado, botao: botao, btnId: m.btnId };
  });

  // ERP base intacto?
  var erpFaltando = _ERP_CRITICAS.filter(function (fn) {
    return typeof window[fn] !== 'function';
  });

  // Etapa 7.3 — conflito de DOM: ids de botão duplicados?
  var duplicados = [];
  _MODULOS.forEach(function (m) {
    if (!m.btnId) return;
    var n = document.querySelectorAll('#' + m.btnId + ', [id="' + m.btnId + '"]').length;
    if (n > 1) duplicados.push(m.btnId + ' (' + n + '×)');
  });

  var faltando = modulos.filter(function (x) { return !x.carregado; }).map(function (x) { return x.nome; });
  var ok = (faltando.length === 0) && (erpFaltando.length === 0) && (duplicados.length === 0);

  return {
    ok: ok,
    modulos: modulos,
    erpFaltando: erpFaltando,
    duplicados: duplicados,
    faltando: faltando,
    menuAberto: menuAberto,
  };
}

// ════════════════════════════════════════════════════════════════
// RELATÓRIO NO CONSOLE
// ════════════════════════════════════════════════════════════════
function _logRelatorio(r) {
  var carregados = r.modulos.filter(function (m) { return m.carregado; }).length;
  console.log('🔒 [KEYO INTEGRIDADE v1.0] ' + carregados + '/' + r.modulos.length +
    ' módulos carregados · ERP ' + (r.erpFaltando.length ? '❌' : '✅') +
    ' · DOM ' + (r.duplicados.length ? '⚠️ duplicado' : '✅'));
  if (r.faltando.length)    console.warn('[KEYO-10] Módulos ausentes:', r.faltando.join(', '));
  if (r.erpFaltando.length) console.error('[KEYO-10] ⚠️ Funções do ERP ausentes:', r.erpFaltando.join(', '));
  if (r.duplicados.length)  console.error('[KEYO-10] ⚠️ Botões duplicados no menu:', r.duplicados.join(', '));
}

// ════════════════════════════════════════════════════════════════
// SELO VISUAL ISOLADO (container próprio — não toca em nada do KEYO)
// ════════════════════════════════════════════════════════════════
function _injetarCSS() {
  if (document.getElementById('keyo-diag-css')) return;
  var s = document.createElement('style');
  s.id = 'keyo-diag-css';
  s.textContent =
    '#keyo-diag-badge{position:fixed;left:14px;bottom:14px;z-index:99999;display:flex;align-items:center;gap:7px;' +
    'padding:7px 12px;border-radius:20px;font:600 11px/1 system-ui,sans-serif;cursor:pointer;border:1px solid;' +
    'box-shadow:0 2px 10px rgba(0,0,0,.18);user-select:none;transition:transform .12s}' +
    '#keyo-diag-badge:hover{transform:translateY(-1px)}' +
    '#keyo-diag-badge.ok{background:#0f2417;border-color:#1f7a4d;color:#3ddc84}' +
    '#keyo-diag-badge.warn{background:#2a1410;border-color:#a3502d;color:#ff9b6b}' +
    '#keyo-diag-dot{width:8px;height:8px;border-radius:50%;background:currentColor;flex-shrink:0}' +
    '#keyo-diag-panel{position:fixed;left:14px;bottom:52px;z-index:99999;width:248px;max-height:60vh;overflow-y:auto;' +
    'background:#13131f;border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:12px 14px;display:none;' +
    'box-shadow:0 8px 28px rgba(0,0,0,.4);font:12px/1.5 system-ui,sans-serif;color:#e8e8f0}' +
    '#keyo-diag-panel.show{display:block}' +
    '#keyo-diag-panel h4{margin:0 0 8px;font-size:12px;color:#C9A84C;letter-spacing:.3px}' +
    '.keyo-diag-row{display:flex;align-items:center;justify-content:space-between;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.05)}' +
    '.keyo-diag-row:last-child{border-bottom:none}' +
    '.keyo-diag-row span:first-child{color:#c8c8d8}' +
    '.keyo-diag-hint{margin-top:8px;font-size:10px;color:#7a7a8c}';
  document.head.appendChild(s);
}

function _renderPanel(r) {
  var rows = r.modulos.map(function (m) {
    var ic = m.carregado ? '✅' : '❌';
    // botao: null=n/a, true=ok, false=ausente (só quando menu aberto)
    var extra = '';
    if (m.btnId) {
      if (m.botao === true)  extra = ' · botão ✅';
      else if (m.botao === false) extra = ' · botão ⚠️';
    }
    return '<div class="keyo-diag-row"><span>' + m.nome + '</span><span>' + ic + extra + '</span></div>';
  }).join('');

  var erpRow = '<div class="keyo-diag-row"><span>ERP base</span><span>' +
    (r.erpFaltando.length ? '❌ ' + r.erpFaltando.join(',') : '✅ íntegro') + '</span></div>';
  var domRow = '<div class="keyo-diag-row"><span>DOM (sem duplicados)</span><span>' +
    (r.duplicados.length ? '⚠️ ' + r.duplicados.join(',') : '✅') + '</span></div>';

  var hint = r.menuAberto
    ? ''
    : '<div class="keyo-diag-hint">Abra a aba KEYO para verificar os botões do menu.</div>';

  return '<h4>🔒 Saúde do KEYO</h4>' + rows + erpRow + domRow + hint;
}

function _ensureBadge() {
  if (document.getElementById('keyo-diag-badge')) return;
  if (!document.body) return;
  _injetarCSS();

  var badge = document.createElement('div');
  badge.id = 'keyo-diag-badge';

  var panel = document.createElement('div');
  panel.id = 'keyo-diag-panel';

  function _atualizar() {
    var r = _checar();
    badge.className = r.ok ? 'ok' : 'warn';
    badge.innerHTML = '<span id="keyo-diag-dot"></span>' +
      '<span>KEYO ' + (r.ok ? 'OK' : 'verificar') + '</span>';
    panel.innerHTML = _renderPanel(r);
    return r;
  }

  badge.onclick = function (e) {
    e.stopPropagation();
    var r = _atualizar();          // recomputa ao abrir (pega menu/botões ao vivo)
    _logRelatorio(r);
    panel.classList.toggle('show');
  };
  // Fecha o painel ao clicar fora
  document.addEventListener('click', function () { panel.classList.remove('show'); });

  document.body.appendChild(panel);
  document.body.appendChild(badge);
  _atualizar();
}

// ════════════════════════════════════════════════════════════════
// API pública para console / suporte
// ════════════════════════════════════════════════════════════════
window.keyoDiagnostico = function () {
  var r = _checar();
  _logRelatorio(r);
  return r;
};

// ── Boot ────────────────────────────────────────────────────────
function _boot() {
  _ensureBadge();
  _logRelatorio(_checar());
}
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', _boot, { once: true });
} else {
  _boot();
}

console.info('[KEYO-10] ✅ Integration / Health-check v1.0 — selo de saúde aditivo (não invasivo). Rode window.keyoDiagnostico() no console quando quiser.');

})();

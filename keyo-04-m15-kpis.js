// ═══════════════════════════════════════════════════════════════
// EXIT GAMES — KEYO M15: DASHBOARD KPIs v1.0
// Arquivo: keyo-04-m15-kpis.js
// Depende de: keyo-00-core.js e keyo-01-ui.js
// Acessa: DB.vendas, DB.clientes, DB.unidades, fatDia(), fatMes()
// NUNCA modificar funções do ERP base.
// ═══════════════════════════════════════════════════════════════
(function _KEYO_M15() {
'use strict';

if (window.__KEYO_M15_LOADED__) { console.warn('[KEYO-M15] Já carregado.'); return; }
if (!window.__KEYO_00_LOADED__) { console.error('[KEYO-M15] Core não carregado. Abortando.'); return; }
window.__KEYO_M15_LOADED__ = true;

// ── VERIFICAÇÃO DE DEPENDÊNCIAS ─────────────────────────────────
const _DEPS = ['toast', 'uid', 'hoje', 'fM', 'san']; // UA/DB/sDB/isAdm são pós-login
const _depsFaltando = _DEPS.filter(d => typeof window[d] === 'undefined');
if (_depsFaltando.length > 0) {
  console.error('[KEYO-M15] Dependências ausentes:', _depsFaltando, '— módulo abortado.');
  window.__KEYO_M15_LOADED__ = false;
  return;
}

// ── FREEZE DE FUNÇÕES CRÍTICAS DO ERP ──────────────────────────
const _ERP_ORIGINALS = {
  goTo:        window.goTo,
  renderPage:  window.renderPage,
  rSb:         window.rSb,
  toast:       window.toast,
  sDB:         window.sDB,
};
window.addEventListener('load', function() {
  Object.keys(_ERP_ORIGINALS).forEach(fn => {
    if (window[fn] !== _ERP_ORIGINALS[fn]) {
      console.error('[KEYO-M15] ⚠️ Função ERP sobrescrita indevidamente:', fn);
    }
  });
}, { once: true });

// ════════════════════════════════════════════════════════════════
// CSS
// ════════════════════════════════════════════════════════════════
(function _css() {
  if (document.getElementById('keyo-m15-css')) return;
  const s = document.createElement('style');
  s.id = 'keyo-m15-css';
  s.textContent = `
#m15-wrap{padding:20px;max-width:680px;margin:0 auto}
#m15-wrap h2{font-size:16px;font-weight:700;color:#111118;margin-bottom:6px;display:flex;align-items:center;gap:8px}
.m15-subtitle{font-size:12px;color:#888899;margin-bottom:18px}
.m15-card{background:#fff;border:1px solid #e8e8f0;border-radius:14px;padding:18px 20px;margin-bottom:14px;box-shadow:0 1px 4px rgba(0,0,0,0.05)}
.m15-card-title{font-size:11px;font-weight:700;color:#888899;text-transform:uppercase;letter-spacing:.8px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center}
.m15-kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:14px}
.m15-kpis-4{grid-template-columns:repeat(4,1fr)}
.m15-kpi{background:#fff;border:1px solid #e8e8f0;border-radius:12px;padding:14px 16px}
.m15-kpi-n{font-size:24px;font-weight:700;color:#111118;line-height:1.1}
.m15-kpi-l{font-size:11px;color:#888899;margin-top:4px}
.m15-kpi-delta{font-size:11px;margin-top:4px;font-weight:500}
.m15-kpi-delta.up{color:#3b6d11}
.m15-kpi-delta.down{color:#a32d2d}
.m15-kpi.destaque{background:linear-gradient(135deg,#C9A84C,#e8c76a);border-color:#C9A84C}
.m15-kpi.destaque .m15-kpi-n{color:#000}
.m15-kpi.destaque .m15-kpi-l{color:rgba(0,0,0,0.6)}

/* tabela vendas */
.m15-table{width:100%;border-collapse:collapse;font-size:12px}
.m15-table th{text-align:left;padding:8px 10px;font-size:10px;font-weight:700;color:#888899;text-transform:uppercase;letter-spacing:.6px;border-bottom:1px solid #e8e8f0}
.m15-table td{padding:10px;border-bottom:1px solid #f4f4fa;vertical-align:middle}
.m15-table tr:last-child td{border-bottom:none}
.m15-badge-status{display:inline-block;font-size:10px;font-weight:600;padding:3px 8px;border-radius:20px}
.m15-badge-status.confirmado{background:#eaf3de;color:#3b6d11}
.m15-badge-status.cancelado{background:#f8d7da;color:#842029}
.m15-badge-status.pendente{background:#fff3cd;color:#856404}

/* barras */
.m15-bar-wrap{margin-bottom:10px}
.m15-bar-label{display:flex;justify-content:space-between;font-size:12px;color:#555566;margin-bottom:4px}
.m15-bar-track{background:#f4f4fa;border-radius:20px;height:8px;overflow:hidden}
.m15-bar-fill{height:100%;border-radius:20px;background:#C9A84C;transition:width .6s ease}

.m15-empty{text-align:center;padding:30px;color:#aaa;font-size:13px}
.m15-atualizar{font-size:11px;color:#C9A84C;cursor:pointer;text-decoration:underline}
.m15-periodo{display:flex;gap:6px;margin-bottom:14px}
.m15-periodo-btn{background:none;border:1px solid #d8d8e8;border-radius:20px;padding:5px 12px;font-size:11px;color:#555566;cursor:pointer;font-family:inherit;transition:all .15s}
.m15-periodo-btn.active{background:#C9A84C;border-color:#C9A84C;color:#000;font-weight:600}
`;
  document.head.appendChild(s);
})();

// ════════════════════════════════════════════════════════════════
// ESTADO
// ════════════════════════════════════════════════════════════════
let _periodo = 'mes';

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════
function _vendas()   { return window.DB?.vendas   || []; }
function _clientes() { return window.DB?.clientes || []; }
function _unidades() { return window.DB?.unidades || []; }

function _hoje() {
  return typeof window.hoje === 'function' ? window.hoje() : new Date().toISOString().slice(0,10);
}

function _fmtMoeda(v) {
  return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function _vendasPeriodo() {
  const hj = _hoje();
  const v  = _vendas().filter(v => v.status === 'confirmado');
  if (_periodo === 'hoje') return v.filter(x => x.data === hj);
  if (_periodo === 'mes')  return v.filter(x => x.data?.startsWith(hj.slice(0,7)));
  return v; // total
}

function _receitaPeriodo() {
  return _vendasPeriodo().reduce((s, v) => s + (v.valorTotal || 0), 0);
}

function _ticketMedio() {
  const vs = _vendasPeriodo();
  return vs.length ? _receitaPeriodo() / vs.length : 0;
}

function _vendasPorSala() {
  const map = {};
  _vendasPeriodo().forEach(v => {
    const sala = (window.rlsSalas ? window.rlsSalas() : []).find(s => String(s.id) === String(v.salaId));
    const nome = sala ? `${sala.emoji || '🚪'} ${sala.nome}` : `Sala ${v.salaId}`;
    map[nome] = (map[nome] || 0) + 1;
  });
  return Object.entries(map).sort((a,b) => b[1]-a[1]);
}

function _ultimasVendas() {
  return _vendas()
    .filter(v => v.data)
    .sort((a,b) => b.data?.localeCompare(a.data))
    .slice(0, 8);
}

function _fmtData(d) {
  if (!d) return '—';
  const [y,m,dd] = d.split('-');
  return `${dd}/${m}`;
}

// ════════════════════════════════════════════════════════════════
// RENDER INLINE
// ════════════════════════════════════════════════════════════════
function _renderInline() {
  const anterior = document.getElementById('keyo-m15-inline');
  if (anterior) anterior.remove();

  const msgs      = document.getElementById('keyo-msgs');
  const inputArea = document.getElementById('keyo-input-area');
  if (msgs)      msgs.style.display      = 'none';
  if (inputArea) inputArea.style.display = 'none';

  const main = document.getElementById('keyo-main');
  if (!main) return;

  const area = document.createElement('div');
  area.id = 'keyo-m15-inline';
  area.style.cssText = 'flex:1;overflow-y:auto';
  area.innerHTML = _html();
  main.appendChild(area);
}

// ════════════════════════════════════════════════════════════════
// HTML
// ════════════════════════════════════════════════════════════════
function _html() {
  const vendas    = _vendasPeriodo();
  const receita   = _receitaPeriodo();
  const ticket    = _ticketMedio();
  const clientes  = _clientes().length;
  const porSala   = _vendasPorSala();
  const maxSala   = porSala[0]?.[1] || 1;
  const ultVendas = _ultimasVendas();
  const canceladas = _vendas().filter(v => v.status === 'cancelado').length;

  const periodoLabel = { hoje: 'Hoje', mes: 'Este mês', total: 'Total' }[_periodo];

  return `
<div id="m15-wrap">
  <h2>📊 Dashboard KPIs</h2>
  <div class="m15-subtitle">Atualizado em ${new Date().toLocaleString('pt-BR')} · <span class="m15-atualizar" onclick="window.m15_atualizar()">Atualizar</span></div>

  <div class="m15-periodo">
    <button class="m15-periodo-btn${_periodo==='hoje'?' active':''}" onclick="window.m15_periodo('hoje')">Hoje</button>
    <button class="m15-periodo-btn${_periodo==='mes'?' active':''}" onclick="window.m15_periodo('mes')">Este mês</button>
    <button class="m15-periodo-btn${_periodo==='total'?' active':''}" onclick="window.m15_periodo('total')">Total</button>
  </div>

  <div class="m15-kpis m15-kpis-4">
    <div class="m15-kpi destaque">
      <div class="m15-kpi-n">${_fmtMoeda(receita)}</div>
      <div class="m15-kpi-l">Receita — ${periodoLabel}</div>
    </div>
    <div class="m15-kpi">
      <div class="m15-kpi-n">${vendas.length}</div>
      <div class="m15-kpi-l">Reservas confirmadas</div>
    </div>
    <div class="m15-kpi">
      <div class="m15-kpi-n">${_fmtMoeda(ticket)}</div>
      <div class="m15-kpi-l">Ticket médio</div>
    </div>
    <div class="m15-kpi">
      <div class="m15-kpi-n">${clientes}</div>
      <div class="m15-kpi-l">Clientes cadastrados</div>
    </div>
  </div>

  ${porSala.length ? `
  <div class="m15-card">
    <div class="m15-card-title">Reservas por sala — ${periodoLabel}</div>
    ${porSala.map(([nome, qtd]) => `
    <div class="m15-bar-wrap">
      <div class="m15-bar-label"><span>${nome}</span><span>${qtd} reserva${qtd>1?'s':''}</span></div>
      <div class="m15-bar-track"><div class="m15-bar-fill" style="width:${Math.round(qtd/maxSala*100)}%"></div></div>
    </div>`).join('')}
  </div>` : ''}

  <div class="m15-card" style="padding:0;overflow:hidden">
    <div class="m15-card-title" style="padding:14px 20px 0">
      <span>Últimas reservas</span>
      <span style="font-size:10px;color:#aaa;font-weight:400">${canceladas} cancelamento${canceladas!==1?'s':''} no total</span>
    </div>
    ${ultVendas.length ? `
    <table class="m15-table">
      <thead><tr>
        <th>Data</th><th>Sala</th><th>Cliente</th><th>Valor</th><th>Status</th>
      </tr></thead>
      <tbody>
        ${ultVendas.map(v => {
          const sala = (window.rlsSalas ? window.rlsSalas() : []).find(s => String(s.id) === String(v.salaId));
          const cli  = _clientes().find(c => String(c.id) === String(v.clienteId));
          return `<tr>
            <td>${_fmtData(v.data)} ${v.horario||''}</td>
            <td>${sala ? sala.emoji+' '+sala.nome : '—'}</td>
            <td>${cli?.nome || 'Walk-in'}</td>
            <td>${_fmtMoeda(v.valorTotal)}</td>
            <td><span class="m15-badge-status ${v.status||'pendente'}">${v.status||'pendente'}</span></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>` : '<div class="m15-empty">Nenhuma reserva encontrada ainda.</div>'}
  </div>
</div>`;
}

// ════════════════════════════════════════════════════════════════
// AÇÕES
// ════════════════════════════════════════════════════════════════
function _setPeriodo(p) {
  _periodo = p;
  _atualizar();
}

function _atualizar() {
  const area = document.getElementById('keyo-m15-inline');
  if (area) area.innerHTML = _html();
}

// ════════════════════════════════════════════════════════════════
// EXPÕE GLOBALMENTE
// ════════════════════════════════════════════════════════════════
window._m15RenderInline = _renderInline;
window.m15_periodo      = _setPeriodo;
window.m15_atualizar    = _atualizar;

console.info('[KEYO-M15] ✅ M15 Dashboard KPIs v1.0 carregado.');

})();

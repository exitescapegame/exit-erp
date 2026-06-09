// ═══════════════════════════════════════════════════════════════
// EXIT GAMES — KEYO M13: ANÁLISE DE CLIENTES v1.0
// Arquivo: keyo-02-m13-churn.js
// Depende de: keyo-00-core.js e keyo-01-ui.js
// Acessa: DB.clientes, DB.vendas, DB.unidades
// NUNCA modificar funções do ERP base.
// ═══════════════════════════════════════════════════════════════
(function _KEYO_M13() {
'use strict';

if (window.__KEYO_M13_LOADED__) { console.warn('[KEYO-M13] Já carregado.'); return; }
if (!window.__KEYO_00_LOADED__) { console.error('[KEYO-M13] Core não carregado. Abortando.'); return; }
window.__KEYO_M13_LOADED__ = true;

// ── VERIFICAÇÃO DE DEPENDÊNCIAS ─────────────────────────────────
const _DEPS = ['DB', 'UA', 'toast', 'sDB', 'uid', 'hoje', 'fM', 'san', 'isAdm'];
const _depsFaltando = _DEPS.filter(d => typeof window[d] === 'undefined');
if (_depsFaltando.length > 0) {
  console.error('[KEYO-M13] Dependências ausentes:', _depsFaltando, '— módulo abortado.');
  window.__KEYO_M13_LOADED__ = false;
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
      console.error('[KEYO-M13] ⚠️ Função ERP sobrescrita indevidamente:', fn);
    }
  });
}, { once: true });

// ════════════════════════════════════════════════════════════════
// CSS
// ════════════════════════════════════════════════════════════════
(function _css() {
  if (document.getElementById('keyo-m13-css')) return;
  const s = document.createElement('style');
  s.id = 'keyo-m13-css';
  s.textContent = `
#m13-wrap{padding:20px;max-width:680px;margin:0 auto}
#m13-wrap h2{font-size:16px;font-weight:700;color:#111118;margin-bottom:18px;display:flex;align-items:center;gap:8px}
.m13-card{background:#fff;border:1px solid #e8e8f0;border-radius:14px;padding:18px 20px;margin-bottom:14px;box-shadow:0 1px 4px rgba(0,0,0,0.05)}
.m13-card-title{font-size:11px;font-weight:700;color:#888899;text-transform:uppercase;letter-spacing:.8px;margin-bottom:14px}
.m13-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
.m13-stat{background:#fff;border:1px solid #e8e8f0;border-radius:12px;padding:14px;text-align:center}
.m13-stat-n{font-size:22px;font-weight:700;color:#111118}
.m13-stat-l{font-size:10px;color:#888899;margin-top:3px}
.m13-stat.verde .m13-stat-n{color:#3b6d11}
.m13-stat.amarelo .m13-stat-n{color:#856404}
.m13-stat.vermelho .m13-stat-n{color:#a32d2d}

/* tabela */
.m13-table{width:100%;border-collapse:collapse;font-size:12px}
.m13-table th{text-align:left;padding:8px 10px;font-size:10px;font-weight:700;color:#888899;text-transform:uppercase;letter-spacing:.6px;border-bottom:1px solid #e8e8f0}
.m13-table td{padding:10px;border-bottom:1px solid #f4f4fa;vertical-align:middle}
.m13-table tr:last-child td{border-bottom:none}
.m13-table tr:hover td{background:#fafafa}
.m13-badge{display:inline-block;font-size:10px;font-weight:600;padding:3px 8px;border-radius:20px}
.m13-badge.ativo{background:#eaf3de;color:#3b6d11}
.m13-badge.atencao{background:#fff3cd;color:#856404}
.m13-badge.risco{background:#f8d7da;color:#842029}
.m13-badge.novo{background:#e6f1fb;color:#185fa5}
.m13-nome{font-weight:500;color:#111118}
.m13-sub{font-size:10px;color:#888899;margin-top:1px}
.m13-btn-sm{background:none;border:1px solid #d8d8e8;border-radius:6px;padding:4px 10px;font-size:11px;color:#555566;cursor:pointer;font-family:inherit;transition:all .15s}
.m13-btn-sm:hover{border-color:#C9A84C;color:#C9A84C}
.m13-filtros{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}
.m13-filtro-btn{background:none;border:1px solid #d8d8e8;border-radius:20px;padding:5px 12px;font-size:11px;color:#555566;cursor:pointer;font-family:inherit;transition:all .15s}
.m13-filtro-btn:hover,.m13-filtro-btn.active{background:#C9A84C;border-color:#C9A84C;color:#000;font-weight:600}
.m13-empty{text-align:center;padding:30px;color:#aaa;font-size:13px}
.m13-msg-box{background:#f4f4fa;border-radius:10px;padding:12px 14px;font-size:12px;line-height:1.8;color:#333344;white-space:pre-wrap;font-family:inherit;border:1px solid #e8e8f0;margin-top:10px}
.m13-msg-actions{display:flex;gap:8px;margin-top:8px}
.m13-btn-wpp{background:#25D366;border:none;border-radius:8px;padding:7px 14px;font-size:12px;font-weight:500;color:#fff;cursor:pointer;font-family:inherit}
.m13-btn-wpp:hover{background:#1ebe5a}
.m13-btn-copy{background:#fff;border:1px solid #d8d8e8;border-radius:8px;padding:7px 14px;font-size:12px;color:#333344;cursor:pointer;font-family:inherit}
`;
  document.head.appendChild(s);
})();

// ════════════════════════════════════════════════════════════════
// ESTADO
// ════════════════════════════════════════════════════════════════
let _filtro = 'todos';
let _clienteSelecionado = null;

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════
function _clientes() { return window.DB?.clientes || []; }
function _vendas()   { return window.DB?.vendas   || []; }

function _diasDesde(dataStr) {
  if (!dataStr) return 999;
  const d = new Date(dataStr);
  const hoje = new Date();
  return Math.floor((hoje - d) / (1000 * 60 * 60 * 24));
}

function _ultimaVisita(clienteId) {
  const vendas = _vendas()
    .filter(v => String(v.clienteId) === String(clienteId) && v.status === 'confirmado')
    .sort((a, b) => b.data?.localeCompare(a.data));
  return vendas[0]?.data || null;
}

function _statusCliente(c) {
  const dias = _diasDesde(_ultimaVisita(c.id) || c.criadoEm);
  const jogos = c.jogos || 0;
  if (jogos === 0) return 'novo';
  if (dias <= 30)  return 'ativo';
  if (dias <= 60)  return 'atencao';
  return 'risco';
}

function _statusLabel(s) {
  return { novo: 'Novo', ativo: 'Ativo', atencao: 'Atenção', risco: 'Em risco' }[s] || s;
}

function _fmtData(dataStr) {
  if (!dataStr) return '—';
  const [y, m, d] = dataStr.split('-');
  return `${d}/${m}/${y}`;
}

function _fmtMoeda(v) {
  return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
}

function _clientesFiltrados() {
  const todos = _clientes();
  if (_filtro === 'todos') return todos;
  return todos.filter(c => _statusCliente(c) === _filtro);
}

// ════════════════════════════════════════════════════════════════
// RENDER INLINE
// ════════════════════════════════════════════════════════════════
function _renderInline() {
  const anterior = document.getElementById('keyo-m13-inline');
  if (anterior) anterior.remove();

  const msgs      = document.getElementById('keyo-msgs');
  const inputArea = document.getElementById('keyo-input-area');
  if (msgs)      msgs.style.display      = 'none';
  if (inputArea) inputArea.style.display = 'none';

  const main = document.getElementById('keyo-main');
  if (!main) return;

  const area = document.createElement('div');
  area.id = 'keyo-m13-inline';
  area.style.cssText = 'flex:1;overflow-y:auto';
  area.innerHTML = _html();
  main.appendChild(area);
}

// ════════════════════════════════════════════════════════════════
// HTML
// ════════════════════════════════════════════════════════════════
function _html() {
  const clientes = _clientes();
  const ativos   = clientes.filter(c => _statusCliente(c) === 'ativo').length;
  const atencao  = clientes.filter(c => _statusCliente(c) === 'atencao').length;
  const risco    = clientes.filter(c => _statusCliente(c) === 'risco').length;
  const novos    = clientes.filter(c => _statusCliente(c) === 'novo').length;

  return `
<div id="m13-wrap">
  <h2>👥 Análise de Clientes</h2>

  <div class="m13-stats">
    <div class="m13-stat"><div class="m13-stat-n">${clientes.length}</div><div class="m13-stat-l">Total</div></div>
    <div class="m13-stat verde"><div class="m13-stat-n">${ativos}</div><div class="m13-stat-l">Ativos</div></div>
    <div class="m13-stat amarelo"><div class="m13-stat-n">${atencao}</div><div class="m13-stat-l">Atenção</div></div>
    <div class="m13-stat vermelho"><div class="m13-stat-n">${risco}</div><div class="m13-stat-l">Em risco</div></div>
  </div>

  <div class="m13-filtros">
    <button class="m13-filtro-btn${_filtro==='todos'?' active':''}" onclick="window.m13_filtrar('todos')">Todos (${clientes.length})</button>
    <button class="m13-filtro-btn${_filtro==='novo'?' active':''}" onclick="window.m13_filtrar('novo')">🆕 Novos (${novos})</button>
    <button class="m13-filtro-btn${_filtro==='ativo'?' active':''}" onclick="window.m13_filtrar('ativo')">✅ Ativos (${ativos})</button>
    <button class="m13-filtro-btn${_filtro==='atencao'?' active':''}" onclick="window.m13_filtrar('atencao')">⚠️ Atenção (${atencao})</button>
    <button class="m13-filtro-btn${_filtro==='risco'?' active':''}" onclick="window.m13_filtrar('risco')">🔴 Em risco (${risco})</button>
  </div>

  <div class="m13-card" style="padding:0;overflow:hidden">
    ${_tabelaHTML()}
  </div>

  <div id="m13-msg-panel" style="display:none">
    <div class="m13-card">
      <div class="m13-card-title" id="m13-msg-titulo">Mensagem de reengajamento</div>
      <div class="m13-msg-box" id="m13-msg-txt"></div>
      <div class="m13-msg-actions">
        <button class="m13-btn-copy" onclick="window.m13_copiarMsg()">📋 Copiar</button>
        <button class="m13-btn-wpp" onclick="window.m13_whatsapp()">💬 WhatsApp</button>
        <button class="m13-btn-copy" onclick="window.m13_gerarIA()">🧠 Gerar com IA</button>
      </div>
    </div>
  </div>
</div>`;
}

function _tabelaHTML() {
  const lista = _clientesFiltrados();
  if (!lista.length) return '<div class="m13-empty">Nenhum cliente encontrado.</div>';

  return `<table class="m13-table">
    <thead>
      <tr>
        <th>Cliente</th>
        <th>Status</th>
        <th>Jogos</th>
        <th>Total gasto</th>
        <th>Última visita</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      ${lista.map(c => {
        const status = _statusCliente(c);
        const ultima = _ultimaVisita(c.id) || c.criadoEm;
        const dias   = _diasDesde(ultima);
        return `
        <tr>
          <td>
            <div class="m13-nome">${c.nome || '—'}</div>
            <div class="m13-sub">${c.telefone || ''}</div>
          </td>
          <td><span class="m13-badge ${status}">${_statusLabel(status)}</span></td>
          <td>${c.jogos || 0}</td>
          <td>${_fmtMoeda(c.totalGasto)}</td>
          <td>
            <div>${_fmtData(ultima)}</div>
            <div class="m13-sub">${dias < 999 ? dias + ' dias atrás' : '—'}</div>
          </td>
          <td><button class="m13-btn-sm" onclick="window.m13_verCliente('${c.id}')">Mensagem</button></td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;
}

// ════════════════════════════════════════════════════════════════
// AÇÕES
// ════════════════════════════════════════════════════════════════
function _filtrar(f) {
  _filtro = f;
  const area = document.getElementById('keyo-m13-inline');
  if (area) { area.innerHTML = _html(); }
}

function _verCliente(id) {
  const c = _clientes().find(x => String(x.id) === String(id));
  if (!c) return;
  _clienteSelecionado = c;

  const status  = _statusCliente(c);
  const ultima  = _ultimaVisita(c.id);
  const dias    = _diasDesde(ultima || c.criadoEm);
  const nome    = (c.nome || '').split(' ')[0];

  const msgs = {
    novo:    `Olá, ${nome}! 👋\n\nFicamos felizes em ter você conosco na EXIT GAMES!\n\nQue tal marcar sua primeira aventura? Temos salas incríveis esperando por você.\n\n🔗 Agende agora: exitsystem.net\n\nAté logo! 🎮`,
    ativo:   `Olá, ${nome}! 🎮\n\nSaudades! Você é um dos nossos jogadores favoritos.\n\nQue tal voltar para mais uma aventura? Novas salas e desafios esperando por você!\n\n📅 Agende agora e garanta seu horário.`,
    atencao: `Olá, ${nome}! 👋\n\nFaz um tempinho que não te vemos por aqui...\n\nQue tal retornar para mais uma partida na EXIT GAMES? Temos novidades esperando por você! 🎮\n\n📅 Fale com a gente e agende seu retorno.`,
    risco:   `Olá, ${nome}! 🙂\n\nSentimos sua falta na EXIT GAMES!\n\nVocê jogou conosco ${c.jogos || 0} vez(es) e adoraríamos te ver de volta.\n\nQue tal uma oferta especial para o seu retorno? Entre em contato conosco! 🎮`,
  };

  const panel = document.getElementById('m13-msg-panel');
  const titulo = document.getElementById('m13-msg-titulo');
  const txt    = document.getElementById('m13-msg-txt');

  if (panel && titulo && txt) {
    titulo.textContent = `Mensagem para ${c.nome} · ${_statusLabel(status)}`;
    txt.textContent    = msgs[status] || msgs.novo;
    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function _copiarMsg() {
  const txt = document.getElementById('m13-msg-txt')?.textContent || '';
  navigator.clipboard.writeText(txt).then(() => {
    if (typeof window.toast === 'function') window.toast('Copiado!', 'ok');
  });
}

function _whatsapp() {
  const c   = _clienteSelecionado;
  const txt = document.getElementById('m13-msg-txt')?.textContent || '';
  const tel = (c?.telefone || '').replace(/\D/g, '');
  const url = tel
    ? `https://wa.me/55${tel}?text=${encodeURIComponent(txt)}`
    : `https://wa.me/?text=${encodeURIComponent(txt)}`;
  window.open(url, '_blank');
}

async function _gerarIA() {
  const c = _clienteSelecionado;
  if (!c) return;
  if (typeof window.toast === 'function') window.toast('Gerando com IA...', 'info');

  const status = _statusCliente(c);
  const dias   = _diasDesde(_ultimaVisita(c.id) || c.criadoEm);

  const prompt = `Você é o assistente de relacionamento da EXIT GAMES, empresa de escape room.
Escreva uma mensagem de WhatsApp curta e amigável para reengajar o cliente abaixo.
Tom: caloroso, sem pressão, genuíno. Máximo 5 linhas.

Cliente: ${c.nome}
Status: ${_statusLabel(status)}
Jogos realizados: ${c.jogos || 0}
Total gasto: R$ ${c.totalGasto || 0}
Dias desde última visita: ${dias < 999 ? dias : 'nunca jogou'}

Responda APENAS com a mensagem, sem explicações.`;

  try {
    const resp = await fetch(window.KEYO_EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (function() {
          try { return JSON.parse(localStorage.getItem('exit_unidade_session') || '{}')?.access_token || window.KEYO_ANON_KEY; }
          catch(e) { return window.KEYO_ANON_KEY; }
        })(),
        'apikey': window.KEYO_ANON_KEY,
      },
      body: JSON.stringify({
        agente: 'mkt', mensagem: prompt, historico: [], unidade_id: 1,
      })
    });
    const data = await resp.json();
    const txt  = data.resposta || data.reply || data.message || data.text || '';
    if (txt) {
      document.getElementById('m13-msg-txt').textContent = txt;
      if (typeof window.toast === 'function') window.toast('Mensagem gerada!', 'ok');
    }
  } catch(e) {
    console.error('[KEYO-M13] Erro IA:', e);
    if (typeof window.toast === 'function') window.toast('Erro ao conectar IA', 'err');
  }
}

// ════════════════════════════════════════════════════════════════
// EXPÕE GLOBALMENTE
// ════════════════════════════════════════════════════════════════
window._m13RenderInline = _renderInline;
window.m13_filtrar      = _filtrar;
window.m13_verCliente   = _verCliente;
window.m13_copiarMsg    = _copiarMsg;
window.m13_whatsapp     = _whatsapp;
window.m13_gerarIA      = _gerarIA;

console.info('[KEYO-M13] ✅ M13 Análise de Clientes v1.0 carregado.');

})();

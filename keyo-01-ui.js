// ═══════════════════════════════════════════════════════════════
// EXIT GAMES — KEYO UI v1.7
// Arquivo: keyo-01-ui.js
// Depende de: keyo-00-core.js (deve ser carregado antes)
// Cobre: Etapas 1.2 + 1.3 + 1.4 do Plano Mestre v2.0
// v1.8: adiciona módulos Churn (M13), Propostas (M14) e KPIs (M15)
// NUNCA modificar funções do ERP base.
// ═══════════════════════════════════════════════════════════════
(function _KEYO_UI() {
'use strict';

// ── GUARD: bloqueia dupla injeção ───────────────────────────────
if (window.__KEYO_01_LOADED__) {
  console.warn('[KEYO-01] Já carregado. Ignorando.');
  return;
}
if (!window.__KEYO_00_LOADED__) {
  console.error('[KEYO-01] keyo-00-core.js não carregado. Abortando.');
  return;
}
window.__KEYO_01_LOADED__ = true;
window.__KEYO_UI_LOADED__ = true; // alias para diagnóstico

// ── Referências originais do ERP (para verificação de integridade) ──
const _ERP_ORIG_RENDER = window.renderPage;
const _ERP_ORIG_RSB    = window.rSb;
const _ERP_ORIG_GOTO   = window.goTo;

// ════════════════════════════════════════════════════════════════
// ESTADO INTERNO
// ════════════════════════════════════════════════════════════════
let _kAgente  = 'keyo';
let _kLoading = false;
let _kHistory = {};   // { agentId: [ {role, texto, ts} ] }
let _kAba     = 'chat'; // 'chat' | 'campanhas'

// Inicializa histórico para todos os agentes
window.KEYO_AGENTS.forEach(a => { _kHistory[a.id] = []; });

// ════════════════════════════════════════════════════════════════
// ETAPA 1.3 — INJETAR NO MENU VIA MENUS[] + rSb()
// ════════════════════════════════════════════════════════════════
// ── PATCH SEGURO DO rSb() ────────────────────────────────────────
// MENUS é const local no ERP — não acessível via window.MENUS.
// Solução: interceptar rSb() e injetar o item KEYO após cada redesenho,
// sem MutationObserver e sem tocar no array MENUS original.
function _injetarMenu() {
  if (!window.rSb) {
    console.warn('[KEYO-01] rSb() não encontrado — tentando novamente em 500ms.');
    setTimeout(_injetarMenu, 500);
    return;
  }

  // Já foi patchado?
  if (window.__KEYO_RSB_PATCHED__) return;
  window.__KEYO_RSB_PATCHED__ = true;

  const _rSbOrig = window.rSb;
  window.rSb = function() {
    _rSbOrig.apply(this, arguments);   // executa o rSb original primeiro
    _injetarItemDOM();                  // depois injeta o item KEYO
  };

  // Executa uma vez já para aparecer imediatamente
  _injetarItemDOM();
  console.info('[KEYO-01] ✅ rSb() interceptado — item KEYO será injetado após cada redesenho.');
}

function _injetarItemDOM() {
  const nav = document.getElementById('sbNav');
  if (!nav) return;

  // Atualiza active se já existe
  const existing = document.getElementById('keyo-sb-item');
  if (existing) {
    existing.className = 'sb-item' + (window.PA === 'keyo' ? ' active' : '');
    return;
  }

  // Seção
  const secao = document.createElement('div');
  secao.className = 'sb-section';
  secao.textContent = 'Inteligência';

  // Item
  const item = document.createElement('div');
  item.id = 'keyo-sb-item';
  item.className = 'sb-item' + (window.PA === 'keyo' ? ' active' : '');
  item.innerHTML = '🧠<span>KEYO · IA</span>';
  item.onclick = function() {
    if (typeof window.goTo === 'function') window.goTo('keyo');
  };

  nav.appendChild(secao);
  nav.appendChild(item);
}

// ════════════════════════════════════════════════════════════════
// ETAPA 1.2 — PATCH SEGURO DO goTo()
// PA é let local do ERP — não acessível via window.PA.
// Solução: interceptar goTo('keyo') antes do ERP processar.
// ════════════════════════════════════════════════════════════════
(function _patchGoTo() {
  if (!window.goTo) return;
  const _orig = window.goTo;
  window.goTo = function(pg) {
    if (pg === 'keyo') {
      // Atualiza estado visual do sidebar
      document.querySelectorAll('#sbNav .sb-item').forEach(el => el.classList.remove('active'));
      const keyoItem = document.getElementById('keyo-sb-item');
      if (keyoItem) keyoItem.classList.add('active');
      // Renderiza tela do KEYO
      const e = document.getElementById('pc');
      if (e) {
        e.innerHTML = _keyoHTML();
        _keyoInit();
      }
      return;
    }
    return _orig.apply(this, arguments);
  };
  console.info('[KEYO-01] ✅ goTo() interceptado com segurança.');
})();

// ════════════════════════════════════════════════════════════════
// CSS EXTRA — aba Campanhas no painel lateral
// ════════════════════════════════════════════════════════════════
(function _injetarCSSAbas() {
  if (document.getElementById('keyo-ui-abas-css')) return;
  const s = document.createElement('style');
  s.id = 'keyo-ui-abas-css';
  s.textContent = `
/* ── Separador e aba Campanhas ── */
#keyo-agents-sep{height:1px;background:rgba(255,255,255,0.08);margin:8px 12px}
#keyo-agents-modulos{padding:0 0 8px}
#keyo-agents-modulos-title{padding:8px 16px 4px;font-size:9px;font-weight:700;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px}
.keyo-mod-btn{display:flex;align-items:center;gap:9px;padding:10px 16px;cursor:pointer;border:none;background:none;width:100%;text-align:left;color:rgba(255,255,255,0.5);font-size:12px;font-family:inherit;border-left:3px solid transparent;transition:all .15s}
.keyo-mod-btn:hover{background:rgba(255,255,255,0.07);color:#f0f0f8}
.keyo-mod-btn.active{background:rgba(201,168,76,.12);color:#C9A84C;font-weight:700;border-left-color:#C9A84C}
.keyo-mod-emoji{font-size:16px;width:20px;text-align:center;flex-shrink:0}
`;
  document.head.appendChild(s);
})();

// ════════════════════════════════════════════════════════════════
// HTML DA TELA KEYO — com aba Campanhas abaixo dos agentes
// ════════════════════════════════════════════════════════════════
function _keyoHTML() {
  const ag = window.KEYO_AGENTS[0];
  return `
<div id="keyo-wrap">
  <div id="keyo-agents">
    <div id="keyo-agents-title">Agentes</div>
    ${window.KEYO_AGENTS.map(a => `
    <button class="keyo-agent-btn${a.id === 'keyo' ? ' active' : ''}"
            data-agent="${a.id}"
            onclick="window.keyo_trocarAgente('${a.id}')">
      <span class="keyo-agent-emoji">${a.emoji}</span>
      <span class="keyo-agent-info">
        <span class="keyo-agent-nome">${a.nome}</span>
        <span class="keyo-agent-desc">${a.desc}</span>
      </span>
    </button>`).join('')}

    <div id="keyo-agents-sep"></div>
    <div id="keyo-agents-modulos">
      <div id="keyo-agents-modulos-title">Módulos</div>
      <button class="keyo-mod-btn" id="keyo-mod-campanhas"
              onclick="window.keyo_abrirModulo('campanhas')">
        <span class="keyo-mod-emoji">📅</span>
        <span>Campanhas</span>
      </button>
      <button class="keyo-mod-btn" id="keyo-mod-precos"
              onclick="window.keyo_abrirModulo('precos')">
        <span class="keyo-mod-emoji">💰</span>
        <span>Precificação</span>
      </button>
      <button class="keyo-mod-btn" id="keyo-mod-churn"
              onclick="window.keyo_abrirModulo('churn')">
        <span class="keyo-mod-emoji">📉</span>
        <span>Churn</span>
      </button>
      <button class="keyo-mod-btn" id="keyo-mod-propostas"
              onclick="window.keyo_abrirModulo('propostas')">
        <span class="keyo-mod-emoji">📋</span>
        <span>Propostas</span>
      </button>
      <button class="keyo-mod-btn" id="keyo-mod-kpis"
              onclick="window.keyo_abrirModulo('kpis')">
        <span class="keyo-mod-emoji">📊</span>
        <span>KPIs</span>
      </button>
    </div>
  </div>

  <div id="keyo-main">
    <div id="keyo-header">
      <span id="keyo-header-emoji">${ag.emoji}</span>
      <div>
        <div id="keyo-header-nome">${ag.nome}</div>
        <div id="keyo-header-desc">${ag.desc}</div>
      </div>
    </div>
    <div id="keyo-msgs"></div>
    <div id="keyo-input-area">
      <div id="keyo-actions">
        <button class="keyo-action-btn" onclick="window.keyo_limparChat()">🗑 Limpar</button>
      </div>
      <div id="keyo-input-row">
        <textarea id="keyo-input"
                  placeholder="Digite sua mensagem..."
                  rows="1"
                  onkeydown="window.keyo_onKeyDown(event)"
                  oninput="window.keyo_resize(this)"></textarea>
        <button id="keyo-send" onclick="window.keyo_enviar()">➤</button>
      </div>
      <div id="keyo-input-hint">Enter para enviar · Shift+Enter para nova linha</div>
    </div>
  </div>
</div>`;
}

// ════════════════════════════════════════════════════════════════
// ABRIR MÓDULO (Campanhas ou voltar ao chat)
// ════════════════════════════════════════════════════════════════
function _abrirModulo(modulo) {
  _kAba = modulo;

  // Desmarca agentes, marca módulo
  document.querySelectorAll('.keyo-agent-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.keyo-mod-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('keyo-mod-' + modulo);
  if (btn) btn.classList.add('active');

  if (modulo === 'campanhas') {
    // Atualiza header
    const emoji = document.getElementById('keyo-header-emoji');
    const nome  = document.getElementById('keyo-header-nome');
    const desc  = document.getElementById('keyo-header-desc');
    if (emoji) emoji.textContent = '📅';
    if (nome)  nome.textContent  = 'Campanhas';
    if (desc)  desc.textContent  = 'Agendador de campanhas de marketing';

    // Esconde input do chat, mostra área do M12
    const inputArea = document.getElementById('keyo-input-area');
    const msgs      = document.getElementById('keyo-msgs');
    if (inputArea) inputArea.style.display = 'none';
    if (msgs)      msgs.style.display      = 'none';

    // Renderiza M12 se disponível
    if (typeof window._k12RenderAgendadorInline === 'function') {
      window._k12RenderAgendadorInline();
    } else if (typeof window.__KEYO_M12_LOADED__ !== 'undefined') {      // M12 carregado mas sem função inline — fallback
      const main = document.getElementById('keyo-msgs');
      if (main) {
        main.style.display = 'block';
        main.innerHTML = '<div style="padding:40px;text-align:center;color:#888">Módulo M12 não inicializado. Recarregue a página.</div>';
      }
    } else {
      const main = document.getElementById('keyo-msgs');
      if (main) {
        main.style.display = 'block';
        main.innerHTML = '<div style="padding:40px;text-align:center;color:#888">Módulo de campanhas não encontrado.</div>';
      }
    }
  }

  if (modulo === 'precos') {
    const emoji = document.getElementById('keyo-header-emoji');
    const nome  = document.getElementById('keyo-header-nome');
    const desc  = document.getElementById('keyo-header-desc');
    if (emoji) emoji.textContent = '💰';
    if (nome)  nome.textContent  = 'Precificação';
    if (desc)  desc.textContent  = 'Calculadora de preços para grupos';

    const inputArea = document.getElementById('keyo-input-area');
    const msgs      = document.getElementById('keyo-msgs');
    if (inputArea) inputArea.style.display = 'none';
    if (msgs)      msgs.style.display      = 'none';

    if (typeof window._m16RenderInline === 'function') {
      window._m16RenderInline();
    } else {
      const main = document.getElementById('keyo-msgs');
      if (main) {
        main.style.display = 'block';
        main.innerHTML = '<div style="padding:40px;text-align:center;color:#888">Módulo de precificação não encontrado.</div>';
      }
    }
  }

  if (modulo === 'churn') {
    const emoji = document.getElementById('keyo-header-emoji');
    const nome  = document.getElementById('keyo-header-nome');
    const desc  = document.getElementById('keyo-header-desc');
    if (emoji) emoji.textContent = '📉';
    if (nome)  nome.textContent  = 'Churn';
    if (desc)  desc.textContent  = 'Análise de retenção de clientes';
    const inputArea = document.getElementById('keyo-input-area');
    const msgs      = document.getElementById('keyo-msgs');
    if (inputArea) inputArea.style.display = 'none';
    if (msgs)      msgs.style.display      = 'none';
    if (typeof window._m13RenderInline === 'function') {
      window._m13RenderInline();
    } else {
      if (msgs) { msgs.style.display = 'block'; msgs.innerHTML = '<div style="padding:40px;text-align:center;color:#888">Módulo M13 não encontrado.</div>'; }
    }
  }

  if (modulo === 'propostas') {
    const emoji = document.getElementById('keyo-header-emoji');
    const nome  = document.getElementById('keyo-header-nome');
    const desc  = document.getElementById('keyo-header-desc');
    if (emoji) emoji.textContent = '📋';
    if (nome)  nome.textContent  = 'Propostas';
    if (desc)  desc.textContent  = 'Gestão de propostas comerciais';
    const inputArea = document.getElementById('keyo-input-area');
    const msgs      = document.getElementById('keyo-msgs');
    if (inputArea) inputArea.style.display = 'none';
    if (msgs)      msgs.style.display      = 'none';
    if (typeof window._m14RenderInline === 'function') {
      window._m14RenderInline();
    } else {
      if (msgs) { msgs.style.display = 'block'; msgs.innerHTML = '<div style="padding:40px;text-align:center;color:#888">Módulo M14 não encontrado.</div>'; }
    }
  }

  if (modulo === 'kpis') {
    const emoji = document.getElementById('keyo-header-emoji');
    const nome  = document.getElementById('keyo-header-nome');
    const desc  = document.getElementById('keyo-header-desc');
    if (emoji) emoji.textContent = '📊';
    if (nome)  nome.textContent  = 'KPIs';
    if (desc)  desc.textContent  = 'Indicadores de desempenho';
    const inputArea = document.getElementById('keyo-input-area');
    const msgs      = document.getElementById('keyo-msgs');
    if (inputArea) inputArea.style.display = 'none';
    if (msgs)      msgs.style.display      = 'none';
    if (typeof window._m15RenderInline === 'function') {
      window._m15RenderInline();
    } else {
      if (msgs) { msgs.style.display = 'block'; msgs.innerHTML = '<div style="padding:40px;text-align:center;color:#888">Módulo M15 não encontrado.</div>'; }
    }
  }
}

// ════════════════════════════════════════════════════════════════
// INIT — chamado após renderizar a tela
// ════════════════════════════════════════════════════════════════
function _keyoInit() {
  _kAgente  = 'keyo';
  _kAba     = 'chat';
  _kLoading = false;
  window.KEYO_AGENTS.forEach(a => { if (!_kHistory[a.id]) _kHistory[a.id] = []; });
  _renderHistory();
  if (_kHistory['keyo'].length === 0) {
    _appendMsg('bot', window.KEYO_WELCOME['keyo']);
  }
  setTimeout(function() {
    const inp = document.getElementById('keyo-input');
    if (inp) inp.focus();
  }, 100);
}

// ════════════════════════════════════════════════════════════════
// TROCAR AGENTE — volta ao chat se estava em módulo
// ════════════════════════════════════════════════════════════════
function _trocarAgente(id) {
  const ag = window.KEYO_AGENTS.find(a => a.id === id);
  if (!ag) return;

  // Se estava em módulo, restaura área de chat
  if (_kAba !== 'chat') {
    _kAba = 'chat';
    const inputArea = document.getElementById('keyo-input-area');
    const msgs      = document.getElementById('keyo-msgs');
    const m12area   = document.getElementById('keyo-m12-inline');
    if (inputArea) inputArea.style.display = '';
    if (msgs)      msgs.style.display      = '';
    if (m12area)   m12area.remove();
  }

  _kAgente = id;

  document.querySelectorAll('.keyo-agent-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.agent === id);
  });
  document.querySelectorAll('.keyo-mod-btn').forEach(b => b.classList.remove('active'));

  const emoji = document.getElementById('keyo-header-emoji');
  const nome  = document.getElementById('keyo-header-nome');
  const desc  = document.getElementById('keyo-header-desc');
  if (emoji) emoji.textContent = ag.emoji;
  if (nome)  nome.textContent  = ag.nome;
  if (desc)  desc.textContent  = ag.desc;

  _renderHistory();
  if (_kHistory[id].length === 0) {
    _appendMsg('bot', window.KEYO_WELCOME[id] || `Olá! Sou o agente **${ag.nome}**.`);
  }

  const inp = document.getElementById('keyo-input');
  if (inp) inp.focus();
}

// ════════════════════════════════════════════════════════════════
// RENDERIZAR HISTÓRICO
// ════════════════════════════════════════════════════════════════
function _renderHistory() {
  const msgs = document.getElementById('keyo-msgs');
  if (!msgs) return;
  msgs.innerHTML = '';
  (_kHistory[_kAgente] || []).forEach(function(m) {
    _appendMsgDOM(msgs, m.role, m.texto, m.ts);
  });
  _scrollBottom();
}

// ════════════════════════════════════════════════════════════════
// ADICIONAR MENSAGEM NA UI + HISTÓRICO
// ════════════════════════════════════════════════════════════════
function _appendMsg(role, texto) {
  const ts = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (!_kHistory[_kAgente]) _kHistory[_kAgente] = [];
  _kHistory[_kAgente].push({ role: role, texto: texto, ts: ts });
  const msgs = document.getElementById('keyo-msgs');
  if (msgs) _appendMsgDOM(msgs, role, texto, ts);
  _scrollBottom();
}

function _appendMsgDOM(container, role, texto, ts) {
  const div = document.createElement('div');
  div.className = 'keyo-msg ' + role;
  div.innerHTML =
    '<div class="keyo-bubble">' + _formato(texto) + '</div>' +
    '<div class="keyo-ts">' + ts + '</div>';
  container.appendChild(div);
}

// ════════════════════════════════════════════════════════════════
// MARKDOWN → HTML
// ════════════════════════════════════════════════════════════════
function _formato(txt) {
  return txt
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/`(.+?)`/g,       '<code>$1</code>')
    .replace(/\n/g,            '<br>');
}

// ════════════════════════════════════════════════════════════════
// LOADING DOTS
// ════════════════════════════════════════════════════════════════
function _showLoading() {
  const msgs = document.getElementById('keyo-msgs');
  if (!msgs) return;
  const div = document.createElement('div');
  div.className = 'keyo-msg bot';
  div.id = 'keyo-loading-msg';
  div.innerHTML = '<div class="keyo-loading">' +
    '<div class="keyo-dot"></div>' +
    '<div class="keyo-dot"></div>' +
    '<div class="keyo-dot"></div>' +
    '</div>';
  msgs.appendChild(div);
  _scrollBottom();
}

function _hideLoading() {
  const el = document.getElementById('keyo-loading-msg');
  if (el) el.remove();
}

// ════════════════════════════════════════════════════════════════
// ETAPA 1.4 — ENVIO PARA EDGE FUNCTION
// ════════════════════════════════════════════════════════════════
async function _enviar() {
  if (_kLoading) return;

  const input = document.getElementById('keyo-input');
  const send  = document.getElementById('keyo-send');
  if (!input) return;

  const texto = input.value.trim();
  if (!texto) return;

  input.value = '';
  input.style.height = 'auto';
  if (send) send.disabled = true;
  _kLoading = true;

  _appendMsg('user', texto);
  _showLoading();

  const hist = (_kHistory[_kAgente] || [])
    .filter(function(m) { return m.role !== 'user' || m.texto !== texto; })
    .slice(-20)
    .map(function(m) { return { role: m.role === 'user' ? 'user' : 'assistant', content: m.texto }; });

  const unidadeId = (window.UA && window.UA.unidade) ? window.UA.unidade : 1;

  try {
    const resp = await fetch(window.KEYO_EDGE_URL, {
      method:  'POST',
      headers: (function() {
        let jwt = '';
        try {
          const erpSession = JSON.parse(localStorage.getItem('exit_unidade_session') || '{}');
          jwt = erpSession?.access_token || '';
          if (!jwt && window._keyoToken) jwt = window._keyoToken;
          if (!jwt) jwt = window.SUPA_KEY || window.KEYO_ANON_KEY || '';
        } catch(e) {
          jwt = window.SUPA_KEY || window.KEYO_ANON_KEY || '';
        }
        return {
          'Content-Type':  'application/json',
          'Authorization': 'Bearer ' + jwt,
          'apikey':         window.KEYO_ANON_KEY || '',
        };
      })(),
      body: JSON.stringify({
        agente:      _kAgente,
        mensagem:    texto,
        historico:   hist,
        unidade_id:  unidadeId,
      })
    });

    if (!resp.ok) throw new Error('HTTP ' + resp.status);

    const data = await resp.json();
    _hideLoading();

    const resposta = data.resposta
                  || data.reply
                  || data.message
                  || data.text
                  || '⚠️ Resposta vazia do servidor.';

    _appendMsg('bot', resposta);

  } catch (err) {
    _hideLoading();
    _appendMsg('bot', '⚠️ Erro ao conectar com o servidor. Verifique sua conexão e tente novamente.');
    console.error('[KEYO-01] Erro na chamada à Edge Function:', err);
  }

  _kLoading = false;
  if (send) send.disabled = false;
  const inp = document.getElementById('keyo-input');
  if (inp) inp.focus();
}

// ════════════════════════════════════════════════════════════════
// LIMPAR CHAT
// ════════════════════════════════════════════════════════════════
function _limparChat() {
  if (!confirm('Limpar o histórico deste agente?')) return;
  _kHistory[_kAgente] = [];
  const msgs = document.getElementById('keyo-msgs');
  if (msgs) msgs.innerHTML = '';
  _appendMsg('bot', window.KEYO_WELCOME[_kAgente] || 'Como posso ajudar?');
}

// ════════════════════════════════════════════════════════════════
// UTILITÁRIOS
// ════════════════════════════════════════════════════════════════
function _onKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    window.keyo_enviar();
  }
}

function _resize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function _scrollBottom() {
  const msgs = document.getElementById('keyo-msgs');
  if (msgs) msgs.scrollTop = msgs.scrollHeight;
}

// ════════════════════════════════════════════════════════════════
// RENDERIZAR TELA (chamado pelo item do menu DOM fallback)
// ════════════════════════════════════════════════════════════════
function _renderTela() {
  document.querySelectorAll('#sbNav .sb-item').forEach(el => el.classList.remove('active'));
  const menuItem = document.getElementById('keyo-menu-item');
  if (menuItem) menuItem.classList.add('active');

  const main = document.getElementById('pc')
             || document.getElementById('main-content')
             || document.getElementById('content')
             || document.querySelector('.main-content')
             || document.querySelector('main');

  if (!main) {
    console.error('[KEYO-01] Área de conteúdo (#pc) não encontrada.');
    return;
  }

  main.innerHTML = _keyoHTML();
  _keyoInit();
}

// ════════════════════════════════════════════════════════════════
// VERIFICAÇÃO DE INTEGRIDADE
// rSb e goTo são patchados intencionalmente pelo KEYO — não alertar.
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
// EXPÕE GLOBALMENTE
// ════════════════════════════════════════════════════════════════
window.keyo_renderTela   = _renderTela;
window.keyo_trocarAgente = _trocarAgente;
window.keyo_enviar       = _enviar;
window.keyo_onKeyDown    = _onKeyDown;
window.keyo_resize       = _resize;
window.keyo_limparChat   = _limparChat;
window.keyo_addMsg       = _appendMsg;
window.keyo_abrirModulo  = _abrirModulo;

// ════════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════════
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _injetarMenu);
} else {
  _injetarMenu();
}

console.info('[KEYO-01] ✅ UI v1.8 carregada — módulos Campanhas, Precificação, Churn, Propostas e KPIs.');

})();

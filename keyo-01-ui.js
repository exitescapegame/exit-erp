// ═══════════════════════════════════════════════════════════════
// EXIT GAMES — KEYO UI v1.4
// Arquivo: keyo-01-ui.js
// Depende de: keyo-00-core.js (deve ser carregado antes)
// Cobre: Etapas 1.2 + 1.3 + 1.4 do Plano Mestre v2.0
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

// Inicializa histórico para todos os agentes
window.KEYO_AGENTS.forEach(a => { _kHistory[a.id] = []; });

// ════════════════════════════════════════════════════════════════
// ETAPA 1.3 — INJETAR NO MENU VIA MENUS[] + rSb()
// Estratégia do plano mestre: push no array MENUS, nunca reescrever rSb()
// ════════════════════════════════════════════════════════════════
function _injetarMenu() {
  // Estratégia primária: MENUS.push + rSb() (método do plano mestre)
  if (window.MENUS && Array.isArray(window.MENUS)) {
    if (!window.MENUS.find(m => m.id === 'keyo')) {
      window.MENUS.push({ id: 'keyo', lbl: 'KEYO · IA', ic: '🧠', perm: 'tudo' });
      if (typeof window.rSb === 'function') window.rSb();
      console.info('[KEYO-01] ✅ Item KEYO adicionado via MENUS.push + rSb().');
    }
    return;
  }

  // Estratégia fallback: injeção direta no DOM com MutationObserver
  console.warn('[KEYO-01] MENUS não disponível — usando fallback DOM.');
  _injetarMenuDOM();
}

function _injetarMenuDOM() {
  function _fazerInjecao() {
    const sbNav = document.getElementById('sbNav');
    if (!sbNav) return false;
    if (document.getElementById('keyo-menu-item')) return true;

    const secao = document.createElement('div');
    secao.className = 'sb-section';
    secao.textContent = 'Inteligência';

    const item = document.createElement('div');
    item.id = 'keyo-menu-item';
    item.className = 'sb-item';
    item.innerHTML = '🧠 <span>KEYO · IA</span>';
    item.style.cssText = 'cursor:pointer';
    item.onclick = function() { window.keyo_renderTela(); };

    const itens = sbNav.querySelectorAll('.sb-item');
    const ultimo = itens[itens.length - 1];
    if (ultimo) {
      sbNav.insertBefore(item, ultimo);
      sbNav.insertBefore(secao, item);
    } else {
      sbNav.appendChild(secao);
      sbNav.appendChild(item);
    }
    console.info('[KEYO-01] ✅ Item KEYO injetado no DOM (fallback).');
    return true;
  }

  _fazerInjecao();

  // MutationObserver: reinjecta se o ERP recriar o sbNav
  const obs = new MutationObserver(function() {
    if (!document.getElementById('keyo-menu-item')) _fazerInjecao();
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

// ════════════════════════════════════════════════════════════════
// ETAPA 1.2 — MONKEY-PATCH SEGURO DO renderPage()
// Intercepta PA === 'keyo', delega tudo mais ao original
// ════════════════════════════════════════════════════════════════
(function _patchRenderPage() {
  if (!window.renderPage) return;
  const _orig = window.renderPage;
  window.renderPage = function() {
    if (window.PA === 'keyo') {
      const e = document.getElementById('pc');
      if (e) {
        e.innerHTML = _keyoHTML();
        _keyoInit();
      }
      return;
    }
    return _orig.apply(this, arguments);
  };
  console.info('[KEYO-01] ✅ renderPage() interceptado com segurança.');
})();

// ════════════════════════════════════════════════════════════════
// HTML DA TELA KEYO
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
// INIT — chamado após renderizar a tela
// ════════════════════════════════════════════════════════════════
function _keyoInit() {
  _kAgente  = 'keyo';
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
// TROCAR AGENTE
// ════════════════════════════════════════════════════════════════
function _trocarAgente(id) {
  const ag = window.KEYO_AGENTS.find(a => a.id === id);
  if (!ag) return;

  _kAgente = id;

  document.querySelectorAll('.keyo-agent-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.agent === id);
  });

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
// RENDERIZAR HISTÓRICO DO AGENTE ATIVO
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
// MARKDOWN → HTML (simples e seguro)
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
// ETAPA 1.4 — _keyoSend(): ENVIO PARA EDGE FUNCTION
// Payload exato do plano mestre:
// { agente, mensagem, historico, unidade_id }
// Resposta esperada: { resposta: "..." }
// ════════════════════════════════════════════════════════════════
async function _enviar() {
  if (_kLoading) return;

  const input = document.getElementById('keyo-input');
  const send  = document.getElementById('keyo-send');
  if (!input) return;

  const texto = input.value.trim();
  if (!texto) return;

  // Limpa input
  input.value = '';
  input.style.height = 'auto';
  if (send) send.disabled = true;
  _kLoading = true;

  // Exibe mensagem do usuário
  _appendMsg('user', texto);
  _showLoading();

  // Monta histórico resumido para contexto (últimas 10 trocas)
  const hist = (_kHistory[_kAgente] || [])
    .filter(function(m) { return m.role !== 'user' || m.texto !== texto; })
    .slice(-20)
    .map(function(m) { return { role: m.role === 'user' ? 'user' : 'assistant', content: m.texto }; });

  // Detecta unidade ativa do ERP (se disponível)
  const unidadeId = (window.UA && window.UA.unidade) ? window.UA.unidade : 1;

  try {
    const resp = await fetch(window.KEYO_EDGE_URL, {
      method:  'POST',
      headers: (function() {
        // Tenta pegar JWT da sessão ativa do ERP (várias fontes)
        let jwt = '';
        try {
          // Fonte 1: sessão Supabase no localStorage
          const sbKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
          if (sbKey) {
            const session = JSON.parse(localStorage.getItem(sbKey) || '{}');
            jwt = session?.access_token || session?.data?.session?.access_token || '';
          }
          // Fonte 2: window._keyoToken (injetado pelo ERP)
          if (!jwt && window._keyoToken) jwt = window._keyoToken;
          // Fonte 3: anon key como fallback
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

    if (!resp.ok) {
      throw new Error('HTTP ' + resp.status);
    }

    const data = await resp.json();
    _hideLoading();

    // Aceita qualquer campo de resposta que a Edge Function retornar
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
// LIMPAR CHAT (com confirmação)
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
  // Marca item ativo
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
// VERIFICAÇÃO DE INTEGRIDADE PÓS-CARGA
// Garante que não sobrescrevemos nada do ERP
// ════════════════════════════════════════════════════════════════
window.addEventListener('load', function() {
  if (window.rSb      && window.rSb      !== _ERP_ORIG_RSB)    console.error('[KEYO-01] ⚠️ rSb() foi sobrescrito!');
  if (window.goTo     && window.goTo     !== _ERP_ORIG_GOTO)   console.error('[KEYO-01] ⚠️ goTo() foi sobrescrito!');
}, { once: true });

// ════════════════════════════════════════════════════════════════
// EXPÕE GLOBALMENTE (chamadas inline no HTML)
// ════════════════════════════════════════════════════════════════
window.keyo_renderTela   = _renderTela;
window.keyo_trocarAgente = _trocarAgente;
window.keyo_enviar       = _enviar;
window.keyo_onKeyDown    = _onKeyDown;
window.keyo_resize       = _resize;
window.keyo_limparChat   = _limparChat;
window.keyo_addMsg       = _appendMsg;   // compatibilidade keyo-00-core

// ════════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════════
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _injetarMenu);
} else {
  _injetarMenu();
}

console.info('[KEYO-01] ✅ UI v1.4 carregada — JWT da sessão ativo.');

})();

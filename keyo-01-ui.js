// ═══════════════════════════════════════════════════════════════
// EXIT GAMES — KEYO UI v2.8
// Arquivo: keyo-01-ui.js
// Depende de: keyo-00-core.js (deve ser carregado antes)
// Cobre: Etapas 1.2 + 1.3 + 1.4 do Plano Mestre v2.0
// v2.0: FIX — keyo-mpros-inline adicionado na lista de limpeza de _trocarAgente() e _abrirModulo(); remove módulos inline SEMPRE (não só
//        quando _kAba !== 'chat'). Remove m12 a m16 e chama _k15Stop().
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
  const _orig     = window.goTo;
  const _rpOrig   = window.renderPage;

  // ── Patch de renderPage ──────────────────────────────────────
  // O goTo('keyo') não seta PA='keyo' (PA é local do ERP).
  // Qualquer chamada a renderPage() — opFinalizar, sDB callbacks,
  // timers, botões do ERP — substituía o #pc derrubando a tela KEYO.
  // Solução: interceptar renderPage() e bloquear enquanto #keyo-wrap
  // estiver visível. Ao navegar para fora do KEYO, restaura o original.
  function _patchRenderPage() {
    if (window.__KEYO_RP_PATCHED__) return;
    if (typeof _rpOrig !== 'function') return;
    window.__KEYO_RP_PATCHED__ = true;
    window.renderPage = function() {
      if (document.getElementById('keyo-wrap')) {
        console.info('[KEYO-01] renderPage() bloqueado — tela KEYO ativa.');
        return;
      }
      // Saiu do KEYO — remove o patch e executa normalmente
      window.__KEYO_RP_PATCHED__ = false;
      window.renderPage = _rpOrig;
      return _rpOrig.apply(this, arguments);
    };
    console.info('[KEYO-01] ✅ renderPage() patchado — tela KEYO protegida contra PDV.');
  }

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
      // Protege renderPage IMEDIATAMENTE após renderizar o KEYO
      _patchRenderPage();
      return;
    }
    // Saindo do KEYO: remove patch do renderPage
    window.__KEYO_RP_PATCHED__ = false;
    window.renderPage = _rpOrig;
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
/* ── Agentes recolhível ── */
#keyo-agents-title{display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none}
#keyo-agents-title:hover{color:rgba(255,255,255,0.7)}
#keyo-agents-chevron{font-size:11px;transition:transform .2s;opacity:.6}
#keyo-agents.recolhido #keyo-agents-chevron{transform:rotate(-90deg)}
#keyo-agents-list{overflow:hidden;transition:max-height .25s ease;max-height:1000px}
#keyo-agents.recolhido #keyo-agents-list{max-height:0}
/* ── Separador e aba Campanhas ── */
#keyo-agents-sep{height:1px;background:rgba(255,255,255,0.08);margin:8px 12px}
#keyo-agents-modulos{padding:0 0 8px}
#keyo-agents-modulos-title{padding:8px 16px 4px;font-size:9px;font-weight:700;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px}
.keyo-mod-btn{display:flex;align-items:center;gap:9px;padding:10px 16px;cursor:pointer;border:none;background:none;width:100%;text-align:left;color:rgba(255,255,255,0.5);font-size:12px;font-family:inherit;border-left:3px solid transparent;transition:all .15s}
.keyo-mod-btn:hover{background:rgba(255,255,255,0.07);color:#f0f0f8}
.keyo-mod-btn.active{background:rgba(201,168,76,.12);color:#C9A84C;font-weight:700;border-left-color:#C9A84C}
.keyo-mod-emoji{font-size:16px;width:20px;text-align:center;flex-shrink:0}
/* ── Setas fixas de rolagem (painel de agentes/módulos cortado em telas menores) ── */
.keyo-scroll-btn{position:sticky;left:0;width:100%;height:24px;border:none;background:#13131f;color:#C9A84C;font-size:10px;cursor:pointer;display:none;align-items:center;justify-content:center;z-index:5;flex-shrink:0}
.keyo-scroll-btn:hover{background:#1c1c2c;color:#fff}
.keyo-scroll-up{top:0;box-shadow:0 4px 6px -4px rgba(0,0,0,.5)}
.keyo-scroll-down{bottom:0;box-shadow:0 -4px 6px -4px rgba(0,0,0,.5)}
/* Scrollbar fina e visível (antes era invisível em vários dispositivos) */
#keyo-agents{scrollbar-width:thin;scrollbar-color:rgba(201,168,76,.5) transparent}
#keyo-agents::-webkit-scrollbar{width:10px}
#keyo-agents::-webkit-scrollbar-track{background:rgba(255,255,255,0.04)}
#keyo-agents::-webkit-scrollbar-thumb{background:rgba(201,168,76,.5);border-radius:5px}
#keyo-agents::-webkit-scrollbar-thumb:hover{background:rgba(201,168,76,.85)}
#keyo-agents::-webkit-scrollbar{width:6px}
#keyo-agents::-webkit-scrollbar-thumb{background:rgba(201,168,76,.4);border-radius:3px}
#keyo-agents::-webkit-scrollbar-track{background:transparent}
/* ── [FIX v2.7] ROLAGEM REAL DO PAINEL DE AGENTES ──────────────────────────
   Sintoma: só ~4,5 agentes aparecem (KEYO..Financeiro), Jurídico/RH somem e
   MÓDULOS aparece logo abaixo, sem barra de rolagem.
   Causa-raiz: dentro de #keyo-agents (flex column de altura fixa), os filhos
   #keyo-agents-list e #keyo-agents-modulos têm flex-shrink:1 (padrão). Quando
   falta altura, o flexbox os ENCOLHE; como #keyo-agents-list tem overflow:hidden,
   ele CORTA os agentes em vez de o painel rolar.
   Correção: min-height:0 no painel (permite rolar) + flex-shrink:0 nos filhos
   (eles mantêm a altura natural e forçam o painel #keyo-agents a rolar via
   overflow-y:auto, que já existe).
   100% ADITIVO e REVERSÍVEL: apague este bloco para voltar ao estado anterior. */
#keyo-wrap{min-height:0}
#keyo-agents{min-height:0}
#keyo-agents-list{flex-shrink:0}
#keyo-agents-modulos{flex-shrink:0}
/* barra de rolagem BEM visível (dourada), pra deixar claro que o painel rola */
#keyo-agents{scrollbar-width:auto;scrollbar-color:#C9A84C rgba(255,255,255,0.10)}
#keyo-agents::-webkit-scrollbar{width:10px}
#keyo-agents::-webkit-scrollbar-thumb{background:#C9A84C;border-radius:5px;border:2px solid #0f0f1a}
#keyo-agents::-webkit-scrollbar-track{background:rgba(255,255,255,0.08)}
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
    <div id="keyo-agents-title" onclick="window.keyo_toggleAgentes()" title="Mostrar/ocultar agentes">
      <span>Agentes</span>
      <span id="keyo-agents-chevron">▾</span>
    </div>
    <div id="keyo-agents-list">
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

  // Remove TODOS os painéis inline antes de abrir o novo
  // Fecha Cientista via flag explícita (evita sobreposição pelo MutationObserver)
  if (typeof window.mpros_fechar === 'function') window.mpros_fechar();
  ['keyo-m12-inline','keyo-m13-inline','keyo-m14-inline',
   'keyo-m15-inline','keyo-m16-inline','keyo-mpros-inline'].forEach(function(mid) {
    const el = document.getElementById(mid);
    if (el) el.remove();
  });
  // Restaura msgs/inputArea caso o Cientista os tenha escondido
  const _msgs = document.getElementById('keyo-msgs');
  const _ia   = document.getElementById('keyo-input-area');
  if (_msgs) _msgs.style.cssText = '';
  if (_ia)   _ia.style.cssText   = '';
  if (typeof window._k15Stop === 'function') window._k15Stop();

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

  if (modulo === 'autorizacoes') {
    const emoji = document.getElementById('keyo-header-emoji');
    const nome  = document.getElementById('keyo-header-nome');
    const desc  = document.getElementById('keyo-header-desc');
    if (emoji) emoji.textContent = '🔔';
    if (nome)  nome.textContent  = 'Autorizações';
    if (desc)  desc.textContent  = 'Iniciativas do KEYO aguardando sua decisão';
    const inputArea = document.getElementById('keyo-input-area');
    const msgs      = document.getElementById('keyo-msgs');
    if (inputArea) inputArea.style.display = 'none';
    if (msgs)      msgs.style.display      = 'none';
    if (typeof window._kAuthRenderInline === 'function') {
      window._kAuthRenderInline();
    } else {
      if (msgs) { msgs.style.display = 'block'; msgs.innerHTML = '<div style="padding:40px;text-align:center;color:#888">Módulo de Autorizações não encontrado.</div>'; }
    }
  }

  if (modulo === 'brain') {
    const emoji = document.getElementById('keyo-header-emoji');
    const nome  = document.getElementById('keyo-header-nome');
    const desc  = document.getElementById('keyo-header-desc');
    if (emoji) emoji.textContent = '🧠';
    if (nome)  nome.textContent  = 'Brain Loop';
    if (desc)  desc.textContent  = 'Monitoramento autônomo e iniciativas proativas';
    const inputArea = document.getElementById('keyo-input-area');
    const msgs      = document.getElementById('keyo-msgs');
    if (inputArea) inputArea.style.display = 'none';
    if (msgs)      msgs.style.display      = 'block';
    if (msgs) {
      const status = (typeof window.keyoBrain_status === 'function')
        ? window.keyoBrain_status()
        : null;
      if (status) {
        const cor = status.ativo ? '#1E8449' : '#C0392B';
        const icone = status.ativo ? '🟢' : '🔴';
        msgs.innerHTML = `
<div style="padding:24px;max-width:600px;margin:0 auto;font:13px/1.6 system-ui,sans-serif">
  <div style="background:#fff;border:1px solid #e3e3e3;border-radius:10px;padding:20px;margin-bottom:12px">
    <div style="font-size:15px;font-weight:700;margin-bottom:12px;color:#1a1a2e">Status do Brain Loop</div>
    <div style="display:flex;gap:24px;flex-wrap:wrap">
      <div><span style="color:#888;font-size:11px;text-transform:uppercase">Status</span><br><span style="font-weight:700;color:${cor}">${icone} ${status.ativo ? 'Ativo' : 'Pausado'}</span></div>
      <div><span style="color:#888;font-size:11px;text-transform:uppercase">Rodadas</span><br><span style="font-weight:700">${status.rodadas}</span></div>
      <div><span style="color:#888;font-size:11px;text-transform:uppercase">Pendentes</span><br><span style="font-weight:700;color:${status.pendentes > 0 ? '#C0392B' : '#1E8449'}">${status.pendentes}</span></div>
      <div><span style="color:#888;font-size:11px;text-transform:uppercase">Erros</span><br><span style="font-weight:700;color:${status.erros > 0 ? '#C0392B' : '#888'}">${status.erros}</span></div>
    </div>
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <button onclick="window.keyoBrain_start();window.keyo_abrirModulo('brain')" style="background:#1E8449;color:#fff;border:none;border-radius:7px;padding:9px 16px;font-size:13px;font-weight:600;cursor:pointer">▶ Iniciar</button>
    <button onclick="window.keyoBrain_stop();window.keyo_abrirModulo('brain')" style="background:#eee;color:#C0392B;border:none;border-radius:7px;padding:9px 16px;font-size:13px;font-weight:600;cursor:pointer">⏹ Pausar</button>
    <button onclick="window.keyoBrain_tick().then(()=>window.keyo_abrirModulo('brain'))" style="background:#C9A84C;color:#1a1a2e;border:none;border-radius:7px;padding:9px 16px;font-size:13px;font-weight:600;cursor:pointer">⚡ Tick Agora</button>
  </div>
  <div style="margin-top:12px;font-size:11px;color:#aaa">O Brain Loop verifica automaticamente a cada 5 min e cria iniciativas na fila de Autorizações.</div>
</div>`;
      } else {
        msgs.innerHTML = '<div style="padding:40px;text-align:center;color:#888">Módulo Brain Loop (keyo-11-brain.js) não encontrado.</div>';
      }
    }
  }

  if (modulo === 'memoria') {
    const emoji = document.getElementById('keyo-header-emoji');
    const nome  = document.getElementById('keyo-header-nome');
    const desc  = document.getElementById('keyo-header-desc');
    if (emoji) emoji.textContent = '💾';
    if (nome)  nome.textContent  = 'Memória';
    if (desc)  desc.textContent  = 'Aprendizado acumulado e base de conhecimento';
    const inputArea = document.getElementById('keyo-input-area');
    const msgs      = document.getElementById('keyo-msgs');
    if (inputArea) inputArea.style.display = 'none';
    if (msgs)      msgs.style.display      = 'none';
    if (typeof window._kMemRenderInline === 'function') {
      window._kMemRenderInline();
    } else {
      if (msgs) { msgs.style.display = 'block'; msgs.innerHTML = '<div style="padding:40px;text-align:center;color:#888">Módulo de Memória (keyo-12-memory.js) não encontrado.</div>'; }
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
  // Reseta flag do Cientista (KEYO foi reaberto do zero)
  if (typeof window.mpros_fechar === 'function') window.mpros_fechar();
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

  // Sempre limpa módulos inline ao trocar de agente
  _kAba = 'chat';
  // Fecha Cientista via flag explícita (evita sobreposição pelo MutationObserver)
  if (typeof window.mpros_fechar === 'function') window.mpros_fechar();
  const inputArea = document.getElementById('keyo-input-area');
  const msgs      = document.getElementById('keyo-msgs');
  if (inputArea) inputArea.style.display = '';
  if (msgs)      msgs.style.display      = '';
  ['keyo-m12-inline','keyo-m13-inline','keyo-m14-inline',
   'keyo-m15-inline','keyo-m16-inline','keyo-mpros-inline'].forEach(function(mid) {
    const el = document.getElementById(mid);
    if (el) el.remove();
  });
  if (typeof window._k15Stop === 'function') window._k15Stop();

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
  // [FEATURE-COPIAR-TEXTO] Antes não dava pra copiar a resposta do KEYO —
  // toda campanha/texto gerado ficava "preso" na tela, precisando ser
  // retranscrito na mão. Botão de copiar só nas respostas do bot (não faz
  // sentido copiar a própria mensagem que o usuário digitou).
  const btnCopiar = role !== 'user'
    ? '<button type="button" class="keyo-btn-copiar" title="Copiar texto" style="margin-top:6px;padding:3px 8px;font-size:11px;border:1px solid rgba(0,0,0,.15);border-radius:6px;background:rgba(0,0,0,.03);cursor:pointer;display:inline-flex;align-items:center;gap:4px;color:inherit">📋 Copiar</button>'
    : '';
  div.innerHTML =
    '<div class="keyo-bubble">' + _formato(texto) + btnCopiar + '</div>' +
    '<div class="keyo-ts">' + ts + '</div>';
  if (role !== 'user') {
    const btn = div.querySelector('.keyo-btn-copiar');
    if (btn) {
      btn.addEventListener('click', function () {
        const _feedback = (ok) => {
          const original = btn.textContent;
          btn.textContent = ok ? '✅' : '⚠️';
          setTimeout(() => { btn.textContent = original; }, 1500);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(texto).then(() => _feedback(true)).catch(() => _feedback(false));
        } else {
          // Fallback pra navegadores/contextos sem Clipboard API
          try {
            const ta = document.createElement('textarea');
            ta.value = texto;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.focus(); ta.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);
            _feedback(ok);
          } catch (_e) { _feedback(false); }
        }
      });
    }
  }
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
// CONTEXTO LOCAL DO APP — [v2.8 FIX-FONTE-UNICA]
// Papel deste bloco: SOMENTE o que o navegador sabe e o servidor não
// (salas em operação, preço do dia, unidade ativa).
// Números financeiros — vendas, faturamento, ticket, contas, caixa —
// vêm EXCLUSIVAMENTE do bloco "CONTEXTO REAL DA EXIT GAMES" montado
// pelo servidor (Edge Function super-action), que lê o banco direto.
// Motivo: quando este terminal estava sem sessão válida, DB.vendas ficava
// vazio e este bloco afirmava "0 vendas" com convicção, vencendo o bloco
// correto do servidor (Salvador tinha 45 vendas / R$ 20.015 em julho).
// Duas fontes para o mesmo número = a IA escolhe a errada. Agora há uma só.
// ════════════════════════════════════════════════════════════════
function _keyoEhAdm() {
  try {
    if (typeof window.isAdm === 'function' && window.isAdm()) return true;
  } catch (_) { /* segue no fallback */ }
  return String((window.UA && window.UA.unidadeId) || '') === 'todas';
}

function _montarContextoAgente(agente) {
  try {
    const hoje = typeof window.hoje === 'function' ? window.hoje() : new Date().toISOString().slice(0, 10);
    // [v2.8] Data formatada SEM passar por new Date(): a string era interpretada
    // como UTC e voltava um dia no fuso do Brasil (mostrava 20/07 no dia 21/07).
    const dataBR = String(hoje).split('-').reverse().join('/');

    const uniIdRaw = _keyoEhAdm()
      ? 'todas'
      : String(
          (typeof window.pdvUID === 'function' ? window.pdvUID() : null)
          ?? window.UA?.unidadeId
          ?? 1
        );

    const unidadesParaMontar = uniIdRaw === 'todas' ? ['1', '2'] : [uniIdRaw];
    const fmtBRL = n => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const salasTodas = typeof window.rlsSalas === 'function' ? window.rlsSalas() : [];

    function _blocoSalasUnidade(uniId) {
      const nomeUnidade = uniId === '2'
        ? 'EXIT SALVADOR — Salvador Norte Shopping'
        : 'EXIT ARACAJU — Shopping Praia Sul';

      const daUnidade = salasTodas.filter(s => s && !s.manutencao && (String(s.unidadeId) === uniId || s.unidadeId == null));
      const _precoUni = (typeof window.precoAtual === 'function') ? window.precoAtual(uniId) : null;

      const linhas = ['── ' + nomeUnidade + ' ──'];

      if (daUnidade.length) {
        linhas.push('SALAS EM OPERAÇÃO (lidas AO VIVO do app — use SEMPRE estes dados, nunca suponha duração, capacidade ou preço):');
        linhas.push(daUnidade.map(s => {
          const dur = s.tempo ? (s.tempo + ' min') : '';
          const cap = (s.minJog && s.maxJog) ? (s.minJog + '–' + s.maxJog + ' jogadores') : '';
          const dif = s.dificuldade || '';
          return '• ' + (s.nome || 'Sala') + [dur, cap, dif].filter(Boolean).map(x => ' — ' + x).join('');
        }).join('\n'));
        linhas.push('Preço da sessão hoje, pela regra da unidade (semana/fim de semana/feriado): ' + (_precoUni != null ? fmtBRL(_precoUni) : '—') + '. Observação: o sistema cobra por sessão/unidade, não por sala.');
      } else {
        linhas.push('Salas: não carregadas neste terminal agora — não afirme nada sobre salas desta unidade.');
      }

      if (agente === 'mkt') {
        linhas.push('Instagram desta unidade: ' + (uniId === '2' ? '@exitgames.ssa (Salvador)' : '@exit.games (Aracaju)'));
      }

      return linhas.join('\n');
    }

    const base = [
      '╔══ DADOS LOCAIS DO APP (complemento — salas e preço) ══╗',
      'Data de hoje: ' + dataBR,
      uniIdRaw === 'todas'
        ? 'Visão ativa: ADM — acesso às DUAS unidades'
        : 'Unidade ativa: ' + (uniIdRaw === '2' ? 'EXIT SALVADOR' : 'EXIT ARACAJU'),
      'REGRA IMPORTANTE: este bloco NÃO traz vendas, faturamento, ticket, contas nem caixa.',
      'Esses números vêm SOMENTE do bloco "CONTEXTO REAL DA EXIT GAMES" (consultado no banco pelo servidor).',
      'Se o bloco do servidor trouxer números de uma unidade, USE-OS. Nunca conclua que uma unidade tem zero vendas por ausência de dados aqui.',
      '─────────────────────────────────────────────',
      unidadesParaMontar.map(_blocoSalasUnidade).join('\n\n'),
      '╚════════════════════════════════════════════╝',
    ];

    return base.join('\n');
  } catch(e) {
    console.warn('[KEYO-01] _montarContextoAgente falhou:', e);
    return '';
  }
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

  // [FIX-UNIDADE-ID] Antes lia window.UA.unidade (propriedade que nunca existiu —
  // o campo real é UA.unidadeId), então SEMPRE caía no fallback "1" (Aracaju),
  // não importa a unidade em que o operador estava. pdvUID() é a mesma função
  // usada pelo resto do ERP para saber a unidade ativa (já trata ADM com
  // unidade selecionada via window._pdvUnidade).
  // [v2.8] ADM envia 'todas' — o servidor (super-action v37) converte em contexto
  // das DUAS unidades. Antes, pdvUID() herdava window._pdvUnidade (estado interno
  // do PDV, invisível na tela do KEYO) e mandava a unidade errada sem o operador saber.
  const unidadeId = _keyoEhAdm()
    ? 'todas'
    : ((typeof window.pdvUID === 'function' ? window.pdvUID() : null)
        || (window.UA && window.UA.unidadeId)
        || 1);
  console.info('[KEYO-01] enviando unidade_id =', unidadeId);

  // Injeta contexto real do DB no payload — evita que a IA invente dados ou use anos antigos
  const _ctx = _montarContextoAgente(_kAgente);
  const _msgFinal = _ctx ? (_ctx + '\n\n' + texto) : texto;

  try {
    // [FIX-SESSAO-EXPIRADA] Antes lia o access_token cru do localStorage, sem checar
    // validade. Se tivesse expirado (padrão Supabase: ~1h), a Edge Function rejeitava
    // com 401 e o usuário via só "erro de conexão" — sem saber que era sessão vencida.
    // Reaproveita unidadeRenovarToken(), a mesma função de renovação já usada no
    // resto do ERP (ela mesma decide se precisa renovar; é barata de chamar sempre).
    if (typeof window.unidadeRenovarToken === 'function') {
      try { await window.unidadeRenovarToken(); } catch (_e) { /* segue com o token que tiver */ }
    }

    let jwt = '';
    try {
      const erpSession = (window._unidadeSession && window._unidadeSession.access_token)
        ? window._unidadeSession
        : JSON.parse(localStorage.getItem('exit_unidade_session') || '{}');
      jwt = erpSession?.access_token || '';
      if (!jwt && window._keyoToken) jwt = window._keyoToken;
      if (!jwt) jwt = window.SUPA_KEY || window.KEYO_ANON_KEY || '';
    } catch (e) {
      jwt = window.SUPA_KEY || window.KEYO_ANON_KEY || '';
    }

    const resp = await fetch(window.KEYO_EDGE_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + jwt,
        'apikey':         window.KEYO_ANON_KEY || '',
      },
      body: JSON.stringify({
        agente:      _kAgente,
        mensagem:    _msgFinal,  // contexto real + pergunta do usuário
        historico:   hist,
        unidade_id:  unidadeId,
      })
    });

    if (resp.status === 401) {
      throw new Error('SESSAO_EXPIRADA');
    }
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
    let msg;
    if (err && err.message === 'SESSAO_EXPIRADA') {
      msg = '🔒 Sua sessão expirou. Saia e entre de novo (ou recarregue a página) e tente novamente.';
    } else if (err && /^HTTP \d+/.test(err.message || '')) {
      msg = '⚠️ O servidor respondeu com erro (' + err.message + '). Tente de novo em instantes; se persistir, avise o suporte.';
    } else {
      msg = '⚠️ Não consegui conectar com o servidor. Verifique sua internet e tente novamente.';
    }
    _appendMsg('bot', msg);
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
window.keyo_toggleAgentes = function () {
  const box = document.getElementById('keyo-agents');
  if (box) box.classList.toggle('recolhido');
};

// ════════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════════
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _injetarMenu);
} else {
  _injetarMenu();
}

console.info('[KEYO-01] ✅ UI v2.8 — FONTE ÚNICA: números financeiros só do servidor; bloco local restrito a salas/preço; ADM envia unidade_id=todas; data corrigida (fuso).');

})();

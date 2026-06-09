// ═══════════════════════════════════════════════════════════════
// EXIT GAMES — KEYO CORE v1.2
// Arquivo: keyo-00-core.js
// Injetar via: <script src="keyo-00-core.js"></script>
// Inserir no index.html APÓS todo o ERP base, antes de </body>
// NUNCA modificar funções do ERP base.
// ═══════════════════════════════════════════════════════════════
(function _KEYO_CORE() {
'use strict';

// ── GUARD: bloqueia dupla injeção ───────────────────────────────
if (window.__KEYO_00_LOADED__) {
  console.warn('[KEYO-00] Já carregado. Ignorando.');
  return;
}
window.__KEYO_00_LOADED__ = true;

// ── VERIFICAÇÃO DE DEPENDÊNCIAS ─────────────────────────────────
// Críticas: sem elas o ERP não funciona — aborta o módulo
const _DEPS_CRITICAS = ['toast', 'uid', 'hoje', 'fM', 'san'];
// Opcionais: só existem com Supabase online — apenas avisa
const _DEPS_OPCIONAIS = ['DB', 'UA', 'sDB', 'isAdm', 'SUPA_KEY'];

const _criticas_faltando = _DEPS_CRITICAS.filter(d => typeof window[d] === 'undefined');
if (_criticas_faltando.length > 0) {
  console.error('[KEYO-00] ❌ Dependências críticas ausentes:', _criticas_faltando, '— módulo abortado.');
  return;
}

const _opcionais_faltando = _DEPS_OPCIONAIS.filter(d => typeof window[d] === 'undefined');
if (_opcionais_faltando.length > 0) {
  console.warn('[KEYO-00] ⚠️ Dependências opcionais ausentes (Supabase offline?):', _opcionais_faltando, '— continuando sem elas.');
}

// ── FREEZE DE FUNÇÕES CRÍTICAS DO ERP ───────────────────────────
const _ERP_ORIGINALS = {
  goTo:       window.goTo,
  renderPage: window.renderPage,
  rSb:        window.rSb,
  toast:      window.toast,
  sDB:        window.sDB,
};
window.addEventListener('load', function() {
  Object.keys(_ERP_ORIGINALS).forEach(fn => {
    if (window[fn] !== _ERP_ORIGINALS[fn] && fn !== 'renderPage') {
      console.error('[KEYO-00] ⚠️ Função ERP sobrescrita indevidamente:', fn);
    }
  });
}, { once: true });

// ════════════════════════════════════════════════════════════════
// ETAPA 1.1 — CONSTANTES E CSS
// ════════════════════════════════════════════════════════════════

// ── Constantes globais ───────────────────────────────────────────
const KEYO_EDGE_URL  = 'https://utivaczfuuazspychdxt.supabase.co/functions/v1/super-action';
const KEYO_ANON_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0aXZhY3pmdXVhenNweWNoZHh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NjI2OTMsImV4cCI6MjA5NTMzODY5M30.fKq1xIBNtxgv8bhynC4CzxI4LOPdN_mSHIR_t1pEohs';

const KEYO_AGENTS = [
  { id: 'keyo',      nome: 'KEYO',        emoji: '🧠', desc: 'Assistente geral da EXIT GAMES' },
  { id: 'vendas',    nome: 'Vendas',       emoji: '💰', desc: 'Metas, conversão e receita' },
  { id: 'mkt',       nome: 'Marketing',    emoji: '📣', desc: 'Campanhas, redes sociais e captação' },
  { id: 'ops',       nome: 'Operações',    emoji: '⚙️', desc: 'Processos, salas e equipe' },
  { id: 'fin',       nome: 'Financeiro',   emoji: '📊', desc: 'Custos, DRE e fluxo de caixa' },
  { id: 'jur',       nome: 'Jurídico',     emoji: '⚖️', desc: 'Contratos, termos e conformidade' },
  { id: 'rh',        nome: 'RH',           emoji: '👥', desc: 'Equipe, escalas e clima organizacional' },
];

const KEYO_WELCOME = {
  keyo:   'Olá! Sou o **KEYO**, assistente de inteligência artificial da EXIT GAMES. Como posso ajudar hoje?',
  vendas: 'Olá! Sou o agente de **Vendas**. Posso analisar metas, conversão, ticket médio e oportunidades de receita.',
  mkt:    'Olá! Sou o agente de **Marketing**. Fale sobre campanhas, redes sociais, captação de clientes e comunicação.',
  ops:    'Olá! Sou o agente de **Operações**. Vamos falar sobre processos, salas, escalas e eficiência operacional.',
  fin:    'Olá! Sou o agente **Financeiro**. Posso ajudar com custos, DRE, fluxo de caixa e análise de resultados.',
  jur:    'Olá! Sou o agente **Jurídico**. Posso orientar sobre contratos, termos de responsabilidade e conformidade.',
  rh:     'Olá! Sou o agente de **RH**. Vamos conversar sobre equipe, escalas, clima organizacional e gestão de pessoas.',
};

// ── Expõe constantes globalmente (usadas por módulos externos) ───
window.KEYO_EDGE_URL  = KEYO_EDGE_URL;
window.KEYO_ANON_KEY  = KEYO_ANON_KEY;
window.KEYO_AGENTS    = KEYO_AGENTS;
window.KEYO_WELCOME   = KEYO_WELCOME;

// ── Estado interno ───────────────────────────────────────────────
let _kAgent   = 'keyo';
let _kLoading = false;
let _kHistory = {};

// ── CSS da interface ─────────────────────────────────────────────
(function _injetarCSS() {
  if (document.getElementById('keyo-css')) return;
  const s = document.createElement('style');
  s.id = 'keyo-css';
  s.textContent = `
/* ── KEYO: layout principal ── */
#keyo-wrap{display:flex;height:calc(100vh - 3px);overflow:hidden;background:#f4f4fa}
#keyo-agents{width:200px;flex-shrink:0;background:#0f0f1a;border-right:1px solid rgba(255,255,255,0.08);display:flex;flex-direction:column;overflow-y:auto}
#keyo-agents-title{padding:14px 16px 8px;font-size:9px;font-weight:700;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px}
.keyo-agent-btn{display:flex;align-items:center;gap:9px;padding:10px 16px;cursor:pointer;border:none;background:none;width:100%;text-align:left;color:rgba(255,255,255,0.5);font-size:12px;font-family:inherit;border-left:3px solid transparent;transition:all .15s}
.keyo-agent-btn:hover{background:rgba(255,255,255,0.07);color:#f0f0f8}
.keyo-agent-btn.active{background:rgba(201,168,76,.12);color:#C9A84C;font-weight:700;border-left-color:#C9A84C}
.keyo-agent-emoji{font-size:16px;width:20px;text-align:center;flex-shrink:0}
.keyo-agent-info{display:flex;flex-direction:column;gap:1px}
.keyo-agent-nome{font-size:12px;line-height:1.2}
.keyo-agent-desc{font-size:9px;color:rgba(255,255,255,0.3);line-height:1.3;display:none}
.keyo-agent-btn.active .keyo-agent-desc{color:rgba(201,168,76,0.6)}

/* ── KEYO: área de chat ── */
#keyo-main{flex:1;display:flex;flex-direction:column;overflow:hidden}
#keyo-header{padding:14px 20px;background:#fff;border-bottom:1px solid #e8e8f0;display:flex;align-items:center;gap:10px;flex-shrink:0}
#keyo-header-emoji{font-size:22px}
#keyo-header-nome{font-size:16px;font-weight:700;color:#111118}
#keyo-header-desc{font-size:11px;color:#888899;margin-top:1px}
#keyo-msgs{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:12px;scroll-behavior:smooth}
#keyo-msgs:empty::after{content:'';display:block}

/* ── KEYO: bolhas de mensagem ── */
.keyo-msg{display:flex;flex-direction:column;max-width:80%}
.keyo-msg.user{align-self:flex-end;align-items:flex-end}
.keyo-msg.bot{align-self:flex-start;align-items:flex-start}
.keyo-bubble{padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.6;word-break:break-word}
.keyo-msg.user .keyo-bubble{background:#C9A84C;color:#000;border-bottom-right-radius:4px}
.keyo-msg.bot .keyo-bubble{background:#fff;border:1px solid #e8e8f0;color:#111118;border-bottom-left-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
.keyo-bubble strong{font-weight:700}
.keyo-bubble em{font-style:italic}
.keyo-bubble code{background:rgba(0,0,0,0.07);padding:1px 5px;border-radius:3px;font-size:11px;font-family:monospace}
.keyo-bubble p{margin:0 0 6px}.keyo-bubble p:last-child{margin:0}
.keyo-bubble ul,.keyo-bubble ol{margin:4px 0 4px 16px;padding:0}
.keyo-bubble li{margin:2px 0}
.keyo-ts{font-size:9px;color:#aaa;margin-top:3px;padding:0 4px}

/* ── KEYO: loading dots ── */
.keyo-loading{display:flex;align-items:center;gap:4px;padding:10px 14px;background:#fff;border:1px solid #e8e8f0;border-radius:14px;border-bottom-left-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
.keyo-dot{width:7px;height:7px;border-radius:50%;background:#C9A84C;animation:keyoDot .9s infinite ease-in-out}
.keyo-dot:nth-child(2){animation-delay:.15s}
.keyo-dot:nth-child(3){animation-delay:.3s}
@keyframes keyoDot{0%,80%,100%{transform:scale(0.6);opacity:.4}40%{transform:scale(1);opacity:1}}

/* ── KEYO: input area ── */
#keyo-input-area{padding:14px 20px;background:#fff;border-top:1px solid #e8e8f0;flex-shrink:0}
#keyo-input-row{display:flex;gap:8px;align-items:flex-end}
#keyo-input{flex:1;background:#f4f4fa;border:1px solid #d8d8e8;border-radius:12px;padding:10px 14px;font-size:13px;font-family:inherit;resize:none;outline:none;min-height:42px;max-height:120px;overflow-y:auto;line-height:1.5;color:#111118;transition:border .15s}
#keyo-input:focus{border-color:#C9A84C;box-shadow:0 0 0 3px rgba(201,168,76,.1)}
#keyo-send{background:#C9A84C;border:none;border-radius:10px;padding:10px 16px;cursor:pointer;font-size:16px;color:#000;flex-shrink:0;height:42px;display:flex;align-items:center;justify-content:center;transition:all .15s}
#keyo-send:hover{background:#b8962e}
#keyo-send:disabled{opacity:.4;cursor:not-allowed}
#keyo-input-hint{font-size:10px;color:#aaa;margin-top:5px;text-align:right}
#keyo-actions{display:flex;gap:6px;margin-bottom:8px}
.keyo-action-btn{background:none;border:1px solid #d8d8e8;border-radius:6px;padding:4px 10px;font-size:11px;color:#888899;cursor:pointer;font-family:inherit;transition:all .15s}
.keyo-action-btn:hover{border-color:#C9A84C;color:#C9A84C}
`;
  document.head.appendChild(s);
})();

// ════════════════════════════════════════════════════════════════
// FIM ETAPA 1.1
// ════════════════════════════════════════════════════════════════

console.info('[KEYO-00] ✅ Etapa 1.1 — CSS e constantes carregados. (v1.2)');
console.info('[KEYO-00] KEYO_AGENTS:', KEYO_AGENTS.length, 'agentes');
console.info('[KEYO-00] KEYO_EDGE_URL:', KEYO_EDGE_URL);

})();

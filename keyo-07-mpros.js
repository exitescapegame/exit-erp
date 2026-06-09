// ═══════════════════════════════════════════════════════════════
// EXIT GAMES — KEYO M07: MPROS — PROSPECÇÃO ATIVA v1.8 (remove apikey CORS + não derruba tela na busca)
// Arquivo: keyo-07-mpros.js
// Injetar via: <script src="keyo-07-mpros.js"></script>
// Depende de: keyo-00-core.js e keyo-01-ui.js (carregar antes)
// Cobre: Fase 4 do Plano Mestre v2.0 (Etapas 7.1 → 7.7)
// Fontes: PNCP (licitações) + Nominatim/Google Places (negócios) + IA (eventos)
// Motor: diário (meia-noite) + acionamento manual pelo ADM
// NUNCA modificar funções do ERP base. (Lei #2)
// ═══════════════════════════════════════════════════════════════
(function _KEYO_MPROS() {
'use strict';

// ── GUARD: bloqueia dupla injeção ───────────────────────────────
if (window.__KEYO_MPROS_LOADED__) {
  console.warn('[KEYO-07] Já carregado. Ignorando.');
  return;
}
if (!window.__KEYO_00_LOADED__) {
  console.error('[KEYO-07] keyo-00-core.js não carregado. Abortando.');
  return;
}
window.__KEYO_MPROS_LOADED__ = true;

// ── VERIFICAÇÃO DE DEPENDÊNCIAS ─────────────────────────────────
const _DEPS = ['toast', 'uid', 'hoje', 'fM', 'san'];
const _depsFaltando = _DEPS.filter(d => typeof window[d] === 'undefined');
if (_depsFaltando.length > 0) {
  console.error('[KEYO-07] Dependências ausentes:', _depsFaltando, '— módulo abortado.');
  window.__KEYO_MPROS_LOADED__ = false;
  return;
}

// ── FREEZE DE FUNÇÕES CRÍTICAS DO ERP ───────────────────────────
const _ERP_ORIGINALS = {
  goTo:  window.goTo,
  toast: window.toast,
  sDB:   window.sDB,
};
window.addEventListener('load', function () {
  ['toast', 'sDB'].forEach(fn => {
    if (window[fn] !== _ERP_ORIGINALS[fn])
      console.error('[KEYO-07] ⚠️ Função ERP sobrescrita indevidamente:', fn);
  });
}, { once: true });

// ════════════════════════════════════════════════════════════════
// ETAPA 7.1 — ESTRUTURA DE DADOS (DB)
// ════════════════════════════════════════════════════════════════

function _initDB() {
  if (typeof window.DB === 'undefined') window.DB = {};

  // Leads captados pelo motor
  if (!window.DB.keyoLeads) window.DB.keyoLeads = [];
  /*
    Lead: {
      id, titulo, tipo, categoria, descricao, fonte,
      contato: { nome, whatsapp, email, site },
      localizacao, uf, municipio,
      potencial: 'alto'|'medio'|'baixo',
      score: 0-100,
      justificativa,
      status: 'fila'|'aprovado'|'proposta'|'enviado'|'negociando'|'ganho'|'descartado',
      propostaId,
      unidadeId,
      criadoEm, aprovadoEm, enviadoEm, fechadoEm,
      semana,        // semana ISO para relatório
      rodada,        // número da rodada de busca
    }
  */

  // Configurações do motor
  if (!window.DB.keyoMprosConfig) window.DB.keyoMprosConfig = {
    ativo:          true,          // motor ligado/pausado
    googlePlacesKey: '',           // campo para chave Google Places (opcional)
    ultimaRodada:   null,          // ISO timestamp da última execução
    rodadaNumero:   0,             // contador de rodadas
    leadsHoje:      0,             // leads captados hoje
    maxLeadsPorRodada: 10,         // máximo por ciclo
  };

  // Relatório semanal acumulado
  if (!window.DB.keyoMprosRelatorio) window.DB.keyoMprosRelatorio = [];

  // Salas de escape criadas pelo Cientista (função Criação)
  if (!window.DB.keyoSalas) window.DB.keyoSalas = [];
  /*
    Sala: {
      id, titulo, tema, tempoMin, jogadores, dificuldade,
      instrucoes,        // pedido extra do ADM
      projeto,           // texto completo do projeto (markdown-ish)
      criadoEm, criadoPor
    }
  */
  /*
    Semana: {
      semana, buscados, descartados, aprovados, enviados,
      negociando, ganhos, receita
    }
  */
}
_initDB();

// ── Helpers de acesso ───────────────────────────────────────────
function _leads()  { return Array.isArray(window.DB?.keyoLeads) ? window.DB.keyoLeads : []; }
function _config() { return window.DB?.keyoMprosConfig || {}; }

// ── Constantes ──────────────────────────────────────────────────
const CATEGORIAS = [
  { id: 'licitacao',       label: 'Licitações Públicas',       emoji: '🏛️' },
  { id: 'team_building',   label: 'Team Building',             emoji: '🤝' },
  { id: 'confrat',         label: 'Confraternização',          emoji: '🎉' },
  { id: 'escola',          label: 'Escolas / Colégios',        emoji: '🎓' },
  { id: 'federacao',       label: 'Federações / Competições',  emoji: '🏆' },
  { id: 'sebrae_senac',    label: 'SEBRAE / SENAC / SESC',     emoji: '📚' },
  { id: 'feira_evento',    label: 'Feiras e Eventos',          emoji: '🎪' },
  { id: 'empresa_regional',label: 'Empresas Regionais',        emoji: '🏢' },
];

const STATUS_CONFIG = {
  fila:       { label: 'Na fila',      cor: '#888899', bg: '#f4f4fa' },
  aprovado:   { label: 'Aprovado',     cor: '#2563eb', bg: '#e6f1fb' },
  proposta:   { label: 'Proposta',     cor: '#7c3aed', bg: '#f3eeff' },
  enviado:    { label: 'Enviado',      cor: '#d97706', bg: '#fff3cd' },
  negociando: { label: 'Negociando',   cor: '#0891b2', bg: '#e0f7fa' },
  ganho:      { label: 'Ganho ✓',     cor: '#16a34a', bg: '#eaf3de' },
  descartado: { label: 'Descartado',   cor: '#dc2626', bg: '#fde8e8' },
};

const POTENCIAL_CONFIG = {
  alto:  { label: 'Alto',  emoji: '🔴', cor: '#dc2626', bg: '#fde8e8' },
  medio: { label: 'Médio', emoji: '🟡', cor: '#d97706', bg: '#fff3cd' },
  baixo: { label: 'Baixo', emoji: '⚪', cor: '#888899', bg: '#f4f4fa' },
};

// ── Semana ISO ───────────────────────────────────────────────────
function _semanaISO() {
  const d = new Date();
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const semana = Math.ceil(((d - jan4) / 86400000 + jan4.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(semana).padStart(2, '0')}`;
}

// ── JWT helper ──────────────────────────────────────────────────
function _jwt() {
  try {
    return JSON.parse(localStorage.getItem('exit_unidade_session') || '{}')?.access_token
      || window._keyoToken || window.SUPA_KEY || window.KEYO_ANON_KEY || '';
  } catch (e) { return window.KEYO_ANON_KEY || ''; }
}

// ── Cabeçalhos da chamada à IA ──────────────────────────────────
// IMPORTANTE: o super-action NÃO permite o cabeçalho 'apikey' (bloqueia por CORS).
// Por isso enviamos só Content-Type + Authorization (o mesmo que passa no preflight).
function _keyoHeaders() {
  let jwt = '';
  try {
    const erpSession = JSON.parse(localStorage.getItem('exit_unidade_session') || '{}');
    jwt = erpSession?.access_token || '';
    if (!jwt && window._keyoToken) jwt = window._keyoToken;
    if (!jwt) jwt = window.SUPA_KEY || window.KEYO_ANON_KEY || '';
  } catch (e) {
    jwt = window.SUPA_KEY || window.KEYO_ANON_KEY || '';
  }
  return {
    'Content-Type':  'application/json',
    'Authorization': 'Bearer ' + jwt,
  };
}

// ════════════════════════════════════════════════════════════════
// ETAPA 7.1 — CSS
// ════════════════════════════════════════════════════════════════
(function _css() {
  if (document.getElementById('keyo-mpros-css')) return;
  const s = document.createElement('style');
  s.id = 'keyo-mpros-css';
  s.textContent = `
/* ══ MPROS: layout wrapper ══ */
#mpros-wrap{display:flex;flex-direction:column;height:100%;overflow:hidden}

/* ══ MPROS: top bar ══ */
#mpros-topbar{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:#fff;border-bottom:1px solid #e8e8f0;flex-shrink:0;gap:12px;flex-wrap:wrap}
#mpros-topbar-left{display:flex;align-items:center;gap:10px}
#mpros-topbar h2{font-size:16px;font-weight:700;color:#111118;display:flex;align-items:center;gap:8px;margin:0}
#mpros-motor-badge{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;cursor:default}
#mpros-motor-badge.ativo{background:#eaf3de;color:#16a34a}
#mpros-motor-badge.pausado{background:#f8d7da;color:#dc2626}
#mpros-topbar-right{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.mpros-btn{border:none;border-radius:8px;padding:8px 16px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s;display:flex;align-items:center;gap:6px}
.mpros-btn-primary{background:#C9A84C;color:#000}
.mpros-btn-primary:hover{background:#b8962e}
.mpros-btn-secondary{background:#f4f4fa;color:#555566;border:1px solid #d8d8e8}
.mpros-btn-secondary:hover{background:#e8e8f0}
.mpros-btn-danger{background:#fde8e8;color:#dc2626;border:1px solid #fca5a5}
.mpros-btn-danger:hover{background:#fecaca}
.mpros-btn-success{background:#eaf3de;color:#16a34a;border:1px solid #86efac}
.mpros-btn-success:hover{background:#dcfce7}
.mpros-btn:disabled{opacity:.4;cursor:not-allowed}

/* ══ MPROS: abas ══ */
#mpros-tabs{display:flex;gap:0;border-bottom:2px solid #e8e8f0;background:#fff;padding:0 20px;flex-shrink:0}
.mpros-tab{padding:11px 18px;font-size:13px;font-weight:600;color:#888899;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;transition:all .15s;background:none;border-top:none;border-left:none;border-right:none;font-family:inherit;display:flex;align-items:center;gap:6px}
.mpros-tab:hover{color:#555566}
.mpros-tab.active{color:#C9A84C;border-bottom-color:#C9A84C}
.mpros-tab-badge{background:#C9A84C;color:#000;font-size:10px;font-weight:700;padding:1px 6px;border-radius:20px;min-width:18px;text-align:center}
.mpros-tab-badge.zero{background:#e8e8f0;color:#888899}

/* ══ MPROS: conteúdo das abas ══ */
#mpros-content{flex:1;overflow-y:auto;padding:20px}

/* ══ MPROS: painel de status do motor ══ */
#mpros-motor-painel{background:#fff;border:1px solid #e8e8f0;border-radius:14px;padding:18px 20px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.mpros-motor-info{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.mpros-motor-stat{text-align:center;min-width:60px}
.mpros-motor-stat-n{font-size:22px;font-weight:700;color:#111118}
.mpros-motor-stat-l{font-size:10px;color:#888899;margin-top:2px}
.mpros-motor-actions{display:flex;gap:8px;flex-wrap:wrap}

/* ══ MPROS: config Google Places ══ */
#mpros-config-box{background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
#mpros-config-box p{font-size:12px;color:#92400e;flex:1;margin:0}
#mpros-gkey-input{background:#fff;border:1px solid #fcd34d;border-radius:8px;padding:7px 12px;font-size:12px;font-family:inherit;color:#111118;outline:none;width:320px;max-width:100%}
#mpros-gkey-input:focus{border-color:#C9A84C}

/* ══ MPROS: kanban / lista de leads ══ */
.mpros-secao{background:#fff;border:1px solid #e8e8f0;border-radius:14px;margin-bottom:14px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.04)}
.mpros-secao-header{display:flex;align-items:center;justify-content:space-between;padding:13px 18px;border-bottom:1px solid #f4f4fa;cursor:pointer;user-select:none}
.mpros-secao-titulo{font-size:13px;font-weight:700;color:#111118;display:flex;align-items:center;gap:8px}
.mpros-secao-count{font-size:11px;font-weight:700;background:#f4f4fa;color:#555566;border-radius:20px;padding:2px 9px}
.mpros-secao-body{padding:0}

/* ══ MPROS: card de lead ══ */
.mpros-lead-card{display:flex;align-items:flex-start;gap:12px;padding:14px 18px;border-bottom:1px solid #f8f8fc;transition:background .1s}
.mpros-lead-card:last-child{border-bottom:none}
.mpros-lead-card:hover{background:#fafafa}
.mpros-lead-pot{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.mpros-lead-corpo{flex:1;min-width:0}
.mpros-lead-titulo{font-size:13px;font-weight:600;color:#111118;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mpros-lead-sub{font-size:11px;color:#888899;margin-top:2px;line-height:1.4}
.mpros-lead-tags{display:flex;gap:5px;margin-top:6px;flex-wrap:wrap}
.mpros-tag{font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px}
.mpros-lead-score{font-size:11px;font-weight:700;color:#C9A84C;margin-top:4px}
.mpros-lead-acoes{display:flex;gap:5px;flex-shrink:0;align-items:center;flex-wrap:wrap}
.mpros-btn-mini{border:none;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s;white-space:nowrap}
.mpros-btn-aprovar{background:#C9A84C;color:#000}
.mpros-btn-aprovar:hover{background:#b8962e}
.mpros-btn-descartar{background:#fde8e8;color:#dc2626}
.mpros-btn-descartar:hover{background:#fecaca}
.mpros-btn-ver{background:#f4f4fa;color:#555566;border:1px solid #e8e8f0}
.mpros-btn-ver:hover{background:#e8e8f0}
.mpros-btn-proposta{background:#e6f1fb;color:#2563eb}
.mpros-btn-proposta:hover{background:#dbeafe}
.mpros-btn-wpp{background:#eaf3de;color:#16a34a}
.mpros-btn-wpp:hover{background:#dcfce7}
.mpros-btn-ganho{background:#eaf3de;color:#16a34a;border:1px solid #86efac}
.mpros-btn-ganho:hover{background:#dcfce7}

/* ══ MPROS: vazio ══ */
.mpros-vazio{text-align:center;padding:50px 20px;color:#888899}
.mpros-vazio-icon{font-size:42px;margin-bottom:10px}
.mpros-vazio p{font-size:13px;line-height:1.6}

/* ══ MPROS: loading spinner ══ */
.mpros-loading{display:flex;align-items:center;justify-content:center;gap:10px;padding:40px;color:#888899;font-size:13px}
.mpros-spin{width:18px;height:18px;border:2px solid #e8e8f0;border-top-color:#C9A84C;border-radius:50%;animation:mpSpin .7s linear infinite}
@keyframes mpSpin{to{transform:rotate(360deg)}}

/* ══ MPROS: relatório ══ */
.mpros-relatorio-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
.mpros-rel-card{background:#fff;border:1px solid #e8e8f0;border-radius:12px;padding:16px;text-align:center}
.mpros-rel-n{font-size:26px;font-weight:700;color:#111118}
.mpros-rel-l{font-size:10px;color:#888899;margin-top:3px}
.mpros-rel-card.destaque .mpros-rel-n{color:#16a34a}
.mpros-tabela{width:100%;border-collapse:collapse;font-size:12px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e8e8f0}
.mpros-tabela th{text-align:left;padding:10px 14px;font-size:10px;font-weight:700;color:#888899;text-transform:uppercase;letter-spacing:.6px;border-bottom:1px solid #e8e8f0;background:#fafafa}
.mpros-tabela td{padding:11px 14px;border-bottom:1px solid #f4f4fa;vertical-align:middle}
.mpros-tabela tr:last-child td{border-bottom:none}
.mpros-tabela tr:hover td{background:#fafafa}

/* ══ MPROS: modal detalhes lead ══ */
#mpros-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9500;display:flex;align-items:center;justify-content:center;padding:16px}
#mpros-modal{background:#fff;border-radius:16px;padding:28px;width:560px;max-width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.2)}
#mpros-modal h3{font-size:16px;font-weight:700;color:#111118;margin-bottom:4px}
.mpros-modal-sub{font-size:12px;color:#888899;margin-bottom:18px}
.mpros-modal-campo{margin-bottom:12px}
.mpros-modal-campo label{display:block;font-size:11px;font-weight:700;color:#888899;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
.mpros-modal-campo p{font-size:13px;color:#111118;line-height:1.6;margin:0;background:#f8f8fc;border-radius:8px;padding:10px 12px}
.mpros-modal-footer{display:flex;gap:8px;justify-content:flex-end;margin-top:20px;flex-wrap:wrap}

/* ══ MPROS: barra de progresso da rodada ══ */
#mpros-progress-bar{height:3px;background:#e8e8f0;border-radius:2px;overflow:hidden;margin-bottom:16px}
#mpros-progress-fill{height:100%;background:#C9A84C;border-radius:2px;transition:width .5s ease;width:0%}

/* ══ MPROS: painel de filtros ══ */
#mpros-filtros{background:#fff;border:1px solid #e8e8f0;border-radius:12px;padding:14px 18px;margin-bottom:14px;display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap}
#mpros-filtros label{font-size:10px;font-weight:700;color:#888899;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px}
#mpros-filtros select{background:#f4f4fa;border:1px solid #d8d8e8;border-radius:7px;padding:6px 10px;font-size:12px;font-family:inherit;color:#111118;outline:none;cursor:pointer}
#mpros-filtros select:focus{border-color:#C9A84C}
.mpros-filtro-grupo{display:flex;flex-direction:column}
#mpros-btn-limpar-filtro{background:none;border:1px solid #d8d8e8;border-radius:7px;padding:6px 12px;font-size:11px;color:#888899;cursor:pointer;font-family:inherit;transition:all .15s;align-self:flex-end}
#mpros-btn-limpar-filtro:hover{border-color:#C9A84C;color:#C9A84C}
.mpros-filtro-contador{font-size:11px;color:#888899;align-self:flex-end;padding-bottom:4px}

/* ══ CIENTISTA: aba Criação ══ */
.cri-painel{background:#fff;border:1px solid #e8e8f0;border-radius:14px;padding:20px;margin-bottom:16px}
.cri-titulo{font-size:14px;font-weight:700;color:#111118;margin:0 0 4px}
.cri-sub{font-size:12px;color:#888899;margin:0 0 16px}
.cri-form{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.cri-campo{display:flex;flex-direction:column;gap:4px}
.cri-campo.full{grid-column:1 / -1}
.cri-campo label{font-size:11px;font-weight:700;color:#888899;text-transform:uppercase;letter-spacing:.5px}
.cri-campo select,.cri-campo input,.cri-campo textarea{font-family:inherit;font-size:13px;padding:9px 11px;border:1px solid #d8d8e8;border-radius:8px;color:#111118;background:#fff}
.cri-campo textarea{resize:vertical;min-height:60px}
.cri-actions{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap}
.cri-loading{text-align:center;color:#888899;font-size:13px;padding:30px}
.cri-dots span{display:inline-block;width:7px;height:7px;margin:0 2px;border-radius:50%;background:#C9A84C;animation:cri-bounce 1.2s infinite}
.cri-dots span:nth-child(2){animation-delay:.2s}
.cri-dots span:nth-child(3){animation-delay:.4s}
@keyframes cri-bounce{0%,80%,100%{opacity:.3;transform:translateY(0)}40%{opacity:1;transform:translateY(-5px)}}
.cri-projeto{background:#fff;border:1px solid #e8e8f0;border-radius:14px;padding:24px 26px;margin-bottom:16px;line-height:1.65;color:#222}
.cri-projeto h1{font-size:19px;color:#111118;margin:0 0 12px;border-bottom:2px solid #C9A84C;padding-bottom:8px}
.cri-projeto h2{font-size:15px;color:#7c3aed;margin:20px 0 8px}
.cri-projeto h3{font-size:13px;color:#111118;margin:14px 0 4px;font-weight:700}
.cri-projeto p{font-size:13px;margin:0 0 8px}
.cri-projeto ul{margin:4px 0 10px;padding-left:20px}
.cri-projeto li{font-size:13px;margin-bottom:3px}
.cri-projeto strong{color:#111118}
.cri-projeto-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:8px}
.cri-tags{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
.cri-tag{font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;background:#f3eeff;color:#7c3aed}
.cri-lista-item{background:#fff;border:1px solid #e8e8f0;border-radius:12px;padding:14px 16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.cri-lista-nome{font-size:13px;font-weight:700;color:#111118}
.cri-lista-meta{font-size:11px;color:#888899;margin-top:2px}
.cri-lista-acoes{display:flex;gap:6px;flex-wrap:wrap}
`;
  document.head.appendChild(s);
})();

// ════════════════════════════════════════════════════════════════
// ETAPA 7.1 — RENDER PRINCIPAL (chamado por keyo_abrirModulo)
// ════════════════════════════════════════════════════════════════
let _abaAtiva = 'fila'; // 'fila' | 'aprovados' | 'pipeline' | 'relatorio' | 'config'

// ── Estado dos filtros de prospecção ────────────────────────────
let _filtros = { categoria: '', cidade: '', potencial: '', tamanho: '' };

function _renderInline() {
  // Remove área anterior
  const anterior = document.getElementById('keyo-mpros-inline');
  if (anterior) anterior.remove();

  // Esconde chat
  const msgs      = document.getElementById('keyo-msgs');
  const inputArea = document.getElementById('keyo-input-area');
  if (msgs)      msgs.style.display      = 'none';
  if (inputArea) inputArea.style.display = 'none';

  // ── FIX BUG 3: proteger contra renderPage() do ERP ──────────
  // O goTo('keyo') do keyo-01 não seta PA='keyo', então qualquer
  // chamada a renderPage() dentro do ERP (ex: opFinalizar, sDB callbacks)
  // substituía o #pc e derrubava a tela. Patchamos renderPage aqui de
  // forma segura: só protege enquanto a tela KEYO está visível.
  if (!window.__KEYO_RENDERPAGE_PATCHED__) {
    window.__KEYO_RENDERPAGE_PATCHED__ = true;
    const _rpOrig = window.renderPage;
    if (typeof _rpOrig === 'function') {
      window.renderPage = function() {
        // Se o container do KEYO estiver visível no #pc, não deixa o ERP sobrescrever
        const pc = document.getElementById('pc');
        if (pc && pc.contains(document.getElementById('keyo-wrap'))) {
          console.info('[KEYO-07] renderPage() bloqueado — tela KEYO ativa.');
          return;
        }
        return _rpOrig.apply(this, arguments);
      };
      console.info('[KEYO-07] ✅ renderPage() patchado — tela KEYO protegida.');
    }
  }

  const main = document.getElementById('keyo-main');
  if (!main) return;

  const area = document.createElement('div');
  area.id = 'keyo-mpros-inline';
  area.style.cssText = 'flex:1;overflow:hidden;display:flex;flex-direction:column';
  area.innerHTML = _htmlPrincipal();
  main.appendChild(area);

  _atualizarAbas();
  _renderAba(_abaAtiva);
  _atualizarMotorBadge();
}

function _htmlPrincipal() {
  const cfg = _config();
  const motorAtivo = cfg.ativo !== false;
  const fila       = _leads().filter(l => l.status === 'fila').length;
  const aprovados  = _leads().filter(l => l.status === 'aprovado').length;
  const pipeline   = _leads().filter(l => ['proposta','enviado','negociando'].includes(l.status)).length;

  return `
<div id="mpros-wrap">
  <!-- TOP BAR -->
  <div id="mpros-topbar">
    <div id="mpros-topbar-left">
      <h2>🔬 Cientista — Prospecção</h2>
      <div id="mpros-motor-badge" class="${motorAtivo ? 'ativo' : 'pausado'}">
        ${motorAtivo ? '● Motor ativo' : '● Motor pausado'}
      </div>
    </div>
    <div id="mpros-topbar-right">
      <button class="mpros-btn mpros-btn-secondary" onclick="window.mpros_toggleMotor()" id="mpros-btn-toggle">
        ${motorAtivo ? '⏸ Pausar motor' : '▶ Retomar motor'}
      </button>
      <button class="mpros-btn mpros-btn-primary" onclick="window.mpros_rodarAgora()" id="mpros-btn-rodar">
        🔍 Buscar agora
      </button>
    </div>
  </div>

  <!-- ABAS -->
  <div id="mpros-tabs">
    <button class="mpros-tab ${_abaAtiva==='fila'?'active':''}" onclick="window.mpros_aba('fila')">
      📥 Fila do ADM
      <span class="mpros-tab-badge ${fila===0?'zero':''}" id="mpros-badge-fila">${fila}</span>
    </button>
    <button class="mpros-tab ${_abaAtiva==='aprovados'?'active':''}" onclick="window.mpros_aba('aprovados')">
      ✅ Aprovados
      <span class="mpros-tab-badge ${aprovados===0?'zero':''}" id="mpros-badge-aprovados">${aprovados}</span>
    </button>
    <button class="mpros-tab ${_abaAtiva==='pipeline'?'active':''}" onclick="window.mpros_aba('pipeline')">
      📊 Pipeline
      <span class="mpros-tab-badge ${pipeline===0?'zero':''}" id="mpros-badge-pipeline">${pipeline}</span>
    </button>
    <button class="mpros-tab ${_abaAtiva==='relatorio'?'active':''}" onclick="window.mpros_aba('relatorio')">
      📈 Relatório
    </button>
    <button class="mpros-tab ${_abaAtiva==='config'?'active':''}" onclick="window.mpros_aba('config')">
      ⚙️ Config
    </button>
    <button class="mpros-tab ${_abaAtiva==='criacao'?'active':''}" onclick="window.mpros_aba('criacao')" style="margin-left:auto">
      🧪 Criação
    </button>
  </div>

  <!-- BARRA DE PROGRESSO DA RODADA -->
  <div id="mpros-progress-bar" style="display:none">
    <div id="mpros-progress-fill"></div>
  </div>

  <!-- CONTEÚDO -->
  <div id="mpros-content"></div>
</div>`;
}

// ── Trocar aba ───────────────────────────────────────────────────
function _aba(id) {
  _abaAtiva = id;
  document.querySelectorAll('.mpros-tab').forEach(t => t.classList.remove('active'));
  const btn = document.querySelector(`.mpros-tab[onclick*="'${id}'"]`);
  if (btn) btn.classList.add('active');
  _renderAba(id);
}

function _renderAba(id) {
  const content = document.getElementById('mpros-content');
  if (!content) return;

  if (id === 'fila')      { content.innerHTML = _htmlFila(); }
  else if (id === 'aprovados') { content.innerHTML = _htmlAprovados(); }
  else if (id === 'pipeline')  { content.innerHTML = _htmlPipeline(); }
  else if (id === 'relatorio') { content.innerHTML = _htmlRelatorio(); }
  else if (id === 'config')    { content.innerHTML = _htmlConfig(); }
  else if (id === 'criacao')   { _criandoSala = false; content.innerHTML = _htmlCriacao(); }
}

// ════════════════════════════════════════════════════════════════
// ABA: FILA DO ADM
// ════════════════════════════════════════════════════════════════
function _htmlFila() {
  const cfg     = _config();
  const fila    = _leads().filter(l => l.status === 'fila');
  const altos   = fila.filter(l => l.potencial === 'alto');
  const medios  = fila.filter(l => l.potencial === 'medio');

  let html = `
<div id="mpros-motor-painel">
  <div class="mpros-motor-info">
    <div class="mpros-motor-stat">
      <div class="mpros-motor-stat-n">${_leads().length}</div>
      <div class="mpros-motor-stat-l">Total captados</div>
    </div>
    <div class="mpros-motor-stat">
      <div class="mpros-motor-stat-n" style="color:#dc2626">${altos.length}</div>
      <div class="mpros-motor-stat-l">🔴 Alto pot.</div>
    </div>
    <div class="mpros-motor-stat">
      <div class="mpros-motor-stat-n" style="color:#d97706">${medios.length}</div>
      <div class="mpros-motor-stat-l">🟡 Médio pot.</div>
    </div>
    <div class="mpros-motor-stat">
      <div class="mpros-motor-stat-n" style="color:#888899">${cfg.ultimaRodada ? _relData(cfg.ultimaRodada) : '—'}</div>
      <div class="mpros-motor-stat-l">Última busca</div>
    </div>
    <div class="mpros-motor-stat">
      <div class="mpros-motor-stat-n" style="color:#888899">${cfg.rodadaNumero || 0}</div>
      <div class="mpros-motor-stat-l">Rodadas</div>
    </div>
  </div>
</div>`;

  // ── Painel de filtros — sempre visível, mesmo com fila vazia ────
  const cidadesDisponiveis = [...new Set(fila.map(l => l.municipio || l.localizacao).filter(Boolean))].sort();
  html += `
<div id="mpros-filtros">
  <div class="mpros-filtro-grupo">
    <label>Ramo</label>
    <select onchange="window.mpros_filtrar('categoria', this.value)">
      <option value="">Todos os ramos</option>
      ${CATEGORIAS.map(c => `<option value="${c.id}" ${_filtros.categoria===c.id?'selected':''}>${c.emoji} ${c.label}</option>`).join('')}
    </select>
  </div>
  <div class="mpros-filtro-grupo">
    <label>Cidade</label>
    <select onchange="window.mpros_filtrar('cidade', this.value)">
      <option value="">Todas as cidades</option>
      ${cidadesDisponiveis.map(c => `<option value="${c}" ${_filtros.cidade===c?'selected':''}>${c}</option>`).join('')}
    </select>
  </div>
  <div class="mpros-filtro-grupo">
    <label>Potencial</label>
    <select onchange="window.mpros_filtrar('potencial', this.value)">
      <option value="">Todos</option>
      <option value="alto"  ${_filtros.potencial==='alto'?'selected':''}>🔴 Alto</option>
      <option value="medio" ${_filtros.potencial==='medio'?'selected':''}>🟡 Médio</option>
    </select>
  </div>
  <div class="mpros-filtro-grupo">
    <label>Tamanho estimado</label>
    <select onchange="window.mpros_filtrar('tamanho', this.value)">
      <option value="">Todos</option>
      <option value="grande" ${_filtros.tamanho==='grande'?'selected':''}>🏢 Grande (50+ pessoas)</option>
      <option value="medio"  ${_filtros.tamanho==='medio'?'selected':''}>🏬 Médio (20–49)</option>
      <option value="pequeno"${_filtros.tamanho==='pequeno'?'selected':''}>🏠 Pequeno (até 19)</option>
    </select>
  </div>
  <button id="mpros-btn-limpar-filtro" onclick="window.mpros_limparFiltros()">✕ Limpar filtros</button>
</div>`;

  // ── Aplica filtros ───────────────────────────────────────────
  let filaFiltrada = fila;
  if (_filtros.categoria) filaFiltrada = filaFiltrada.filter(l => l.categoria === _filtros.categoria);
  if (_filtros.cidade)    filaFiltrada = filaFiltrada.filter(l => (l.municipio || l.localizacao) === _filtros.cidade);
  if (_filtros.potencial) filaFiltrada = filaFiltrada.filter(l => l.potencial === _filtros.potencial);
  if (_filtros.tamanho)   filaFiltrada = filaFiltrada.filter(l => (l.tamanhoEstimado || 'medio') === _filtros.tamanho);

  const temFiltro = Object.values(_filtros).some(v => v !== '');

  if (!fila.length) {
    html += `<div class="mpros-vazio">
      <div class="mpros-vazio-icon">🎯</div>
      <p>Nenhum lead na fila.<br>
      Clique em <strong>"Buscar agora"</strong> para iniciar uma rodada de prospecção<br>
      ou aguarde o motor diário (meia-noite).</p>
    </div>`;
    return html;
  }

  html += `<div class="mpros-filtro-contador">${temFiltro ? `${filaFiltrada.length} de ${fila.length} leads` : `${fila.length} leads na fila`}</div>`;

  if (!filaFiltrada.length) {
    html += `<div class="mpros-vazio">
      <div class="mpros-vazio-icon">🔍</div>
      <p>Nenhum lead encontrado com esses filtros.<br>Tente ampliar os critérios ou <strong>limpar os filtros</strong>.</p>
    </div>`;
    return html;
  }

  // Agrupa por potencial: alto primeiro
  ['alto', 'medio'].forEach(pot => {
    const grupo = filaFiltrada.filter(l => l.potencial === pot);
    if (!grupo.length) return;
    const pc = POTENCIAL_CONFIG[pot];
    html += `
<div class="mpros-secao">
  <div class="mpros-secao-header">
    <div class="mpros-secao-titulo">${pc.emoji} Potencial ${pc.label}</div>
    <span class="mpros-secao-count">${grupo.length}</span>
  </div>
  <div class="mpros-secao-body">
    ${grupo.map(l => _cardLead(l, 'fila')).join('')}
  </div>
</div>`;
  });

  return html;
}

// ════════════════════════════════════════════════════════════════
// ABA: APROVADOS
// ════════════════════════════════════════════════════════════════
function _htmlAprovados() {
  const lista = _leads().filter(l => l.status === 'aprovado');

  if (!lista.length) return `<div class="mpros-vazio">
    <div class="mpros-vazio-icon">✅</div>
    <p>Nenhum lead aprovado ainda.<br>Aprove leads da <strong>Fila do ADM</strong> para que apareçam aqui.</p>
  </div>`;

  return `
<div class="mpros-secao">
  <div class="mpros-secao-header">
    <div class="mpros-secao-titulo">✅ Leads aprovados — aguardando pesquisa e proposta</div>
    <span class="mpros-secao-count">${lista.length}</span>
  </div>
  <div class="mpros-secao-body">
    ${lista.map(l => _cardLead(l, 'aprovado')).join('')}
  </div>
</div>`;
}

// ════════════════════════════════════════════════════════════════
// ABA: PIPELINE
// ════════════════════════════════════════════════════════════════
function _htmlPipeline() {
  const statusPipeline = ['proposta', 'enviado', 'negociando', 'ganho', 'descartado'];

  let html = '';
  statusPipeline.forEach(st => {
    const grupo = _leads().filter(l => l.status === st);
    if (!grupo.length) return;
    const sc = STATUS_CONFIG[st];
    html += `
<div class="mpros-secao">
  <div class="mpros-secao-header">
    <div class="mpros-secao-titulo" style="color:${sc.cor}">${sc.label}</div>
    <span class="mpros-secao-count">${grupo.length}</span>
  </div>
  <div class="mpros-secao-body">
    ${grupo.map(l => _cardLead(l, st)).join('')}
  </div>
</div>`;
  });

  if (!html) return `<div class="mpros-vazio">
    <div class="mpros-vazio-icon">📊</div>
    <p>Pipeline vazio.<br>Aprove leads e gere propostas para acompanhar aqui.</p>
  </div>`;

  return html;
}

// ════════════════════════════════════════════════════════════════
// ABA: RELATÓRIO SEMANAL
// ════════════════════════════════════════════════════════════════
function _htmlRelatorio() {
  const leads = _leads();
  const semana = _semanaISO();

  // Totais gerais
  const total      = leads.length;
  const descartados = leads.filter(l => l.status === 'descartado').length;
  const enviados   = leads.filter(l => ['enviado','negociando','ganho'].includes(l.status)).length;
  const ganhos     = leads.filter(l => l.status === 'ganho').length;
  const txConversao = enviados ? Math.round((ganhos / enviados) * 100) : 0;

  // Leads desta semana
  const desta = leads.filter(l => l.semana === semana);

  let html = `
<div class="mpros-relatorio-grid">
  <div class="mpros-rel-card">
    <div class="mpros-rel-n">${total}</div>
    <div class="mpros-rel-l">Total captados</div>
  </div>
  <div class="mpros-rel-card">
    <div class="mpros-rel-n" style="color:#dc2626">${descartados}</div>
    <div class="mpros-rel-l">Descartados</div>
  </div>
  <div class="mpros-rel-card">
    <div class="mpros-rel-n" style="color:#d97706">${enviados}</div>
    <div class="mpros-rel-l">Propostas enviadas</div>
  </div>
  <div class="mpros-rel-card destaque">
    <div class="mpros-rel-n">${ganhos}</div>
    <div class="mpros-rel-l">Negócios fechados</div>
  </div>
</div>

<div class="mpros-secao" style="margin-bottom:16px">
  <div class="mpros-secao-header">
    <div class="mpros-secao-titulo">📅 Esta semana (${semana}) — ${desta.length} leads</div>
  </div>
  <div class="mpros-secao-body" style="padding:14px 18px">`;

  if (!desta.length) {
    html += `<p style="font-size:13px;color:#888899;margin:0">Nenhum lead captado esta semana ainda.</p>`;
  } else {
    const dFila        = desta.filter(l => l.status === 'fila').length;
    const dAprovados   = desta.filter(l => l.status === 'aprovado').length;
    const dDescartados = desta.filter(l => l.status === 'descartado').length;
    const dEnviados    = desta.filter(l => ['enviado','negociando','ganho'].includes(l.status)).length;
    const dGanhos      = desta.filter(l => l.status === 'ganho').length;
    html += `
<div style="display:flex;gap:20px;flex-wrap:wrap;font-size:13px">
  <span>📥 Na fila: <strong>${dFila}</strong></span>
  <span>✅ Aprovados: <strong>${dAprovados}</strong></span>
  <span>🗑 Descartados: <strong>${dDescartados}</strong></span>
  <span>📤 Enviados: <strong>${dEnviados}</strong></span>
  <span style="color:#16a34a">🏆 Fechados: <strong>${dGanhos}</strong></span>
</div>`;
  }

  html += `</div></div>`;

  // Histórico de semanas anteriores
  const relatorio = (window.DB?.keyoMprosRelatorio || []).slice(-8).reverse();
  if (relatorio.length) {
    html += `
<div class="mpros-secao">
  <div class="mpros-secao-header">
    <div class="mpros-secao-titulo">📋 Histórico semanal</div>
  </div>
  <div class="mpros-secao-body" style="padding:0">
    <table class="mpros-tabela">
      <thead><tr>
        <th>Semana</th><th>Buscados</th><th>Descartados</th>
        <th>Aprovados</th><th>Enviados</th><th>Fechados</th><th>Taxa</th>
      </tr></thead>
      <tbody>
        ${relatorio.map(r => `<tr>
          <td><strong>${r.semana}</strong></td>
          <td>${r.buscados||0}</td>
          <td style="color:#dc2626">${r.descartados||0}</td>
          <td style="color:#2563eb">${r.aprovados||0}</td>
          <td style="color:#d97706">${r.enviados||0}</td>
          <td style="color:#16a34a"><strong>${r.ganhos||0}</strong></td>
          <td>${r.enviados ? Math.round(((r.ganhos||0)/(r.enviados))*100)+'%' : '—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>
</div>`;
  }

  return html;
}

// ════════════════════════════════════════════════════════════════
// ABA: CONFIGURAÇÕES
// ════════════════════════════════════════════════════════════════
function _htmlConfig() {
  const cfg = _config();
  return `
<div class="mpros-secao" style="max-width:600px">
  <div class="mpros-secao-header">
    <div class="mpros-secao-titulo">⚙️ Configurações do Motor</div>
  </div>
  <div class="mpros-secao-body" style="padding:20px">

    <!-- Google Places Key -->
    <div id="mpros-config-box">
      <div>
        <p><strong>🔑 Google Places API (opcional)</strong><br>
        Cole sua chave para ativar buscas com mais dados de contato (telefone, site).<br>
        Sem chave, o sistema usa Nominatim (gratuito).</p>
        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
          <input id="mpros-gkey-input" type="password"
                 placeholder="AIza..."
                 value="${cfg.googlePlacesKey || ''}" />
          <button class="mpros-btn mpros-btn-primary" onclick="window.mpros_salvarGKey()">
            💾 Salvar chave
          </button>
        </div>
        <p style="font-size:11px;margin-top:6px;color:#92400e">
          ${cfg.googlePlacesKey ? '✅ Chave configurada — Google Places ativo' : '⚠️ Sem chave — usando Nominatim gratuito'}
        </p>
      </div>
    </div>

    <!-- Leads por rodada -->
    <div style="margin-bottom:16px">
      <label style="display:block;font-size:12px;font-weight:700;color:#444455;margin-bottom:6px">
        Leads por rodada (máx. por ciclo de busca)
      </label>
      <select id="mpros-max-leads"
              onchange="window.mpros_salvarMaxLeads(this.value)"
              style="background:#f4f4fa;border:1px solid #d8d8e8;border-radius:8px;padding:8px 12px;font-size:13px;font-family:inherit;color:#111118;outline:none">
        ${[5,10,15,20].map(n =>
          `<option value="${n}" ${(cfg.maxLeadsPorRodada||10)===n?'selected':''}>${n} leads</option>`
        ).join('')}
      </select>
      <p style="font-size:11px;color:#888899;margin-top:5px">
        Recomendado: 5–10 por semana para manter qualidade e foco.
      </p>
    </div>

    <!-- Status do motor -->
    <div style="background:#f8f8fc;border-radius:10px;padding:14px;font-size:12px;color:#555566;line-height:1.8">
      <strong>Status do motor:</strong><br>
      ⏰ Próxima execução automática: <strong>hoje à meia-noite</strong><br>
      🔄 Rodadas realizadas: <strong>${cfg.rodadaNumero || 0}</strong><br>
      📅 Última rodada: <strong>${cfg.ultimaRodada ? _relData(cfg.ultimaRodada) : 'nunca'}</strong><br>
      📦 Total de leads captados: <strong>${_leads().length}</strong>
    </div>

  </div>
</div>`;
}

// ════════════════════════════════════════════════════════════════
// CARD DE LEAD (reutilizado em todas as abas)
// ════════════════════════════════════════════════════════════════
function _cardLead(l, contexto) {
  const pc  = POTENCIAL_CONFIG[l.potencial] || POTENCIAL_CONFIG.baixo;
  const cat = CATEGORIAS.find(c => c.id === l.categoria) || { emoji: '🎯', label: l.categoria };
  const sc  = STATUS_CONFIG[l.status] || STATUS_CONFIG.fila;

  // Botões de ação por contexto
  let acoes = '';
  if (contexto === 'fila') {
    acoes = `
      <button class="mpros-btn-mini mpros-btn-ver"     onclick="window.mpros_verLead('${l.id}')">👁 Ver</button>
      <button class="mpros-btn-mini mpros-btn-aprovar" onclick="window.mpros_aprovar('${l.id}')">✅ Aprovar</button>
      <button class="mpros-btn-mini mpros-btn-descartar" onclick="window.mpros_descartar('${l.id}')">🗑</button>`;
  } else if (contexto === 'aprovado') {
    acoes = `
      <button class="mpros-btn-mini mpros-btn-ver"      onclick="window.mpros_verLead('${l.id}')">👁 Ver</button>
      <button class="mpros-btn-mini mpros-btn-proposta" onclick="window.mpros_gerarProposta('${l.id}')">📋 Gerar proposta</button>`;
  } else if (contexto === 'proposta') {
    acoes = `
      <button class="mpros-btn-mini mpros-btn-ver"  onclick="window.mpros_verLead('${l.id}')">👁 Ver</button>
      <button class="mpros-btn-mini mpros-btn-wpp"  onclick="window.mpros_enviarWpp('${l.id}')">💬 Enviar WPP</button>`;
  } else if (contexto === 'enviado' || contexto === 'negociando') {
    acoes = `
      <button class="mpros-btn-mini mpros-btn-ver"   onclick="window.mpros_verLead('${l.id}')">👁 Ver</button>
      <button class="mpros-btn-mini mpros-btn-ganho" onclick="window.mpros_marcarGanho('${l.id}')">🏆 Fechou!</button>`;
  } else {
    acoes = `<button class="mpros-btn-mini mpros-btn-ver" onclick="window.mpros_verLead('${l.id}')">👁 Ver</button>`;
  }

  return `
<div class="mpros-lead-card">
  <div class="mpros-lead-pot" style="background:${pc.bg}">
    ${pc.emoji}
  </div>
  <div class="mpros-lead-corpo">
    <div class="mpros-lead-titulo">${_sanStr(l.titulo || l.nome || '—')}</div>
    <div class="mpros-lead-sub">${_sanStr(l.localizacao || l.municipio || '')}${l.uf ? ' · ' + l.uf : ''}</div>
    <div class="mpros-lead-tags">
      <span class="mpros-tag" style="background:${cat.emoji?'#f4f4fa':'#f4f4fa'};color:#555566">
        ${cat.emoji} ${cat.label}
      </span>
      <span class="mpros-tag" style="background:${sc.bg};color:${sc.cor}">
        ${sc.label}
      </span>
      ${l.fonte ? `<span class="mpros-tag" style="background:#f0f0fa;color:#7c3aed">📡 ${l.fonte}</span>` : ''}
    </div>
    <div class="mpros-lead-score">Score: ${l.score || 0}/100 · ${_sanStr(l.justificativa || '').substring(0,60)}${(l.justificativa||'').length>60?'…':''}</div>
  </div>
  <div class="mpros-lead-acoes">${acoes}</div>
</div>`;
}

// ════════════════════════════════════════════════════════════════
// HELPERS UI
// ════════════════════════════════════════════════════════════════
function _atualizarAbas() {
  const fila      = _leads().filter(l => l.status === 'fila').length;
  const aprovados = _leads().filter(l => l.status === 'aprovado').length;
  const pipeline  = _leads().filter(l => ['proposta','enviado','negociando'].includes(l.status)).length;
  const bf = document.getElementById('mpros-badge-fila');
  const ba = document.getElementById('mpros-badge-aprovados');
  const bp = document.getElementById('mpros-badge-pipeline');
  if (bf) { bf.textContent = fila;      bf.className = 'mpros-tab-badge' + (fila===0?' zero':''); }
  if (ba) { ba.textContent = aprovados; ba.className = 'mpros-tab-badge' + (aprovados===0?' zero':''); }
  if (bp) { bp.textContent = pipeline;  bp.className = 'mpros-tab-badge' + (pipeline===0?' zero':''); }
}

function _atualizarMotorBadge() {
  const ativo  = _config().ativo !== false;
  const badge  = document.getElementById('mpros-motor-badge');
  const btnTog = document.getElementById('mpros-btn-toggle');
  if (badge) {
    badge.className = 'mpros-motor-badge ' + (ativo ? 'ativo' : 'pausado');
    badge.textContent = ativo ? '● Motor ativo' : '● Motor pausado';
  }
  if (btnTog) btnTog.textContent = ativo ? '⏸ Pausar motor' : '▶ Retomar motor';
}

function _sanStr(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function _relData(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}) + ' ' +
           d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  } catch(e) { return iso; }
}

// ════════════════════════════════════════════════════════════════
// AÇÕES DO ADM (stubs — implementação nas próximas etapas)
// ════════════════════════════════════════════════════════════════

function _toggleMotor() {
  const cfg = _config();
  cfg.ativo = !cfg.ativo;
  if (typeof window.sDB === 'function') window.sDB();
  window.toast(cfg.ativo ? '▶ Motor de prospecção retomado!' : '⏸ Motor pausado.', 'ok');
  _atualizarMotorBadge();
  // Reinicia agendamento se ativado
  if (cfg.ativo) _agendarMotor();
}

function _salvarGKey() {
  const val = (document.getElementById('mpros-gkey-input')?.value || '').trim();
  _config().googlePlacesKey = val;
  if (typeof window.sDB === 'function') window.sDB();
  window.toast(val ? '🔑 Chave Google Places salva!' : '🔑 Chave removida — usando Nominatim.', 'ok');
  _renderAba('config');
}

function _salvarMaxLeads(val) {
  _config().maxLeadsPorRodada = Number(val) || 10;
  if (typeof window.sDB === 'function') window.sDB();
  window.toast(`✅ Máximo de ${val} leads por rodada salvo.`, 'ok');
}

// ── Filtros de prospecção ────────────────────────────────────────
function _filtrar(campo, valor) {
  _filtros[campo] = valor;
  _renderAba('fila');
}

function _limparFiltros() {
  _filtros = { categoria: '', cidade: '', potencial: '', tamanho: '' };
  _renderAba('fila');
}

function _aprovar(id) {
  const lead = _leads().find(l => l.id === id);
  if (!lead) return;
  if (!confirm(`Aprovar o lead "${lead.titulo || lead.nome}"?\n\nEle irá para a fila de pesquisa e geração de proposta.`)) return;
  lead.status     = 'aprovado';
  lead.aprovadoEm = new Date().toISOString();
  if (typeof window.sDB === 'function') window.sDB();
  window.toast(`✅ Lead aprovado! Gere a proposta na aba "Aprovados".`, 'ok');
  _atualizarAbas();
  _renderAba(_abaAtiva);
}

function _descartar(id) {
  const lead = _leads().find(l => l.id === id);
  if (!lead) return;
  if (!confirm(`Descartar o lead "${lead.titulo || lead.nome}"?\n\nEle será movido para o histórico.`)) return;
  lead.status      = 'descartado';
  lead.descartadoEm = new Date().toISOString();
  if (typeof window.sDB === 'function') window.sDB();
  window.toast('🗑 Lead descartado.', 'ok');
  _atualizarAbas();
  _renderAba(_abaAtiva);
}

function _marcarGanho(id) {
  const lead = _leads().find(l => l.id === id);
  if (!lead) return;
  if (!confirm(`Marcar "${lead.titulo || lead.nome}" como GANHO?\n\nNegócio fechado! 🏆`)) return;
  lead.status    = 'ganho';
  lead.fechadoEm = new Date().toISOString();
  if (typeof window.sDB === 'function') window.sDB();
  window.toast('🏆 Negócio fechado! Parabéns!', 'ok');
  _atualizarAbas();
  _renderAba(_abaAtiva);
}

function _enviarWpp(id) {
  const lead = _leads().find(l => l.id === id);
  if (!lead) return;
  const tel  = (lead.contato?.whatsapp || '').replace(/\D/g,'');
  const msg  = `Olá! Somos da EXIT GAMES, a maior rede de escape rooms do nordeste. Identificamos que vocês podem ter interesse em uma experiência única para sua equipe. Podemos conversar?`;
  if (tel) {
    window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`, '_blank');
    lead.status    = 'enviado';
    lead.enviadoEm = new Date().toISOString();
    if (typeof window.sDB === 'function') window.sDB();
    _atualizarAbas();
    _renderAba(_abaAtiva);
  } else {
    window.toast('⚠️ Lead sem número de WhatsApp cadastrado.', 'warn');
  }
}

// Modal de detalhes do lead
function _verLead(id) {
  const lead = _leads().find(l => l.id === id);
  if (!lead) return;
  const pc  = POTENCIAL_CONFIG[lead.potencial] || POTENCIAL_CONFIG.baixo;
  const sc  = STATUS_CONFIG[lead.status] || STATUS_CONFIG.fila;
  const cat = CATEGORIAS.find(c => c.id === lead.categoria) || { emoji:'🎯', label: lead.categoria };

  const existe = document.getElementById('mpros-modal-overlay');
  if (existe) existe.remove();

  const overlay = document.createElement('div');
  overlay.id = 'mpros-modal-overlay';
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = `
<div id="mpros-modal">
  <h3>${pc.emoji} ${_sanStr(lead.titulo || lead.nome)}</h3>
  <div class="mpros-modal-sub">
    ${cat.emoji} ${cat.label} &nbsp;·&nbsp;
    <span style="color:${sc.cor};font-weight:600">${sc.label}</span> &nbsp;·&nbsp;
    Score: <strong>${lead.score||0}/100</strong> &nbsp;·&nbsp;
    <span style="color:${pc.cor};font-weight:600">Potencial ${pc.label}</span>
  </div>

  <div class="mpros-modal-campo">
    <label>Descrição / Objeto</label>
    <p>${_sanStr(lead.descricao || '—')}</p>
  </div>

  <div class="mpros-modal-campo">
    <label>Justificativa de potencial</label>
    <p>${_sanStr(lead.justificativa || '—')}</p>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
    <div class="mpros-modal-campo">
      <label>Localização</label>
      <p>${_sanStr(lead.localizacao || lead.municipio || '—')}${lead.uf ? ' — ' + lead.uf : ''}</p>
    </div>
    <div class="mpros-modal-campo">
      <label>Fonte</label>
      <p>${_sanStr(lead.fonte || '—')}</p>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
    <div class="mpros-modal-campo">
      <label>WhatsApp / Telefone</label>
      <p>${_sanStr(lead.contato?.whatsapp || lead.contato?.telefone || '—')}</p>
    </div>
    <div class="mpros-modal-campo">
      <label>E-mail</label>
      <p>${_sanStr(lead.contato?.email || '—')}</p>
    </div>
  </div>

  ${lead.contato?.site ? `<div class="mpros-modal-campo">
    <label>Site</label>
    <p><a href="${_sanStr(lead.contato.site)}" target="_blank" style="color:#2563eb">${_sanStr(lead.contato.site)}</a></p>
  </div>` : ''}

  <div class="mpros-modal-campo">
    <label>Captado em</label>
    <p>${_relData(lead.criadoEm)} · Rodada #${lead.rodada||'—'} · Semana ${lead.semana||'—'}</p>
  </div>

  <div class="mpros-modal-footer">
    ${lead.status === 'fila' ? `
      <button class="mpros-btn mpros-btn-primary" onclick="document.getElementById('mpros-modal-overlay').remove();window.mpros_aprovar('${lead.id}')">✅ Aprovar</button>
      <button class="mpros-btn mpros-btn-danger"  onclick="document.getElementById('mpros-modal-overlay').remove();window.mpros_descartar('${lead.id}')">🗑 Descartar</button>
    ` : ''}
    ${lead.status === 'aprovado' ? `
      <button class="mpros-btn mpros-btn-primary" onclick="document.getElementById('mpros-modal-overlay').remove();window.mpros_gerarProposta('${lead.id}')">📋 Gerar Proposta</button>
    ` : ''}
    <button class="mpros-btn mpros-btn-secondary" onclick="document.getElementById('mpros-modal-overlay').remove()">Fechar</button>
  </div>
</div>`;
  document.body.appendChild(overlay);
}

// Stub para geração de proposta (implementado na Etapa 7.5)
function _gerarProposta(id) {
  window.toast('⏳ Pesquisando lead e gerando proposta com IA...', 'info');
  // Implementação na Etapa 7.5
  setTimeout(() => {
    window.toast('🚧 Geração de proposta — disponível na próxima etapa.', 'warn');
  }, 1500);
}



// ════════════════════════════════════════════════════════════════
// ETAPA 7.2 — MOTOR DE BUSCA REAL
// Fontes: Nominatim/OSM · Google Places (opcional) · PNCP (licitações)
// Scoring: via Supabase Edge Function (super-action) com IA
// ════════════════════════════════════════════════════════════════

// ── Agendamento diário (meia-noite) ─────────────────────────────
let _motorTimer = null;

function _agendarMotor() {
  if (_motorTimer) clearTimeout(_motorTimer);
  if (_config().ativo === false) return;

  const agora     = new Date();
  const meianoite = new Date(agora);
  meianoite.setHours(24, 0, 0, 0);

  const ms = meianoite - agora;
  _motorTimer = setTimeout(async function () {
    if (_config().ativo !== false) {
      console.info('[KEYO-07] 🌙 Motor noturno iniciando rodada automática...');
      await _rodarAgora(true);
    }
    _agendarMotor();
  }, ms);

  console.info(`[KEYO-07] ⏰ Próxima rodada automática em ${Math.round(ms / 3600000)}h`);
}

// ── Helpers de progresso ─────────────────────────────────────────
function _setProgress(pct) {
  const fill = document.getElementById('mpros-progress-fill');
  if (fill) fill.style.width = pct + '%';
}
function _showProgress() {
  const bar = document.getElementById('mpros-progress-bar');
  if (bar) { bar.style.display = 'block'; _setProgress(5); }
}
function _hideProgress() {
  const bar = document.getElementById('mpros-progress-bar');
  _setProgress(100);
  setTimeout(() => { if (bar) bar.style.display = 'none'; _setProgress(0); }, 700);
}

// ── Deduplicação ─────────────────────────────────────────────────
// Evita inserir leads com mesmo nome/CNPJ já existentes em DB.keyoLeads
function _isDuplicado(lead) {
  const existentes = _leads();
  const nome = (lead.titulo || lead.nome || '').toLowerCase().trim();
  const cnpj = (lead.cnpj || '').replace(/\D/g, '');
  return existentes.some(e => {
    const eNome = (e.titulo || e.nome || '').toLowerCase().trim();
    const eCnpj = (e.cnpj || '').replace(/\D/g, '');
    if (cnpj && eCnpj && cnpj === eCnpj) return true;
    if (nome && eNome && eNome === nome) return true;
    return false;
  });
}

// ── Scoring com IA (Supabase Edge Function) ──────────────────────
// Envia lote de leads brutos e recebe score/potencial/justificativa
async function _scorarLote(leadesBrutos) {
  if (!leadesBrutos.length) return [];

  const SUPA_URL = 'https://utivaczfuuazspychdxt.supabase.co/functions/v1/super-action';
  const token    = _jwt();

  const promptSistema = `Você é o agente de scoring do KEYO, sistema de prospecção da EXIT GAMES (rede de escape rooms em Aracaju/SE e Salvador/BA).
Para cada lead recebido, avalie o potencial comercial para venda de experiências de escape room (team building, confraternização, eventos corporativos, escolas, competições).

Responda SOMENTE com um array JSON válido, sem markdown, sem texto fora do JSON.
Cada item do array deve ter exatamente estes campos:
  "idx": número do índice (0-based, igual ao recebido),
  "score": número de 0 a 100 (quanto maior, maior potencial),
  "potencial": "alto" | "medio" | "baixo",
  "tamanhoEstimado": "grande" | "medio" | "pequeno",
  "justificativa": string curta (até 100 caracteres) explicando o score.

Critérios de tamanho:
  "grande": 50+ pessoas (empresas grandes, faculdades, órgãos públicos, federações)
  "medio": 20–49 pessoas (empresas médias, colégios, associações)
  "pequeno": até 19 pessoas (pequenas empresas, estúdios, etc.)

Critérios de alto potencial (score 70-100):
- Empresas com 50+ funcionários (team building)
- Escolas / colégios / faculdades (grupos)
- Prefeituras / órgãos públicos com licitações abertas
- Federações, sindicatos, associações (eventos)
- SEBRAE, SENAC, SESC (cursos + eventos)

Critérios de médio (40-69): empresas menores, eventos genéricos, sem dados claros de tamanho.
Critérios de baixo (0-39): sem relevância óbvia para escape room, sem dados de contato, muito distante.`;

  const promptUsuario = `Avalie estes leads e retorne SOMENTE o array JSON:\n${JSON.stringify(
    leadesBrutos.map((l, i) => ({
      idx: i,
      titulo: l.titulo || l.nome,
      categoria: l.categoria,
      descricao: l.descricao,
      localizacao: l.localizacao || l.municipio,
      uf: l.uf,
      contato: l.contato,
    }))
  )}`;

  try {
    const resp = await fetch(SUPA_URL, {
      method: 'POST',
      headers: _keyoHeaders(),
      body: JSON.stringify({
        agente:     'mkt',                          // agente comercial (mesmo do m14)
        mensagem:   `${promptSistema}\n\n${promptUsuario}`,
        historico:  [],
        unidade_id: window.UA?.unidadeId || 1,
      }),
    });

    if (!resp.ok) throw new Error(`Supabase HTTP ${resp.status}`);
    const data = await resp.json();

    // super-action devolve o texto da IA em data.resposta
    let texto = (data && data.resposta) ? data.resposta : '';
    if (!texto && Array.isArray(data?.content)) texto = data.content.map(c => c.text || '').join('');

    // Remove possíveis blocos markdown
    texto = texto.replace(/```json|```/gi, '').trim();

    const scores = JSON.parse(texto);
    if (!Array.isArray(scores)) throw new Error('Resposta não é array');

    // Mescla de volta nos leads brutos
    return leadesBrutos.map((lead, i) => {
      const s = scores.find(x => x.idx === i) || {};
      return Object.assign({}, lead, {
        score:           Number(s.score)      || 30,
        potencial:       ['alto','medio','baixo'].includes(s.potencial) ? s.potencial : 'baixo',
        tamanhoEstimado: ['grande','medio','pequeno'].includes(s.tamanhoEstimado) ? s.tamanhoEstimado : 'medio',
        justificativa:   s.justificativa     || '',
      });
    });
  } catch (err) {
    console.warn('[KEYO-07] ⚠️ Scoring IA falhou, usando padrão baixo:', err.message);
    // Fallback: scoring básico local
    return leadesBrutos.map(lead => Object.assign({}, lead, {
      score:        lead.categoria === 'licitacao' ? 65 : 30,
      potencial:    lead.categoria === 'licitacao' ? 'medio' : 'baixo',
      justificativa: 'Scoring automático (IA indisponível)',
    }));
  }
}

// ════════════════════════════════════════════════════════════════
// PROXY — todas as chamadas externas passam pela Edge Function
// keyo-proxy para evitar bloqueio de CSP do exitsystem.net
// ════════════════════════════════════════════════════════════════
const PROXY_URL = 'https://utivaczfuuazspychdxt.supabase.co/functions/v1/dynamic-api';

async function _proxy(source, params) {
  const token = _jwt();
  const resp = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ source, params }),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => resp.status);
    throw new Error(`keyo-proxy [${source}] HTTP ${resp.status}: ${txt}`);
  }
  return resp.json();
}

// ════════════════════════════════════════════════════════════════
// FONTE 1: NOMINATIM / OpenStreetMap  (via proxy)
// ════════════════════════════════════════════════════════════════
async function _buscarNominatim() {
  const leads = [];

  const TERMOS = [
    'escola', 'colegio', 'faculdade', 'universidade',
    'empresa', 'escritorio', 'sindicato', 'associacao',
    'federacao', 'clube', 'sebrae', 'senac', 'sesc',
  ];
  const CIDADES = [
    { lat: '-10.9472', lon: '-37.0731', label: 'Aracaju', uf: 'SE', unidadeId: '1' },
    { lat: '-12.9714', lon: '-38.5014', label: 'Salvador', uf: 'BA', unidadeId: '2' },
  ];

  // 2 termos aleatórios por rodada para variar os resultados
  const termosSelecionados = TERMOS.sort(() => Math.random() - 0.5).slice(0, 2);

  for (const cidade of CIDADES) {
    for (const termo of termosSelecionados) {
      try {
        const data = await _proxy('nominatim', {
          query: `${termo} ${cidade.label}`,
          lat:   cidade.lat,
          lon:   cidade.lon,
          limit: '5',
        });

        for (const item of (data.results || [])) {
          if (!item.display_name) continue;
          const nome = item.namedetails?.name || item.display_name.split(',')[0];

          let categoria = 'empresa_regional';
          const tipo = (item.type || '') + ' ' + (item.class || '');
          if (/school|college|university|educa/i.test(tipo)) categoria = 'escola';
          else if (/association|club|federation/i.test(tipo)) categoria = 'federacao';

          leads.push({
            id:          window.uid ? window.uid() : ('nom_' + Math.random().toString(36).slice(2)),
            titulo:      nome,
            tipo:        item.type || 'place',
            categoria,
            descricao:   item.display_name,
            fonte:       'Nominatim/OSM',
            contato: {
              site:     item.extratags?.website || '',
              whatsapp: item.extratags?.phone   || '',
              email:    item.extratags?.email   || '',
            },
            localizacao: cidade.label,
            uf:          cidade.uf,
            municipio:   cidade.label,
            unidadeId:   cidade.unidadeId,
            semana:      _semanaISO(),
            rodada:      (_config().rodadaNumero || 0) + 1,
            status:      'fila',
            criadoEm:    new Date().toISOString(),
          });
        }
        // Pequena pausa entre chamadas ao proxy
        await new Promise(r => setTimeout(r, 300));
      } catch (e) {
        console.warn(`[KEYO-07] Nominatim proxy falhou (${termo}/${cidade.label}):`, e.message);
      }
    }
  }

  console.info(`[KEYO-07] 📍 Nominatim: ${leads.length} resultados brutos`);
  return leads;
}

// ════════════════════════════════════════════════════════════════
// FONTE 2: GOOGLE PLACES (opcional — só se chave configurada)  (via proxy)
// ════════════════════════════════════════════════════════════════
async function _buscarGooglePlaces() {
  const cfg = _config();
  if (!cfg.googlePlacesKey) return [];

  const leads = [];
  const KEY   = cfg.googlePlacesKey;
  const TIPOS = ['school', 'university', 'establishment'];
  const CIDADES = [
    { lat: '-10.9472', lon: '-37.0731', label: 'Aracaju', uf: 'SE', unidadeId: '1' },
    { lat: '-12.9714', lon: '-38.5014', label: 'Salvador', uf: 'BA', unidadeId: '2' },
  ];

  for (const cidade of CIDADES) {
    for (const tipo of TIPOS.slice(0, 2)) {
      try {
        const data = await _proxy('google_places', {
          key: KEY, lat: cidade.lat, lon: cidade.lon,
          type: tipo, radius: '8000',
        });

        if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
          console.warn('[KEYO-07] Google Places status:', data.status);
          continue;
        }

        for (const place of (data.results || []).slice(0, 4)) {
          let contato = { site: '', whatsapp: '', email: '' };
          try {
            const det = await _proxy('google_details', { key: KEY, place_id: place.place_id });
            contato.whatsapp = det.result?.formatted_phone_number || '';
            contato.site     = det.result?.website || '';
          } catch (_) { /* ignora detalhes se falhar */ }

          let categoria = 'empresa_regional';
          if (/school|university/i.test(tipo)) categoria = 'escola';

          leads.push({
            id:          window.uid ? window.uid() : ('gpl_' + Math.random().toString(36).slice(2)),
            titulo:      place.name,
            tipo,
            categoria,
            descricao:   place.vicinity || '',
            fonte:       'Google Places',
            contato,
            localizacao: cidade.label,
            uf:          cidade.uf,
            municipio:   cidade.label,
            unidadeId:   cidade.unidadeId,
            semana:      _semanaISO(),
            rodada:      (_config().rodadaNumero || 0) + 1,
            status:      'fila',
            criadoEm:    new Date().toISOString(),
          });

          await new Promise(r => setTimeout(r, 200));
        }
      } catch (e) {
        console.warn(`[KEYO-07] Google Places proxy falhou (${tipo}/${cidade.label}):`, e.message);
      }
    }
  }

  console.info(`[KEYO-07] 🗺️ Google Places: ${leads.length} resultados brutos`);
  return leads;
}

// ════════════════════════════════════════════════════════════════
// FONTE 3: PNCP — Portal Nacional de Contratações Públicas  (via proxy)
// ════════════════════════════════════════════════════════════════
async function _buscarPNCP() {
  const leads = [];
  const TERMOS_FILTRO = ['evento', 'confraterniza', 'capacita', 'treinamento', 'lazer', 'cultural'];
  const UFS = ['SE', 'BA'];

  // PNCP exige codigoModalidadeContratacao (obrigatório, 1 por chamada)
  // 6 = Pregão Eletrônico · 8 = Dispensa de Licitação
  const MODALIDADES = [6, 8];

  for (const uf of UFS) {
    for (const modalidade of MODALIDADES) {
      try {
        const hoje    = new Date();
        const dataFim = hoje.toISOString().slice(0, 10).replace(/-/g, '');
        const dataIni = new Date(hoje - 30 * 86400000).toISOString().slice(0, 10).replace(/-/g, '');

        const data = await _proxy('pncp', {
          uf,
          dataInicial: dataIni,
          dataFinal:   dataFim,
          codigoModalidadeContratacao: modalidade,   // ← parâmetro obrigatório do PNCP
          pagina: '1',
          tamanhoPagina: '20',
        });

        // PNCP pode retornar { data: [...] } ou array direto
        const itens = data.data || data.content || (Array.isArray(data) ? data : []);

        for (const item of itens.slice(0, 10)) {
          const objeto = (item.objetoCompra || item.descricao || '').toLowerCase();
          if (!TERMOS_FILTRO.some(t => objeto.includes(t))) continue;

          const orgao     = item.orgaoEntidade?.razaoSocial || item.nomeUnidadeOrgao || 'Órgão Público';
          const municipio = item.municipioNome || item.municipio || (uf === 'SE' ? 'Aracaju' : 'Salvador');

          leads.push({
            id:          window.uid ? window.uid() : ('pncp_' + Math.random().toString(36).slice(2)),
            titulo:      `[Licitação] ${orgao}`,
            tipo:        'licitacao',
            categoria:   'licitacao',
            descricao:   item.objetoCompra || item.descricao || '',
            fonte:       'PNCP',
            cnpj:        item.orgaoEntidade?.cnpj || '',
            contato: {
              site:     item.linkSistemaOrigem || 'https://pncp.gov.br',
              whatsapp: '',
              email:    '',
            },
            localizacao:    municipio,
            uf,
            municipio,
            unidadeId:      uf === 'SE' ? '1' : '2',
            semana:         _semanaISO(),
            rodada:         (_config().rodadaNumero || 0) + 1,
            status:         'fila',
            criadoEm:       new Date().toISOString(),
            pncpNumero:     item.numeroControlePNCP || '',
            valorEstimado:  item.valorTotalEstimado || 0,
          });
        }
        await new Promise(r => setTimeout(r, 300));
      } catch (e) {
        console.warn(`[KEYO-07] PNCP proxy falhou (${uf}/mod${modalidade}):`, e.message);
      }
    }
  }

  console.info(`[KEYO-07] 🏛️ PNCP: ${leads.length} licitações relevantes`);
  return leads;
}

// ════════════════════════════════════════════════════════════════
// MOTOR PRINCIPAL — _rodarAgora
// ════════════════════════════════════════════════════════════════
async function _rodarAgora(silencioso = false) {
  const cfg = _config();
  if (cfg.ativo === false && !silencioso) {
    window.toast('⏸ Motor pausado. Retome primeiro.', 'warn');
    return;
  }

  const btnRodar = document.getElementById('mpros-btn-rodar');
  if (btnRodar) { btnRodar.disabled = true; btnRodar.textContent = '⏳ Buscando...'; }

  _showProgress();
  if (!silencioso) window.toast('🔍 Iniciando rodada de prospecção...', 'info');

  try {
    // ── FASE 1: Buscas em paralelo (Nominatim + Google + PNCP) ───
    _setProgress(15);
    if (!silencioso) window.toast('📡 Buscando em Nominatim, Google Places e PNCP...', 'info');

    const [leadsNominatim, leadsGoogle, leadsPNCP] = await Promise.all([
      _buscarNominatim(),
      _buscarGooglePlaces(),
      _buscarPNCP(),
    ]);

    _setProgress(50);

    // ── FASE 2: Mescla e deduplicação ────────────────────────────
    let todosBrutos = [...leadsNominatim, ...leadsGoogle, ...leadsPNCP];

    // Remove duplicatas entre si (pelo título)
    const vistos = new Set();
    todosBrutos = todosBrutos.filter(l => {
      const chave = (l.titulo || l.nome || '').toLowerCase().trim();
      if (!chave || vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    });

    // Remove leads já existentes no DB
    todosBrutos = todosBrutos.filter(l => !_isDuplicado(l));

    // Respeita limite da rodada
    const max = cfg.maxLeadsPorRodada || 10;
    todosBrutos = todosBrutos.slice(0, max);

    console.info(`[KEYO-07] 🔎 ${todosBrutos.length} leads únicos após deduplicação`);

    if (!todosBrutos.length) {
      if (!silencioso) window.toast('ℹ️ Nenhum lead novo encontrado nesta rodada.', 'info');
      cfg.ultimaRodada = new Date().toISOString();
      cfg.rodadaNumero = (cfg.rodadaNumero || 0) + 1;
      if (typeof window.sDB === 'function') window.sDB();
      _hideProgress();
      if (document.getElementById('mpros-wrap')) { _atualizarAbas(); _renderAba(_abaAtiva); }
      return;
    }

    // ── FASE 3: Scoring com IA ───────────────────────────────────
    _setProgress(65);
    if (!silencioso) window.toast('🤖 Avaliando potencial dos leads com IA...', 'info');

    const leadsComScore = await _scorarLote(todosBrutos);

    // ── FASE 4: Filtra só médio e alto (descarta baixo automaticamente) ──
    _setProgress(85);
    const leadsFiltrados = leadsComScore.filter(l => l.potencial !== 'baixo');
    const descartadosAuto = leadsComScore.length - leadsFiltrados.length;

    // ── FASE 5: Salva no DB ──────────────────────────────────────
    for (const lead of leadsFiltrados) {
      window.DB.keyoLeads.push(lead);
    }

    cfg.ultimaRodada = new Date().toISOString();
    cfg.rodadaNumero = (cfg.rodadaNumero || 0) + 1;
    cfg.leadsHoje    = (cfg.leadsHoje || 0) + leadsFiltrados.length;

    if (typeof window.sDB === 'function') window.sDB();

    _hideProgress();

    const altos  = leadsFiltrados.filter(l => l.potencial === 'alto').length;
    const medios = leadsFiltrados.filter(l => l.potencial === 'medio').length;

    if (!silencioso) {
      window.toast(
        `✅ Rodada #${cfg.rodadaNumero} concluída! ` +
        `${leadsFiltrados.length} leads: 🔴${altos} altos · 🟡${medios} médios · ` +
        `${descartadosAuto} descartados automaticamente.`,
        'ok'
      );
    }

    console.info(
      `[KEYO-07] ✅ Rodada #${cfg.rodadaNumero}: ` +
      `${leadsComScore.length} avaliados → ${leadsFiltrados.length} salvos ` +
      `(${altos} alto / ${medios} medio / ${descartadosAuto} descartados auto)`
    );

    // Atualiza UI se estiver visível
    if (document.getElementById('mpros-wrap')) {
      _atualizarAbas();
      _renderAba(_abaAtiva);
    }

  } catch (err) {
    console.error('[KEYO-07] ❌ Erro crítico no motor:', err);
    if (!silencioso) window.toast('❌ Erro na rodada. Verifique o console.', 'error');
    _hideProgress();
  } finally {
    if (btnRodar) { btnRodar.disabled = false; btnRodar.textContent = '🔍 Buscar agora'; }
  }
}

// ════════════════════════════════════════════════════════════════
// FUNÇÃO CRIAÇÃO — O CIENTISTA PROJETA SALAS DE ESCAPE
// (cérebro embutido no navegador; usa o mesmo canal de IA do scoring)
// ════════════════════════════════════════════════════════════════
let _salaAtual = null;       // projeto em exibição (transitório)
let _criandoSala = false;

function _salas() { return Array.isArray(window.DB?.keyoSalas) ? window.DB.keyoSalas : []; }

const TEMAS_CRIACAO = [
  'Terror', 'Suspense / Mistério', 'Ação / Espionagem', 'Aventura / Tesouro',
  'Ficção científica', 'Fantasia / Medieval', 'Crime / Investigação', 'Histórico',
];

// ── Escape de HTML ───────────────────────────────────────────────
function _esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Conversor markdown-simples → HTML (robusto a texto cortado) ──
function _md2html(txt) {
  const linhas = _esc(txt).split('\n');
  let html = '', emLista = false;
  const fecharLista = () => { if (emLista) { html += '</ul>'; emLista = false; } };
  for (let linha of linhas) {
    let l = linha.trim();
    if (!l) { fecharLista(); continue; }
    l = l.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    if (l.startsWith('### '))      { fecharLista(); html += `<h3>${l.slice(4)}</h3>`; }
    else if (l.startsWith('## '))  { fecharLista(); html += `<h2>${l.slice(3)}</h2>`; }
    else if (l.startsWith('# '))   { fecharLista(); html += `<h1>${l.slice(2)}</h1>`; }
    else if (l.startsWith('- ') || l.startsWith('* ')) {
      if (!emLista) { html += '<ul>'; emLista = true; }
      html += `<li>${l.slice(2)}</li>`;
    } else { fecharLista(); html += `<p>${l}</p>`; }
  }
  fecharLista();
  return html;
}

// ── HTML da aba Criação ──────────────────────────────────────────
function _htmlCriacao() {
  const salas = _salas();
  const opTemas = TEMAS_CRIACAO.map(t => `<option value="${_esc(t)}">${_esc(t)}</option>`).join('');

  let listaHtml = '';
  if (salas.length) {
    listaHtml = '<h3 class="cri-titulo" style="margin-top:8px">📁 Salas criadas</h3>' +
      salas.slice().reverse().map(s => `
        <div class="cri-lista-item">
          <div>
            <div class="cri-lista-nome">${_esc(s.titulo)}</div>
            <div class="cri-lista-meta">${_esc(s.tema)} · ${s.tempoMin} min · ${_esc(s.jogadores)} jogadores · ${_esc(s.dificuldade)}</div>
          </div>
          <div class="cri-lista-acoes">
            <button class="mpros-btn mpros-btn-secondary" onclick="window.mpros_verSala('${s.id}')">👁 Ver</button>
            <button class="mpros-btn mpros-btn-secondary" onclick="window.mpros_imprimirSala('${s.id}')">🖨️ Imprimir</button>
            <button class="mpros-btn mpros-btn-danger" onclick="window.mpros_excluirSala('${s.id}')">🗑</button>
          </div>
        </div>`).join('');
  }

  return `
<div class="cri-painel">
  <h3 class="cri-titulo">🔬 Criar projeto de sala de escape</h3>
  <p class="cri-sub">Escolha o tema e os parâmetros. O Cientista monta o projeto completo com pesquisa aprofundada, puzzles detalhados e fontes de referência.</p>
  <div class="cri-form">
    <div class="cri-campo">
      <label>Tema</label>
      <select id="cri-tema">${opTemas}</select>
    </div>
    <div class="cri-campo">
      <label>Duração do jogo (minutos)</label>
      <input type="number" id="cri-tempo" value="60" min="15" max="240" step="5" placeholder="Ex: 60">
    </div>
    <div class="cri-campo">
      <label>Jogadores</label>
      <input type="text" id="cri-jogadores" value="3 a 6" placeholder="Ex: 2 a 6, ou 4 pessoas">
    </div>
    <div class="cri-campo">
      <label>Dificuldade</label>
      <select id="cri-dificuldade">
        <option value="Fácil">Fácil</option>
        <option value="Média" selected>Média</option>
        <option value="Difícil">Difícil</option>
        <option value="Elite">Elite</option>
      </select>
    </div>
    <div class="cri-campo">
      <label>Quantidade de puzzles</label>
      <input type="number" id="cri-puzzles" value="0" min="0" max="20" step="1" placeholder="0 = automático pela duração">
      <span style="font-size:10px;color:#888899;margin-top:3px">0 = calculado pela duração (1 a cada 8–10 min)</span>
    </div>
    <div class="cri-campo full">
      <label>Pedido especial (opcional)</label>
      <textarea id="cri-instrucoes" placeholder="Ex: usar um cofre de verdade, incluir um momento de susto, tema baseado em um hospital abandonado..."></textarea>
    </div>
  </div>
  <div class="cri-actions">
    <button class="mpros-btn mpros-btn-primary" id="cri-btn-criar" onclick="window.mpros_criarSala()">🔬 Criar projeto da sala</button>
  </div>
</div>

<div id="cri-resultado">${_salaAtual ? _renderProjeto(_salaAtual) : ''}</div>

${listaHtml}
`;
}

// ── O "cérebro" do Cientista (instruções) ────────────────────────
function _promptCientista(dados, projetoAnterior, pedidoAjuste) {
  const numPuzzles = dados && dados.numPuzzles && Number(dados.numPuzzles) > 0
    ? `EXATAMENTE ${dados.numPuzzles} puzzles`
    : `aproximadamente ${dados ? Math.max(3, Math.round(Number(dados.tempoMin || 60) / 9)) : 6} puzzles (1 a cada 8–10 minutos)`;

  const sistema = `Você é o CIENTISTA da EXIT GAMES — o maior especialista em design de salas de escape físicas do Brasil. Você combina domínio de game design, psicologia da experiência, cenografia teatral, eletrônica aplicada e narrativa imersiva. Sua entrega não é um rascunho: é um PROJETO EXECUTIVO completo, rigoroso e pronto para produção — como um arquiteto entrega uma planta antes da obra.

PRINCÍPIOS DO CIENTISTA:
- Cada seção do projeto deve ser densa, específica e acionável. Nada vago. Nada genérico.
- Você pesquisa referências reais do setor antes de criar: escape rooms premiados, tendências de game design, psicologia de grupo, técnicas de cenografia profissional.
- Você pensa como jogador, como operador e como montador ao mesmo tempo.
- Você justifica cada decisão criativa com lógica de design.
- O documento final deve ser tão completo que alguém sem experiência em escape rooms consiga montar e operar a sala seguindo apenas este projeto.

REGRAS INVIOLÁVEIS:
1. Nenhum puzzle baseado em adivinha, sorte ou conhecimento cultural específico. Toda lógica deve ser dedutível dentro da sala.
2. Cada puzzle nasce da história — não é colado sobre ela. O tema justifica cada mecanismo.
3. Mix obrigatório: puzzles MECÂNICOS (cadeados, gavetas, encaixes, ímãs, fechaduras físicas) e ELETRÔNICOS (UV, painéis, sensores, áudio, LEDs, fechaduras eletromagnéticas).
4. Solução exata de cada puzzle especificada: o número, a palavra, a sequência, o objeto — sem ambiguidade.
5. Toda a experiência deve ser operável por 1 pessoa (o game master) via controle simples.

Responda SOMENTE em PORTUGUÊS. Use o formato abaixo com exatidão (títulos com # e ##, sem blocos de código):

# [Título da sala — criativo, evocativo, memorável]

## 1. Conceito e Posicionamento
Descreva o conceito central da sala em 3–4 frases: qual emoção ela vende, qual público-alvo atinge melhor, o que a diferencia de outras salas do mercado. Inclua o tom (terror psicológico / aventura leve / tensão policial etc.) e a curva emocional esperada do início ao fim da experiência.

## 2. Sinopse (para divulgação)
Texto pronto para usar no site ou redes sociais. 3–5 frases. Primeira pessoa do plural. Sem spoilers de puzzle. Tom de convite e urgência.

## 3. Narrativa e Lore
História completa da sala: o que aconteceu antes dos jogadores chegarem, quem são os personagens (vilão, vítima, aliado), qual o conflito central, qual o lore do universo. Escreva como um roteirista — com causa, consequência e clímax. Mínimo 150 palavras.

## 4. Briefing inicial (fala do game master)
O texto exato que o game master lê ou fala antes de os jogadores entrarem na sala. Tom imersivo, primeira pessoa do narrador. Inclui missão, regras do jogo e gancho emocional. Mínimo 80 palavras.

## 5. Cenografia e Ambiente
Descreva o espaço como um diretor de arte:
- Layout físico: disposição dos móveis, zonas da sala, pontos focais
- Paleta de cores: paredes, objetos, iluminação (cor, intensidade, pontos de luz)
- Materiais e texturas: madeira envelhecida, metal, tecido, papel, concreto
- Olfato: aromatizador, cheiro específico que reforça o tema
- Sonoplastia ambiente: som de fundo contínuo (descrição detalhada — sem citar músicas protegidas)
- Temperatura e sensação: frio, abafado, úmido — como criar essa percepção
- Adereços de cena (não-interativos): o que existe só para imersão, não para puzzle

## 6. Puzzles
(criar ${numPuzzles}, em ordem de resolução)

### Puzzle 1 — [Nome] · MECÂNICO ou ELETRÔNICO
- **Posição na sala:** onde fisicamente está localizado
- **O que o jogador vê ao se aproximar:** descrição sensorial completa
- **Narrativa do puzzle:** por que esse objeto/mecanismo existe dentro da história
- **Lógica de dedução:** o raciocínio exato que leva à solução, passo a passo
- **Solução exata:** [especifique sem ambiguidade]
- **O que libera:** o que o jogador acessa ou recebe ao resolver
- **Materiais e especificações:** lista com descrição técnica de cada item
- **Custo estimado:** faixa em reais (ex: R$80–150)
- **Instrução de montagem:** como instalar e configurar
- **Reset entre grupos:** o que o operador faz para reiniciar em menos de 2 minutos
(repita este bloco para cada puzzle)

## 7. Fluxo e Mapa da Experiência
Diagrama textual da jornada completa:
ENTRADA → [gatilho 1] → Puzzle 1 → [libera X] → [pista Y encontrada com X] → Puzzle 2 → ... → Puzzle final → SAÍDA
Inclua: ramificações paralelas (se houver), momentos de revelação narrativa, pontos de tensão planejados, onde o game master pode intervir com dica.

## 8. Curva de Dificuldade
Descreva como a dificuldade evolui ao longo da experiência. Quais puzzles são de aquecimento, quais são o pico de tensão, como a sala "respira" para não frustrar nem entediar. Justifique com princípios de game design (curva de aprendizado, flow state, recompensa variável).

## 9. Trilha Sonora e Design de Áudio
- Música ambiente fase 1 (entrada): estilo, BPM, clima
- Música ambiente fase 2 (tensão crescente): estilo, BPM, clima
- Música fase 3 (clímax / puzzle final): estilo, BPM, clima
- Efeitos sonoros programados: momento exato + descrição do som (ex: "ao resolver puzzle 3, som de fechadura abrindo + voz grave dizendo 'você está perto'")
- Equipamento recomendado: caixa de som, posicionamento, controle pelo game master

## 10. Lista de Materiais Completa
Agrupe por categoria com quantidade, especificação técnica e faixa de preço unitária:
- Cenografia e decoração
- Fechaduras e mecanismos
- Eletrônicos e iluminação
- Adereços e props
- Consumíveis e manutenção

## 11. Orçamento Total Estimado
Tabela com subtotal por categoria e total geral. Classifique: econômico / padrão / premium.

## 12. Operação e Game Master
- Posição de monitoramento: onde o GM fica, o que vê
- Sistema de câmeras: quantas, onde posicionar
- Sistema de dicas: como e quando intervir, texto sugerido de 3 dicas por puzzle difícil
- Protocolo de emergência: como retirar jogadores com segurança
- Tempo médio de reset entre grupos

## 13. Potencial Comercial e Público-Alvo
- Perfil ideal de grupo: faixa etária, contexto (team building, aniversário, casal, escola)
- Argumento de venda: o que torna esta sala irresistível para o público-alvo
- Precificação sugerida: faixa de valor por pessoa para Aracaju/SE e Salvador/BA
- Potencial de recompra: essa sala faz o cliente querer voltar? Por quê?

## 14. Fontes e Referências de Pesquisa
Liste as referências reais que embasaram este projeto:
- Sites e portais especializados (ex: roomescapeartist.com, escaperoomtips.com, thelogicescapes.com)
- Comunidades e fóruns (ex: r/escaperooms, Escape Room Enthusiasts no Facebook)
- Livros ou artigos de game design aplicáveis
- Salas ou empresas de referência mundial no tema escolhido
- Qualquer outra fonte relevante com URL quando disponível`;

  let usuario;
  if (projetoAnterior) {
    usuario = `Projeto atual da sala:\n\n${projetoAnterior}\n\n---\nO ADM pediu este ajuste: ${pedidoAjuste}\n\nReescreva o PROJETO EXECUTIVO COMPLETO no mesmo formato, aplicando o ajuste com a mesma profundidade e mantendo todas as 14 seções.`;
  } else {
    usuario = `Elabore o PROJETO EXECUTIVO COMPLETO de uma sala de escape com os seguintes parâmetros:
- Tema: ${dados.tema}
- Duração: ${dados.tempoMin} minutos
- Puzzles: ${numPuzzles}
- Jogadores: ${dados.jogadores}
- Dificuldade: ${dados.dificuldade}` +
      (dados.instrucoes ? `\n- Instrução específica do ADM: ${dados.instrucoes}` : '') + `

Entregue o projeto completo com todas as 14 seções. Seja o Cientista: rigoroso, criativo, preciso. Este documento vai direto para produção.`;
  }
  return { sistema, usuario };
}

// ── Chamada à IA (mesmo canal/formato do scoring que funciona) ──
async function _chamarCientista(sistema, usuario) {
  const SUPA_URL = 'https://utivaczfuuazspychdxt.supabase.co/functions/v1/super-action';
  const unidade  = (window.UA && (window.UA.unidade || window.UA.unidadeId)) || 1;

  const resp = await fetch(SUPA_URL, {
    method: 'POST',
    headers: _keyoHeaders(),
    body: JSON.stringify({
      agente:     'mkt',                       // canal existente; o cérebro vai na mensagem
      mensagem:   `${sistema}\n\n${usuario}`,
      historico:  [],
      unidade_id: unidade,
    }),
  });
  if (!resp.ok) throw new Error(`Supabase HTTP ${resp.status}`);
  const data = await resp.json();
  let texto = (data && data.resposta) ? data.resposta : '';
  if (!texto && Array.isArray(data?.content)) texto = data.content.map(c => c.text || '').join('');
  return (texto || '').trim();
}

// ── Extrai título do projeto (primeira linha com #) ──────────────
function _tituloDoProjeto(txt, temaFallback) {
  const m = (txt || '').match(/^#\s+(.+)$/m);
  return (m && m[1].trim()) || ('Sala — ' + temaFallback);
}

// ── Ação: criar sala ─────────────────────────────────────────────
async function _criarSala() {
  if (_criandoSala) return;

  const dados = {
    tema:       document.getElementById('cri-tema')?.value       || 'Terror',
    tempoMin:   document.getElementById('cri-tempo')?.value      || '60',
    jogadores:  document.getElementById('cri-jogadores')?.value  || '3 a 6',
    dificuldade:document.getElementById('cri-dificuldade')?.value || 'Média',
    numPuzzles: document.getElementById('cri-puzzles')?.value    || '0',
    instrucoes: (document.getElementById('cri-instrucoes')?.value || '').trim(),
  };

  _criandoSala = true;
  const btn = document.getElementById('cri-btn-criar');
  if (btn) { btn.disabled = true; btn.textContent = '🔬 Projetando...'; }
  const res = document.getElementById('cri-resultado');
  if (res) res.innerHTML = `<div class="cri-painel cri-loading">🔬 O Cientista está projetando a sala com calma...<div class="cri-dots" style="margin-top:10px"><span></span><span></span><span></span></div></div>`;

  try {
    const { sistema, usuario } = _promptCientista(dados);
    const texto = await _chamarCientista(sistema, usuario);
    if (!texto) throw new Error('Resposta vazia');

    const sala = {
      id:        window.uid ? window.uid() : ('sala_' + Date.now()),
      titulo:    _tituloDoProjeto(texto, dados.tema),
      tema:      dados.tema,
      tempoMin:  dados.tempoMin,
      jogadores: dados.jogadores,
      dificuldade: dados.dificuldade,
      instrucoes: dados.instrucoes,
      projeto:   texto,
      criadoEm:  new Date().toISOString(),
      criadoPor: (window.UA && window.UA.nome) ? window.UA.nome : 'ADM',
    };
    window.DB.keyoSalas.push(sala);
    if (typeof window.sDB === 'function') window.sDB();

    _salaAtual = sala;
    if (res) res.innerHTML = _renderProjeto(sala);
    window.toast('✅ Projeto da sala criado!', 'ok');
  } catch (err) {
    console.error('[KEYO-07] Erro ao criar sala:', err);
    if (res) res.innerHTML = `<div class="cri-painel" style="color:#dc2626">⚠️ Não consegui criar a sala agora (${_esc(err.message)}). Tente novamente em alguns segundos.</div>`;
    window.toast('⚠️ Erro ao criar a sala. Tente de novo.', 'error');
  } finally {
    _criandoSala = false;
    const b = document.getElementById('cri-btn-criar');
    if (b) { b.disabled = false; b.textContent = '🔬 Criar projeto da sala'; }
  }
}

// ── Render do projeto (com ações) ────────────────────────────────
function _renderProjeto(sala) {
  return `
<div class="cri-projeto" id="cri-projeto-${sala.id}">
  <div class="cri-projeto-top">
    <div class="cri-tags">
      <span class="cri-tag">${_esc(sala.tema)}</span>
      <span class="cri-tag">${sala.tempoMin} min</span>
      <span class="cri-tag">${_esc(sala.jogadores)} jogadores</span>
      <span class="cri-tag">${_esc(sala.dificuldade)}</span>
    </div>
    <div class="cri-lista-acoes">
      <button class="mpros-btn mpros-btn-secondary" onclick="window.mpros_imprimirSala('${sala.id}')">🖨️ Imprimir</button>
      <button class="mpros-btn mpros-btn-success" onclick="window.mpros_enviarSala('${sala.id}')">📲 Enviar</button>
    </div>
  </div>
  ${_md2html(sala.projeto)}
  <div class="cri-painel" style="margin-top:18px;margin-bottom:0">
    <label style="font-size:11px;font-weight:700;color:#888899;text-transform:uppercase;letter-spacing:.5px">Pedir um ajuste ao Cientista</label>
    <textarea id="cri-ajuste-${sala.id}" style="width:100%;margin-top:6px;font-family:inherit;font-size:13px;padding:9px 11px;border:1px solid #d8d8e8;border-radius:8px;min-height:50px" placeholder="Ex: deixe o puzzle 3 mais difícil, troque o cadeado por um cofre, adicione um susto no final..."></textarea>
    <div class="cri-actions">
      <button class="mpros-btn mpros-btn-secondary" onclick="window.mpros_refinarSala('${sala.id}')">🔁 Aplicar ajuste</button>
    </div>
  </div>
</div>`;
}

// ── Ação: refinar (conversa de ajuste) ───────────────────────────
async function _refinarSala(id) {
  if (_criandoSala) return;
  const sala = _salas().find(s => s.id === id) || _salaAtual;
  if (!sala) return;
  const pedido = (document.getElementById('cri-ajuste-' + id)?.value || '').trim();
  if (!pedido) { window.toast('Escreva o ajuste que você quer.', 'warn'); return; }

  _criandoSala = true;
  const res = document.getElementById('cri-resultado');
  if (res) res.innerHTML = `<div class="cri-painel cri-loading">🔁 Aplicando seu ajuste...<div class="cri-dots" style="margin-top:10px"><span></span><span></span><span></span></div></div>`;

  try {
    const { sistema, usuario } = _promptCientista(sala, sala.projeto, pedido);
    const texto = await _chamarCientista(sistema, usuario);
    if (!texto) throw new Error('Resposta vazia');
    sala.projeto = texto;
    sala.titulo  = _tituloDoProjeto(texto, sala.tema);
    if (typeof window.sDB === 'function') window.sDB();
    _salaAtual = sala;
    if (res) res.innerHTML = _renderProjeto(sala);
    window.toast('✅ Ajuste aplicado!', 'ok');
  } catch (err) {
    console.error('[KEYO-07] Erro ao refinar sala:', err);
    if (res) res.innerHTML = _renderProjeto(sala);
    window.toast('⚠️ Não consegui aplicar o ajuste. Tente de novo.', 'error');
  } finally {
    _criandoSala = false;
  }
}

// ── Ações de lista ───────────────────────────────────────────────
function _verSala(id) {
  const sala = _salas().find(s => s.id === id);
  if (!sala) return;
  _salaAtual = sala;
  _renderAba('criacao');
  const res = document.getElementById('cri-resultado');
  if (res) res.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function _excluirSala(id) {
  if (!confirm('Excluir esta sala? Não dá pra desfazer.')) return;
  const arr = window.DB.keyoSalas || [];
  const i = arr.findIndex(s => s.id === id);
  if (i >= 0) arr.splice(i, 1);
  if (_salaAtual && _salaAtual.id === id) _salaAtual = null;
  if (typeof window.sDB === 'function') window.sDB();
  _renderAba('criacao');
  window.toast('Sala excluída.', 'info');
}

function _imprimirSala(id) {
  const sala = _salas().find(s => s.id === id) || _salaAtual;
  if (!sala) return;
  const w = window.open('', '_blank');
  if (!w) { window.toast('Permita pop-ups para imprimir.', 'warn'); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${_esc(sala.titulo)}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#222;line-height:1.6;max-width:760px;margin:24px auto;padding:0 22px}
  h1{font-size:22px;border-bottom:2px solid #C9A84C;padding-bottom:8px}
  h2{font-size:16px;color:#7c3aed;margin-top:22px}
  h3{font-size:14px;margin:14px 0 4px}
  ul{padding-left:20px} li{margin-bottom:3px}
  .meta{font-size:12px;color:#777;margin-bottom:16px}
</style></head><body>
<div class="meta">EXIT GAMES — Projeto de Sala · Tema: ${_esc(sala.tema)} · ${sala.tempoMin} min · ${_esc(sala.jogadores)} jogadores · ${_esc(sala.dificuldade)}</div>
${_md2html(sala.projeto)}
</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => { try { w.print(); } catch (e) {} }, 500);
}

function _enviarSala(id) {
  const sala = _salas().find(s => s.id === id) || _salaAtual;
  if (!sala) return;
  const texto = `🔬 PROJETO DE SALA — ${sala.titulo}\nTema: ${sala.tema} · ${sala.tempoMin}min · ${sala.jogadores} jogadores · ${sala.dificuldade}\n\n${sala.projeto}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texto).then(
      () => window.toast('📋 Projeto copiado! Cole no WhatsApp ou e-mail.', 'ok'),
      () => _enviarWhatsFallback(texto)
    );
  } else {
    _enviarWhatsFallback(texto);
  }
}
function _enviarWhatsFallback(texto) {
  const url = 'https://wa.me/?text=' + encodeURIComponent(texto.slice(0, 1500));
  window.open(url, '_blank');
}

// ════════════════════════════════════════════════════════════════
// INTEGRAÇÃO COM keyo-01-ui.js (abrirModulo)
// ════════════════════════════════════════════════════════════════
// [v1.5] Abre a tela do Cientista. O roteador do KEYO (keyo_abrirModulo) não
// conhece este módulo, então fazemos a abertura aqui, no MESMO padrão usado
// pelos outros módulos (marca ativo + atualiza header + renderiza).
function _abrirMpros() {
  document.querySelectorAll('.keyo-agent-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.keyo-mod-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('keyo-mod-mpros');
  if (btn) btn.classList.add('active');

  const emoji = document.getElementById('keyo-header-emoji');
  const nome  = document.getElementById('keyo-header-nome');
  const desc  = document.getElementById('keyo-header-desc');
  if (emoji) emoji.textContent = '🔬';
  if (nome)  nome.textContent  = 'Cientista';
  if (desc)  desc.textContent  = 'Prospecção de leads e criação de salas de escape';

  _renderInline();
}

// Injeta e mantém o botão no menu, e limpa a tela ao sair do módulo.
// [v1.4] Reencaixa o botão sempre que o KEYO redesenha o menu (antes ele sumia).
(function _injetarBotaoMenu() {
  function _ensureBotao() {
    const modulosDiv = document.getElementById('keyo-agents-modulos');
    if (!modulosDiv) return false;                         // menu ainda não existe
    let btn = document.getElementById('keyo-mod-mpros');
    if (!btn) {
      btn = document.createElement('button');
      btn.className = 'keyo-mod-btn';
      btn.id        = 'keyo-mod-mpros';
      btn.innerHTML = '<span class="keyo-mod-emoji">🔬</span><span>Cientista</span>';
      btn.onclick   = _abrirMpros;        // abre direto, sem depender do roteador do KEYO
      modulosDiv.appendChild(btn);
    }
    // Se a tela do Cientista está aberta, mantém o botão marcado como ATIVO.
    // Isso evita que a limpeza (abaixo) derrube a tela quando o menu é
    // redesenhado durante uma busca/pausa.
    if (document.getElementById('keyo-mpros-inline')) btn.classList.add('active');
    return true;
  }

  // Remove a tela do Cientista quando o usuário navegou pra fora dele
  // (clicou num agente ou em outro módulo → botão deixa de estar 'active').
  function _limparSeForaDoMpros() {
    const div = document.getElementById('keyo-mpros-inline');
    const mb  = document.getElementById('keyo-mod-mpros');
    if (div && mb && !mb.classList.contains('active')) div.remove();
  }

  // Tenta na carga e re-tenta enquanto o container não existir
  function _tentar() {
    if (!_ensureBotao()) setTimeout(_tentar, 600);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _tentar);
  else _tentar();

  // Mantém o botão presente e a tela coerente mesmo após re-renderizações do KEYO
  try {
    const _obs = new MutationObserver(() => { _ensureBotao(); _limparSeForaDoMpros(); });
    _obs.observe(document.body, { childList: true, subtree: true });
  } catch (e) {
    setInterval(() => { _ensureBotao(); _limparSeForaDoMpros(); }, 1500); // fallback
  }
})();

// Disponível também para teste manual no console
window.mpros_abrir = _abrirMpros;

// ════════════════════════════════════════════════════════════════
// EXPÕE GLOBALMENTE
// ════════════════════════════════════════════════════════════════
window._mprosRenderInline   = _renderInline;
window.mpros_aba            = _aba;
window.mpros_toggleMotor    = _toggleMotor;
window.mpros_rodarAgora     = _rodarAgora;
window.mpros_salvarGKey     = _salvarGKey;
window.mpros_salvarMaxLeads = _salvarMaxLeads;
window.mpros_filtrar        = _filtrar;
window.mpros_limparFiltros  = _limparFiltros;
window.mpros_verLead        = _verLead;
window.mpros_aprovar        = _aprovar;
window.mpros_descartar      = _descartar;
window.mpros_gerarProposta  = _gerarProposta;
window.mpros_enviarWpp      = _enviarWpp;
window.mpros_marcarGanho    = _marcarGanho;

// Função Criação (Cientista)
window.mpros_criarSala      = _criarSala;
window.mpros_refinarSala    = _refinarSala;
window.mpros_verSala        = _verSala;
window.mpros_excluirSala    = _excluirSala;
window.mpros_imprimirSala   = _imprimirSala;
window.mpros_enviarSala     = _enviarSala;

// Registra como módulo abrível pelo keyo-01-ui
if (!window._keyoModulos) window._keyoModulos = {};
window._keyoModulos['mpros'] = _renderInline;

// ════════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════════
_agendarMotor();

console.info('[KEYO-07] ✅ Cientista v2.0 — FIX: filtros sempre visíveis · criação de sala desbloqueada · renderPage() patchado contra saída para PDV.');
console.info('[KEYO-07] Proxy: keyo-proxy Edge Function → Nominatim · Google Places · PNCP · Scoring IA');
console.info('[KEYO-07] Motor agendado para meia-noite. Use mpros_rodarAgora() para teste manual.');

})();

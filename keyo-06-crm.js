// ═══════════════════════════════════════════════════════════════
// EXIT GAMES — KEYO CRM v1.0
// Arquivo: keyo-06-crm.js
// Injetar via: <script src="keyo-06-crm.js"></script>
// Depende de: keyo-00-core.js e keyo-01-ui.js (carregar antes)
// Cobre: Fase 3 do Plano Mestre v2.0 (Etapas 3.1 + 3.2 + 3.3)
// NUNCA modificar funções do ERP base. (Lei #2)
// ═══════════════════════════════════════════════════════════════
(function _KEYO_CRM() {
'use strict';

// ── GUARD: bloqueia dupla injeção ───────────────────────────────
if (window.__KEYO_CRM_LOADED__) {
  console.warn('[KEYO-CRM] Já carregado. Ignorando.');
  return;
}
if (!window.__KEYO_00_LOADED__) {
  console.error('[KEYO-CRM] keyo-00-core.js não carregado. Abortando.');
  return;
}
window.__KEYO_CRM_LOADED__ = true;

// ── VERIFICAÇÃO DE DEPENDÊNCIAS ─────────────────────────────────
const _DEPS = ['toast', 'uid', 'hoje', 'fM', 'san'];
const _depsFaltando = _DEPS.filter(d => typeof window[d] === 'undefined');
if (_depsFaltando.length > 0) {
  console.error('[KEYO-CRM] Dependências ausentes:', _depsFaltando, '— módulo abortado.');
  window.__KEYO_CRM_LOADED__ = false;
  return;
}

// ── FREEZE DE FUNÇÕES CRÍTICAS DO ERP ───────────────────────────
// Guardamos as referências ANTES de qualquer patch para comparação posterior.
// renderPage e rSb são patchados intencionalmente pelo KEYO-01-UI — por isso
// usamos _renderPageCRMOrig como nossa base (a versão já patchada pelo UI).
const _ERP_ORIGINALS = {
  goTo:          window.goTo,
  toast:         window.toast,
  sDB:           window.sDB,
  rClientes:     window.rClientes,
  filtCli:       window.filtCli,
  salvarCliente: window.salvarCliente,
};
window.addEventListener('load', function() {
  ['toast','sDB','rClientes','filtCli','salvarCliente'].forEach(fn => {
    if (window[fn] !== _ERP_ORIGINALS[fn]) {
      console.error('[KEYO-CRM] ⚠️ Função ERP sobrescrita indevidamente:', fn);
    }
  });
}, { once: true });

// ════════════════════════════════════════════════════════════════
// CSS — abas + painel CRM
// ════════════════════════════════════════════════════════════════
(function _css() {
  if (document.getElementById('keyo-crm-css')) return;
  const s = document.createElement('style');
  s.id = 'keyo-crm-css';
  s.textContent = `
/* ── CRM: barra de abas ── */
#keyo-crm-tabs{display:flex;gap:0;border-bottom:2px solid #e8e8f0;margin-bottom:0;background:#fff;padding:0 20px;position:sticky;top:0;z-index:10}
.keyo-crm-tab{padding:12px 20px;font-size:13px;font-weight:600;color:#888899;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;transition:all .15s;background:none;border-top:none;border-left:none;border-right:none;font-family:inherit}
.keyo-crm-tab:hover{color:#555566}
.keyo-crm-tab.active{color:#C9A84C;border-bottom-color:#C9A84C}

/* ── CRM: painel ── */
#keyo-crm-painel{padding:20px;max-width:900px;margin:0 auto}

/* ── CRM: seções de alerta ── */
.crm-secao{background:#fff;border:1px solid #e8e8f0;border-radius:14px;margin-bottom:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.05)}
.crm-secao-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #f4f4fa}
.crm-secao-titulo{font-size:13px;font-weight:700;color:#111118;display:flex;align-items:center;gap:8px}
.crm-secao-badge{font-size:11px;font-weight:700;background:#f4f4fa;color:#555566;border-radius:20px;padding:2px 9px}
.crm-secao-badge.alerta{background:#fff3cd;color:#856404}
.crm-secao-badge.risco{background:#f8d7da;color:#842029}
.crm-secao-badge.ok{background:#eaf3de;color:#3b6d11}
.crm-secao-body{padding:14px 18px}

/* ── CRM: linha de item ── */
.crm-item{display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid #f8f8fc}
.crm-item:last-child{border-bottom:none}
.crm-item-avatar{width:34px;height:34px;border-radius:50%;background:#f0f0fa;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#888899;flex-shrink:0;text-transform:uppercase}
.crm-item-info{flex:1;min-width:0}
.crm-item-nome{font-size:13px;font-weight:500;color:#111118;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.crm-item-sub{font-size:11px;color:#888899;margin-top:1px}
.crm-item-valor{font-size:12px;font-weight:600;color:#111118;flex-shrink:0;text-align:right}
.crm-item-acao{flex-shrink:0}
.crm-btn-sm{background:none;border:1px solid #d8d8e8;border-radius:6px;padding:4px 10px;font-size:11px;color:#555566;cursor:pointer;font-family:inherit;transition:all .15s;white-space:nowrap}
.crm-btn-sm:hover{border-color:#C9A84C;color:#C9A84C}
.crm-btn-campanha{background:#C9A84C;border-color:#C9A84C;color:#000;font-weight:600}
.crm-btn-campanha:hover{background:#b8962e;border-color:#b8962e}
.crm-btn-m13{background:#7C6FCD;border-color:#7C6FCD;color:#fff;font-weight:600}
.crm-btn-m13:hover{background:#6a5fbe;border-color:#6a5fbe}

/* ── CRM: vazio ── */
.crm-vazio{text-align:center;padding:24px;color:#aaa;font-size:12px}
.crm-vazio-icon{font-size:28px;margin-bottom:6px}

/* ── CRM: header do painel ── */
#keyo-crm-resumo{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
.crm-stat{background:#fff;border:1px solid #e8e8f0;border-radius:12px;padding:14px 16px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.04)}
.crm-stat-n{font-size:22px;font-weight:700;color:#111118}
.crm-stat-l{font-size:10px;color:#888899;margin-top:3px}
.crm-stat.verde  .crm-stat-n{color:#3b6d11}
.crm-stat.amarelo .crm-stat-n{color:#856404}
.crm-stat.vermelho .crm-stat-n{color:#a32d2d}
.crm-stat.ouro   .crm-stat-n{color:#b8962e}

/* ── CRM: botão de ação global ── */
#crm-acao-global{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap}
.crm-btn-global{padding:9px 18px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;border:1px solid transparent;transition:all .15s}
.crm-btn-global.primario{background:#C9A84C;color:#000}
.crm-btn-global.primario:hover{background:#b8962e}
.crm-btn-global.secundario{background:#fff;border-color:#d8d8e8;color:#555566}
.crm-btn-global.secundario:hover{border-color:#C9A84C;color:#C9A84C}
.crm-btn-global.roxo{background:#7C6FCD;color:#fff}
.crm-btn-global.roxo:hover{background:#6a5fbe}

/* ── CRM: aniversariantes ── */
.crm-aniv-badge{background:linear-gradient(135deg,#ff9a9e,#fecfef);color:#8b1a4a;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;margin-left:6px}

/* ── CRM: top clientes ── */
.crm-rank{font-size:11px;font-weight:700;color:#C9A84C;width:20px;flex-shrink:0;text-align:center}
.crm-progress{flex:1;height:5px;background:#f4f4fa;border-radius:20px;overflow:hidden;margin:0 10px}
.crm-progress-bar{height:100%;border-radius:20px;background:linear-gradient(to right,#C9A84C,#e8c76a);transition:width .6s ease}
`;
  document.head.appendChild(s);
})();

// ════════════════════════════════════════════════════════════════
// ETAPA 3.1 — MONKEY-PATCH SEGURO EM renderPage
// Intercepta apenas PA='clientes', delega todo o resto ao original.
// ════════════════════════════════════════════════════════════════
(function _patchRenderPage() {
  // Espera renderPage estar disponível (pode ter sido patchado pelo KEYO-01-UI)
  function _aplicarPatch() {
    if (!window.renderPage) {
      setTimeout(_aplicarPatch, 300);
      return;
    }
    if (window.__KEYO_CRM_RP_PATCHED__) return;
    window.__KEYO_CRM_RP_PATCHED__ = true;

    const _renderPageCRMOrig = window.renderPage;

    window.renderPage = function() {
      // Só intercepta quando estamos na página de clientes
      if (window.PA === 'clientes') {
        const e = document.getElementById('pc');
        if (!e) return _renderPageCRMOrig.apply(this, arguments);

        // Chama rClientes() original para obter o HTML da lista
        let htmlOriginal = '';
        try {
          if (typeof window.rClientes === 'function') {
            // rClientes normalmente escreve direto em #pc — capturamos via innerHTML
            _renderPageCRMOrig.apply(this, arguments);
            htmlOriginal = e.innerHTML;
          } else {
            return _renderPageCRMOrig.apply(this, arguments);
          }
        } catch(err) {
          console.error('[KEYO-CRM] Erro ao capturar rClientes():', err);
          return _renderPageCRMOrig.apply(this, arguments);
        }

        // Injeta abas em volta do conteúdo original
        e.innerHTML = _htmlComAbas(htmlOriginal);
        _initAbas();
        return;
      }
      return _renderPageCRMOrig.apply(this, arguments);
    };

    console.info('[KEYO-CRM] ✅ renderPage() interceptado — abas CRM ativas na tela de Clientes.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _aplicarPatch);
  } else {
    _aplicarPatch();
  }
})();

// ════════════════════════════════════════════════════════════════
// HTML DO WRAPPER COM ABAS
// ════════════════════════════════════════════════════════════════
function _htmlComAbas(htmlOriginal) {
  return `
<div id="keyo-crm-wrap">
  <div id="keyo-crm-tabs">
    <button class="keyo-crm-tab active" id="crm-tab-clientes"
            onclick="window.crm_trocarAba('clientes')">
      📋 Clientes
    </button>
    <button class="keyo-crm-tab" id="crm-tab-keyo"
            onclick="window.crm_trocarAba('keyo')">
      🤖 Keyo CRM
    </button>
  </div>
  <div id="crm-conteudo-clientes">${htmlOriginal}</div>
  <div id="crm-conteudo-keyo" style="display:none"></div>
</div>`;
}

// ── Inicializa estado das abas após injetar HTML ─────────────────
function _initAbas() {
  // A aba ativa na abertura é sempre "Clientes"
  _crm_aba = 'clientes';
}

// ════════════════════════════════════════════════════════════════
// TROCAR ABA
// ════════════════════════════════════════════════════════════════
let _crm_aba = 'clientes';

function _trocarAba(aba) {
  _crm_aba = aba;

  // Atualiza visual das abas
  document.querySelectorAll('.keyo-crm-tab').forEach(t => t.classList.remove('active'));
  const tabEl = document.getElementById('crm-tab-' + aba);
  if (tabEl) tabEl.classList.add('active');

  // Mostra/esconde painéis
  const pClientes = document.getElementById('crm-conteudo-clientes');
  const pKeyo     = document.getElementById('crm-conteudo-keyo');

  if (aba === 'clientes') {
    if (pClientes) pClientes.style.display = '';
    if (pKeyo)     pKeyo.style.display     = 'none';
  } else {
    if (pClientes) pClientes.style.display = 'none';
    if (pKeyo)     pKeyo.style.display     = '';
    // Renderiza o painel Keyo (lazy — só quando abre)
    if (pKeyo && !pKeyo.dataset.rendered) {
      pKeyo.innerHTML = _htmlPainelKeyo();
      pKeyo.dataset.rendered = '1';
    }
  }
}

// ════════════════════════════════════════════════════════════════
// ETAPA 3.2 — PAINEL KEYO CRM (alertas locais, sem chamada IA)
// ════════════════════════════════════════════════════════════════

// ── Helpers de acesso ao DB ─────────────────────────────────────
function _clientes() { return Array.isArray(window.DB?.clientes) ? window.DB.clientes : []; }
function _vendas()   { return Array.isArray(window.DB?.vendas)   ? window.DB.vendas   : []; }

function _diasDesde(dataStr) {
  if (!dataStr) return 9999;
  const d = new Date(dataStr);
  if (isNaN(d)) return 9999;
  return Math.floor((new Date() - d) / (1000 * 60 * 60 * 24));
}

function _statsCliente(c) {
  // Tenta reaproveitar o M13 se disponível
  if (typeof window.m13_statsCliente === 'function') {
    return window.m13_statsCliente(c);
  }
  // Fallback local
  const vendasCli = _vendas().filter(v =>
    String(v.clienteId) === String(c.id) && v.status === 'confirmado');
  const jogos      = vendasCli.length || Number(c.jogos) || 0;
  const totalGasto = vendasCli.reduce((s, v) => s + (Number(v.valorTotal) || 0), 0) || Number(c.totalGasto) || 0;
  const ultima     = vendasCli.map(v => v.data).filter(Boolean).sort().slice(-1)[0]
                   || c.ultimaVisita || c.criadoEm || null;
  return { jogos, totalGasto, ultima };
}

function _fmtMoeda(v) {
  return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
}

function _fmtData(d) {
  if (!d) return '—';
  const b = String(d).slice(0, 10);
  const [y, m, dd] = b.split('-');
  return (dd && m && y) ? `${dd}/${m}/${y}` : b;
}

function _inicialAvatar(nome) {
  return (nome || '?').trim()[0].toUpperCase();
}

// ── Cálculos dos alertas ─────────────────────────────────────────

function _calcInativos() {
  return _clientes()
    .map(c => ({ ...c, _stats: _statsCliente(c) }))
    .filter(c => {
      if (c._stats.jogos === 0) return false; // nunca jogou — não é inativo
      return _diasDesde(c._stats.ultima) > 60;
    })
    .sort((a, b) => _diasDesde(a._stats.ultima) - _diasDesde(b._stats.ultima))
    .slice(0, 10); // top 10 mais urgentes
}

function _calcAniversariantes() {
  const hoje = new Date();
  const hojeMes = hoje.getMonth() + 1;
  const hojeDia = hoje.getDate();

  // Janela: hoje + 7 dias
  const resultados = [];
  for (let i = 0; i <= 7; i++) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() + i);
    const mes = d.getMonth() + 1;
    const dia = d.getDate();

    _clientes().forEach(c => {
      const nasc = c.nascimento || c.dataNascimento || c.data_nascimento || '';
      if (!nasc) return;
      const partes = String(nasc).slice(0, 10).split('-');
      if (partes.length < 3) return;
      const cMes = parseInt(partes[1]);
      const cDia = parseInt(partes[2]);
      if (cMes === mes && cDia === dia) {
        resultados.push({ ...c, _diasAte: i, _nascimento: nasc });
      }
    });
  }
  return resultados;
}

function _calcComCredito() {
  return _clientes()
    .filter(c => Number(c.creditos || c.credito || 0) > 0)
    .sort((a, b) => Number(b.creditos || b.credito || 0) - Number(a.creditos || a.credito || 0))
    .slice(0, 8);
}

function _calcTopClientes() {
  return _clientes()
    .map(c => ({ ...c, _stats: _statsCliente(c) }))
    .filter(c => c._stats.totalGasto > 0)
    .sort((a, b) => b._stats.totalGasto - a._stats.totalGasto)
    .slice(0, 5);
}

// ── HTML do painel ───────────────────────────────────────────────
function _htmlPainelKeyo() {
  const clientes   = _clientes();
  const inativos   = _calcInativos();
  const aniversar  = _calcAniversariantes();
  const comCredito = _calcComCredito();
  const top5       = _calcTopClientes();

  const totalCli   = clientes.length;
  const nRisco     = clientes.filter(c => {
    const s = _statsCliente(c);
    return s.jogos > 0 && _diasDesde(s.ultima) > 60;
  }).length;
  const nAniv      = aniversar.length;
  const maxGasto   = top5[0]?._stats.totalGasto || 1;

  return `
<div id="keyo-crm-painel">

  <!-- RESUMO NUMÉRICO -->
  <div id="keyo-crm-resumo">
    <div class="crm-stat">
      <div class="crm-stat-n">${totalCli}</div>
      <div class="crm-stat-l">Clientes cadastrados</div>
    </div>
    <div class="crm-stat vermelho">
      <div class="crm-stat-n">${nRisco}</div>
      <div class="crm-stat-l">Em risco de churn</div>
    </div>
    <div class="crm-stat ouro">
      <div class="crm-stat-n">${nAniv}</div>
      <div class="crm-stat-l">Aniversariantes (7d)</div>
    </div>
    <div class="crm-stat verde">
      <div class="crm-stat-n">${comCredito.length}</div>
      <div class="crm-stat-l">Com crédito disponível</div>
    </div>
  </div>

  <!-- AÇÕES GLOBAIS -->
  <div id="crm-acao-global">
    <button class="crm-btn-global primario" onclick="window.crm_campanhaTodos()">
      📣 Campanha para inativos (${inativos.length})
    </button>
    <button class="crm-btn-global roxo" onclick="window.crm_abrirM13()">
      📉 Ver análise completa (M13)
    </button>
    <button class="crm-btn-global secundario" onclick="window.crm_atualizar()">
      🔄 Atualizar
    </button>
  </div>

  <!-- SEÇÃO: CLIENTES INATIVOS -->
  <div class="crm-secao">
    <div class="crm-secao-header">
      <div class="crm-secao-titulo">
        🔴 Clientes inativos
        <span class="crm-secao-badge ${inativos.length > 0 ? 'risco' : 'ok'}">${inativos.length}</span>
      </div>
      <span style="font-size:11px;color:#aaa">Sem visita há mais de 60 dias</span>
    </div>
    <div class="crm-secao-body">
      ${inativos.length === 0
        ? `<div class="crm-vazio"><div class="crm-vazio-icon">✅</div>Nenhum cliente inativo. Ótimo!</div>`
        : inativos.map(c => {
            const dias = _diasDesde(c._stats.ultima);
            const urgencia = dias > 120 ? '🔴' : dias > 90 ? '🟠' : '🟡';
            return `
            <div class="crm-item">
              <div class="crm-item-avatar">${_inicialAvatar(c.nome)}</div>
              <div class="crm-item-info">
                <div class="crm-item-nome">${c.nome || '—'}</div>
                <div class="crm-item-sub">${urgencia} ${dias} dias sem visita · ${c._stats.jogos} jogo${c._stats.jogos !== 1 ? 's' : ''}</div>
              </div>
              <div class="crm-item-valor">${_fmtMoeda(c._stats.totalGasto)}</div>
              <div class="crm-item-acao">
                <button class="crm-btn-sm crm-btn-campanha"
                        onclick="window.crm_contatarCliente('${c.id}','${(c.nome||'').replace(/'/g,'&#39;')}','${c.telefone||''}')">
                  💬 Contatar
                </button>
              </div>
            </div>`;
          }).join('')
      }
    </div>
  </div>

  <!-- SEÇÃO: ANIVERSARIANTES -->
  <div class="crm-secao">
    <div class="crm-secao-header">
      <div class="crm-secao-titulo">
        🎂 Aniversariantes
        <span class="crm-secao-badge ${aniversar.length > 0 ? 'alerta' : 'ok'}">${aniversar.length}</span>
      </div>
      <span style="font-size:11px;color:#aaa">Próximos 7 dias</span>
    </div>
    <div class="crm-secao-body">
      ${aniversar.length === 0
        ? `<div class="crm-vazio"><div class="crm-vazio-icon">🎈</div>Nenhum aniversariante nos próximos 7 dias.</div>`
        : aniversar.map(c => {
            const label = c._diasAte === 0 ? '🎉 Hoje!' : c._diasAte === 1 ? 'Amanhã' : `Em ${c._diasAte} dias`;
            const stats = _statsCliente(c);
            return `
            <div class="crm-item">
              <div class="crm-item-avatar" style="background:#fff0f5;color:#c2185b">🎂</div>
              <div class="crm-item-info">
                <div class="crm-item-nome">
                  ${c.nome || '—'}
                  <span class="crm-aniv-badge">${label}</span>
                </div>
                <div class="crm-item-sub">${_fmtData(c._nascimento)} · ${stats.jogos} jogo${stats.jogos !== 1 ? 's' : ''}</div>
              </div>
              <div class="crm-item-acao">
                <button class="crm-btn-sm"
                        onclick="window.crm_parabens('${c.id}','${(c.nome||'').replace(/'/g,'&#39;')}','${c.telefone||''}')">
                  🎁 Parabéns
                </button>
              </div>
            </div>`;
          }).join('')
      }
    </div>
  </div>

  <!-- SEÇÃO: COM CRÉDITO -->
  <div class="crm-secao">
    <div class="crm-secao-header">
      <div class="crm-secao-titulo">
        💳 Com crédito disponível
        <span class="crm-secao-badge ${comCredito.length > 0 ? 'alerta' : 'ok'}">${comCredito.length}</span>
      </div>
      <span style="font-size:11px;color:#aaa">Lembrar para usar o crédito</span>
    </div>
    <div class="crm-secao-body">
      ${comCredito.length === 0
        ? `<div class="crm-vazio"><div class="crm-vazio-icon">💳</div>Nenhum cliente com crédito pendente.</div>`
        : comCredito.map(c => {
            const credito = Number(c.creditos || c.credito || 0);
            return `
            <div class="crm-item">
              <div class="crm-item-avatar">${_inicialAvatar(c.nome)}</div>
              <div class="crm-item-info">
                <div class="crm-item-nome">${c.nome || '—'}</div>
                <div class="crm-item-sub">${c.telefone || 'Sem telefone'}</div>
              </div>
              <div class="crm-item-valor" style="color:#3b6d11;font-weight:700">${_fmtMoeda(credito)}</div>
              <div class="crm-item-acao">
                <button class="crm-btn-sm"
                        onclick="window.crm_lembrarCredito('${c.id}','${(c.nome||'').replace(/'/g,'&#39;')}','${c.telefone||''}','${credito}')">
                  📲 Lembrar
                </button>
              </div>
            </div>`;
          }).join('')
      }
    </div>
  </div>

  <!-- SEÇÃO: TOP 5 CLIENTES -->
  <div class="crm-secao">
    <div class="crm-secao-header">
      <div class="crm-secao-titulo">
        🏆 Top 5 por faturamento
        <span class="crm-secao-badge ok">${top5.length}</span>
      </div>
      <span style="font-size:11px;color:#aaa">Clientes que mais gastaram</span>
    </div>
    <div class="crm-secao-body">
      ${top5.length === 0
        ? `<div class="crm-vazio"><div class="crm-vazio-icon">📊</div>Sem dados de faturamento ainda.</div>`
        : top5.map((c, i) => {
            const pct = Math.round(c._stats.totalGasto / maxGasto * 100);
            return `
            <div class="crm-item">
              <div class="crm-rank">#${i + 1}</div>
              <div class="crm-item-avatar">${_inicialAvatar(c.nome)}</div>
              <div class="crm-item-info">
                <div class="crm-item-nome">${c.nome || '—'}</div>
                <div class="crm-progress">
                  <div class="crm-progress-bar" style="width:${pct}%"></div>
                </div>
              </div>
              <div class="crm-item-valor" style="color:#b8962e;font-weight:700">
                ${_fmtMoeda(c._stats.totalGasto)}
              </div>
              <div style="font-size:10px;color:#aaa;flex-shrink:0;text-align:right;margin-left:6px">
                ${c._stats.jogos} jogo${c._stats.jogos !== 1 ? 's' : ''}
              </div>
            </div>`;
          }).join('')
      }
    </div>
  </div>

</div>`;
}

// ════════════════════════════════════════════════════════════════
// ETAPA 3.3 — BOTÕES DE AÇÃO (pontes M12 / M13 / WhatsApp)
// Nunca gera erro se módulo não estiver instalado.
// ════════════════════════════════════════════════════════════════

// ── Contatar cliente inativo ─────────────────────────────────────
function _contatarCliente(id, nome, telefone) {
  const primeiroNome = nome.split(' ')[0];
  const msg = `Olá, ${primeiroNome}! 🎮\n\nSentimos sua falta na EXIT GAMES! Temos novidades esperando por você.\n\nQue tal agendar uma nova aventura? Acesse: exitsystem.net\n\nAté logo! 🙂`;
  const tel = telefone.replace(/\D/g, '');
  const url = tel
    ? `https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

// ── Mensagem de parabéns ─────────────────────────────────────────
function _parabens(id, nome, telefone) {
  const primeiroNome = nome.split(' ')[0];
  const msg = `Olá, ${primeiroNome}! 🎂🎉\n\nA equipe EXIT GAMES deseja um feliz aniversário!\n\nQue tal comemorar com uma experiência incrível? Prepare seu grupo e venha jogar!\n\n📅 Agende agora: exitsystem.net`;
  const tel = telefone.replace(/\D/g, '');
  const url = tel
    ? `https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

// ── Lembrar sobre crédito ────────────────────────────────────────
function _lembrarCredito(id, nome, telefone, credito) {
  const primeiroNome = nome.split(' ')[0];
  const valorFmt = 'R$ ' + Number(credito).toFixed(2).replace('.', ',');
  const msg = `Olá, ${primeiroNome}! 👋\n\nVocê tem ${valorFmt} de crédito disponível na EXIT GAMES!\n\nQue tal usar agora e garantir uma nova aventura? 🎮\n\n📅 Agende: exitsystem.net`;
  const tel = telefone.replace(/\D/g, '');
  const url = tel
    ? `https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

// ── Campanha para todos os inativos ─────────────────────────────
function _campanhaTodos() {
  // Tenta usar M12 se disponível
  if (window.__KEYO_M12_LOADED__) {
    const inativos = _calcInativos();
    if (inativos.length === 0) {
      window.toast('Nenhum cliente inativo para campanha.', 'info');
      return;
    }
    // Abre KEYO na aba de Campanhas
    if (typeof window.goTo === 'function') window.goTo('keyo');
    setTimeout(function() {
      if (typeof window.keyo_abrirModulo === 'function') window.keyo_abrirModulo('campanhas');
    }, 200);
    window.toast(`${inativos.length} clientes inativos — crie uma campanha de reativação!`, 'ok');
    return;
  }

  // M12 não instalado: abre WhatsApp com mensagem genérica
  window.toast('Módulo M12 não instalado. Abrindo WhatsApp...', 'info');
  const msg = `Olá! 🎮 Sentimos sua falta na EXIT GAMES!\n\nTemos novidades incríveis esperando por você. Venha jogar conosco!\n\n📅 Agende: exitsystem.net`;
  window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
}

// ── Abrir M13 ────────────────────────────────────────────────────
function _abrirM13() {
  if (!window.__KEYO_M13_LOADED__) {
    window.toast('Módulo M13 não instalado.', 'warn');
    return;
  }
  if (typeof window.goTo === 'function') window.goTo('keyo');
  setTimeout(function() {
    if (typeof window.keyo_abrirModulo === 'function') window.keyo_abrirModulo('churn');
  }, 200);
}

// ── Atualizar painel (re-renderiza) ──────────────────────────────
function _atualizar() {
  const pKeyo = document.getElementById('crm-conteudo-keyo');
  if (pKeyo) {
    pKeyo.innerHTML = _htmlPainelKeyo();
    pKeyo.dataset.rendered = '1';
    window.toast('Painel atualizado!', 'ok');
  }
}

// ════════════════════════════════════════════════════════════════
// EXPÕE GLOBALMENTE
// ════════════════════════════════════════════════════════════════
window.crm_trocarAba        = _trocarAba;
window.crm_atualizar        = _atualizar;
window.crm_campanhaTodos    = _campanhaTodos;
window.crm_abrirM13         = _abrirM13;
window.crm_contatarCliente  = _contatarCliente;
window.crm_parabens         = _parabens;
window.crm_lembrarCredito   = _lembrarCredito;

console.info('[KEYO-CRM] ✅ Fase 3 — KEYO CRM v1.0 carregado. (3.1 patch renderPage | 3.2 alertas | 3.3 ações)');

})();

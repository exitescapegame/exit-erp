// ═══════════════════════════════════════════════════════════════
// EXIT GAMES — KEYO M15: DASHBOARD KPIs v1.3
// Arquivo: keyo-04-m15-kpis.js
// Depende de: ERP base (_setTimerSeguro, _limparTimerSeguro, san)
// Acessa: DB.vendas, DB.clientes, DB.unidades
// NUNCA modificar funções do ERP base. (Lei #2)
// ───────────────────────────────────────────────────────────────
// MUDANÇAS v1.2 → v1.3 (apenas correções — lógica de IA intacta):
//   [v1.3-A] Chat inline agora aparece já no 1º "Analisar com IA"
//            (antes ficava em display:none até o refresh de 60s).
//   [v1.3-B] fetch com timeout/abort (30s) → não trava mais o módulo
//            se a Edge Function pendurar.
//   [v1.3-C] refresh de 60s não re-renderiza enquanto você digita no
//            chat ou durante uma chamada (não apaga mais o texto).
//   [v1.3-D] mensagens do chat sanitizadas com san() do ERP.
//   Nada da inteligência do KEYO mudou: prompt, contexto, agente fin,
//   _k15CalcKPIs e todos os nomes públicos seguem iguais.
// ═══════════════════════════════════════════════════════════════
(function _KEYO_M15() {
'use strict';

if (window.__KEYO_M15_LOADED__) { console.warn('[KEYO-M15] Já carregado.'); return; }
if (!window.__KEYO_00_LOADED__) { console.error('[KEYO-M15] Core não carregado. Abortando.'); return; }
window.__KEYO_M15_LOADED__ = true;

// ── VERIFICAÇÃO DE DEPENDÊNCIAS ─────────────────────────────────
const _DEPS = ['toast', 'uid', 'hoje', 'fM', 'san', '_setTimerSeguro', '_limparTimerSeguro'];
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

/* ── card IA ──────────────────────────────────────────────── */
#m15-ia-card{background:linear-gradient(135deg,#0f1120,#1a1f3a);border:1px solid #2e3460;border-radius:14px;padding:18px 20px;margin-bottom:14px;color:#e8eaf6}
#m15-ia-card .m15-card-title{color:#7986cb;border-bottom:1px solid #2e3460;padding-bottom:10px;margin-bottom:14px}
#m15-ia-card .m15-card-title span:first-child{color:#9fa8da}
#m15-ia-btn{background:#3949ab;border:none;border-radius:20px;color:#fff;font-size:11px;font-weight:600;padding:5px 14px;cursor:pointer;font-family:inherit;transition:background .15s;white-space:nowrap}
#m15-ia-btn:hover{background:#5c6bc0}
#m15-ia-btn:disabled{background:#2e3460;color:#5c6bc0;cursor:not-allowed}

/* área de resposta */
#m15-ia-resposta{font-size:13px;line-height:1.7;color:#c5cae9;min-height:20px;white-space:pre-wrap;word-break:break-word}
#m15-ia-resposta.vazio{color:#4a5080;font-style:italic}
#m15-ia-dots{display:inline-flex;gap:4px;align-items:center;padding:4px 0}
#m15-ia-dots span{width:6px;height:6px;border-radius:50%;background:#5c6bc0;animation:m15pulse 1.2s infinite}
#m15-ia-dots span:nth-child(2){animation-delay:.2s}
#m15-ia-dots span:nth-child(3){animation-delay:.4s}
@keyframes m15pulse{0%,80%,100%{opacity:.2}40%{opacity:1}}

/* seções do resumo IA */
.m15-ia-secao{margin-bottom:14px}
.m15-ia-secao-titulo{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#7986cb;margin-bottom:6px}
.m15-ia-secao-corpo{font-size:13px;color:#c5cae9;line-height:1.65}
.m15-ia-anomalia{background:rgba(244,67,54,.1);border-left:3px solid #ef5350;border-radius:4px;padding:8px 12px;margin-bottom:6px;font-size:12px;color:#ef9a9a}
.m15-ia-acao{background:rgba(76,175,80,.08);border-left:3px solid #66bb6a;border-radius:4px;padding:8px 12px;margin-bottom:6px;font-size:12px;color:#a5d6a7}

/* chat inline */
#m15-ia-chat{margin-top:16px;border-top:1px solid #2e3460;padding-top:14px}
#m15-ia-chat-historico{max-height:200px;overflow-y:auto;margin-bottom:10px;display:flex;flex-direction:column;gap:8px}
.m15-chat-msg{font-size:12px;line-height:1.6;padding:8px 12px;border-radius:10px;max-width:90%}
.m15-chat-msg.user{background:#1e2442;color:#9fa8da;align-self:flex-end;border-radius:10px 10px 2px 10px}
.m15-chat-msg.ia{background:#161b30;color:#c5cae9;align-self:flex-start;border-radius:10px 10px 10px 2px}
#m15-ia-chat-input-wrap{display:flex;gap:8px;align-items:flex-end}
#m15-ia-chat-input{flex:1;background:#1a1f3a;border:1px solid #2e3460;border-radius:10px;padding:9px 12px;font-size:12px;color:#e8eaf6;font-family:inherit;resize:none;outline:none;min-height:36px;max-height:100px;line-height:1.4}
#m15-ia-chat-input::placeholder{color:#4a5080}
#m15-ia-chat-input:focus{border-color:#5c6bc0}
#m15-ia-chat-send{background:#3949ab;border:none;border-radius:10px;color:#fff;font-size:12px;font-weight:600;padding:9px 14px;cursor:pointer;font-family:inherit;white-space:nowrap;transition:background .15s}
#m15-ia-chat-send:hover{background:#5c6bc0}
#m15-ia-chat-send:disabled{background:#2e3460;color:#5c6bc0;cursor:not-allowed}
`;
  document.head.appendChild(s);
})();

// ════════════════════════════════════════════════════════════════
// ESTADO
// ════════════════════════════════════════════════════════════════
let _periodo        = 'mes';
let _iaLoading      = false;      // mutex — impede chamadas simultâneas
let _iaResumo       = null;       // último resumo retornado pela IA
let _iaChatHistorico = [];        // [{ role, content }]

// ════════════════════════════════════════════════════════════════
// HELPERS DE ACESSO AO DB
// ════════════════════════════════════════════════════════════════
function _vendas()   { return window.DB?.vendas   || []; }
function _clientes() { return window.DB?.clientes || []; }

function _hoje() {
  return typeof window.hoje === 'function' ? window.hoje() : new Date().toISOString().slice(0,10);
}

function _fmtMoeda(v) {
  return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
}

function _fmtData(d) {
  if (!d) return '—';
  const [, m, dd] = d.split('-');
  return `${dd}/${m}`;
}

// [v1.3-D] escape de HTML — usa o san() canônico do ERP, com fallback local
function _esc(s) {
  if (typeof window.san === 'function') return window.san(s);
  const d = document.createElement('div');
  d.textContent = String(s == null ? '' : s);
  return d.innerHTML;
}

// [v1.3-B] fetch com timeout/abort — evita travar _iaLoading se a Edge pendurar
function _fetchComTimeout(url, opts, ms = 30000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

// ════════════════════════════════════════════════════════════════
// 2D.1 — _k15CalcKPIs()
// Único ponto de cálculo. Retorna objeto com todos os indicadores.
// ════════════════════════════════════════════════════════════════
function _k15CalcKPIs() {
  const hj      = _hoje();
  const semAnt  = (function() {
    const d = new Date(hj);
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0,10);
  })();
  const mesAtual = hj.slice(0,7);
  const mesAnt   = (function() {
    const d = new Date(hj + 'T12:00:00');
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0,7);
  })();

  const todasVendas = _vendas();

  function _filtrarPeriodo(lista, periodo) {
    const confirmadas = lista.filter(v => v.status === 'confirmado');
    if (periodo === 'hoje') return confirmadas.filter(v => v.data === hj);
    if (periodo === 'mes')  return confirmadas.filter(v => v.data?.startsWith(mesAtual));
    return confirmadas;
  }

  function _filtrarComparativo(lista, periodo) {
    const confirmadas = lista.filter(v => v.status === 'confirmado');
    if (periodo === 'hoje') return confirmadas.filter(v => v.data === semAnt);
    if (periodo === 'mes')  return confirmadas.filter(v => v.data?.startsWith(mesAnt));
    return [];
  }

  const vendasAtivas = _filtrarPeriodo(todasVendas, _periodo);
  const vendasComp   = _filtrarComparativo(todasVendas, _periodo);

  const faturamento = vendasAtivas.reduce((s, v) => s + (v.valorTotal || 0), 0);
  const nReservas   = vendasAtivas.length;
  const ticketMedio = nReservas ? faturamento / nReservas : 0;
  const nClientes   = _clientes().length;
  const canceladas  = todasVendas.filter(v => v.status === 'cancelado').length;

  const fatComp  = vendasComp.reduce((s, v) => s + (v.valorTotal || 0), 0);
  const deltaFat = fatComp > 0 ? ((faturamento - fatComp) / fatComp) * 100 : null;

  const porSala = (function() {
    const map = {};
    vendasAtivas.forEach(v => {
      const salas = typeof window.rlsSalas === 'function' ? window.rlsSalas() : [];
      const sala  = salas.find(s => String(s.id) === String(v.salaId));
      const nome  = sala ? `${sala.emoji || '🚪'} ${sala.nome}` : `Sala ${v.salaId}`;
      map[nome] = (map[nome] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  })();

  const ultimasReservas = todasVendas
    .filter(v => v.data)
    .sort((a, b) => b.data?.localeCompare(a.data))
    .slice(0, 8);

  return {
    hj, mesAtual, semAnt, mesAnt,
    faturamento, nReservas, ticketMedio,
    nClientes, canceladas, deltaFat,
    porSala, ultimasReservas,
    // dados brutos para o prompt da IA
    fatComp, nReservasComp: vendasComp.length,
  };
}

// ════════════════════════════════════════════════════════════════
// IA — _k15MontarContexto()
// Serializa os KPIs em texto estruturado para o prompt.
// ════════════════════════════════════════════════════════════════
function _k15MontarContexto(kpis) {
  const periodoLabel = { hoje: 'Hoje', mes: 'Este mês', total: 'Total acumulado' }[_periodo];
  const salasTxt = kpis.porSala.length
    ? kpis.porSala.map(([n, q]) => `  - ${n}: ${q} reserva(s)`).join('\n')
    : '  - Sem dados de sala disponíveis';

  const compTxt = kpis.deltaFat !== null
    ? `Comparativo vs período anterior: ${kpis.deltaFat >= 0 ? '+' : ''}${kpis.deltaFat.toFixed(1)}% em faturamento (base: R$ ${kpis.fatComp.toFixed(2)}, ${kpis.nReservasComp} reserva(s))`
    : 'Comparativo: não disponível para o período "Total"';

  return `DADOS DO DASHBOARD — EXIT GAMES (Escape Room)
Período analisado: ${periodoLabel} (${kpis.hj})
Negócio: salas de escape room em Aracaju (Shopping Jardins) e Salvador (Shopping Barra)

KPIs principais:
  - Faturamento: R$ ${kpis.faturamento.toFixed(2)}
  - Reservas confirmadas: ${kpis.nReservas}
  - Ticket médio: R$ ${kpis.ticketMedio.toFixed(2)}
  - Clientes cadastrados: ${kpis.nClientes}
  - Cancelamentos (total histórico): ${kpis.canceladas}
  - ${compTxt}

Reservas por sala (${periodoLabel}):
${salasTxt}`;
}

// ════════════════════════════════════════════════════════════════
// IA — _k15AnalisarIA()
// Chama Edge Function (agente fin) e renderiza o card de análise.
// ════════════════════════════════════════════════════════════════
async function _k15AnalisarIA() {
  if (_iaLoading) return;
  _iaLoading = true;
  _iaChatHistorico = []; // novo resumo limpa o histórico do chat

  const btn = document.getElementById('m15-ia-btn');
  const res = document.getElementById('m15-ia-resposta');
  if (btn) { btn.disabled = true; btn.textContent = 'Analisando…'; }
  if (res)  res.innerHTML = '<div id="m15-ia-dots"><span></span><span></span><span></span></div>';

  const kpis    = _k15CalcKPIs();
  const contexto = _k15MontarContexto(kpis);

  const prompt = `${contexto}

Você é o analista financeiro da EXIT GAMES. Com base nos dados acima, produza uma análise executiva OBRIGATORIAMENTE no seguinte formato JSON (sem markdown, sem texto fora do JSON):

{
  "resumo": "2-3 frases de diagnóstico geral do período",
  "anomalias": ["anomalia 1 detectada", "anomalia 2 detectada"],
  "acoes": ["ação sugerida 1", "ação sugerida 2", "ação sugerida 3"]
}

Regras:
- anomalias: lista de problemas detectados (queda, sala parada, ticket baixo, etc.). Lista vazia [] se tudo normal.
- acoes: sugestões concretas e práticas para o negócio de escape room.
- Responda SOMENTE com o JSON válido. Nenhum texto antes ou depois.`;

  try {
    const edgeUrl = window.KEYO_EDGE_URL;
    if (!edgeUrl) throw new Error('KEYO_EDGE_URL não definida');

    const r = await _fetchComTimeout(edgeUrl, {   // [v1.3-B]
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agente: 'fin',
        mensagem: prompt,
        historico: [],
        unidade_id: window.UA?.unidadeId || 1,
      }),
    });

    if (!r.ok) throw new Error(`Edge Function retornou ${r.status}`);
    const data = await r.json();
    const texto = data?.resposta || '';

    // parse seguro do JSON retornado
    let parsed = null;
    try {
      const limpo = texto.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(limpo);
    } catch (_) {
      // IA não devolveu JSON válido — exibe texto bruto
      parsed = { resumo: texto, anomalias: [], acoes: [] };
    }

    _iaResumo = parsed;
    _k15RenderCardIA();

  } catch (err) {
    console.error('[KEYO-M15] Erro na chamada IA:', err);
    const msg = err.name === 'AbortError'   // [v1.3-B]
      ? 'Tempo de resposta da IA esgotado. Tente novamente.'
      : 'Não foi possível conectar à IA. Verifique a Edge Function.';
    window.toast(msg, 'erro');
    if (res) res.innerHTML = `<span style="color:#ef5350;font-size:12px">${_esc(msg)}</span>`;
  } finally {
    _iaLoading = false;
    if (btn) { btn.disabled = false; btn.textContent = '🤖 Analisar com IA'; }
  }
}

// ════════════════════════════════════════════════════════════════
// IA — _k15RenderCardIA()
// Atualiza apenas a área de resposta do card — sem re-render total.
// ════════════════════════════════════════════════════════════════
function _k15RenderCardIA() {
  const res = document.getElementById('m15-ia-resposta');
  if (!res) return;

  if (!_iaResumo) {
    res.className = 'vazio';
    res.textContent = 'Clique em "Analisar com IA" para obter um diagnóstico do período.';
    return;
  }

  const { resumo, anomalias = [], acoes = [] } = _iaResumo;

  const anomaliasHtml = anomalias.length
    ? anomalias.map(a => `<div class="m15-ia-anomalia">⚠️ ${_esc(a)}</div>`).join('')   // [v1.3-D]
    : '<div style="font-size:12px;color:#66bb6a">✅ Nenhuma anomalia detectada neste período.</div>';

  const acoesHtml = acoes.length
    ? acoes.map(a => `<div class="m15-ia-acao">→ ${_esc(a)}</div>`).join('')             // [v1.3-D]
    : '';

  res.className = '';
  res.innerHTML = `
<div class="m15-ia-secao">
  <div class="m15-ia-secao-titulo">Diagnóstico</div>
  <div class="m15-ia-secao-corpo">${_esc(resumo)}</div>
</div>
<div class="m15-ia-secao">
  <div class="m15-ia-secao-titulo">Anomalias detectadas</div>
  ${anomaliasHtml}
</div>
${acoes.length ? `
<div class="m15-ia-secao">
  <div class="m15-ia-secao-titulo">Ações sugeridas</div>
  ${acoesHtml}
</div>` : ''}`;

  // renderiza o chat após o primeiro resumo
  _k15RenderChat();
}

// ════════════════════════════════════════════════════════════════
// IA — CHAT INLINE
// ════════════════════════════════════════════════════════════════
function _k15RenderChat() {
  const chat = document.getElementById('m15-ia-chat');
  if (!chat) return;
  chat.style.display = '';   // [v1.3-A] garante visibilidade já no 1º resumo

  const histHtml = _iaChatHistorico.length
    ? _iaChatHistorico.map(m => {
        if (m.loading) {       // [v1.3-A/D] dots de carregamento — HTML interno controlado, não sanitiza
          return '<div class="m15-chat-msg ia"><div id="m15-ia-dots"><span></span><span></span><span></span></div></div>';
        }
        const cls = m.role === 'user' ? 'user' : 'ia';
        return `<div class="m15-chat-msg ${cls}">${_esc(m.content)}</div>`;   // [v1.3-D]
      }).join('')
    : '';

  chat.innerHTML = `
<div id="m15-ia-chat-historico">${histHtml}</div>
<div id="m15-ia-chat-input-wrap">
  <textarea
    id="m15-ia-chat-input"
    placeholder="Pergunte sobre os dados… ex: Por que o ticket caiu?"
    rows="1"
    onkeydown="window.m15_chat_keydown(event)"
  ></textarea>
  <button id="m15-ia-chat-send" onclick="window.m15_chat_enviar()">Enviar</button>
</div>`;

  // scroll para o fim do histórico
  const hist = document.getElementById('m15-ia-chat-historico');
  if (hist) hist.scrollTop = hist.scrollHeight;
}

async function _k15ChatEnviar() {
  if (_iaLoading) return;
  const input = document.getElementById('m15-ia-chat-input');
  const pergunta = input?.value?.trim();
  if (!pergunta) return;

  _iaLoading = true;
  input.value = '';

  const sendBtn = document.getElementById('m15-ia-chat-send');
  if (sendBtn) sendBtn.disabled = true;

  // adiciona mensagem do usuário
  _iaChatHistorico.push({ role: 'user', content: pergunta });
  _k15RenderChat();

  // monta histórico para a Edge Function (injeta contexto no primeiro turno)
  const kpis     = _k15CalcKPIs();
  const contexto = _k15MontarContexto(kpis);
  const resumoTxt = _iaResumo
    ? `\n\nResumo já gerado:\n${_iaResumo.resumo}`
    : '';

  const sistemaContexto = `${contexto}${resumoTxt}

Você é o analista financeiro da EXIT GAMES. Responda de forma direta e objetiva às perguntas sobre os dados acima. Máximo 4 frases por resposta.`;

  // constrói histórico no formato da Edge Function
  const historicoEdge = [
    { role: 'user',      content: sistemaContexto },
    { role: 'assistant', content: 'Entendido. Estou pronto para responder perguntas sobre os KPIs.' },
    ..._iaChatHistorico.slice(0, -1).filter(m => !m.loading).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
  ];

  // dot loading no chat — [v1.3-A] guardado como flag, não como HTML cru
  _iaChatHistorico.push({ role: 'ia', loading: true });
  _k15RenderChat();

  try {
    const edgeUrl = window.KEYO_EDGE_URL;
    if (!edgeUrl) throw new Error('KEYO_EDGE_URL não definida');

    const r = await _fetchComTimeout(edgeUrl, {   // [v1.3-B]
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agente: 'fin',
        mensagem: pergunta,
        historico: historicoEdge,
        unidade_id: window.UA?.unidadeId || 1,
      }),
    });

    if (!r.ok) throw new Error(`Edge Function retornou ${r.status}`);
    const data = await r.json();
    const resposta = data?.resposta?.trim() || '(sem resposta)';

    // substitui o dot loading pela resposta real
    _iaChatHistorico[_iaChatHistorico.length - 1] = { role: 'ia', content: resposta };

  } catch (err) {
    console.error('[KEYO-M15] Erro no chat IA:', err);
    _iaChatHistorico[_iaChatHistorico.length - 1] = {
      role: 'ia',
      content: err.name === 'AbortError'   // [v1.3-B]
        ? '⚠️ Tempo esgotado. Tente novamente.'
        : '⚠️ Erro ao consultar a IA. Tente novamente.',
    };
  } finally {
    _iaLoading = false;
    if (sendBtn) sendBtn.disabled = false;
    _k15RenderChat();
  }
}

function _k15ChatKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    _k15ChatEnviar();
  }
}

// ════════════════════════════════════════════════════════════════
// HTML — card IA (estático — conteúdo atualizado via _k15RenderCardIA)
// ════════════════════════════════════════════════════════════════
function _htmlCardIA() {
  return `
<div id="m15-ia-card">
  <div class="m15-card-title">
    <span>🤖 Análise IA — Agente Financeiro</span>
    <button id="m15-ia-btn" onclick="window.m15_analisar()">🤖 Analisar com IA</button>
  </div>
  <div id="m15-ia-resposta" class="vazio">
    Clique em "Analisar com IA" para obter um diagnóstico do período.
  </div>
  <div id="m15-ia-chat" style="display:none"></div>
</div>`;
}

// ════════════════════════════════════════════════════════════════
// HTML — dashboard completo
// ════════════════════════════════════════════════════════════════
function _html() {
  const kpis         = _k15CalcKPIs();
  const periodoLabel = { hoje: 'Hoje', mes: 'Este mês', total: 'Total' }[_periodo];
  const maxSala      = kpis.porSala[0]?.[1] || 1;

  const deltaHtml = kpis.deltaFat !== null
    ? `<div class="m15-kpi-delta ${kpis.deltaFat >= 0 ? 'up' : 'down'}">
        ${kpis.deltaFat >= 0 ? '▲' : '▼'} ${Math.abs(kpis.deltaFat).toFixed(1)}%
        vs ${_periodo === 'hoje' ? 'semana ant.' : 'mês ant.'}
       </div>`
    : '';

  return `
<div id="m15-wrap">
  <h2>📊 Dashboard KPIs</h2>
  <div class="m15-subtitle">
    Atualizado em ${new Date().toLocaleString('pt-BR')} ·
    <span class="m15-atualizar" onclick="window.m15_atualizar()">Atualizar</span>
  </div>

  <div class="m15-periodo">
    <button class="m15-periodo-btn${_periodo==='hoje'?' active':''}" onclick="window.m15_periodo('hoje')">Hoje</button>
    <button class="m15-periodo-btn${_periodo==='mes'?' active':''}" onclick="window.m15_periodo('mes')">Este mês</button>
    <button class="m15-periodo-btn${_periodo==='total'?' active':''}" onclick="window.m15_periodo('total')">Total</button>
  </div>

  ${_htmlCardIA()}

  <div class="m15-kpis m15-kpis-4">
    <div class="m15-kpi destaque">
      <div class="m15-kpi-n">${_fmtMoeda(kpis.faturamento)}</div>
      <div class="m15-kpi-l">Receita — ${periodoLabel}</div>
      ${deltaHtml}
    </div>
    <div class="m15-kpi">
      <div class="m15-kpi-n">${kpis.nReservas}</div>
      <div class="m15-kpi-l">Reservas confirmadas</div>
    </div>
    <div class="m15-kpi">
      <div class="m15-kpi-n">${_fmtMoeda(kpis.ticketMedio)}</div>
      <div class="m15-kpi-l">Ticket médio</div>
    </div>
    <div class="m15-kpi">
      <div class="m15-kpi-n">${kpis.nClientes}</div>
      <div class="m15-kpi-l">Clientes cadastrados</div>
    </div>
  </div>

  ${kpis.porSala.length ? `
  <div class="m15-card">
    <div class="m15-card-title">Reservas por sala — ${periodoLabel}</div>
    ${kpis.porSala.map(([nome, qtd]) => `
    <div class="m15-bar-wrap">
      <div class="m15-bar-label">
        <span>${nome}</span>
        <span>${qtd} reserva${qtd > 1 ? 's' : ''}</span>
      </div>
      <div class="m15-bar-track">
        <div class="m15-bar-fill" style="width:${Math.round(qtd / maxSala * 100)}%"></div>
      </div>
    </div>`).join('')}
  </div>` : ''}

  <div class="m15-card" style="padding:0;overflow:hidden">
    <div class="m15-card-title" style="padding:14px 20px 0">
      <span>Últimas reservas</span>
      <span style="font-size:10px;color:#aaa;font-weight:400">
        ${kpis.canceladas} cancelamento${kpis.canceladas !== 1 ? 's' : ''} no total
      </span>
    </div>
    ${kpis.ultimasReservas.length ? `
    <table class="m15-table">
      <thead><tr>
        <th>Data</th><th>Sala</th><th>Cliente</th><th>Valor</th><th>Status</th>
      </tr></thead>
      <tbody>
        ${kpis.ultimasReservas.map(v => {
          const salas = typeof window.rlsSalas === 'function' ? window.rlsSalas() : [];
          const sala  = salas.find(s => String(s.id) === String(v.salaId));
          const cli   = _clientes().find(c => String(c.id) === String(v.clienteId));
          return `<tr>
            <td>${_fmtData(v.data)} ${v.horario || ''}</td>
            <td>${sala ? sala.emoji + ' ' + sala.nome : '—'}</td>
            <td>${cli?.nome || 'Walk-in'}</td>
            <td>${_fmtMoeda(v.valorTotal)}</td>
            <td><span class="m15-badge-status ${v.status || 'pendente'}">${v.status || 'pendente'}</span></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>` : '<div class="m15-empty">Nenhuma reserva encontrada ainda.</div>'}
  </div>
</div>`;
}

// ════════════════════════════════════════════════════════════════
// 2D.2 — _k15Start() / _k15Stop() + timer seguro
// ════════════════════════════════════════════════════════════════
function _k15RenderKPIs() {
  const area = document.getElementById('keyo-m15-inline');
  if (!area) return;

  // [v1.3-C] não re-renderiza no meio de uma chamada nem enquanto o usuário
  // digita no chat — senão o refresh de 60s apagaria o texto em digitação.
  const _input = document.getElementById('m15-ia-chat-input');
  const _digitando = _input && (document.activeElement === _input || (_input.value && _input.value.trim()));
  if (_iaLoading || _digitando) return;

  // preserva o estado do card IA antes do re-render
  const iaResumoAntes    = _iaResumo;
  const iaHistAntes      = _iaChatHistorico.slice();

  area.innerHTML = _html();

  // restaura o card IA se havia análise ativa
  if (iaResumoAntes) {
    _iaResumo        = iaResumoAntes;
    _iaChatHistorico = iaHistAntes;
    _k15RenderCardIA();
    const chatEl = document.getElementById('m15-ia-chat');
    if (chatEl) chatEl.style.display = '';
  }
}

function _k15Start() {
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

  window._setTimerSeguro('m15-refresh', _k15RenderKPIs, 60000, true);
}

function _k15Stop() {
  window._limparTimerSeguro('m15-refresh');
}

// ════════════════════════════════════════════════════════════════
// AÇÕES DE PERÍODO
// ════════════════════════════════════════════════════════════════
function _setPeriodo(p) {
  _periodo  = p;
  _iaResumo = null;          // novo período invalida análise anterior
  _iaChatHistorico = [];
  _k15RenderKPIs();
}

// ════════════════════════════════════════════════════════════════
// EXPÕE GLOBALMENTE
// ════════════════════════════════════════════════════════════════
window._m15RenderInline  = _k15Start;       // compatibilidade
window._k15Start         = _k15Start;
window._k15Stop          = _k15Stop;
window._k15CalcKPIs      = _k15CalcKPIs;
window.m15_periodo       = _setPeriodo;
window.m15_atualizar     = _k15RenderKPIs;
window.m15_analisar      = _k15AnalisarIA;
window.m15_chat_enviar   = _k15ChatEnviar;
window.m15_chat_keydown  = _k15ChatKeydown;

console.info('[KEYO-M15] ✅ M15 Dashboard KPIs v1.3 (IA) carregado.');

})();

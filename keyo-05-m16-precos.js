// ═══════════════════════════════════════════════════════════════
// EXIT GAMES — KEYO M16: PRECIFICAÇÃO DE GRUPOS v1.0
// Arquivo: keyo-05-m16-precos.js
// Depende de: keyo-00-core.js e keyo-01-ui.js (carregar antes)
// Acessa: rlsSalas(), DB.unidades
// NUNCA modificar funções do ERP base.
// ═══════════════════════════════════════════════════════════════
(function _KEYO_M16() {
'use strict';

if (window.__KEYO_M16_LOADED__) { console.warn('[KEYO-M16] Já carregado.'); return; }
if (!window.__KEYO_00_LOADED__) { console.error('[KEYO-M16] Core não carregado. Abortando.'); return; }
window.__KEYO_M16_LOADED__ = true;

// ── VERIFICAÇÃO DE DEPENDÊNCIAS ─────────────────────────────────
const _DEPS = ['toast', 'uid', 'hoje', 'fM', 'san']; // UA/DB/sDB/isAdm são pós-login
const _depsFaltando = _DEPS.filter(d => typeof window[d] === 'undefined');
if (_depsFaltando.length > 0) {
  console.error('[KEYO-M16] Dependências ausentes:', _depsFaltando, '— módulo abortado.');
  window.__KEYO_M16_LOADED__ = false;
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
      console.error('[KEYO-M16] ⚠️ Função ERP sobrescrita indevidamente:', fn);
    }
  });
}, { once: true });

// ════════════════════════════════════════════════════════════════
// CSS
// ════════════════════════════════════════════════════════════════
(function _css() {
  if (document.getElementById('keyo-m16-css')) return;
  const s = document.createElement('style');
  s.id = 'keyo-m16-css';
  s.textContent = `
#m16-wrap{padding:20px;max-width:620px;margin:0 auto}
#m16-wrap h2{font-size:16px;font-weight:700;color:#111118;margin-bottom:18px;display:flex;align-items:center;gap:8px}
.m16-card{background:#fff;border:1px solid #e8e8f0;border-radius:14px;padding:18px 20px;margin-bottom:14px;box-shadow:0 1px 4px rgba(0,0,0,0.05)}
.m16-card-title{font-size:11px;font-weight:700;color:#888899;text-transform:uppercase;letter-spacing:.8px;margin-bottom:14px}
.m16-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.m16-row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.m16-campo{display:flex;flex-direction:column;gap:5px}
.m16-campo label{font-size:12px;color:#555566;font-weight:500}
.m16-campo input,.m16-campo select{font-family:inherit;font-size:13px;padding:9px 12px;border:1px solid #d8d8e8;border-radius:10px;background:#f9f9fc;color:#111118;outline:none;transition:border .15s}
.m16-campo input:focus,.m16-campo select:focus{border-color:#C9A84C;background:#fff;box-shadow:0 0 0 3px rgba(201,168,76,.1)}
.m16-campo input[type=number]{-moz-appearance:textfield}
.m16-campo input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
.m16-btn-calc{width:100%;padding:12px;background:#C9A84C;border:none;border-radius:10px;font-size:14px;font-weight:700;color:#000;cursor:pointer;font-family:inherit;transition:background .15s;margin-top:4px}
.m16-btn-calc:hover{background:#b8962e}
.m16-btn-calc:disabled{opacity:.4;cursor:not-allowed}

/* resultado */
#m16-resultado{display:none}
.m16-result-total{background:linear-gradient(135deg,#C9A84C,#e8c76a);border-radius:14px;padding:20px 24px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center}
.m16-result-total-label{font-size:13px;font-weight:600;color:rgba(0,0,0,0.7)}
.m16-result-total-valor{font-size:28px;font-weight:800;color:#000}
.m16-result-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px}
.m16-stat{background:#fff;border:1px solid #e8e8f0;border-radius:10px;padding:12px 14px;text-align:center}
.m16-stat-n{font-size:18px;font-weight:700;color:#111118}
.m16-stat-l{font-size:10px;color:#888899;margin-top:3px}
.m16-resumo-box{background:#f4f4fa;border-radius:10px;padding:14px 16px;font-size:12px;line-height:1.8;color:#333344;white-space:pre-wrap;font-family:inherit;border:1px solid #e8e8f0}
.m16-resumo-actions{display:flex;gap:8px;margin-top:10px}
.m16-btn-sec{flex:1;padding:9px;background:#fff;border:1px solid #d8d8e8;border-radius:8px;font-size:12px;font-weight:500;color:#333344;cursor:pointer;font-family:inherit;transition:all .15s}
.m16-btn-sec:hover{border-color:#C9A84C;color:#C9A84C}
.m16-btn-wpp{background:#25D366;border-color:#25D366;color:#fff}
.m16-btn-wpp:hover{background:#1ebe5a;border-color:#1ebe5a;color:#fff}

/* sala chips */
.m16-salas-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.m16-sala-chip{border:1px solid #d8d8e8;border-radius:10px;padding:10px 12px;cursor:pointer;background:#f9f9fc;transition:all .15s;text-align:left}
.m16-sala-chip:hover{border-color:#C9A84C;background:#fffbf0}
.m16-sala-chip.selected{border-color:#C9A84C;background:rgba(201,168,76,.1);font-weight:600}
.m16-sala-chip.disabled{opacity:.35;cursor:not-allowed;pointer-events:none}
.m16-sala-nome{font-size:12px;font-weight:500;color:#111118}
.m16-sala-info{font-size:10px;color:#888899;margin-top:2px}
.m16-sala-emoji{font-size:18px;margin-bottom:4px}
.m16-tag{display:inline-block;font-size:10px;padding:2px 7px;border-radius:20px;margin-top:4px}
.m16-tag-dif-Fácil{background:#eaf3de;color:#3b6d11}
.m16-tag-dif-Médio{background:#fff3cd;color:#856404}
.m16-tag-dif-Difícil{background:#f8d7da;color:#842029}
.m16-tag-dif-Extremo{background:#2d0a0a;color:#ff6b6b}

.m16-empty{text-align:center;padding:30px;color:#aaa;font-size:13px}
.m16-desconto-row{display:flex;align-items:center;gap:8px}
.m16-desconto-row input{width:80px}
.m16-desconto-row span{font-size:12px;color:#888899}
`;
  document.head.appendChild(s);
})();

// ════════════════════════════════════════════════════════════════
// ESTADO
// ════════════════════════════════════════════════════════════════
let _unidadeId  = null;
let _salaId     = null;
let _pessoas    = 2;
let _data       = new Date().toISOString().slice(0, 10);
let _desconto   = 0;
let _resultado  = null;

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════
function _unidades() {
  return (window.DB && window.DB.unidades) ? window.DB.unidades : [];
}

function _salas() {
  try { return window.rlsSalas ? window.rlsSalas() : []; }
  catch(e) { return []; }
}

function _salasDaUnidade(unidadeId) {
  return _salas().filter(s => String(s.unidadeId) === String(unidadeId));
}

function _isFimSemana(dataStr, unidade) {
  const d = new Date(dataStr + 'T12:00:00');
  const dow = d.getDay(); // 0=dom,6=sab
  const dias = unidade.diasFimSemana || [0, 6];
  return dias.includes(dow);
}

function _isFeriado(dataStr) {
  // Feriados nacionais fixos (pode expandir)
  const feriados = [
    '01-01','04-21','05-01','09-07','10-12','11-02','11-15','11-20','12-25'
  ];
  const mmdd = dataStr.slice(5);
  return feriados.includes(mmdd);
}

function _precoBase(unidade, dataStr) {
  if (_isFeriado(dataStr)) return unidade.precoFeriado || unidade.precoFimSemana || 45;
  if (_isFimSemana(dataStr, unidade)) return unidade.precoFimSemana || 45;
  return unidade.precoSemana || 35;
}

function _tipoDia(unidade, dataStr) {
  if (_isFeriado(dataStr)) return 'Feriado';
  if (_isFimSemana(dataStr, unidade)) return 'Fim de semana';
  return 'Semana';
}

function _fmtMoeda(v) {
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',');
}

function _fmtData(dataStr) {
  const [y, m, d] = dataStr.split('-');
  return `${d}/${m}/${y}`;
}

function _nomeDia(dataStr) {
  const dias = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  return dias[new Date(dataStr + 'T12:00:00').getDay()];
}

// ════════════════════════════════════════════════════════════════
// RENDER PRINCIPAL (inline dentro do keyo-main)
// ════════════════════════════════════════════════════════════════
function _renderInline() {
  const anterior = document.getElementById('keyo-m16-inline');
  if (anterior) anterior.remove();

  const msgs      = document.getElementById('keyo-msgs');
  const inputArea = document.getElementById('keyo-input-area');
  if (msgs)      msgs.style.display      = 'none';
  if (inputArea) inputArea.style.display = 'none';

  const main = document.getElementById('keyo-main');
  if (!main) return;

  const area = document.createElement('div');
  area.id = 'keyo-m16-inline';
  area.style.cssText = 'flex:1;overflow-y:auto';
  area.innerHTML = _html();
  main.appendChild(area);

  _bindEventos();
  _renderSalas();
}

// ════════════════════════════════════════════════════════════════
// HTML
// ════════════════════════════════════════════════════════════════
function _html() {
  const uns = _unidades();
  const hoje = new Date().toISOString().slice(0, 10);

  return `
<div id="m16-wrap">
  <h2>💰 Precificação de Grupos</h2>

  <div class="m16-card">
    <div class="m16-card-title">1 · Configuração</div>
    <div class="m16-row" style="margin-bottom:12px">
      <div class="m16-campo">
        <label>Unidade</label>
        <select id="m16-unidade" onchange="window.m16_trocarUnidade()">
          <option value="">Selecione...</option>
          ${uns.map(u => `<option value="${u.id}">${u.nome}</option>`).join('')}
        </select>
      </div>
      <div class="m16-campo">
        <label>Data</label>
        <input type="date" id="m16-data" value="${hoje}" onchange="window.m16_calcular()">
      </div>
    </div>
    <div class="m16-row">
      <div class="m16-campo">
        <label>Nº de pessoas</label>
        <input type="number" id="m16-pessoas" value="2" min="1" max="50"
               onchange="window.m16_calcular()">
      </div>
      <div class="m16-campo">
        <label>Desconto (%)</label>
        <div class="m16-desconto-row">
          <input type="number" id="m16-desconto" value="0" min="0" max="100"
                 onchange="window.m16_calcular()">
          <span>% sobre o total</span>
        </div>
      </div>
    </div>
  </div>

  <div class="m16-card">
    <div class="m16-card-title">2 · Sala</div>
    <div id="m16-salas-container">
      <div class="m16-empty">Selecione uma unidade para ver as salas.</div>
    </div>
  </div>

  <button class="m16-btn-calc" id="m16-btn-calc" onclick="window.m16_calcular()" disabled>
    Calcular preço
  </button>

  <div id="m16-resultado">
    <div class="m16-result-total">
      <div>
        <div class="m16-result-total-label">Total do grupo</div>
        <div style="font-size:11px;color:rgba(0,0,0,0.5);margin-top:2px" id="m16-res-sub"></div>
      </div>
      <div class="m16-result-total-valor" id="m16-res-total">R$ 0,00</div>
    </div>

    <div class="m16-result-grid">
      <div class="m16-stat">
        <div class="m16-stat-n" id="m16-res-base">R$ 0,00</div>
        <div class="m16-stat-l">Preço base</div>
      </div>
      <div class="m16-stat">
        <div class="m16-stat-n" id="m16-res-desc">R$ 0,00</div>
        <div class="m16-stat-l">Desconto</div>
      </div>
      <div class="m16-stat">
        <div class="m16-stat-n" id="m16-res-pp">R$ 0,00</div>
        <div class="m16-stat-l">Por pessoa</div>
      </div>
    </div>

    <div class="m16-card" style="margin-bottom:0">
      <div class="m16-card-title">Resumo para envio</div>
      <div class="m16-resumo-box" id="m16-resumo-txt"></div>
      <div class="m16-resumo-actions">
        <button class="m16-btn-sec" onclick="window.m16_copiar()">📋 Copiar</button>
        <button class="m16-btn-sec m16-btn-wpp" onclick="window.m16_whatsapp()">💬 WhatsApp</button>
        <button class="m16-btn-sec" onclick="window.m16_gerarIA()">🧠 Melhorar com IA</button>
      </div>
    </div>
  </div>
</div>`;
}

// ════════════════════════════════════════════════════════════════
// RENDER SALAS
// ════════════════════════════════════════════════════════════════
function _renderSalas() {
  const container = document.getElementById('m16-salas-container');
  if (!container) return;

  if (!_unidadeId) {
    container.innerHTML = '<div class="m16-empty">Selecione uma unidade para ver as salas.</div>';
    return;
  }

  const pessoas = parseInt(document.getElementById('m16-pessoas')?.value || '2');
  const salas   = _salasDaUnidade(_unidadeId);

  if (!salas.length) {
    container.innerHTML = '<div class="m16-empty">Nenhuma sala encontrada para esta unidade.</div>';
    return;
  }

  container.innerHTML = `<div class="m16-salas-grid">
    ${salas.map(s => {
      const cabeFit  = pessoas >= (s.minJog || 1) && pessoas <= (s.maxJog || 99);
      const selected = String(s.id) === String(_salaId) ? ' selected' : '';
      const disabled = !cabeFit ? ' disabled' : '';
      const hint     = !cabeFit
        ? `${s.minJog}–${s.maxJog} pessoas`
        : `${s.minJog}–${s.maxJog} · ${s.tempo} min`;
      return `
      <div class="m16-sala-chip${selected}${disabled}" onclick="window.m16_selecionarSala('${s.id}')">
        <div class="m16-sala-emoji">${s.emoji || '🚪'}</div>
        <div class="m16-sala-nome">${s.nome}</div>
        <div class="m16-sala-info">${hint}</div>
        <span class="m16-tag m16-tag-dif-${s.dificuldade||'Médio'}">${s.dificuldade||'Médio'}</span>
      </div>`;
    }).join('')}
  </div>`;
}

// ════════════════════════════════════════════════════════════════
// CALCULAR
// ════════════════════════════════════════════════════════════════
function _calcular() {
  const unidadeEl = document.getElementById('m16-unidade');
  const pessoasEl = document.getElementById('m16-pessoas');
  const dataEl    = document.getElementById('m16-data');
  const descontoEl= document.getElementById('m16-desconto');
  const btnCalc   = document.getElementById('m16-btn-calc');

  _unidadeId = unidadeEl?.value || null;
  _pessoas   = parseInt(pessoasEl?.value || '2');
  _data      = dataEl?.value || new Date().toISOString().slice(0, 10);
  _desconto  = parseFloat(descontoEl?.value || '0');

  // Habilita botão se unidade e sala selecionadas
  const pronto = _unidadeId && _salaId;
  if (btnCalc) btnCalc.disabled = !pronto;

  _renderSalas();
  if (!pronto) return;

  const unidade = _unidades().find(u => String(u.id) === String(_unidadeId));
  const sala    = _salas().find(s => String(s.id) === String(_salaId));
  if (!unidade || !sala) return;

  const precoBase   = _precoBase(unidade, _data);
  const total       = precoBase * _pessoas;
  const descValor   = total * (_desconto / 100);
  const totalFinal  = total - descValor;
  const porPessoa   = totalFinal / _pessoas;
  const tipoDia     = _tipoDia(unidade, _data);

  _resultado = { unidade, sala, precoBase, total, descValor, totalFinal, porPessoa, tipoDia };

  // Atualiza UI
  document.getElementById('m16-res-total').textContent = _fmtMoeda(totalFinal);
  document.getElementById('m16-res-base').textContent  = _fmtMoeda(precoBase) + '/pessoa';
  document.getElementById('m16-res-desc').textContent  = _desconto > 0 ? '-' + _fmtMoeda(descValor) : 'Sem desconto';
  document.getElementById('m16-res-pp').textContent    = _fmtMoeda(porPessoa);
  document.getElementById('m16-res-sub').textContent   =
    `${_pessoas} pessoas · ${tipoDia} · ${_fmtData(_data)} (${_nomeDia(_data)})`;

  // Resumo de texto
  const resumo = _gerarResumo(_resultado);
  document.getElementById('m16-resumo-txt').textContent = resumo;

  document.getElementById('m16-resultado').style.display = 'block';
  document.getElementById('m16-resultado').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ════════════════════════════════════════════════════════════════
// GERAR RESUMO TEXTO
// ════════════════════════════════════════════════════════════════
function _gerarResumo(r) {
  const linhas = [
    `🎮 EXIT GAMES — ${r.unidade.nome}`,
    ``,
    `Sala: ${r.sala.emoji || ''} ${r.sala.nome}`,
    `Dificuldade: ${r.sala.dificuldade || 'Médio'} · Duração: ${r.sala.tempo} min`,
    `Capacidade: ${r.sala.minJog}–${r.sala.maxJog} jogadores`,
    ``,
    `📅 Data: ${_fmtData(_data)} (${_nomeDia(_data)}) — ${r.tipoDia}`,
    `👥 Grupo: ${_pessoas} pessoas`,
    ``,
    `💰 Precificação:`,
    `   Preço por pessoa: ${_fmtMoeda(r.precoBase)}`,
    `   Subtotal: ${_fmtMoeda(r.total)}`,
  ];
  if (_desconto > 0) {
    linhas.push(`   Desconto (${_desconto}%): -${_fmtMoeda(r.descValor)}`);
  }
  linhas.push(`   ✅ Total: ${_fmtMoeda(r.totalFinal)}`);
  linhas.push(`   Por pessoa: ${_fmtMoeda(r.porPessoa)}`);
  linhas.push(``);
  linhas.push(`Para agendar, entre em contato:`);
  linhas.push(`📍 ${r.unidade.endereco || r.unidade.nome}`);

  return linhas.join('\n');
}

// ════════════════════════════════════════════════════════════════
// AÇÕES DO RESUMO
// ════════════════════════════════════════════════════════════════
function _copiar() {
  const txt = document.getElementById('m16-resumo-txt')?.textContent || '';
  navigator.clipboard.writeText(txt).then(function() {
    if (typeof window.toast === 'function') window.toast('Copiado!', 'ok');
  }).catch(function() {
    if (typeof window.toast === 'function') window.toast('Erro ao copiar', 'err');
  });
}

function _whatsapp() {
  const txt = document.getElementById('m16-resumo-txt')?.textContent || '';
  const url = 'https://wa.me/?text=' + encodeURIComponent(txt);
  window.open(url, '_blank');
}

async function _gerarIA() {
  if (!_resultado) return;
  if (typeof window.toast === 'function') window.toast('Gerando com IA...', 'info');

  const prompt = `Você é um consultor de vendas da EXIT GAMES.
Reescreva o seguinte resumo de orçamento de forma mais comercial, persuasiva e amigável, mantendo todos os dados.
Use emojis com moderação. Máximo 200 palavras.

${document.getElementById('m16-resumo-txt')?.textContent}`;

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
        agente: 'vendas',
        mensagem: prompt,
        historico: [],
        unidade_id: _unidadeId || 1,
      })
    });
    const data = await resp.json();
    const txt  = data.resposta || data.reply || data.message || data.text || '';
    if (txt) {
      document.getElementById('m16-resumo-txt').textContent = txt;
      if (typeof window.toast === 'function') window.toast('Resumo melhorado!', 'ok');
    }
  } catch(e) {
    console.error('[KEYO-M16] Erro IA:', e);
    if (typeof window.toast === 'function') window.toast('Erro ao conectar IA', 'err');
  }
}

// ════════════════════════════════════════════════════════════════
// BIND EVENTOS
// ════════════════════════════════════════════════════════════════
function _bindEventos() {
  // Atualiza unidadeId quando muda o select
  const selUn = document.getElementById('m16-unidade');
  if (selUn) selUn.addEventListener('change', function() {
    _unidadeId = this.value || null;
    _salaId    = null;
    _renderSalas();
    _calcular();
  });
}

function _trocarUnidade() {
  const sel = document.getElementById('m16-unidade');
  _unidadeId = sel?.value || null;
  _salaId    = null;
  _renderSalas();
  _calcular();
}

function _selecionarSala(id) {
  _salaId = id;
  _renderSalas();
  _calcular();
}

// ════════════════════════════════════════════════════════════════
// EXPÕE GLOBALMENTE
// ════════════════════════════════════════════════════════════════
window._m16RenderInline   = _renderInline;
window.m16_trocarUnidade  = _trocarUnidade;
window.m16_selecionarSala = _selecionarSala;
window.m16_calcular       = _calcular;
window.m16_copiar         = _copiar;
window.m16_whatsapp       = _whatsapp;
window.m16_gerarIA        = _gerarIA;

console.info('[KEYO-M16] ✅ M16 Precificação de Grupos v1.0 carregado.');

})();

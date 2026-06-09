// ═══════════════════════════════════════════════════════════════
// EXIT GAMES — KEYO M14: PROPOSTAS COMERCIAIS v1.0
// Arquivo: keyo-03-m14-propostas.js
// Depende de: keyo-00-core.js e keyo-01-ui.js
// Acessa: DB.unidades, rlsSalas()
// NUNCA modificar funções do ERP base.
// ═══════════════════════════════════════════════════════════════
(function _KEYO_M14() {
'use strict';

if (window.__KEYO_M14_LOADED__) { console.warn('[KEYO-M14] Já carregado.'); return; }
if (!window.__KEYO_00_LOADED__) { console.error('[KEYO-M14] Core não carregado. Abortando.'); return; }
window.__KEYO_M14_LOADED__ = true;

// ── VERIFICAÇÃO DE DEPENDÊNCIAS ─────────────────────────────────
const _DEPS = ['DB', 'UA', 'toast', 'sDB', 'uid', 'hoje', 'fM', 'san', 'isAdm'];
const _depsFaltando = _DEPS.filter(d => typeof window[d] === 'undefined');
if (_depsFaltando.length > 0) {
  console.error('[KEYO-M14] Dependências ausentes:', _depsFaltando, '— módulo abortado.');
  window.__KEYO_M14_LOADED__ = false;
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
      console.error('[KEYO-M14] ⚠️ Função ERP sobrescrita indevidamente:', fn);
    }
  });
}, { once: true });

// ════════════════════════════════════════════════════════════════
// CSS
// ════════════════════════════════════════════════════════════════
(function _css() {
  if (document.getElementById('keyo-m14-css')) return;
  const s = document.createElement('style');
  s.id = 'keyo-m14-css';
  s.textContent = `
#m14-wrap{padding:20px;max-width:640px;margin:0 auto}
#m14-wrap h2{font-size:16px;font-weight:700;color:#111118;margin-bottom:18px;display:flex;align-items:center;gap:8px}
.m14-card{background:#fff;border:1px solid #e8e8f0;border-radius:14px;padding:18px 20px;margin-bottom:14px;box-shadow:0 1px 4px rgba(0,0,0,0.05)}
.m14-card-title{font-size:11px;font-weight:700;color:#888899;text-transform:uppercase;letter-spacing:.8px;margin-bottom:14px}
.m14-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
.m14-row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px}
.m14-campo{display:flex;flex-direction:column;gap:5px}
.m14-campo label{font-size:12px;color:#555566;font-weight:500}
.m14-campo input,.m14-campo select,.m14-campo textarea{font-family:inherit;font-size:13px;padding:9px 12px;border:1px solid #d8d8e8;border-radius:10px;background:#f9f9fc;color:#111118;outline:none;transition:border .15s}
.m14-campo input:focus,.m14-campo select:focus,.m14-campo textarea:focus{border-color:#C9A84C;background:#fff;box-shadow:0 0 0 3px rgba(201,168,76,.1)}
.m14-campo textarea{resize:vertical;min-height:80px}
.m14-btn-gerar{width:100%;padding:12px;background:#C9A84C;border:none;border-radius:10px;font-size:14px;font-weight:700;color:#000;cursor:pointer;font-family:inherit;transition:background .15s;margin-top:4px}
.m14-btn-gerar:hover{background:#b8962e}
.m14-btn-gerar:disabled{opacity:.4;cursor:not-allowed}
.m14-proposta-box{background:#f9f9fc;border:1px solid #e8e8f0;border-radius:10px;padding:16px;font-size:13px;line-height:1.8;color:#111118;white-space:pre-wrap;font-family:inherit;min-height:200px}
.m14-proposta-loading{text-align:center;padding:40px;color:#888899;font-size:13px}
.m14-actions{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
.m14-btn-sec{flex:1;min-width:100px;padding:9px;background:#fff;border:1px solid #d8d8e8;border-radius:8px;font-size:12px;font-weight:500;color:#333344;cursor:pointer;font-family:inherit;transition:all .15s;text-align:center}
.m14-btn-sec:hover{border-color:#C9A84C;color:#C9A84C}
.m14-btn-wpp{background:#25D366;border-color:#25D366;color:#fff}
.m14-btn-wpp:hover{background:#1ebe5a;border-color:#1ebe5a;color:#fff}
.m14-tipo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}
.m14-tipo-btn{border:1px solid #d8d8e8;border-radius:10px;padding:12px 8px;cursor:pointer;background:#f9f9fc;transition:all .15s;text-align:center;font-family:inherit}
.m14-tipo-btn:hover{border-color:#C9A84C;background:#fffbf0}
.m14-tipo-btn.selected{border-color:#C9A84C;background:rgba(201,168,76,.1);font-weight:600}
.m14-tipo-emoji{font-size:22px;display:block;margin-bottom:4px}
.m14-tipo-nome{font-size:12px;color:#111118}
.m14-historico{margin-top:6px}
.m14-hist-item{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f4f4fa;font-size:12px}
.m14-hist-item:last-child{border-bottom:none}
.m14-hist-nome{flex:1;font-weight:500;color:#111118}
.m14-hist-data{font-size:10px;color:#888899}
.m14-hist-btn{background:none;border:1px solid #d8d8e8;border-radius:6px;padding:3px 8px;font-size:11px;color:#555566;cursor:pointer;font-family:inherit}
.m14-hist-btn:hover{border-color:#C9A84C;color:#C9A84C}
`;
  document.head.appendChild(s);
})();

// ════════════════════════════════════════════════════════════════
// ESTADO
// ════════════════════════════════════════════════════════════════
let _tipo       = 'corporativo';
let _proposta   = '';
let _historico  = JSON.parse(localStorage.getItem('keyo_m14_historico') || '[]');

const TIPOS = [
  { id: 'corporativo', emoji: '🏢', nome: 'Corporativo'  },
  { id: 'aniversario', emoji: '🎂', nome: 'Aniversário'  },
  { id: 'escolar',     emoji: '🎓', nome: 'Escolar'      },
  { id: 'grupo',       emoji: '👥', nome: 'Grupo'        },
  { id: 'incentivo',   emoji: '🏆', nome: 'Incentivo'    },
  { id: 'confratern',  emoji: '🥂', nome: 'Confratern.'  },
];

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════
function _salas() {
  try { return window.rlsSalas ? window.rlsSalas() : []; } catch(e) { return []; }
}
function _unidades() {
  return (window.DB && window.DB.unidades) ? window.DB.unidades : [];
}
function _fmtDataHoje() {
  return new Date().toLocaleDateString('pt-BR');
}
function _salvarHistorico(nome, texto) {
  _historico.unshift({ id: Date.now(), nome, texto, data: new Date().toISOString() });
  _historico = _historico.slice(0, 10);
  try { localStorage.setItem('keyo_m14_historico', JSON.stringify(_historico)); } catch(e) {}
}

// ════════════════════════════════════════════════════════════════
// RENDER INLINE
// ════════════════════════════════════════════════════════════════
function _renderInline() {
  const anterior = document.getElementById('keyo-m14-inline');
  if (anterior) anterior.remove();

  const msgs      = document.getElementById('keyo-msgs');
  const inputArea = document.getElementById('keyo-input-area');
  if (msgs)      msgs.style.display      = 'none';
  if (inputArea) inputArea.style.display = 'none';

  const main = document.getElementById('keyo-main');
  if (!main) return;

  const area = document.createElement('div');
  area.id = 'keyo-m14-inline';
  area.style.cssText = 'flex:1;overflow-y:auto';
  area.innerHTML = _html();
  main.appendChild(area);
}

// ════════════════════════════════════════════════════════════════
// HTML
// ════════════════════════════════════════════════════════════════
function _html() {
  const uns   = _unidades();
  const salas = _salas();

  return `
<div id="m14-wrap">
  <h2>📄 Propostas Comerciais</h2>

  <div class="m14-card">
    <div class="m14-card-title">1 · Tipo de proposta</div>
    <div class="m14-tipo-grid">
      ${TIPOS.map(t => `
      <button class="m14-tipo-btn${_tipo===t.id?' selected':''}" onclick="window.m14_tipo('${t.id}')">
        <span class="m14-tipo-emoji">${t.emoji}</span>
        <span class="m14-tipo-nome">${t.nome}</span>
      </button>`).join('')}
    </div>
  </div>

  <div class="m14-card">
    <div class="m14-card-title">2 · Dados do cliente</div>
    <div class="m14-row">
      <div class="m14-campo"><label>Nome / Empresa</label><input type="text" id="m14-cliente" placeholder="Ex: Empresa ABC Ltda"></div>
      <div class="m14-campo"><label>Responsável</label><input type="text" id="m14-responsavel" placeholder="Ex: João Silva"></div>
    </div>
    <div class="m14-row3">
      <div class="m14-campo"><label>Nº de pessoas</label><input type="number" id="m14-pessoas" value="10" min="1"></div>
      <div class="m14-campo"><label>Data sugerida</label><input type="date" id="m14-data" value="${new Date().toISOString().slice(0,10)}"></div>
      <div class="m14-campo"><label>Unidade</label>
        <select id="m14-unidade">
          ${uns.map(u => `<option value="${u.id}">${u.nome}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="m14-campo"><label>Observações / Pedidos especiais</label>
      <textarea id="m14-obs" placeholder="Ex: decoração temática, bolo, data flexível..."></textarea>
    </div>
  </div>

  <button class="m14-btn-gerar" id="m14-btn-gerar" onclick="window.m14_gerar()">
    🧠 Gerar proposta com IA
  </button>

  <div id="m14-resultado" style="display:none">
    <div class="m14-card">
      <div class="m14-card-title">Proposta gerada</div>
      <div class="m14-proposta-box" id="m14-proposta-box"></div>
      <div class="m14-actions">
        <button class="m14-btn-sec" onclick="window.m14_copiar()">📋 Copiar</button>
        <button class="m14-btn-sec m14-btn-wpp" onclick="window.m14_whatsapp()">💬 WhatsApp</button>
        <button class="m14-btn-sec" onclick="window.m14_email()">📧 E-mail</button>
        <button class="m14-btn-sec" onclick="window.m14_regenerar()">🔄 Regenerar</button>
      </div>
    </div>
  </div>

  ${_historico.length ? `
  <div class="m14-card">
    <div class="m14-card-title">Propostas recentes</div>
    <div class="m14-historico">
      ${_historico.slice(0,5).map(h => `
      <div class="m14-hist-item">
        <div class="m14-hist-nome">${h.nome}</div>
        <div class="m14-hist-data">${new Date(h.data).toLocaleDateString('pt-BR')}</div>
        <button class="m14-hist-btn" onclick="window.m14_carregarHistorico(${h.id})">Ver</button>
      </div>`).join('')}
    </div>
  </div>` : ''}
</div>`;
}

// ════════════════════════════════════════════════════════════════
// AÇÕES
// ════════════════════════════════════════════════════════════════
function _setTipo(t) {
  _tipo = t;
  document.querySelectorAll('.m14-tipo-btn').forEach(b => {
    b.classList.toggle('selected', b.getAttribute('onclick').includes(`'${t}'`));
  });
}

async function _gerar() {
  const cliente     = document.getElementById('m14-cliente')?.value.trim();
  const responsavel = document.getElementById('m14-responsavel')?.value.trim();
  const pessoas     = document.getElementById('m14-pessoas')?.value || '10';
  const data        = document.getElementById('m14-data')?.value || '';
  const obs         = document.getElementById('m14-obs')?.value.trim() || '';
  const unidadeId   = document.getElementById('m14-unidade')?.value;

  if (!cliente) {
    if (typeof window.toast === 'function') window.toast('Informe o nome do cliente/empresa', 'warn');
    return;
  }

  const unidade = _unidades().find(u => String(u.id) === String(unidadeId));
  const salas   = _salas().filter(s => String(s.unidadeId) === String(unidadeId));
  const tipoObj = TIPOS.find(t => t.id === _tipo);

  const [y, m, d] = (data || new Date().toISOString().slice(0,10)).split('-');
  const dataFmt = `${d}/${m}/${y}`;

  const prompt = `Você é um consultor comercial da EXIT GAMES, empresa de escape room.
Crie uma proposta comercial profissional e persuasiva para o seguinte cliente:

Tipo: ${tipoObj?.nome || _tipo}
Cliente/Empresa: ${cliente}
${responsavel ? `Responsável: ${responsavel}` : ''}
Número de pessoas: ${pessoas}
Data sugerida: ${dataFmt}
Unidade: ${unidade?.nome || 'EXIT GAMES'}
${obs ? `Observações: ${obs}` : ''}
Salas disponíveis: ${salas.slice(0,4).map(s => `${s.emoji || ''} ${s.nome} (${s.minJog}-${s.maxJog} pessoas, ${s.tempo}min, ${s.dificuldade})`).join(', ')}
Preço semana: R$ ${unidade?.precoSemana || 35}/pessoa | Fim de semana: R$ ${unidade?.precoFimSemana || 45}/pessoa

Estruture a proposta com: saudação, apresentação da experiência, sugestão de salas, preço estimado, diferenciais, próximos passos.
Tom: profissional mas caloroso. Máximo 400 palavras.`;

  const btn = document.getElementById('m14-btn-gerar');
  const box = document.getElementById('m14-proposta-box');
  const resultado = document.getElementById('m14-resultado');

  if (btn) btn.disabled = true;
  resultado.style.display = 'block';
  box.innerHTML = '<div class="m14-proposta-loading">🧠 Gerando proposta...</div>';

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
        agente: 'vendas', mensagem: prompt, historico: [], unidade_id: unidadeId || 1,
      })
    });
    const data2 = await resp.json();
    _proposta = data2.resposta || data2.reply || data2.message || data2.text || '';
    if (_proposta) {
      box.textContent = _proposta;
      _salvarHistorico(cliente, _proposta);
      if (typeof window.toast === 'function') window.toast('Proposta gerada!', 'ok');
    } else {
      box.textContent = 'Não foi possível gerar a proposta. Tente novamente.';
    }
  } catch(e) {
    console.error('[KEYO-M14] Erro IA:', e);
    box.textContent = '⚠️ Erro ao conectar com a IA. Verifique sua conexão.';
  }

  if (btn) btn.disabled = false;
  resultado.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function _copiar() {
  const txt = document.getElementById('m14-proposta-box')?.textContent || '';
  navigator.clipboard.writeText(txt).then(() => {
    if (typeof window.toast === 'function') window.toast('Copiado!', 'ok');
  });
}

function _whatsapp() {
  const txt = document.getElementById('m14-proposta-box')?.textContent || '';
  window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank');
}

function _email() {
  const cliente = document.getElementById('m14-cliente')?.value || 'Cliente';
  const txt     = document.getElementById('m14-proposta-box')?.textContent || '';
  const subject = encodeURIComponent(`Proposta EXIT GAMES — ${cliente}`);
  const body    = encodeURIComponent(txt);
  window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
}

function _regenerar() {
  document.getElementById('m14-resultado').style.display = 'none';
  _proposta = '';
  _gerar();
}

function _carregarHistorico(id) {
  const h = _historico.find(x => x.id === id);
  if (!h) return;
  _proposta = h.texto;
  const resultado = document.getElementById('m14-resultado');
  const box       = document.getElementById('m14-proposta-box');
  if (resultado && box) {
    resultado.style.display = 'block';
    box.textContent = h.texto;
    resultado.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// ════════════════════════════════════════════════════════════════
// EXPÕE GLOBALMENTE
// ════════════════════════════════════════════════════════════════
window._m14RenderInline        = _renderInline;
window.m14_tipo                = _setTipo;
window.m14_gerar               = _gerar;
window.m14_copiar              = _copiar;
window.m14_whatsapp            = _whatsapp;
window.m14_email               = _email;
window.m14_regenerar           = _regenerar;
window.m14_carregarHistorico   = _carregarHistorico;

console.info('[KEYO-M14] ✅ M14 Propostas Comerciais v1.0 carregado.');

})();

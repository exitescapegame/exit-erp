// ═══════════════════════════════════════════════════════════════
// EXIT GAMES — KEYO M12: AGENDADOR DE CAMPANHAS v1.0
// Arquivo: keyo-01-m12-campanhas.js
// Injetar via: <script src="keyo-01-m12-campanhas.js"></script>
// Depende de: keyo-00-core.js e keyo-01-ui.js (carregar antes)
// NUNCA modificar funções do ERP base.
// ═══════════════════════════════════════════════════════════════
(function _KEYO_M12() {
'use strict';

// ── GUARD: bloqueia dupla injeção ───────────────────────────────
if (window.__KEYO_M12_LOADED__) {
  console.warn('[KEYO-M12] Já carregado. Ignorando.');
  return;
}
if (!window.__KEYO_00_LOADED__) {
  console.error('[KEYO-M12] keyo-00-core.js não carregado. Abortando.');
  return;
}
window.__KEYO_M12_LOADED__ = true;

// ── VERIFICAÇÃO DE DEPENDÊNCIAS ─────────────────────────────────
const _DEPS_CRITICAS = ['toast', 'uid', 'hoje', 'fM', 'san'];
const _depsFaltando = _DEPS_CRITICAS.filter(d => typeof window[d] === 'undefined');
if (_depsFaltando.length > 0) {
  console.error('[KEYO-M12] Dependências críticas ausentes:', _depsFaltando, '— módulo abortado.');
  return;
}

// ── FREEZE DE FUNÇÕES CRÍTICAS DO ERP ───────────────────────────
const _ERP_ORIG_RENDER = window.renderPage;
const _ERP_ORIG_RSB    = window.rSb;
const _ERP_ORIG_GOTO   = window.goTo;
const _ERP_ORIG_TOAST  = window.toast;

window.addEventListener('load', function() {
  if (window.rSb    && window.rSb    !== _ERP_ORIG_RSB)    console.error('[KEYO-M12] ⚠️ rSb() sobrescrito!');
  if (window.goTo   && window.goTo   !== _ERP_ORIG_GOTO)   console.error('[KEYO-M12] ⚠️ goTo() sobrescrito!');
  if (window.toast  && window.toast  !== _ERP_ORIG_TOAST)  console.error('[KEYO-M12] ⚠️ toast() sobrescrito!');
}, { once: true });

// ════════════════════════════════════════════════════════════════
// ETAPA 2A.1 — ESTRUTURA DE DADOS E CSS
// ════════════════════════════════════════════════════════════════

// ── Inicializa DB ────────────────────────────────────────────────
function _initDB() {
  if (typeof window.DB === 'undefined') window.DB = {};
  if (!window.DB.keyoCampanhas) window.DB.keyoCampanhas = [];
}
_initDB();

// ── Canais disponíveis ───────────────────────────────────────────
const M12_CANAIS = [
  { id: 'whatsapp',  label: 'WhatsApp',  emoji: '💬' },
  { id: 'email',     label: 'E-mail',    emoji: '📧' },
  { id: 'instagram', label: 'Instagram', emoji: '📸' },
];

// ── Status de campanha ───────────────────────────────────────────
const M12_STATUS = {
  rascunho:  { label: 'Rascunho',   cor: '#888899' },
  agendada:  { label: 'Agendada',   cor: '#2196F3' },
  enviando:  { label: 'Enviando',   cor: '#FF9800' },
  enviada:   { label: 'Enviada',    cor: '#4CAF50' },
  cancelada: { label: 'Cancelada',  cor: '#f44336' },
};

// ── CSS ──────────────────────────────────────────────────────────
(function _injetarCSS() {
  if (document.getElementById('keyo-m12-css')) return;
  const s = document.createElement('style');
  s.id = 'keyo-m12-css';
  s.textContent = `
/* ── M12: layout ── */
#m12-wrap{padding:20px;max-width:960px;margin:0 auto}
#m12-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
#m12-header h2{font-size:18px;font-weight:700;color:#111118;display:flex;align-items:center;gap:8px}
#m12-nova-btn{background:#C9A84C;border:none;border-radius:8px;padding:9px 18px;font-size:13px;font-weight:600;color:#000;cursor:pointer;transition:all .15s}
#m12-nova-btn:hover{background:#b8962e}

/* ── M12: filtros ── */
#m12-filtros{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.m12-filtro-select{background:#fff;border:1px solid #d8d8e8;border-radius:8px;padding:7px 12px;font-size:12px;color:#111118;font-family:inherit;cursor:pointer;outline:none}
.m12-filtro-select:focus{border-color:#C9A84C}

/* ── M12: cards de campanha ── */
#m12-lista{display:flex;flex-direction:column;gap:10px}
.m12-card{background:#fff;border:1px solid #e8e8f0;border-radius:12px;padding:16px;display:flex;align-items:center;gap:14px;transition:box-shadow .15s}
.m12-card:hover{box-shadow:0 2px 8px rgba(0,0,0,0.08)}
.m12-card-canal{width:38px;height:38px;border-radius:10px;background:#f4f4fa;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.m12-card-info{flex:1;min-width:0}
.m12-card-titulo{font-size:14px;font-weight:600;color:#111118;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.m12-card-meta{font-size:11px;color:#888899;margin-top:2px}
.m12-card-status{font-size:11px;font-weight:600;padding:3px 8px;border-radius:20px;color:#fff;flex-shrink:0}
.m12-card-acoes{display:flex;gap:6px;flex-shrink:0}
.m12-btn-sm{border:none;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s}
.m12-btn-preview{background:#f0f0fa;color:#555566}
.m12-btn-preview:hover{background:#e0e0f0}
.m12-btn-aprovar{background:#C9A84C;color:#000}
.m12-btn-aprovar:hover{background:#b8962e}
.m12-btn-cancelar{background:#fff0f0;color:#f44336}
.m12-btn-cancelar:hover{background:#ffe0e0}

/* ── M12: vazio ── */
#m12-vazio{text-align:center;padding:60px 20px;color:#888899}
#m12-vazio .m12-vazio-icon{font-size:48px;margin-bottom:12px}
#m12-vazio p{font-size:13px}

/* ── M12: modal nova campanha ── */
#m12-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9000;display:flex;align-items:center;justify-content:center}
#m12-modal{background:#fff;border-radius:16px;padding:28px;width:520px;max-width:95vw;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.2)}
#m12-modal h3{font-size:16px;font-weight:700;color:#111118;margin-bottom:20px}
.m12-field{margin-bottom:14px}
.m12-field label{display:block;font-size:12px;font-weight:600;color:#444455;margin-bottom:5px}
.m12-field input,.m12-field select,.m12-field textarea{width:100%;background:#f4f4fa;border:1px solid #d8d8e8;border-radius:8px;padding:9px 12px;font-size:13px;font-family:inherit;color:#111118;outline:none;transition:border .15s;box-sizing:border-box}
.m12-field input:focus,.m12-field select:focus,.m12-field textarea:focus{border-color:#C9A84C;box-shadow:0 0 0 3px rgba(201,168,76,.1)}
.m12-field textarea{resize:vertical;min-height:80px}
.m12-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.m12-modal-footer{display:flex;gap:8px;justify-content:flex-end;margin-top:20px}
.m12-btn-salvar{background:#C9A84C;border:none;border-radius:8px;padding:9px 20px;font-size:13px;font-weight:600;color:#000;cursor:pointer}
.m12-btn-salvar:hover{background:#b8962e}
.m12-btn-fechar{background:#f4f4fa;border:none;border-radius:8px;padding:9px 20px;font-size:13px;color:#555566;cursor:pointer}
.m12-btn-fechar:hover{background:#e8e8f0}

/* ── M12: modal preview ── */
#m12-preview-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9000;display:flex;align-items:center;justify-content:center}
#m12-preview-box{background:#fff;border-radius:16px;padding:28px;width:460px;max-width:95vw;box-shadow:0 20px 60px rgba(0,0,0,0.2)}
#m12-preview-box h3{font-size:15px;font-weight:700;margin-bottom:16px}
.m12-preview-canal{font-size:12px;color:#888899;margin-bottom:8px}
.m12-preview-msg{background:#f4f4fa;border-radius:10px;padding:14px;font-size:13px;line-height:1.6;color:#111118;white-space:pre-wrap;margin-bottom:16px}
.m12-preview-agenda{font-size:12px;color:#555566;margin-bottom:16px}
`;
  document.head.appendChild(s);
})();

// ════════════════════════════════════════════════════════════════
// ETAPA 2A.2 — _k12RenderAgendador() — LISTAGEM
// ════════════════════════════════════════════════════════════════
function _k12RenderAgendador() {
  const pc = document.getElementById('pc');
  if (!pc) return;

  pc.innerHTML = `
<div id="m12-wrap">
  <div id="m12-header">
    <h2>📅 Agendador de Campanhas</h2>
    <button id="m12-nova-btn" onclick="window.k12_abrirModal()">+ Nova Campanha</button>
  </div>
  <div id="m12-filtros">
    <select class="m12-filtro-select" id="m12-f-status" onchange="window.k12_renderLista()">
      <option value="">Todos os status</option>
      ${Object.entries(M12_STATUS).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
    </select>
    <select class="m12-filtro-select" id="m12-f-canal" onchange="window.k12_renderLista()">
      <option value="">Todos os canais</option>
      ${M12_CANAIS.map(c => `<option value="${c.id}">${c.emoji} ${c.label}</option>`).join('')}
    </select>
    <select class="m12-filtro-select" id="m12-f-unidade" onchange="window.k12_renderLista()">
      <option value="">Todas as unidades</option>
      <option value="1">Aracaju</option>
      <option value="2">Salvador</option>
    </select>
  </div>
  <div id="m12-lista"></div>
</div>`;

  _k12RenderLista();
}

function _k12RenderLista() {
  const lista = document.getElementById('m12-lista');
  if (!lista) return;

  const fStatus  = document.getElementById('m12-f-status')?.value  || '';
  const fCanal   = document.getElementById('m12-f-canal')?.value   || '';
  const fUnidade = document.getElementById('m12-f-unidade')?.value || '';

  let campanhas = (window.DB.keyoCampanhas || []).filter(c => {
    if (fStatus  && c.status    !== fStatus)           return false;
    if (fCanal   && c.canal     !== fCanal)            return false;
    if (fUnidade && String(c.unidadeId) !== fUnidade)  return false;
    return true;
  });

  // Ordena: agendadas primeiro, depois por data
  campanhas.sort((a, b) => {
    const ordem = { agendada:0, enviando:1, rascunho:2, enviada:3, cancelada:4 };
    if (ordem[a.status] !== ordem[b.status]) return ordem[a.status] - ordem[b.status];
    return (a.dataEnvio + a.horaEnvio) < (b.dataEnvio + b.horaEnvio) ? -1 : 1;
  });

  if (campanhas.length === 0) {
    lista.innerHTML = `
<div id="m12-vazio">
  <div class="m12-vazio-icon">📭</div>
  <p>Nenhuma campanha encontrada.<br>Clique em <strong>+ Nova Campanha</strong> para começar.</p>
</div>`;
    return;
  }

  lista.innerHTML = campanhas.map(c => {
    const canal   = M12_CANAIS.find(ch => ch.id === c.canal) || { emoji: '📢', label: c.canal };
    const status  = M12_STATUS[c.status] || { label: c.status, cor: '#888' };
    const unidade = c.unidadeId == 1 ? 'Aracaju' : c.unidadeId == 2 ? 'Salvador' : 'Todas';
    const dataHr  = c.dataEnvio ? `${c.dataEnvio} às ${c.horaEnvio}` : 'Sem data';

    const botoesAcao = c.status === 'rascunho' ? `
      <button class="m12-btn-sm m12-btn-aprovar"  onclick="window.k12_aprovar('${c.id}')">✓ Agendar</button>
      <button class="m12-btn-sm m12-btn-cancelar" onclick="window.k12_cancelar('${c.id}')">✕</button>
    ` : c.status === 'agendada' ? `
      <button class="m12-btn-sm m12-btn-cancelar" onclick="window.k12_cancelar('${c.id}')">✕ Cancelar</button>
    ` : '';

    return `
<div class="m12-card">
  <div class="m12-card-canal">${canal.emoji}</div>
  <div class="m12-card-info">
    <div class="m12-card-titulo">${_san(c.titulo)}</div>
    <div class="m12-card-meta">${canal.label} · ${unidade} · ${dataHr}</div>
  </div>
  <div class="m12-card-status" style="background:${status.cor}">${status.label}</div>
  <div class="m12-card-acoes">
    <button class="m12-btn-sm m12-btn-preview" onclick="window.k12_preview('${c.id}')">👁 Ver</button>
    ${botoesAcao}
  </div>
</div>`;
  }).join('');
}

// ── Sanitize helper local ────────────────────────────────────────
function _san(txt) {
  if (typeof window.san === 'function') return window.san(txt);
  return String(txt || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ════════════════════════════════════════════════════════════════
// ETAPA 2A.3 — MODAL NOVA CAMPANHA + SALVAR
// ════════════════════════════════════════════════════════════════
function _k12AbrirModal(id) {
  // Remove modal existente se houver
  const existe = document.getElementById('m12-modal-overlay');
  if (existe) existe.remove();

  const campanha = id ? (window.DB.keyoCampanhas || []).find(c => c.id === id) : null;
  const c = campanha || {};

  const overlay = document.createElement('div');
  overlay.id = 'm12-modal-overlay';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

  overlay.innerHTML = `
<div id="m12-modal">
  <h3>${id ? '✏️ Editar Campanha' : '📅 Nova Campanha'}</h3>

  <div class="m12-field">
    <label>Título da campanha *</label>
    <input type="text" id="m12-titulo" placeholder="Ex: Promoção Dia das Mães" maxlength="80"
           value="${_san(c.titulo || '')}">
  </div>

  <div class="m12-row">
    <div class="m12-field">
      <label>Canal *</label>
      <select id="m12-canal">
        <option value="">Selecione...</option>
        ${M12_CANAIS.map(ch => `<option value="${ch.id}" ${c.canal === ch.id ? 'selected' : ''}>${ch.emoji} ${ch.label}</option>`).join('')}
      </select>
    </div>
    <div class="m12-field">
      <label>Unidade *</label>
      <select id="m12-unidade">
        <option value="">Selecione...</option>
        <option value="1" ${c.unidadeId == 1 ? 'selected' : ''}>Aracaju</option>
        <option value="2" ${c.unidadeId == 2 ? 'selected' : ''}>Salvador</option>
        <option value="0" ${c.unidadeId == 0 ? 'selected' : ''}>Todas</option>
      </select>
    </div>
  </div>

  <div class="m12-row">
    <div class="m12-field">
      <label>Data de envio *</label>
      <input type="date" id="m12-data" value="${c.dataEnvio || ''}">
    </div>
    <div class="m12-field">
      <label>Horário *</label>
      <input type="time" id="m12-hora" value="${c.horaEnvio || '10:00'}">
    </div>
  </div>

  <div class="m12-field">
    <label>Mensagem *</label>
    <textarea id="m12-mensagem" placeholder="Digite o texto da campanha..."
              rows="4">${_san(c.mensagem || '')}</textarea>
  </div>

  <div class="m12-field">
    <label>💡 Gerar mensagem com IA</label>
    <div style="display:flex;gap:8px">
      <input type="text" id="m12-ia-prompt" placeholder="Ex: promoção 20% para grupos de empresa"
             style="flex:1">
      <button class="m12-btn-sm m12-btn-aprovar" onclick="window.k12_gerarIA()"
              style="padding:8px 14px;white-space:nowrap">✨ Gerar</button>
    </div>
  </div>

  <div class="m12-modal-footer">
    <button class="m12-btn-fechar" onclick="document.getElementById('m12-modal-overlay').remove()">Cancelar</button>
    <button class="m12-btn-salvar" onclick="window.k12_salvar('${id || ''}')">💾 Salvar</button>
  </div>
</div>`;

  document.body.appendChild(overlay);
}

function _k12Salvar(id) {
  const titulo   = document.getElementById('m12-titulo')?.value.trim();
  const canal    = document.getElementById('m12-canal')?.value;
  const unidade  = document.getElementById('m12-unidade')?.value;
  const data     = document.getElementById('m12-data')?.value;
  const hora     = document.getElementById('m12-hora')?.value;
  const mensagem = document.getElementById('m12-mensagem')?.value.trim();

  // Validações
  if (!titulo)   { window.toast('Informe o título da campanha.', 'warn');   return; }
  if (!canal)    { window.toast('Selecione o canal de envio.', 'warn');      return; }
  if (!unidade)  { window.toast('Selecione a unidade.', 'warn');             return; }
  if (!data)     { window.toast('Informe a data de envio.', 'warn');         return; }
  if (!hora)     { window.toast('Informe o horário de envio.', 'warn');      return; }
  if (!mensagem) { window.toast('Digite a mensagem da campanha.', 'warn');   return; }

  if (!window.DB.keyoCampanhas) window.DB.keyoCampanhas = [];

  if (id) {
    // Editar existente
    const idx = window.DB.keyoCampanhas.findIndex(c => c.id === id);
    if (idx >= 0) {
      window.DB.keyoCampanhas[idx] = {
        ...window.DB.keyoCampanhas[idx],
        titulo, canal, unidadeId: Number(unidade),
        dataEnvio: data, horaEnvio: hora, mensagem,
      };
    }
  } else {
    // Nova campanha
    const nova = {
      id:         typeof window.uid === 'function' ? window.uid() : Date.now().toString(36),
      titulo, canal,
      unidadeId:  Number(unidade),
      dataEnvio:  data,
      horaEnvio:  hora,
      mensagem,
      status:     'rascunho',
      criadoPor:  window.UA?.nome || 'KEYO',
      criadoEm:   new Date().toISOString(),
    };
    window.DB.keyoCampanhas.push(nova);
  }

  // Persiste
  if (typeof window.sDB === 'function') window.sDB();

  document.getElementById('m12-modal-overlay')?.remove();
  window.toast('Campanha salva com sucesso!', 'ok');
  _k12RenderLista();
}

// ── Gerar mensagem com IA ────────────────────────────────────────
async function _k12GerarIA() {
  const prompt  = document.getElementById('m12-ia-prompt')?.value.trim();
  const canal   = document.getElementById('m12-canal')?.value;
  const titulo  = document.getElementById('m12-titulo')?.value.trim();

  if (!prompt) { window.toast('Descreva o tipo de campanha para a IA.', 'warn'); return; }

  const btn = document.querySelector('#m12-modal .m12-btn-aprovar');
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }

  try {
    const jwt = _getJWT();
    const resp = await fetch(window.KEYO_EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + jwt,
        'apikey':         window.KEYO_ANON_KEY || '',
      },
      body: JSON.stringify({
        agente:     'mkt',
        mensagem:   `Crie uma mensagem de campanha de marketing para canal ${canal || 'WhatsApp'} sobre: "${prompt}". Título sugerido: "${titulo || 'Promoção EXIT GAMES'}". A mensagem deve ser direta, atrativa, com no máximo 200 caracteres, em português brasileiro. Retorne SOMENTE o texto da mensagem, sem aspas, sem prefixo.`,
        historico:  [],
        unidade_id: Number(window.UA?.unidade) || 1,
      })
    });

    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    const texto = data.resposta || data.reply || '';

    const textarea = document.getElementById('m12-mensagem');
    if (textarea && texto) {
      textarea.value = texto.replace(/^["']|["']$/g, '').trim();
      window.toast('Mensagem gerada pela IA! Revise antes de salvar.', 'ok');
    }
  } catch(err) {
    window.toast('Erro ao gerar mensagem. Tente novamente.', 'error');
    console.error('[KEYO-M12] Erro IA:', err);
  } finally {
    if (btn) { btn.textContent = '✨ Gerar'; btn.disabled = false; }
  }
}

// ════════════════════════════════════════════════════════════════
// ETAPA 2A.4 — PREVIEW + APROVAR + CANCELAR
// ════════════════════════════════════════════════════════════════
function _k12Preview(id) {
  const c = (window.DB.keyoCampanhas || []).find(c => c.id === id);
  if (!c) return;

  const existe = document.getElementById('m12-preview-overlay');
  if (existe) existe.remove();

  const canal   = M12_CANAIS.find(ch => ch.id === c.canal) || { emoji: '📢', label: c.canal };
  const status  = M12_STATUS[c.status] || { label: c.status, cor: '#888' };
  const unidade = c.unidadeId == 1 ? 'Aracaju' : c.unidadeId == 2 ? 'Salvador' : 'Todas';

  const overlay = document.createElement('div');
  overlay.id = 'm12-preview-overlay';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

  const botoesAcao = c.status === 'rascunho' ? `
    <button class="m12-btn-sm m12-btn-aprovar" onclick="document.getElementById('m12-preview-overlay').remove();window.k12_aprovar('${c.id}')">✓ Agendar</button>
    <button class="m12-btn-sm" style="background:#f0f0fa;color:#555566" onclick="document.getElementById('m12-preview-overlay').remove();window.k12_abrirModal('${c.id}')">✏️ Editar</button>
  ` : '';

  overlay.innerHTML = `
<div id="m12-preview-box">
  <h3>${canal.emoji} ${_san(c.titulo)}</h3>
  <div class="m12-preview-canal">${canal.label} · ${unidade} · <span style="color:${status.cor};font-weight:600">${status.label}</span></div>
  <div class="m12-preview-msg">${_san(c.mensagem)}</div>
  <div class="m12-preview-agenda">📅 Agendado para: <strong>${c.dataEnvio} às ${c.horaEnvio}</strong></div>
  <div style="display:flex;gap:8px;justify-content:flex-end">
    ${botoesAcao}
    <button class="m12-btn-fechar" onclick="document.getElementById('m12-preview-overlay').remove()">Fechar</button>
  </div>
</div>`;

  document.body.appendChild(overlay);
}

function _k12Aprovar(id) {
  const c = (window.DB.keyoCampanhas || []).find(c => c.id === id);
  if (!c) return;

  if (!confirm(`Agendar a campanha "${c.titulo}" para ${c.dataEnvio} às ${c.horaEnvio}?`)) return;

  c.status    = 'agendada';
  c.agendadoEm = new Date().toISOString();

  if (typeof window.sDB === 'function') window.sDB();
  window.toast(`Campanha "${c.titulo}" agendada! 📅`, 'ok');
  _k12RenderLista();

  // Inicia monitoramento de disparo
  _k12IniciarMonitor();
}

function _k12Cancelar(id) {
  const c = (window.DB.keyoCampanhas || []).find(c => c.id === id);
  if (!c) return;

  if (!confirm(`Cancelar a campanha "${c.titulo}"?`)) return;

  c.status      = 'cancelada';
  c.canceladoEm = new Date().toISOString();

  if (typeof window.sDB === 'function') window.sDB();
  window.toast(`Campanha cancelada.`, 'ok');
  _k12RenderLista();
}

// ════════════════════════════════════════════════════════════════
// MOTOR DE DISPARO — monitora campanhas agendadas
// ════════════════════════════════════════════════════════════════
let _m12MonitorInterval = null;

function _k12IniciarMonitor() {
  if (_m12MonitorInterval) return; // já rodando
  _m12MonitorInterval = setInterval(_k12ChecarDisparos, 30000); // checa a cada 30s
  _k12ChecarDisparos(); // checa imediatamente
  console.info('[KEYO-M12] ✅ Monitor de disparos iniciado (30s).');
}

async function _k12ChecarDisparos() {
  const agora = new Date();
  const campanhas = (window.DB.keyoCampanhas || []).filter(c => c.status === 'agendada');

  for (const c of campanhas) {
    if (!c.dataEnvio || !c.horaEnvio) continue;

    const dataHora = new Date(`${c.dataEnvio}T${c.horaEnvio}:00`);
    if (agora >= dataHora) {
      await _k12Disparar(c);
    }
  }
}

async function _k12Disparar(c) {
  c.status = 'enviando';
  if (typeof window.sDB === 'function') window.sDB();

  console.info('[KEYO-M12] 📤 Disparando campanha:', c.titulo, '| Canal:', c.canal);

  try {
    const jwt = _getJWT();
    const resp = await fetch(window.KEYO_EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + jwt,
        'apikey':         window.KEYO_ANON_KEY || '',
      },
      body: JSON.stringify({
        agente:     'mkt',
        mensagem:   `DISPARO DE CAMPANHA\nTítulo: ${c.titulo}\nCanal: ${c.canal}\nUnidade: ${c.unidadeId}\nMensagem: ${c.mensagem}\n\nConfirme o disparo e registre no log.`,
        historico:  [],
        unidade_id: Number(c.unidadeId) || 1,
      })
    });

    if (!resp.ok) throw new Error('HTTP ' + resp.status);

    c.status     = 'enviada';
    c.enviadoEm  = new Date().toISOString();
    if (typeof window.sDB === 'function') window.sDB();

    window.toast(`📤 Campanha "${c.titulo}" enviada via ${c.canal}!`, 'ok');
    console.info('[KEYO-M12] ✅ Campanha enviada:', c.titulo);

    // Atualiza lista se estiver na tela
    if (document.getElementById('m12-lista')) _k12RenderLista();

  } catch(err) {
    c.status = 'agendada'; // volta para agendada em caso de erro
    if (typeof window.sDB === 'function') window.sDB();
    console.error('[KEYO-M12] ❌ Erro ao disparar campanha:', c.titulo, err);
  }
}

// ── Helper: pegar JWT ────────────────────────────────────────────
function _getJWT() {
  try {
    const s = JSON.parse(localStorage.getItem('exit_unidade_session') || '{}');
    return s?.access_token || window._keyoToken || window.SUPA_KEY || window.KEYO_ANON_KEY || '';
  } catch(e) {
    return window.KEYO_ANON_KEY || '';
  }
}

// ════════════════════════════════════════════════════════════════
// MONKEY-PATCH DO renderPage() — intercepta PA === 'keyo-m12'
// ════════════════════════════════════════════════════════════════
(function _patchRenderPage() {
  if (!window.renderPage) return;
  const _orig = window.renderPage;
  window.renderPage = function() {
    if (window.PA === 'keyo-m12') {
      const e = document.getElementById('pc');
      if (e) _k12RenderAgendador();
      return;
    }
    return _orig.apply(this, arguments);
  };
})();

// ════════════════════════════════════════════════════════════════
// INJETAR NO MENU KEYO (sub-item dentro da seção INTELIGÊNCIA)
// ════════════════════════════════════════════════════════════════
function _injetarMenuM12() {
  function _fazer() {
    const keyoItem = document.getElementById('keyo-menu-item');
    if (!keyoItem) return false;
    if (document.getElementById('keyo-m12-menu-item')) return true;

    const item = document.createElement('div');
    item.id = 'keyo-m12-menu-item';
    item.className = 'sb-item';
    item.innerHTML = '&nbsp;&nbsp;📅 <span>Campanhas</span>';
    item.style.cssText = 'cursor:pointer;font-size:12px;padding-left:28px';
    item.onclick = function() {
      window.PA = 'keyo-m12';
      document.querySelectorAll('#sbNav .sb-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      _k12RenderAgendador();
    };

    keyoItem.after(item);
    return true;
  }

  if (!_fazer()) {
    const obs = new MutationObserver(function() {
      if (_fazer()) obs.disconnect();
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }
}

// ════════════════════════════════════════════════════════════════
// EXPÕE GLOBALMENTE
// ════════════════════════════════════════════════════════════════
window.k12_renderLista  = _k12RenderLista;
window.k12_abrirModal   = _k12AbrirModal;
window.k12_salvar       = _k12Salvar;
window.k12_gerarIA      = _k12GerarIA;
window.k12_preview      = _k12Preview;
window.k12_aprovar      = _k12Aprovar;
window.k12_cancelar     = _k12Cancelar;

// ════════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════════
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    _injetarMenuM12();
    _k12IniciarMonitor();
  });
} else {
  _injetarMenuM12();
  _k12IniciarMonitor();
}

console.info('[KEYO-M12] ✅ M12 Agendador de Campanhas v1.0 carregado.');

})();

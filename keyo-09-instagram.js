// ═══════════════════════════════════════════════════════════════
// EXIT GAMES — KEYO INSTAGRAM v1.0
// Arquivo: keyo-09-instagram.js
// Injetar via: <script src="keyo-09-instagram.js"></script>
// Depende de: keyo-00-core.js e keyo-01-ui.js (carregar antes)
// Cobre: Fase 6 do Plano Mestre v2.0
// NUNCA modificar funções do ERP base. (Lei #2)
// Secrets Supabase: IG_APP_ID, IG_APP_SECRET, IG_TOKEN_ARACAJU,
//   IG_TOKEN_SALVADOR, IG_USER_ARACAJU, IG_USER_SALVADOR
// ═══════════════════════════════════════════════════════════════
(function _KEYO_IG() {
'use strict';

// ── GUARD: bloqueia dupla injeção ───────────────────────────────
if (window.__KEYO_IG_LOADED__) {
  console.warn('[KEYO-IG] Já carregado. Ignorando.');
  return;
}
if (!window.__KEYO_00_LOADED__) {
  console.error('[KEYO-IG] keyo-00-core.js não carregado. Abortando.');
  return;
}
window.__KEYO_IG_LOADED__ = true;

// ── VERIFICAÇÃO DE DEPENDÊNCIAS ─────────────────────────────────
const _DEPS = ['toast', 'uid', 'hoje', 'fM', 'san'];
const _depsFaltando = _DEPS.filter(d => typeof window[d] === 'undefined');
if (_depsFaltando.length > 0) {
  console.error('[KEYO-IG] Dependências ausentes:', _depsFaltando, '— módulo abortado.');
  window.__KEYO_IG_LOADED__ = false;
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
      console.error('[KEYO-IG] ⚠️ Função ERP sobrescrita indevidamente:', fn);
  });
}, { once: true });

// ════════════════════════════════════════════════════════════════
// CONSTANTES
// ════════════════════════════════════════════════════════════════
const _IG_EDGE = 'https://utivaczfuuazspychdxt.supabase.co/functions/v1/super-action';
const _IG_ANON = window.KEYO_ANON_KEY || '';

// Unidades — IDs fixos conforme plano mestre
const _IG_UNIDADES = [
  { id: 1, nome: 'EXIT ARACAJU',  handle: '@exit.games',    igUser: '17841408803205398' },
  { id: 2, nome: 'EXIT SALVADOR', handle: '@exitgames.ssa', igUser: '17841478464476536' },
];

// ── Estado interno ───────────────────────────────────────────────
let _igUnidade    = 1;            // unidade ativa (1 = Aracaju, 2 = Salvador)
let _igAba        = 'feed';       // aba ativa: feed | comentarios | mensagens | insights
let _igCarregando = false;

// ── Cache em memória (resetado a cada reload) ───────────────────
let _igCache = {
  feed:         null,
  comentarios:  null,
  mensagens:    null,
  insights:     null,
  ultimaQuery:  {},
};

// ════════════════════════════════════════════════════════════════
// CSS
// ════════════════════════════════════════════════════════════════
(function _css() {
  if (document.getElementById('keyo-ig-css')) return;
  const s = document.createElement('style');
  s.id = 'keyo-ig-css';
  s.textContent = `
/* ── IG: layout geral ── */
#keyo-ig-wrap{display:flex;flex-direction:column;height:100%;overflow:hidden;background:#f4f4fa}
#keyo-ig-header{background:#fff;border-bottom:1px solid #e8e8f0;padding:14px 20px;flex-shrink:0}
#keyo-ig-header-top{display:flex;align-items:center;gap:12px;margin-bottom:10px}
#keyo-ig-logo{font-size:22px}
#keyo-ig-titulo{font-size:16px;font-weight:700;color:#111118}
#keyo-ig-subtitle{font-size:11px;color:#888899;margin-top:1px}
#keyo-ig-unid-sel{margin-left:auto;display:flex;gap:6px}
.ig-unid-btn{border:1px solid #d8d8e8;background:#fff;border-radius:8px;padding:5px 12px;font-size:12px;font-weight:600;color:#555566;cursor:pointer;font-family:inherit;transition:all .15s}
.ig-unid-btn:hover{border-color:#C9A84C;color:#C9A84C}
.ig-unid-btn.active{background:#C9A84C;border-color:#C9A84C;color:#000}

/* ── IG: abas ── */
#keyo-ig-abas{display:flex;gap:0;padding:0 20px;background:#fff;border-bottom:2px solid #e8e8f0}
.ig-aba-btn{padding:10px 18px;font-size:13px;font-weight:600;color:#888899;cursor:pointer;border:none;border-bottom:2px solid transparent;margin-bottom:-2px;background:none;font-family:inherit;transition:all .15s}
.ig-aba-btn:hover{color:#555566}
.ig-aba-btn.active{color:#C9A84C;border-bottom-color:#C9A84C}
.ig-aba-badge{display:inline-block;background:#f4f4fa;color:#888899;border-radius:10px;padding:1px 7px;font-size:10px;font-weight:700;margin-left:4px}
.ig-aba-btn.active .ig-aba-badge{background:rgba(201,168,76,.15);color:#C9A84C}

/* ── IG: painel de conteúdo ── */
#keyo-ig-corpo{flex:1;overflow-y:auto;padding:20px}

/* ── IG: cards de post ── */
.ig-post-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.ig-post-card{background:#fff;border:1px solid #e8e8f0;border-radius:14px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.05);transition:box-shadow .15s}
.ig-post-card:hover{box-shadow:0 4px 16px rgba(0,0,0,0.1)}
.ig-post-media{width:100%;aspect-ratio:1;object-fit:cover;background:#f0f0fa;display:flex;align-items:center;justify-content:center;font-size:32px;color:#ccc}
.ig-post-media img{width:100%;height:100%;object-fit:cover;display:block}
.ig-post-body{padding:12px}
.ig-post-caption{font-size:12px;color:#333344;line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:8px}
.ig-post-stats{display:flex;gap:14px;font-size:11px;color:#888899;margin-bottom:10px}
.ig-post-stat{display:flex;align-items:center;gap:4px}
.ig-post-date{font-size:10px;color:#bbb;margin-bottom:10px}
.ig-post-actions{display:flex;gap:6px}
.ig-post-btn{flex:1;background:none;border:1px solid #d8d8e8;border-radius:6px;padding:5px 8px;font-size:11px;color:#555566;cursor:pointer;font-family:inherit;transition:all .15s;text-align:center}
.ig-post-btn:hover{border-color:#C9A84C;color:#C9A84C}
.ig-post-btn.primary{background:#C9A84C;border-color:#C9A84C;color:#000;font-weight:600}
.ig-post-btn.primary:hover{background:#b8962e}

/* ── IG: comentários ── */
.ig-com-lista{display:flex;flex-direction:column;gap:10px}
.ig-com-card{background:#fff;border:1px solid #e8e8f0;border-radius:12px;padding:14px;box-shadow:0 1px 3px rgba(0,0,0,0.04)}
.ig-com-header{display:flex;align-items:flex-start;gap:10px;margin-bottom:8px}
.ig-com-avatar{width:32px;height:32px;border-radius:50%;background:#f0f0fa;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#888899;flex-shrink:0}
.ig-com-meta{flex:1}
.ig-com-user{font-size:12px;font-weight:700;color:#111118}
.ig-com-post-ref{font-size:10px;color:#aaa;margin-top:1px}
.ig-com-texto{font-size:13px;color:#333344;line-height:1.5;margin-bottom:10px}
.ig-com-actions{display:flex;gap:6px;align-items:center}
.ig-com-reply-input{flex:1;border:1px solid #d8d8e8;border-radius:8px;padding:6px 10px;font-size:12px;font-family:inherit;outline:none;transition:border .15s}
.ig-com-reply-input:focus{border-color:#C9A84C}
.ig-com-reply-btn{background:#C9A84C;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;color:#000;white-space:nowrap}
.ig-com-reply-btn:hover{background:#b8962e}
.ig-com-ia-btn{background:none;border:1px solid #7C6FCD;border-radius:8px;padding:5px 10px;font-size:11px;color:#7C6FCD;cursor:pointer;font-family:inherit;white-space:nowrap;transition:all .15s}
.ig-com-ia-btn:hover{background:#7C6FCD;color:#fff}

/* ── IG: mensagens DM ── */
.ig-dm-lista{display:flex;flex-direction:column;gap:8px}
.ig-dm-card{background:#fff;border:1px solid #e8e8f0;border-radius:12px;padding:14px;cursor:pointer;transition:all .15s;box-shadow:0 1px 3px rgba(0,0,0,0.04)}
.ig-dm-card:hover{border-color:#C9A84C;box-shadow:0 2px 8px rgba(201,168,76,0.15)}
.ig-dm-card.nao-lido{border-left:3px solid #C9A84C}
.ig-dm-header{display:flex;align-items:center;gap:10px}
.ig-dm-avatar{width:36px;height:36px;border-radius:50%;background:#f0f0fa;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#888899;flex-shrink:0}
.ig-dm-info{flex:1;min-width:0}
.ig-dm-user{font-size:13px;font-weight:600;color:#111118}
.ig-dm-preview{font-size:11px;color:#888899;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}
.ig-dm-meta{font-size:10px;color:#bbb;flex-shrink:0;text-align:right}
.ig-dm-badge{display:inline-block;background:#C9A84C;color:#000;border-radius:10px;padding:1px 7px;font-size:10px;font-weight:700;margin-top:2px}

/* ── IG: insights ── */
.ig-insights-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:20px}
.ig-insight-card{background:#fff;border:1px solid #e8e8f0;border-radius:14px;padding:18px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,0.05)}
.ig-insight-valor{font-size:28px;font-weight:800;color:#111118;margin-bottom:4px}
.ig-insight-label{font-size:11px;color:#888899;font-weight:500}
.ig-insight-delta{font-size:11px;margin-top:4px;font-weight:600}
.ig-insight-delta.up{color:#3b6d11}
.ig-insight-delta.down{color:#842029}

/* ── IG: estado vazio / loading ── */
.ig-vazio{text-align:center;padding:40px 20px;color:#aaa}
.ig-vazio-icon{font-size:36px;margin-bottom:10px}
.ig-vazio-text{font-size:13px;color:#888899}
.ig-loading{display:flex;align-items:center;justify-content:center;gap:8px;padding:40px;color:#888899;font-size:13px}
.ig-loading-dot{width:8px;height:8px;border-radius:50%;background:#C9A84C;animation:igDot .9s infinite ease-in-out}
.ig-loading-dot:nth-child(2){animation-delay:.15s}
.ig-loading-dot:nth-child(3){animation-delay:.3s}
@keyframes igDot{0%,80%,100%{transform:scale(.6);opacity:.4}40%{transform:scale(1);opacity:1}}

/* ── IG: modal de resposta IA ── */
#keyo-ig-modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;align-items:center;justify-content:center}
#keyo-ig-modal-overlay.open{display:flex}
#keyo-ig-modal{background:#fff;border-radius:16px;padding:24px;max-width:520px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.2)}
#keyo-ig-modal h3{font-size:15px;font-weight:700;color:#111118;margin-bottom:14px}
#keyo-ig-modal-texto{font-size:13px;color:#555566;line-height:1.6;background:#f8f8fc;border-radius:8px;padding:12px;margin-bottom:14px;min-height:80px}
#keyo-ig-modal-actions{display:flex;gap:8px;justify-content:flex-end}
.ig-modal-btn{border-radius:8px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s}
.ig-modal-btn.sec{background:none;border:1px solid #d8d8e8;color:#555566}
.ig-modal-btn.sec:hover{border-color:#C9A84C;color:#C9A84C}
.ig-modal-btn.pri{background:#C9A84C;border:none;color:#000}
.ig-modal-btn.pri:hover{background:#b8962e}

/* ── IG: banner de erro de API ── */
.ig-api-erro{background:#fff3cd;border:1px solid #ffc107;border-radius:10px;padding:12px 16px;font-size:12px;color:#856404;margin-bottom:16px;display:flex;align-items:center;gap:8px}
`;
  document.head.appendChild(s);
})();

// ════════════════════════════════════════════════════════════════
// CHAMADA À EDGE FUNCTION (proxy para API do Instagram)
// ════════════════════════════════════════════════════════════════

async function _igAPI(acao, params = {}) {
  /* Todas as chamadas à API do Instagram passam pela Edge Function
     para não expor tokens no frontend. */
  try {
    const resp = await fetch(_IG_EDGE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + _IG_ANON,
      },
      body: JSON.stringify({
        agente:     'instagram',
        acao:       acao,
        unidade_id: _igUnidade,
        params:     params,
      }),
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    return data;
  } catch (e) {
    console.error('[KEYO-IG] Erro na API:', acao, e.message);
    throw e;
  }
}

// ════════════════════════════════════════════════════════════════
// FEED — últimos posts da unidade
// ════════════════════════════════════════════════════════════════

async function _igCarregarFeed() {
  if (_igCarregando) return;
  _igCarregando = true;
  _igRenderLoading();

  try {
    const data = await _igAPI('feed', { limit: 12 });
    _igCache.feed = data.posts || [];
    _igRenderFeed(_igCache.feed);
  } catch (e) {
    _igRenderErro('Não foi possível carregar o feed. ' + e.message);
  } finally {
    _igCarregando = false;
  }
}

function _igRenderFeed(posts) {
  const corpo = document.getElementById('keyo-ig-corpo');
  if (!corpo) return;

  if (!posts || posts.length === 0) {
    corpo.innerHTML = _igHtmlVazio('📸', 'Nenhum post encontrado para esta unidade.');
    return;
  }

  const cards = posts.map(p => {
    const mediaHtml = p.media_url
      ? `<div class="ig-post-media"><img src="${p.media_url}" alt="post" loading="lazy" onerror="this.parentElement.innerHTML='📷'"></div>`
      : `<div class="ig-post-media">📷</div>`;
    const caption = (p.caption || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const dataFmt = p.timestamp ? new Date(p.timestamp).toLocaleDateString('pt-BR') : '';
    const likes   = p.like_count   != null ? p.like_count   : '—';
    const comms   = p.comments_count != null ? p.comments_count : '—';

    return `
<div class="ig-post-card">
  ${mediaHtml}
  <div class="ig-post-body">
    <div class="ig-post-date">${dataFmt}</div>
    <div class="ig-post-caption">${caption || '<em style="color:#bbb">Sem legenda</em>'}</div>
    <div class="ig-post-stats">
      <span class="ig-post-stat">❤️ ${likes}</span>
      <span class="ig-post-stat">💬 ${comms}</span>
    </div>
    <div class="ig-post-actions">
      <button class="ig-post-btn" onclick="window._igVerComentarios('${p.id}','${(p.caption||'').slice(0,60).replace(/'/g,"\\'")}')">💬 Comentários</button>
      <button class="ig-post-btn primary" onclick="window.open('${p.permalink||'#'}','_blank')">🔗 Ver</button>
    </div>
  </div>
</div>`;
  }).join('');

  corpo.innerHTML = `<div class="ig-post-grid">${cards}</div>`;
}

// ════════════════════════════════════════════════════════════════
// COMENTÁRIOS — lista + resposta manual + sugestão IA
// ════════════════════════════════════════════════════════════════

let _igFiltroPostId = null;

async function _igCarregarComentarios(postId = null) {
  if (_igCarregando) return;
  _igFiltroPostId = postId;
  _igCarregando   = true;
  _igRenderLoading();

  try {
    const params = { limit: 30 };
    if (postId) params.post_id = postId;
    const data = await _igAPI('comentarios', params);
    _igCache.comentarios = data.comentarios || [];
    _igRenderComentarios(_igCache.comentarios);
  } catch (e) {
    _igRenderErro('Não foi possível carregar os comentários. ' + e.message);
  } finally {
    _igCarregando = false;
  }
}

function _igRenderComentarios(lista) {
  const corpo = document.getElementById('keyo-ig-corpo');
  if (!corpo) return;

  if (!lista || lista.length === 0) {
    corpo.innerHTML = _igHtmlVazio('💬', 'Nenhum comentário recente encontrado.');
    return;
  }

  const items = lista.map(c => {
    const texto = (c.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const user  = c.username || 'usuário';
    const ini   = user.charAt(0).toUpperCase();
    const ref   = c.post_id ? `Post #${c.post_id.slice(-6)}` : '';

    return `
<div class="ig-com-card" id="ig-com-${c.id}">
  <div class="ig-com-header">
    <div class="ig-com-avatar">${ini}</div>
    <div class="ig-com-meta">
      <div class="ig-com-user">@${user}</div>
      <div class="ig-com-post-ref">${ref}</div>
    </div>
  </div>
  <div class="ig-com-texto">${texto}</div>
  <div class="ig-com-actions">
    <input class="ig-com-reply-input" id="ig-reply-${c.id}" type="text" placeholder="Responder...">
    <button class="ig-com-ia-btn" onclick="window._igSugerirResposta('${c.id}','${texto.replace(/'/g,"\\'").slice(0,200)}')">🤖 Sugerir</button>
    <button class="ig-com-reply-btn" onclick="window._igResponderComentario('${c.id}','${c.post_id||''}')">Responder</button>
  </div>
</div>`;
  }).join('');

  const filtroInfo = _igFiltroPostId
    ? `<div class="ig-api-erro" style="background:#e8f4fd;border-color:#90caf9;color:#1565c0">📌 Filtrando comentários do post <strong>#${_igFiltroPostId.slice(-6)}</strong>. <a href="#" onclick="window._igVerTodosComentarios();return false" style="color:#1565c0;margin-left:8px">Ver todos</a></div>`
    : '';

  corpo.innerHTML = filtroInfo + `<div class="ig-com-lista">${items}</div>`;
}

window._igVerComentarios = function (postId, caption) {
  _igAba = 'comentarios';
  _igAtualizarAbas();
  _igCarregarComentarios(postId);
};

window._igVerTodosComentarios = function () {
  _igFiltroPostId = null;
  _igCarregarComentarios();
};

window._igResponderComentario = async function (comId, postId) {
  const input = document.getElementById('ig-reply-' + comId);
  if (!input) return;
  const texto = input.value.trim();
  if (!texto) { window.toast('Digite uma resposta', 'warn'); return; }

  try {
    input.disabled = true;
    await _igAPI('responder_comentario', { comment_id: comId, post_id: postId, text: texto });
    window.toast('✅ Resposta enviada!', 'ok');
    input.value    = '';
    input.disabled = false;
    // remove o card do comentário respondido
    const card = document.getElementById('ig-com-' + comId);
    if (card) { card.style.opacity = '.4'; card.style.pointerEvents = 'none'; }
  } catch (e) {
    input.disabled = false;
    window.toast('Erro ao responder: ' + e.message, 'erro');
  }
};

window._igSugerirResposta = async function (comId, textoComentario) {
  const modal = document.getElementById('keyo-ig-modal-overlay');
  const modalTexto = document.getElementById('keyo-ig-modal-texto');
  if (!modal || !modalTexto) return;

  modalTexto.textContent = '🤖 Gerando sugestão...';
  modal.className = 'open';
  modal.dataset.comId = comId;

  try {
    const unid = _IG_UNIDADES.find(u => u.id === _igUnidade);
    const prompt = `Você é o assistente de redes sociais da ${unid?.nome || 'EXIT GAMES'}, empresa de Escape Room.
Gere uma resposta simpática, profissional e engajante para o seguinte comentário no Instagram:
"${textoComentario}"

Regras:
- Máximo 2 frases
- Tom amigável e animado
- Pode usar 1-2 emojis
- Não mencione preços
- Em português do Brasil`;

    const resp = await fetch(_IG_EDGE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _IG_ANON },
      body: JSON.stringify({ agente: 'mkt', mensagem: prompt, historico: [], unidade_id: _igUnidade }),
    });
    const data = await resp.json();
    const sugestao = data.resposta || data.message || data.content?.[0]?.text || 'Sugestão não disponível.';
    modalTexto.textContent = sugestao;
  } catch (e) {
    modalTexto.textContent = 'Não foi possível gerar sugestão. ' + e.message;
  }
};

// ════════════════════════════════════════════════════════════════
// MENSAGENS DIRETAS (DM)
// ════════════════════════════════════════════════════════════════

async function _igCarregarMensagens() {
  if (_igCarregando) return;
  _igCarregando = true;
  _igRenderLoading();

  try {
    const data = await _igAPI('mensagens', { limit: 20 });
    _igCache.mensagens = data.conversas || [];
    _igRenderMensagens(_igCache.mensagens);
  } catch (e) {
    _igRenderErro('Não foi possível carregar as mensagens. ' + e.message);
  } finally {
    _igCarregando = false;
  }
}

function _igRenderMensagens(lista) {
  const corpo = document.getElementById('keyo-ig-corpo');
  if (!corpo) return;

  if (!lista || lista.length === 0) {
    corpo.innerHTML = _igHtmlVazio('📨', 'Nenhuma mensagem direta encontrada.');
    return;
  }

  const items = lista.map(conv => {
    const user     = conv.username || conv.from?.username || 'usuário';
    const ini      = user.charAt(0).toUpperCase();
    const preview  = (conv.ultima_msg || conv.snippet || '').slice(0, 80);
    const naoLido  = conv.unread_count > 0;
    const dataFmt  = conv.updated_time ? new Date(conv.updated_time).toLocaleDateString('pt-BR') : '';
    const badge    = naoLido ? `<div class="ig-dm-badge">${conv.unread_count}</div>` : '';

    return `
<div class="ig-dm-card ${naoLido ? 'nao-lido' : ''}" onclick="window._igAbrirDM('${conv.id}','${user}')">
  <div class="ig-dm-header">
    <div class="ig-dm-avatar">${ini}</div>
    <div class="ig-dm-info">
      <div class="ig-dm-user">@${user}</div>
      <div class="ig-dm-preview">${preview || '<em>Sem mensagens</em>'}</div>
    </div>
    <div class="ig-dm-meta">${dataFmt}${badge}</div>
  </div>
</div>`;
  }).join('');

  corpo.innerHTML = `<div class="ig-dm-lista">${items}</div>`;
}

window._igAbrirDM = function (convId, username) {
  window.toast('Abrindo conversa com @' + username + '…', 'info');
  // Abre o Instagram diretamente na conversa
  window.open('https://www.instagram.com/direct/inbox/', '_blank');
};

// ════════════════════════════════════════════════════════════════
// INSIGHTS — métricas da conta
// ════════════════════════════════════════════════════════════════

async function _igCarregarInsights() {
  if (_igCarregando) return;
  _igCarregando = true;
  _igRenderLoading();

  try {
    const data = await _igAPI('insights', { periodo: 30 });
    _igCache.insights = data.insights || {};
    _igRenderInsights(_igCache.insights);
  } catch (e) {
    _igRenderErro('Não foi possível carregar os insights. ' + e.message);
  } finally {
    _igCarregando = false;
  }
}

function _igRenderInsights(ins) {
  const corpo = document.getElementById('keyo-ig-corpo');
  if (!corpo) return;

  const metricas = [
    { chave: 'impressions',       label: 'Impressões (30d)',    emoji: '👁️' },
    { chave: 'reach',             label: 'Alcance (30d)',       emoji: '📡' },
    { chave: 'profile_views',     label: 'Visitas ao perfil',   emoji: '👤' },
    { chave: 'follower_count',    label: 'Seguidores',          emoji: '👥' },
    { chave: 'website_clicks',    label: 'Cliques no link',     emoji: '🔗' },
    { chave: 'total_interactions',label: 'Interações (30d)',    emoji: '❤️' },
  ];

  const cards = metricas.map(m => {
    const val  = ins[m.chave];
    const prev = ins[m.chave + '_prev'];
    let deltaHtml = '';
    if (val != null && prev != null && prev > 0) {
      const pct = ((val - prev) / prev * 100).toFixed(1);
      const dir = pct >= 0 ? 'up' : 'down';
      const sinal = pct >= 0 ? '▲' : '▼';
      deltaHtml = `<div class="ig-insight-delta ${dir}">${sinal} ${Math.abs(pct)}%</div>`;
    }
    const display = val != null ? val.toLocaleString('pt-BR') : '—';
    return `
<div class="ig-insight-card">
  <div style="font-size:24px;margin-bottom:6px">${m.emoji}</div>
  <div class="ig-insight-valor">${display}</div>
  <div class="ig-insight-label">${m.label}</div>
  ${deltaHtml}
</div>`;
  }).join('');

  const unid = _IG_UNIDADES.find(u => u.id === _igUnidade);
  corpo.innerHTML = `
<div style="margin-bottom:14px">
  <div style="font-size:13px;font-weight:700;color:#111118;margin-bottom:4px">📊 Insights — ${unid?.nome || ''}</div>
  <div style="font-size:11px;color:#888899">Dados dos últimos 30 dias. Atualizado em tempo real via API do Instagram.</div>
</div>
<div class="ig-insights-grid">${cards}</div>`;
}

// ════════════════════════════════════════════════════════════════
// MODAL — sugestão de resposta IA
// ════════════════════════════════════════════════════════════════

function _igRenderModal() {
  if (document.getElementById('keyo-ig-modal-overlay')) return;
  const el = document.createElement('div');
  el.id = 'keyo-ig-modal-overlay';
  el.innerHTML = `
<div id="keyo-ig-modal">
  <h3>🤖 Sugestão de resposta (IA)</h3>
  <div id="keyo-ig-modal-texto"></div>
  <div id="keyo-ig-modal-actions">
    <button class="ig-modal-btn sec" onclick="document.getElementById('keyo-ig-modal-overlay').className=''">Cancelar</button>
    <button class="ig-modal-btn sec" onclick="window._igModalCopiar()">📋 Copiar</button>
    <button class="ig-modal-btn pri" onclick="window._igModalUsar()">✅ Usar resposta</button>
  </div>
</div>`;
  document.body.appendChild(el);
  el.addEventListener('click', function (e) {
    if (e.target === el) el.className = '';
  });
}

window._igModalCopiar = function () {
  const texto = document.getElementById('keyo-ig-modal-texto')?.textContent || '';
  navigator.clipboard.writeText(texto).then(() => window.toast('Copiado!', 'ok'));
};

window._igModalUsar = function () {
  const modal   = document.getElementById('keyo-ig-modal-overlay');
  const texto   = document.getElementById('keyo-ig-modal-texto')?.textContent || '';
  const comId   = modal?.dataset.comId;
  if (comId) {
    const input = document.getElementById('ig-reply-' + comId);
    if (input) input.value = texto;
  }
  if (modal) modal.className = '';
  window.toast('Sugestão aplicada no campo de resposta', 'ok');
};

// ════════════════════════════════════════════════════════════════
// HELPERS DE RENDER
// ════════════════════════════════════════════════════════════════

function _igRenderLoading() {
  const corpo = document.getElementById('keyo-ig-corpo');
  if (!corpo) return;
  corpo.innerHTML = `
<div class="ig-loading">
  <div class="ig-loading-dot"></div>
  <div class="ig-loading-dot"></div>
  <div class="ig-loading-dot"></div>
  <span>Carregando…</span>
</div>`;
}

function _igRenderErro(msg) {
  const corpo = document.getElementById('keyo-ig-corpo');
  if (!corpo) return;
  corpo.innerHTML = `<div class="ig-api-erro">⚠️ ${msg}</div>`;
}

function _igHtmlVazio(icon, texto) {
  return `<div class="ig-vazio"><div class="ig-vazio-icon">${icon}</div><div class="ig-vazio-text">${texto}</div></div>`;
}

// ════════════════════════════════════════════════════════════════
// NAVEGAÇÃO — abas e unidades
// ════════════════════════════════════════════════════════════════

function _igAtualizarAbas() {
  document.querySelectorAll('.ig-aba-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.aba === _igAba);
  });
}

function _igAtualizarUnidades() {
  document.querySelectorAll('.ig-unid-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.unid) === _igUnidade);
  });
  // Limpa cache ao trocar de unidade
  _igCache = { feed: null, comentarios: null, mensagens: null, insights: null, ultimaQuery: {} };
}

function _igNavAba(aba) {
  _igAba = aba;
  _igAtualizarAbas();
  switch (aba) {
    case 'feed':        _igCarregarFeed();       break;
    case 'comentarios': _igCarregarComentarios(); break;
    case 'mensagens':   _igCarregarMensagens();   break;
    case 'insights':    _igCarregarInsights();    break;
  }
}

function _igNavUnidade(id) {
  _igUnidade = id;
  _igAtualizarUnidades();
  _igNavAba(_igAba);
}

// ════════════════════════════════════════════════════════════════
// RENDER PRINCIPAL DA PÁGINA
// ════════════════════════════════════════════════════════════════

function _igRenderPagina() {
  const unidBtns = _IG_UNIDADES.map(u =>
    `<button class="ig-unid-btn${u.id === _igUnidade ? ' active' : ''}" data-unid="${u.id}" onclick="window._igNavUnidade(${u.id})">${u.nome}</button>`
  ).join('');

  const abas = [
    { id: 'feed',        label: 'Feed',       emoji: '📸' },
    { id: 'comentarios', label: 'Comentários',emoji: '💬' },
    { id: 'mensagens',   label: 'Mensagens',  emoji: '📨' },
    { id: 'insights',    label: 'Insights',   emoji: '📊' },
  ];
  const abasBtns = abas.map(a =>
    `<button class="ig-aba-btn${a.id === _igAba ? ' active' : ''}" data-aba="${a.id}" onclick="window._igNavAba('${a.id}')">${a.emoji} ${a.label}</button>`
  ).join('');

  return `
<div id="keyo-ig-wrap">
  <div id="keyo-ig-header">
    <div id="keyo-ig-header-top">
      <div id="keyo-ig-logo">📷</div>
      <div>
        <div id="keyo-ig-titulo">Instagram</div>
        <div id="keyo-ig-subtitle">Feed · Comentários · Mensagens · Insights</div>
      </div>
      <div id="keyo-ig-unid-sel">${unidBtns}</div>
    </div>
  </div>
  <div id="keyo-ig-abas">${abasBtns}</div>
  <div id="keyo-ig-corpo"></div>
</div>`;
}

// ════════════════════════════════════════════════════════════════
// INTEGRAÇÃO COM O ROUTER DO ERP (renderPage patch)
// ════════════════════════════════════════════════════════════════

const _renderPageOrig = window.renderPage;

window.renderPage = function (pagina) {
  if (pagina === 'keyo-instagram') {
    const container = document.getElementById('app') || document.getElementById('main') || document.body;
    container.innerHTML = _igRenderPagina();
    _igRenderModal();
    _igNavAba('feed');
    return;
  }
  if (typeof _renderPageOrig === 'function') _renderPageOrig(pagina);
};

// ── Expõe funções de navegação globalmente ──────────────────────
window._igNavAba      = _igNavAba;
window._igNavUnidade  = _igNavUnidade;

// ════════════════════════════════════════════════════════════════
// SIDEBAR — injeta item no menu do ERP
// ════════════════════════════════════════════════════════════════

function _igInjetarSidebar() {
  // Aguarda o DOM estar pronto e o ERP ter renderizado o sidebar
  const tentativas = [300, 800, 1500, 3000];
  tentativas.forEach(delay => {
    setTimeout(() => {
      // Tenta encontrar o item "KEYO" no sidebar para inserir após
      const sidebar = document.querySelector('#sidebar, #nav, .sidebar, nav');
      if (!sidebar) return;
      if (document.getElementById('keyo-ig-nav-item')) return;

      // Procura item KEYO existente
      const keyoItem = Array.from(sidebar.querySelectorAll('*'))
        .find(el => el.textContent.trim() === 'KEYO' || el.dataset?.page === 'keyo');

      const li = document.createElement('li');
      li.id = 'keyo-ig-nav-item';
      li.style.cssText = 'cursor:pointer;padding:8px 16px;font-size:13px;color:#888899;display:flex;align-items:center;gap:8px';
      li.innerHTML = '📷 Instagram';
      li.addEventListener('mouseenter', () => li.style.color = '#C9A84C');
      li.addEventListener('mouseleave', () => li.style.color = '#888899');
      li.addEventListener('click', () => window.renderPage('keyo-instagram'));

      if (keyoItem?.parentElement) {
        keyoItem.parentElement.insertAdjacentElement('afterend', li);
      } else {
        sidebar.appendChild(li);
      }
    }, delay);
  });
}

_igInjetarSidebar();

// ════════════════════════════════════════════════════════════════
// INIT CHECK — avisa se Edge Function não suporta acao=instagram
// ════════════════════════════════════════════════════════════════

(async function _igInit() {
  // Teste silencioso para verificar se a edge function responde
  try {
    const resp = await fetch(_IG_EDGE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _IG_ANON },
      body: JSON.stringify({ agente: 'instagram', acao: 'ping', unidade_id: 1, params: {} }),
    });
    const data = await resp.json();
    if (data?.ok || data?.pong) {
      console.info('[KEYO-IG] ✅ Edge Function responde ao ping Instagram.');
    } else {
      console.warn('[KEYO-IG] ⚠️ Edge Function não suporta ação "instagram" ainda. Adicionar handler na super-action.');
    }
  } catch (e) {
    console.warn('[KEYO-IG] ⚠️ Não foi possível testar a Edge Function:', e.message);
  }
})();

console.info('[KEYO-IG] ✅ Instagram carregado com sucesso. (v1.0)');
})();

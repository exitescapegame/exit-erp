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

/* ── IG: thread DM (conversa individual) ── */
#ig-dm-thread{display:flex;flex-direction:column;height:100%}
#ig-dm-thread-header{display:flex;align-items:center;gap:10px;padding:12px 16px;background:#fff;border-bottom:1px solid #e8e8f0;flex-shrink:0}
#ig-dm-thread-back{background:none;border:none;cursor:pointer;font-size:18px;color:#555566;padding:4px 6px;border-radius:6px}
#ig-dm-thread-back:hover{background:#f0f0fa}
#ig-dm-thread-user{font-size:14px;font-weight:700;color:#111118}
#ig-dm-thread-sub{font-size:11px;color:#888899}
#ig-dm-thread-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:#f4f4fa}
.ig-dm-bubble{max-width:72%;padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.5}
.ig-dm-bubble.deles{background:#fff;border:1px solid #e8e8f0;border-radius:14px 14px 14px 2px;align-self:flex-start;color:#111118}
.ig-dm-bubble.meu{background:#C9A84C;border-radius:14px 14px 2px 14px;align-self:flex-end;color:#000;font-weight:500}
.ig-dm-bubble-meta{font-size:10px;color:#bbb;margin-top:4px}
.ig-dm-bubble.deles .ig-dm-bubble-meta{text-align:left}
.ig-dm-bubble.meu .ig-dm-bubble-meta{text-align:right}
#ig-dm-thread-footer{padding:12px 16px;background:#fff;border-top:1px solid #e8e8f0;flex-shrink:0;display:flex;flex-direction:column;gap:8px}
#ig-dm-thread-sugerir-bar{display:flex;gap:6px}
#ig-dm-thread-input-bar{display:flex;gap:8px;align-items:flex-end}
#ig-dm-thread-txt{flex:1;border:1px solid #d8d8e8;border-radius:10px;padding:8px 12px;font-size:13px;font-family:inherit;outline:none;resize:none;min-height:40px;max-height:120px;transition:border .15s;line-height:1.4}
#ig-dm-thread-txt:focus{border-color:#C9A84C}
.ig-dm-send-btn{background:#C9A84C;border:none;border-radius:10px;padding:9px 16px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;color:#000;white-space:nowrap;height:40px}
.ig-dm-send-btn:hover{background:#b8962e}
.ig-dm-ia-btn{background:none;border:1px solid #7C6FCD;border-radius:8px;padding:6px 12px;font-size:12px;color:#7C6FCD;cursor:pointer;font-family:inherit;transition:all .15s;flex:1}
.ig-dm-ia-btn:hover{background:#7C6FCD;color:#fff}
.ig-dm-wpp-btn{background:#25D366;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:600;color:#fff;cursor:pointer;font-family:inherit;flex:1}
.ig-dm-wpp-btn:hover{background:#1da850}
.ig-dm-wpp-btn:disabled{background:#ccc;cursor:default}
`;
  document.head.appendChild(s);
})();

// ════════════════════════════════════════════════════════════════
// CHAMADA À EDGE FUNCTION (proxy para API do Instagram)
// ════════════════════════════════════════════════════════════════

async function _igAPI(acao, params = {}) {
  /* Todas as chamadas à API do Instagram passam pela Edge Function
     para não expor tokens no frontend.
     Autenticação: usa o JWT da sessão do ERP (mesmo padrão do chat).
     A Edge Function exige um usuário logado (auth.getUser) — só a anon
     key resulta em 401 "Sessão inválida". */
  let jwt = '';
  try {
    const erpSession = JSON.parse(localStorage.getItem('exit_unidade_session') || '{}');
    jwt = erpSession?.access_token || '';
    if (!jwt && window._keyoToken) jwt = window._keyoToken;
    if (!jwt) jwt = window.SUPA_KEY || window.KEYO_ANON_KEY || _IG_ANON;
  } catch (e) {
    jwt = window.SUPA_KEY || window.KEYO_ANON_KEY || _IG_ANON;
  }
  try {
    const resp = await fetch(_IG_EDGE, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + jwt,
        'apikey':        window.KEYO_ANON_KEY || _IG_ANON,
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

// ════════════════════════════════════════════════════════════════
// THREAD DM — tela de conversa individual com resposta inline
// ════════════════════════════════════════════════════════════════

// [FIX] _igAbrirDM: antes redirecionava para instagram.com (inútil).
// Agora abre a thread inline dentro do ERP com histórico + resposta.
window._igAbrirDM = async function (convId, username) {
  const corpo = document.getElementById('keyo-ig-corpo');
  if (!corpo) return;

  // Mostra loading imediato
  corpo.innerHTML = `
<div id="ig-dm-thread">
  <div id="ig-dm-thread-header">
    <button id="ig-dm-thread-back" onclick="window._igVoltar()" title="Voltar">←</button>
    <div>
      <div id="ig-dm-thread-user">@${username}</div>
      <div id="ig-dm-thread-sub">Carregando conversa…</div>
    </div>
  </div>
  <div id="ig-dm-thread-msgs" style="flex:1;overflow-y:auto;padding:16px">
    <div class="ig-loading"><div class="ig-loading-dot"></div><div class="ig-loading-dot"></div><div class="ig-loading-dot"></div><span>Carregando…</span></div>
  </div>
</div>`;

  // Guarda estado para o botão Voltar
  window._igDmAtual = { convId, username };

  // Busca histórico de mensagens da conversa
  let msgs = [];
  let telefone = '';
  try {
    const data = await _igAPI('thread_dm', { conversation_id: convId });
    msgs = data.mensagens || [];
    telefone = data.telefone || '';
  } catch (e) {
    // Se a Edge Function ainda não suporta thread_dm, usa lista vazia
    console.warn('[KEYO-IG] thread_dm não suportado ainda:', e.message);
  }

  // Render da thread
  _igRenderThread(convId, username, msgs, telefone);
};

function _igRenderThread(convId, username, msgs, telefone) {
  const corpo = document.getElementById('keyo-ig-corpo');
  if (!corpo) return;

  const bolhas = msgs.length
    ? msgs.map(m => {
        const deles = m.from !== 'page'; // mensagens do cliente
        const hora  = m.created_time
          ? new Date(m.created_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          : '';
        const texto = (m.message || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `
<div style="display:flex;flex-direction:column;align-items:${deles ? 'flex-start' : 'flex-end'}">
  <div class="ig-dm-bubble ${deles ? 'deles' : 'meu'}">${texto}</div>
  <div class="ig-dm-bubble-meta">${deles ? '@' + username + ' · ' : ''}${hora}</div>
</div>`;
      }).join('')
    : '<div class="ig-vazio"><div class="ig-vazio-icon">💬</div><div class="ig-vazio-text">Inicie a conversa com uma mensagem.</div></div>';

  // Botão WhatsApp — só mostra se tiver telefone
  const wppBtn = telefone
    ? `<button class="ig-dm-wpp-btn" onclick="window._igAbrirWhatsApp('${convId}','${username}','${telefone}')">📱 Abrir no WhatsApp</button>`
    : `<button class="ig-dm-wpp-btn" disabled title="Telefone não encontrado no cadastro">📱 Sem WhatsApp</button>`;

  corpo.innerHTML = `
<div id="ig-dm-thread">
  <div id="ig-dm-thread-header">
    <button id="ig-dm-thread-back" onclick="window._igVoltar()" title="Voltar">←</button>
    <div style="flex:1">
      <div id="ig-dm-thread-user">@${username}</div>
      <div id="ig-dm-thread-sub">DM · Instagram${telefone ? ' · 📱 ' + telefone : ' · sem WhatsApp cadastrado'}</div>
    </div>
  </div>
  <div id="ig-dm-thread-msgs">${bolhas}</div>
  <div id="ig-dm-thread-footer">
    <div id="ig-dm-thread-sugerir-bar">
      <button class="ig-dm-ia-btn" onclick="window._igSugerirRespostaDM('${convId}','${username}')">🤖 Keyo sugere resposta</button>
      ${wppBtn}
    </div>
    <div id="ig-dm-thread-input-bar">
      <textarea id="ig-dm-thread-txt" placeholder="Responda pelo Instagram…" rows="1"
        oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'"
        onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();window._igEnviarDM('${convId}','${username}')}"
      ></textarea>
      <button class="ig-dm-send-btn" onclick="window._igEnviarDM('${convId}','${username}')">Enviar IG</button>
    </div>
  </div>
</div>`;

  // Scroll para o final
  const msgs_el = document.getElementById('ig-dm-thread-msgs');
  if (msgs_el) setTimeout(() => { msgs_el.scrollTop = msgs_el.scrollHeight; }, 50);
}

// Volta para a lista de DMs
window._igVoltar = function () {
  window._igDmAtual = null;
  _igNavAba('mensagens');
};

// Envia resposta pela API do Instagram
window._igEnviarDM = async function (convId, username) {
  const txt = (document.getElementById('ig-dm-thread-txt') || {}).value?.trim();
  if (!txt) { window.toast('Digite uma mensagem', 'warn'); return; }

  const btn = document.querySelector('.ig-dm-send-btn');
  if (btn) { btn.disabled = true; btn.textContent = '…'; }

  try {
    await _igAPI('responder_dm', { conversation_id: convId, text: txt });
    window.toast('✅ Mensagem enviada pelo Instagram!', 'ok');
    // Recarrega a thread para mostrar a mensagem enviada
    await window._igAbrirDM(convId, username);
  } catch (e) {
    window.toast('Erro ao enviar: ' + e.message, 'erro');
    if (btn) { btn.disabled = false; btn.textContent = 'Enviar IG'; }
  }
};

// Sugere resposta com IA (tom do Keyo) e encaminha para WhatsApp se tiver
window._igSugerirRespostaDM = async function (convId, username) {
  const modal     = document.getElementById('keyo-ig-modal-overlay');
  const modalTxt  = document.getElementById('keyo-ig-modal-texto');
  if (!modal || !modalTxt) return;

  modalTxt.textContent = '🤖 Gerando sugestão…';
  modal.className = 'open';
  modal.dataset.dmConvId  = convId;
  modal.dataset.dmUser    = username;

  // Pega as últimas mensagens do cliente visíveis na thread
  const bolhas = document.querySelectorAll('#ig-dm-thread-msgs .ig-dm-bubble.deles');
  const historico = Array.from(bolhas).slice(-3).map(b => b.textContent.trim()).join(' / ');
  const unid = _IG_UNIDADES.find(u => u.id === _igUnidade);

  const prompt = `Você é Keyo, atendente virtual da ${unid?.nome || 'EXIT GAMES'} — escape room do Nordeste.
Persona: gente boa, animado, acolhedor, com leveza e humor na medida certa.
Responda à mensagem do Instagram de @${username} de forma humana e calorosa — como se fosse um amigo que adora escape room.

Últimas mensagens do cliente: "${historico || 'sem histórico visível'}"

Regras:
- Máximo 3 frases curtas (tom de WhatsApp/DM, não de email)
- Use o nome do cliente (@${username}) ao cumprimentar se fizer sentido
- 1-2 emojis, nunca em toda frase
- Se fizer sentido, convide a reservar ou pergunte a data
- Se o cliente não tem WhatsApp cadastrado, mantenha o atendimento pelo Instagram naturalmente
- Em português do Brasil`;

  try {
    const resp = await fetch(_IG_EDGE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _IG_ANON },
      body: JSON.stringify({ agente: 'mkt', mensagem: prompt, historico: [], unidade_id: _igUnidade }),
    });
    const data = await resp.json();
    const sugestao = data.resposta || data.message || data.content?.[0]?.text || 'Sugestão não disponível.';
    modalTxt.textContent = sugestao;
  } catch (e) {
    modalTxt.textContent = 'Não foi possível gerar sugestão. ' + e.message;
  }
};

// Substitui os botões do modal para funcionar também com DMs
window._igModalUsar = function () {
  const modal  = document.getElementById('keyo-ig-modal-overlay');
  const texto  = document.getElementById('keyo-ig-modal-texto')?.textContent || '';
  const comId  = modal?.dataset.comId;
  const dmConv = modal?.dataset.dmConvId;

  if (comId) {
    // Comentário
    const input = document.getElementById('ig-reply-' + comId);
    if (input) input.value = texto;
    window.toast('Sugestão aplicada no campo de resposta', 'ok');
  } else if (dmConv) {
    // DM
    const txt = document.getElementById('ig-dm-thread-txt');
    if (txt) { txt.value = texto; txt.dispatchEvent(new Event('input')); }
    window.toast('Sugestão aplicada — revise e clique em Enviar IG', 'ok');
  }
  if (modal) modal.className = '';
};

// Abre WhatsApp com o telefone do cliente (continua conversa fora do IG)
window._igAbrirWhatsApp = function (convId, username, telefone) {
  if (!telefone) { window.toast('Sem telefone cadastrado para este usuário', 'warn'); return; }
  const tel  = telefone.replace(/\D/g, '');
  const unid = _IG_UNIDADES.find(u => u.id === _igUnidade);
  const msg  = encodeURIComponent(
    `Olá! 😊 Sou do ${unid?.nome || 'EXIT GAMES'}. Vi sua mensagem no Instagram e vim continuar o atendimento por aqui! Como posso te ajudar?`
  );
  window.open(`https://wa.me/55${tel}?text=${msg}`, '_blank');
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
    { chave: 'views',             label: 'Visualizações (30d)', emoji: '👁️' },
    { chave: 'reach',             label: 'Alcance (30d)',       emoji: '📡' },
    { chave: 'accounts_engaged',  label: 'Contas engajadas',    emoji: '👤' },
    { chave: 'follower_count',    label: 'Seguidores',          emoji: '👥' },
    { chave: 'media_count',       label: 'Publicações',         emoji: '🖼️' },
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

// [FIX] _igModalUsar unificado na seção THREAD DM acima

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
    <div style="margin-top:8px">
      <button class="ig-unid-btn" onclick="window._igDescobrir()" title="Lista as contas @ que o token enxerga e seus IDs">🔍 Descobrir contas</button>
    </div>
  </div>
  <div id="keyo-ig-abas">${abasBtns}</div>
  <div id="keyo-ig-corpo"></div>
</div>`;
}

// ════════════════════════════════════════════════════════════════
// INTEGRAÇÃO INLINE (padrão Cientista) — monta dentro de #keyo-main
// SEM apagar a tela do KEYO·IA. Não sobrescreve mais window.renderPage.
// ════════════════════════════════════════════════════════════════

const _IG_INLINE_ID = 'keyo-instagram-inline';

// IDs de inline de outros módulos — removidos ao abrir o Instagram
const _IG_OUTROS_INLINE = ['keyo-mpros-inline','keyo-m12-inline','keyo-m13-inline',
  'keyo-m14-inline','keyo-m15-inline','keyo-m16-inline'];

function _igMontarInline() {
  // Fecha Cientista e demais módulos inline (evita sobreposição)
  if (typeof window.mpros_fechar === 'function') window.mpros_fechar();
  _IG_OUTROS_INLINE.forEach(function (mid) {
    const el = document.getElementById(mid);
    if (el) el.remove();
  });
  if (typeof window._k15Stop === 'function') window._k15Stop();

  // Esconde a área de chat
  const msgs      = document.getElementById('keyo-msgs');
  const inputArea = document.getElementById('keyo-input-area');
  if (msgs)      msgs.style.display      = 'none';
  if (inputArea) inputArea.style.display = 'none';

  const main = document.getElementById('keyo-main');
  if (!main) return;

  // Atualiza o cabeçalho
  const emoji = document.getElementById('keyo-header-emoji');
  const nome  = document.getElementById('keyo-header-nome');
  const desc  = document.getElementById('keyo-header-desc');
  if (emoji) emoji.textContent = '📷';
  if (nome)  nome.textContent  = 'Instagram';
  if (desc)  desc.textContent  = 'Feed, comentários, mensagens e insights';

  let area = document.getElementById(_IG_INLINE_ID);
  if (area) area.remove();
  area = document.createElement('div');
  area.id = _IG_INLINE_ID;
  area.style.cssText = 'flex:1;overflow:auto;display:flex;flex-direction:column';
  area.innerHTML = _igRenderPagina();
  main.appendChild(area);

  _igRenderModal();
  _igNavAba('feed');
}

function _abrirInstagram() {
  document.querySelectorAll('.keyo-agent-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.keyo-mod-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('keyo-mod-instagram');
  if (btn) btn.classList.add('active');
  _igMontarInline();
}

function _fecharInstagram() {
  const area = document.getElementById(_IG_INLINE_ID);
  if (area) area.remove();
  const btn = document.getElementById('keyo-mod-instagram');
  if (btn) btn.classList.remove('active');
  const msgs      = document.getElementById('keyo-msgs');
  const inputArea = document.getElementById('keyo-input-area');
  if (msgs)      msgs.style.cssText      = '';
  if (inputArea) inputArea.style.cssText = '';
}

window.instagram_abrir  = _abrirInstagram;
window.instagram_fechar = _fecharInstagram;

// Auto-fecha o Instagram quando o usuário clica em outro agente/módulo.
// (O keyo-01-ui.js não conhece este módulo, então tratamos aqui.)
document.addEventListener('click', function (e) {
  if (!document.getElementById(_IG_INLINE_ID)) return;
  const alvo = e.target.closest('.keyo-agent-btn, .keyo-mod-btn');
  if (!alvo) return;
  if (alvo.id === 'keyo-mod-instagram') return; // clicou no próprio
  _fecharInstagram();
}, true);

// ── Expõe funções de navegação globalmente ──────────────────────
window._igNavAba      = _igNavAba;
window._igNavUnidade  = _igNavUnidade;

// ── Descobrir contas: lista as @ que o token enxerga e seus IDs ──
window._igDescobrir = async function () {
  const corpo = document.getElementById('keyo-ig-corpo');
  if (corpo) corpo.innerHTML = '<div style="padding:24px;color:#888899;font-size:13px">🔍 Consultando o token…</div>';
  try {
    const data = await _igAPI('descobrir', {});
    const paginas = data.paginas || [];
    if (!paginas.length) {
      if (corpo) corpo.innerHTML = '<div style="padding:24px;color:#a32d2d;font-size:13px">Nenhuma Página encontrada. O token de System User ainda não tem as Páginas do Facebook atribuídas — verifique na Meta Business.</div>';
      return;
    }
    const linhas = paginas.map(p => `
      <tr>
        <td style="padding:8px 10px;border-bottom:0.5px solid #e8e8f0">${p.ig_username ? '@' + p.ig_username : '—'}</td>
        <td style="padding:8px 10px;border-bottom:0.5px solid #e8e8f0">${p.page_nome || '—'}</td>
        <td style="padding:8px 10px;border-bottom:0.5px solid #e8e8f0;font-family:monospace;font-size:12px;user-select:all">${p.ig_id || '—'}</td>
      </tr>`).join('');
    if (corpo) corpo.innerHTML = `
      <div style="padding:18px">
        <div style="font-size:13px;font-weight:700;color:#111118;margin-bottom:4px">Contas encontradas</div>
        <div style="font-size:11px;color:#888899;margin-bottom:12px">Copie cada <strong>ig_id</strong> para os secrets IG_USER_ARACAJU / IG_USER_SALVADOR.</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="text-align:left;color:#888899;font-size:11px">
            <th style="padding:6px 10px">Conta @</th><th style="padding:6px 10px">Página FB</th><th style="padding:6px 10px">ig_id</th>
          </tr></thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>`;
  } catch (e) {
    if (corpo) corpo.innerHTML = '<div style="padding:24px;color:#a32d2d;font-size:13px">Erro: ' + e.message + '</div>';
  }
};


// ════════════════════════════════════════════════════════════════
// SIDEBAR — injeta botão "Instagram" na lista de MÓDULOS
// (mesmo container e classe do Cientista: #keyo-agents-modulos / .keyo-mod-btn)
// ════════════════════════════════════════════════════════════════

(function _injetarBotaoInstagram() {
  function _ensureBotao() {
    const modulosDiv = document.getElementById('keyo-agents-modulos');
    if (!modulosDiv) return false;
    let btn = document.getElementById('keyo-mod-instagram');
    if (!btn) {
      btn = document.createElement('button');
      btn.className = 'keyo-mod-btn';
      btn.id        = 'keyo-mod-instagram';
      btn.innerHTML = '<span class="keyo-mod-emoji">📷</span><span>Instagram</span>';
      btn.onclick   = window.instagram_abrir;
      modulosDiv.appendChild(btn);
    }
    // Sincroniza 'active' com o estado do inline
    if (document.getElementById('keyo-instagram-inline')) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
    return true;
  }

  function _tentar() {
    if (!_ensureBotao()) setTimeout(_tentar, 600);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _tentar);
  else _tentar();

  try {
    const _obs = new MutationObserver(() => { _ensureBotao(); });
    _obs.observe(document.body, { childList: true, subtree: true });
  } catch (e) {
    setInterval(_ensureBotao, 1500);
  }
})();

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

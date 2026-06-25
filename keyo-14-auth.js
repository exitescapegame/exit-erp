/* ════════════════════════════════════════════════════════════════
   KEYO M20 — AUTORIZAÇÕES (keyo-14-auth.js)
   Cards de autorização: o ADM aprova / modifica / rejeita as
   iniciativas que o KEYO (Brain Loop) coloca na fila.
   Fonte: keyo_brain_queue (Supabase). Log: keyo_auth_log.
   Padrão idêntico aos demais módulos (render inline no painel KEYO).
   NÃO altera o core. Lei 1/2/3/7 respeitadas.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__KEYO_M20_LOADED__) return;
  window.__KEYO_M20_LOADED__ = true;

  // ── Helpers de Supabase (REST) ────────────────────────────────
  const SUPA_URL  = 'https://utivaczfuuazspychdxt.supabase.co';
  function _anon() { return window.KEYO_ANON_KEY || ''; }
  function _auth() {
    return (window._unidadeSession && window._unidadeSession.access_token) || _anon();
  }
  function _unidadeAtual() {
    // Usa a unidade logada se existir; senão null (mostra todas)
    try {
      if (window.UA && window.UA.unidadeId) return String(window.UA.unidadeId);
      if (window._unidadeId) return String(window._unidadeId);
    } catch (_e) {}
    return null;
  }

  async function _sb(path, method, body) {
    const headers = {
      'Content-Type': 'application/json',
      'apikey': _anon(),
      'Authorization': 'Bearer ' + _auth()
    };
    if (method === 'PATCH' || method === 'POST') headers['Prefer'] = 'return=representation';
    const opt = { method: method || 'GET', headers };
    if (body) opt.body = JSON.stringify(body);
    const r = await fetch(SUPA_URL + '/rest/v1/' + path, opt);
    const txt = await r.text();
    if (!r.ok) throw new Error('Supabase ' + r.status + ': ' + txt.slice(0, 200));
    return txt ? JSON.parse(txt) : null;
  }

  // ── Sanitização (usa san() do core se existir; senão fallback) ─
  function S(v) {
    if (typeof window.san === 'function') return window.san(v);
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── Estado do módulo ──────────────────────────────────────────
  let _cards = [];
  let _carregando = false;

  // ── Buscar iniciativas pendentes ──────────────────────────────
  async function _carregar() {
    _carregando = true;
    const uni = _unidadeAtual();
    let q = 'keyo_brain_queue?status=eq.pendente&order=priority.desc,criado_em.asc';
    if (uni) q += '&or=(unidade_id.eq.' + encodeURIComponent(uni) + ',unidade_id.is.null)';
    try {
      _cards = await _sb(q, 'GET') || [];
    } catch (e) {
      _cards = null; // sinaliza erro
      _erro = e.message;
    }
    _carregando = false;
  }
  let _erro = '';

  // ── Registrar decisão no log + atualizar a fila ───────────────
  async function _decidir(id, decisao, feedback) {
    const card = _cards.find(c => String(c.id) === String(id));
    if (!card) return;
    const agora = new Date().toISOString();
    // 1) Atualiza a fila (status)
    await _sb('keyo_brain_queue?id=eq.' + encodeURIComponent(id), 'PATCH', {
      status: decisao,            // 'aprovada' | 'rejeitada' | 'modificada'
      decidido_em: agora,
      feedback: feedback || null
    });
    // 2) Grava no log de auditoria (RLHF + LGPD: rastreável)
    try {
      await _sb('keyo_auth_log', 'POST', [{
        queue_id: card.id,
        agent: card.agent || null,
        initiative_type: card.type || null,
        decision: decisao,
        feedback: feedback || null,
        unidade_id: card.unidade_id || _unidadeAtual() || null,
        decided_at: agora
      }]);
    } catch (_e) { /* log não-bloqueante */ }
  }

  // ── Ações dos botões (expostas globalmente) ───────────────────
  window.keyoAuth_aprovar = async function (id) {
    try { await _decidir(id, 'aprovada', null); _toast('✅ Iniciativa aprovada'); }
    catch (e) { _toast('Erro ao aprovar: ' + e.message, true); }
    await _render();
  };
  window.keyoAuth_rejeitar = async function (id) {
    const motivo = (typeof window.prompt === 'function')
      ? window.prompt('Por que rejeitar? (ajuda o KEYO a aprender)') : '';
    if (motivo === null) return; // cancelou
    try { await _decidir(id, 'rejeitada', motivo || '(sem motivo)'); _toast('❌ Iniciativa rejeitada'); }
    catch (e) { _toast('Erro ao rejeitar: ' + e.message, true); }
    await _render();
  };
  window.keyoAuth_modificar = async function (id) {
    const ajuste = (typeof window.prompt === 'function')
      ? window.prompt('Como você prefere? (o KEYO aprende sua variação)') : '';
    if (ajuste === null) return;
    try { await _decidir(id, 'modificada', ajuste || '(modificada)'); _toast('✏️ Modificação registrada'); }
    catch (e) { _toast('Erro ao modificar: ' + e.message, true); }
    await _render();
  };

  function _toast(msg, isErro) {
    if (typeof window.toast === 'function') { window.toast(msg, isErro ? 'error' : 'success'); }
  }

  // ── Render de UM card ─────────────────────────────────────────
  function _cardHTML(c) {
    const prioridade = (c.priority >= 3) ? 'alta' : (c.priority >= 2 ? 'media' : 'baixa');
    const corBorda = prioridade === 'alta' ? '#C0392B' : (prioridade === 'media' ? '#C9A84C' : '#2E75B6');
    const agente = S(c.agent || 'KEYO');
    const titulo = S(c.title || c.type || 'Iniciativa');
    const justificativa = S(c.justification || c.reason || '');
    const preview = S(c.preview || '');
    const impacto = S(c.impact || '');
    const idJS = S(c.id);
    return `
    <div class="kauth-card" style="border-left:4px solid ${corBorda}">
      <div class="kauth-card-head">
        <span class="kauth-agent">${agente}</span>
        <span class="kauth-prio kauth-prio-${prioridade}">${prioridade.toUpperCase()}</span>
      </div>
      <div class="kauth-title">${titulo}</div>
      ${justificativa ? `<div class="kauth-just"><b>Por quê:</b> ${justificativa}</div>` : ''}
      ${preview ? `<div class="kauth-preview">${preview}</div>` : ''}
      ${impacto ? `<div class="kauth-impact">📈 ${impacto}</div>` : ''}
      <div class="kauth-actions">
        <button class="kauth-btn kauth-aprovar" onclick="window.keyoAuth_aprovar('${idJS}')">✅ Aprovar</button>
        <button class="kauth-btn kauth-modificar" onclick="window.keyoAuth_modificar('${idJS}')">✏️ Modificar</button>
        <button class="kauth-btn kauth-rejeitar" onclick="window.keyoAuth_rejeitar('${idJS}')">❌ Rejeitar</button>
      </div>
    </div>`;
  }

  // ── Render do painel inteiro ──────────────────────────────────
  async function _render() {
    const main = document.getElementById('keyo-msgs');
    if (!main) return;
    main.style.display = 'block';
    main.innerHTML = '<div class="kauth-loading">Carregando autorizações…</div>';
    await _carregar();
    if (_cards === null) {
      main.innerHTML = `<div class="kauth-empty">⚠️ Não foi possível carregar as autorizações.<br><small>${S(_erro)}</small><br><small>Verifique se a tabela <b>keyo_brain_queue</b> existe no Supabase.</small></div>`;
      return;
    }
    if (!_cards.length) {
      main.innerHTML = `<div class="kauth-empty">✅ Nenhuma autorização pendente.<br><small>Quando o KEYO detectar uma oportunidade, ela aparece aqui.</small></div>`;
      return;
    }
    main.innerHTML =
      `<div class="kauth-wrap">
        <div class="kauth-header">🔔 ${_cards.length} iniciativa(s) aguardando sua decisão</div>
        ${_cards.map(_cardHTML).join('')}
      </div>`;
  }

  // ── CSS do módulo (injetado uma vez) ──────────────────────────
  function _injetarCSS() {
    if (document.getElementById('kauth-css')) return;
    const st = document.createElement('style');
    st.id = 'kauth-css';
    st.textContent = `
    .kauth-wrap{padding:16px;max-width:760px;margin:0 auto}
    .kauth-header{font-weight:700;font-size:15px;margin-bottom:14px;color:#1a1a2e}
    .kauth-card{background:#fff;border:1px solid #e3e3e3;border-radius:10px;padding:14px 16px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
    .kauth-card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
    .kauth-agent{font-size:12px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:.04em}
    .kauth-prio{font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;color:#fff}
    .kauth-prio-alta{background:#C0392B}.kauth-prio-media{background:#C9A84C}.kauth-prio-baixa{background:#2E75B6}
    .kauth-title{font-size:15px;font-weight:700;color:#1a1a2e;margin-bottom:6px}
    .kauth-just{font-size:13px;color:#444;margin-bottom:6px;line-height:1.4}
    .kauth-preview{font-size:13px;color:#333;background:#f7f7f9;border-radius:6px;padding:8px 10px;margin-bottom:6px;white-space:pre-wrap}
    .kauth-impact{font-size:13px;color:#1E8449;font-weight:600;margin-bottom:10px}
    .kauth-actions{display:flex;gap:8px;flex-wrap:wrap}
    .kauth-btn{border:none;border-radius:7px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;transition:.15s}
    .kauth-aprovar{background:#1E8449;color:#fff}.kauth-aprovar:hover{background:#176b3a}
    .kauth-modificar{background:#C9A84C;color:#1a1a2e}.kauth-modificar:hover{background:#b89640}
    .kauth-rejeitar{background:#eee;color:#C0392B}.kauth-rejeitar:hover{background:#e0d0d0}
    .kauth-empty,.kauth-loading{padding:48px 24px;text-align:center;color:#888;font-size:14px;line-height:1.6}
    `;
    document.head.appendChild(st);
  }

  // ── Função pública de render inline (chamada pelo _abrirModulo) ─
  window._kAuthRenderInline = function () {
    _injetarCSS();
    const inputArea = document.getElementById('keyo-input-area');
    const msgs = document.getElementById('keyo-msgs');
    if (inputArea) inputArea.style.display = 'none';
    if (msgs) msgs.style.display = 'block';
    _render();
  };

  // ── Auto-injeta o botão "Autorizações" na sidebar de Módulos ──
  function _injetarBotao() {
    const cont = document.getElementById('keyo-agents-modulos');
    if (!cont || document.getElementById('keyo-mod-autorizacoes')) return;
    const btn = document.createElement('button');
    btn.className = 'keyo-mod-btn';
    btn.id = 'keyo-mod-autorizacoes';
    btn.setAttribute('onclick', "window.keyo_abrirModulo('autorizacoes')");
    btn.innerHTML = '<span class="keyo-mod-emoji">🔔</span><span>Autorizações</span>';
    cont.appendChild(btn);
  }

  // Observa a criação do painel KEYO para injetar o botão
  function _watch() {
    if (document.getElementById('keyo-agents-modulos')) { _injetarBotao(); return; }
    const obs = new MutationObserver(function () {
      if (document.getElementById('keyo-agents-modulos')) { _injetarBotao(); }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _watch);
  } else { _watch(); }

  console.info('[KEYO-M20] Autorizações carregado ✓');
})();

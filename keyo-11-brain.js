/* ════════════════════════════════════════════════════════════════
   KEYO M17 — BRAIN LOOP (keyo-11-brain.js)
   Loop autônomo de monitoramento: chama a Edge Function
   keyo-brain-tick a cada 5 minutos, lê a fila keyo_brain_queue
   e mantém um badge de contagem de pendências visível no menu.

   Padrão idêntico aos demais módulos. 100% ADITIVO.
   NÃO altera nenhuma função do ERP base. (Lei #2)
   NÃO patcha goTo/renderPage/rSb.

   Deploy:
     1. Suba keyo-brain-tick no Supabase (Edge Functions).
     2. Rode KEYO_13_1_TABELAS.sql no SQL Editor.
     3. Inclua este arquivo no index.html APÓS keyo-14-auth.js.

   API pública:
     window.keyoBrain_start()    — inicia / retoma o loop
     window.keyoBrain_stop()     — pausa (não deleta nada)
     window.keyoBrain_tick()     — dispara um ciclo imediato
     window.keyoBrain_status()   — retorna { rodadas, pendentes, ativo }
   ════════════════════════════════════════════════════════════════ */
(function _KEYO_BRAIN() {
  'use strict';

  /* ── GUARD ────────────────────────────────────────────────── */
  if (window.__KEYO_M17_LOADED__) {
    console.warn('[KEYO-11] Já carregado. Ignorando.');
    return;
  }
  if (!window.__KEYO_00_LOADED__) {
    console.error('[KEYO-11] keyo-00-core.js não carregado. Abortando.');
    return;
  }
  window.__KEYO_M17_LOADED__ = true;

  /* ── VERIFICAÇÃO DE DEPENDÊNCIAS ──────────────────────────── */
  const _DEPS = ['toast', 'uid', 'hoje', 'fM', 'san'];
  const _depsFaltando = _DEPS.filter(d => typeof window[d] === 'undefined');
  if (_depsFaltando.length > 0) {
    console.error('[KEYO-11] Dependências ausentes:', _depsFaltando, '— módulo abortado.');
    window.__KEYO_M17_LOADED__ = false;
    return;
  }

  /* ── FREEZE DE FUNÇÕES CRÍTICAS ────────────────────────────── */
  const _ERP_ORIG = { goTo: window.goTo, toast: window.toast, sDB: window.sDB };
  window.addEventListener('load', function () {
    ['toast', 'sDB'].forEach(fn => {
      if (window[fn] !== _ERP_ORIG[fn])
        console.error('[KEYO-11] ⚠️ Função ERP sobrescrita:', fn);
    });
  }, { once: true });

  /* ════════════════════════════════════════════════════════════
     CONSTANTES
  ════════════════════════════════════════════════════════════ */
  const SUPA_URL     = 'https://utivaczfuuazspychdxt.supabase.co';
  const TICK_URL     = SUPA_URL + '/functions/v1/keyo-brain-tick';
  // Intervalo padrão: 5 min. Pode ser ajustado por window.KEYO_BRAIN_INTERVAL_MS
  const INTERVAL_MS  = 5 * 60 * 1000;
  const POLL_DELAY   = 30 * 1000; // re-lê a fila 30s após cada tick (Edge Function assíncrona)

  /* ── Helpers de Supabase REST ─────────────────────────────── */
  function _anon() { return window.KEYO_ANON_KEY || ''; }
  function _jwt() {
    try {
      const s = JSON.parse(localStorage.getItem('exit_unidade_session') || '{}');
      return s?.access_token || _anon();
    } catch (_e) { return _anon(); }
  }

  async function _sbGet(path) {
    const r = await fetch(SUPA_URL + '/rest/v1/' + path, {
      headers: {
        'Content-Type': 'application/json',
        'apikey':       _anon(),
        'Authorization':'Bearer ' + _jwt(),
      },
    });
    const txt = await r.text();
    if (!r.ok) throw new Error('Supabase ' + r.status + ': ' + txt.slice(0, 200));
    return txt ? JSON.parse(txt) : [];
  }

  /* ════════════════════════════════════════════════════════════
     ESTADO INTERNO
  ════════════════════════════════════════════════════════════ */
  let _ativo     = false;
  let _timer     = null;
  let _rodadas   = 0;
  let _pendentes = 0;   // contagem de cards na fila
  let _erros     = 0;

  /* ════════════════════════════════════════════════════════════
     BADGE DE CONTAGEM
     Injetado uma vez; atualizado a cada ciclo de polling.
  ════════════════════════════════════════════════════════════ */
  function _injetarCSSBadge() {
    if (document.getElementById('keyo-brain-css')) return;
    const s = document.createElement('style');
    s.id = 'keyo-brain-css';
    s.textContent = `
#keyo-brain-badge-wrap{position:relative;display:inline-block}
#keyo-brain-count{
  position:absolute;top:-6px;right:-8px;
  min-width:18px;height:18px;
  background:#C0392B;color:#fff;
  border-radius:9px;
  font:700 10px/18px system-ui,sans-serif;
  text-align:center;padding:0 4px;
  pointer-events:none;
  display:none;
  z-index:10;
}
#keyo-brain-count.show{display:block}
#keyo-brain-status-bar{
  position:fixed;right:14px;bottom:14px;
  z-index:99998;
  font:11px/1.4 system-ui,sans-serif;
  color:rgba(255,255,255,0.55);
  pointer-events:none;
  transition:opacity .3s;
}
`;
    document.head.appendChild(s);
  }

  /* Injeta o badge no botão "Autorizações" do menu KEYO */
  function _injetarBadge() {
    const btn = document.getElementById('keyo-mod-autorizacoes');
    if (!btn || document.getElementById('keyo-brain-count')) return;
    btn.style.position = 'relative';
    const badge = document.createElement('span');
    badge.id = 'keyo-brain-count';
    btn.appendChild(badge);
  }

  function _atualizarBadge(n) {
    const badge = document.getElementById('keyo-brain-count');
    if (!badge) return;
    if (n > 0) {
      badge.textContent = n > 99 ? '99+' : String(n);
      badge.classList.add('show');
    } else {
      badge.classList.remove('show');
    }
  }

  /* ════════════════════════════════════════════════════════════
     POLLING DA FILA (leve — só conta pendentes)
  ════════════════════════════════════════════════════════════ */
  async function _pollFila() {
    try {
      const uni = _unidadeAtual();
      let q = 'keyo_brain_queue?select=id&status=eq.pendente';
      if (uni) q += '&or=(unidade_id.eq.' + encodeURIComponent(uni) + ',unidade_id.is.null)';
      const rows = await _sbGet(q);
      _pendentes = Array.isArray(rows) ? rows.length : 0;
      _atualizarBadge(_pendentes);
    } catch (_e) {
      // polling falha silenciosamente (sem conexão, tabela ainda não existe)
    }
  }

  function _unidadeAtual() {
    try {
      if (window.UA && window.UA.unidadeId) return String(window.UA.unidadeId);
      if (window._unidadeId) return String(window._unidadeId);
    } catch (_e) {}
    return null;
  }

  /* ════════════════════════════════════════════════════════════
     DISPARAR TICK NA EDGE FUNCTION
  ════════════════════════════════════════════════════════════ */
  async function _tick() {
    _rodadas++;
    console.info('[KEYO-11] 🧠 Brain tick #' + _rodadas + ' — ' + new Date().toLocaleTimeString('pt-BR'));
    try {
      const r = await fetch(TICK_URL, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': 'Bearer ' + _jwt(),
          'apikey':         _anon(),
        },
        body: JSON.stringify({}),
      });
      if (!r.ok) {
        const txt = await r.text();
        throw new Error('HTTP ' + r.status + ': ' + txt.slice(0, 100));
      }
      const data = await r.json();
      _erros = 0;
      const criados = data?.criados || 0;
      if (criados > 0) {
        console.info('[KEYO-11] ✅ ' + criados + ' nova(s) iniciativa(s) criada(s).');
        if (typeof window.toast === 'function') {
          window.toast('🧠 KEYO: ' + criados + ' nova(s) iniciativa(s) aguardando sua decisão.', 'info');
        }
      }
    } catch (e) {
      _erros++;
      console.warn('[KEYO-11] ⚠️ Tick #' + _rodadas + ' falhou (' + _erros + 'x):', e.message);
      // Back-off: se falhar 3x consecutivas, pausa o loop e avisa
      if (_erros >= 3) {
        console.error('[KEYO-11] 3 falhas consecutivas — pausando Brain Loop. Chame keyoBrain_start() para retomar.');
        _stop();
        if (typeof window.toast === 'function') {
          window.toast('🧠 Brain Loop pausado após 3 falhas. Verifique a Edge Function.', 'error');
        }
        return;
      }
    }
    // Aguarda 30s e re-lê a fila (a Edge Function grava de forma assíncrona)
    setTimeout(_pollFila, POLL_DELAY);
  }

  /* ════════════════════════════════════════════════════════════
     CICLO PRINCIPAL
  ════════════════════════════════════════════════════════════ */
  function _ciclo() {
    _tick();  // dispara agora
    const ms = (window.KEYO_BRAIN_INTERVAL_MS && window.KEYO_BRAIN_INTERVAL_MS > 60000)
      ? window.KEYO_BRAIN_INTERVAL_MS
      : INTERVAL_MS;
    _timer = setInterval(_tick, ms);
  }

  function _start() {
    if (_ativo) return;
    _ativo = true;
    _erros = 0;
    _ciclo();
    console.info('[KEYO-11] 🟢 Brain Loop iniciado (intervalo: ' +
      Math.round((window.KEYO_BRAIN_INTERVAL_MS || INTERVAL_MS) / 60000) + ' min).');
  }

  function _stop() {
    _ativo = false;
    if (_timer) { clearInterval(_timer); _timer = null; }
    console.info('[KEYO-11] 🔴 Brain Loop pausado.');
  }

  /* ════════════════════════════════════════════════════════════
     INJEÇÃO DO BOTÃO "Brain Loop" NO MENU KEYO
  ════════════════════════════════════════════════════════════ */
  function _injetarBotaoMenu() {
    const cont = document.getElementById('keyo-agents-modulos');
    if (!cont || document.getElementById('keyo-mod-brain')) return;
    const btn = document.createElement('button');
    btn.className = 'keyo-mod-btn';
    btn.id = 'keyo-mod-brain';
    btn.title = 'Inicia/pausa o Brain Loop autônomo';
    btn.innerHTML = '<span class="keyo-mod-emoji">🧠</span><span>Brain Loop</span>';
    btn.onclick = function () {
      if (_ativo) {
        _stop();
        btn.style.opacity = '0.5';
        if (typeof window.toast === 'function') window.toast('🔴 Brain Loop pausado.', 'info');
      } else {
        btn.style.opacity = '1';
        _start();
        if (typeof window.toast === 'function') window.toast('🟢 Brain Loop iniciado.', 'success');
      }
    };
    cont.appendChild(btn);
  }

  /* ════════════════════════════════════════════════════════════
     BOOTSTRAP
  ════════════════════════════════════════════════════════════ */
  function _boot() {
    _injetarCSSBadge();

    // Aguarda o DOM do KEYO estar disponível para injetar badge e botão
    if (document.getElementById('keyo-agents-modulos')) {
      _injetarBotaoMenu();
      _injetarBadge();
    }

    // MutationObserver: KEYO pode ser aberto depois do boot
    const obs = new MutationObserver(function () {
      if (document.getElementById('keyo-agents-modulos')) {
        _injetarBotaoMenu();
        _injetarBadge();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });

    // Faz polling inicial da fila (sem disparar tick — só conta)
    _pollFila();
    // Polling leve a cada 60s para manter o badge atualizado mesmo sem tick
    setInterval(_pollFila, 60 * 1000);

    // Inicia o loop automaticamente
    _start();
  }

  /* ════════════════════════════════════════════════════════════
     API PÚBLICA
  ════════════════════════════════════════════════════════════ */
  window.keyoBrain_start  = _start;
  window.keyoBrain_stop   = _stop;
  window.keyoBrain_tick   = _tick;
  window.keyoBrain_status = function () {
    return { ativo: _ativo, rodadas: _rodadas, pendentes: _pendentes, erros: _erros };
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _boot);
  } else {
    _boot();
  }

  console.info('[KEYO-11] ✅ Brain Loop (M17) carregado — keyoBrain_start/stop/tick/status disponíveis.');

})();

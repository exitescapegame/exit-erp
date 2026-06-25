/* ════════════════════════════════════════════════════════════════
   KEYO M18 — MEMÓRIA EVOLUTIVA (keyo-12-memory.js)
   Três camadas de memória persistida no Supabase:
     • Curto prazo  → keyo_memoria  (TTL 24h, já existia)
     • Médio prazo  → keyo_memoria  (scope='medium', permanente)
     • Longo prazo  → keyo_knowledge (base de conhecimento permanente)
   RLHF simplificado: registra pesos por tipo de iniciativa em
     keyo_learning_weights.

   API pública:
     window.kMemSave(key, value, scope)  → salva
     window.kMemGet(key, scope)          → recupera
     window.kMemSearch(query, scope, n)  → top-n por relevância textual
     window.kMemInjectContext(agente)    → retorna string de contexto
       para injetar no prompt (top-5 memórias relevantes)
     window.kMemRLHF(agent, type, decision, feedback)
       → registra decisão do ADM no keyo_learning_weights

   100% ADITIVO. NÃO altera funções do ERP base. (Lei #2)
   ════════════════════════════════════════════════════════════════ */
(function _KEYO_MEMORY() {
  'use strict';

  /* ── GUARD ────────────────────────────────────────────────── */
  if (window.__KEYO_M18_LOADED__) {
    console.warn('[KEYO-12] Já carregado. Ignorando.');
    return;
  }
  if (!window.__KEYO_00_LOADED__) {
    console.error('[KEYO-12] keyo-00-core.js não carregado. Abortando.');
    return;
  }
  window.__KEYO_M18_LOADED__ = true;

  /* ── VERIFICAÇÃO DE DEPENDÊNCIAS ──────────────────────────── */
  const _DEPS = ['toast', 'uid', 'hoje', 'fM', 'san'];
  const _depsFaltando = _DEPS.filter(d => typeof window[d] === 'undefined');
  if (_depsFaltando.length > 0) {
    console.error('[KEYO-12] Dependências ausentes:', _depsFaltando, '— módulo abortado.');
    window.__KEYO_M18_LOADED__ = false;
    return;
  }

  /* ── FREEZE DE FUNÇÕES CRÍTICAS ────────────────────────────── */
  const _ERP_ORIG = { goTo: window.goTo, toast: window.toast, sDB: window.sDB };
  window.addEventListener('load', function () {
    ['toast', 'sDB'].forEach(fn => {
      if (window[fn] !== _ERP_ORIG[fn])
        console.error('[KEYO-12] ⚠️ Função ERP sobrescrita:', fn);
    });
  }, { once: true });

  /* ════════════════════════════════════════════════════════════
     CONSTANTES E HELPERS REST
  ════════════════════════════════════════════════════════════ */
  const SUPA_URL = 'https://utivaczfuuazspychdxt.supabase.co';

  function _anon() { return window.KEYO_ANON_KEY || ''; }
  function _jwt() {
    try {
      const s = JSON.parse(localStorage.getItem('exit_unidade_session') || '{}');
      return s?.access_token || _anon();
    } catch (_e) { return _anon(); }
  }

  function _headers(extra) {
    return Object.assign({
      'Content-Type':  'application/json',
      'apikey':         _anon(),
      'Authorization': 'Bearer ' + _jwt(),
    }, extra || {});
  }

  async function _sbGet(path) {
    const r = await fetch(SUPA_URL + '/rest/v1/' + path, { headers: _headers() });
    const txt = await r.text();
    if (!r.ok) throw new Error('Supabase GET ' + r.status + ': ' + txt.slice(0, 200));
    return txt ? JSON.parse(txt) : [];
  }

  async function _sbPost(table, body) {
    const r = await fetch(SUPA_URL + '/rest/v1/' + table, {
      method:  'POST',
      headers: _headers({ 'Prefer': 'return=representation' }),
      body:    JSON.stringify(body),
    });
    const txt = await r.text();
    if (!r.ok) throw new Error('Supabase POST ' + r.status + ': ' + txt.slice(0, 200));
    return txt ? JSON.parse(txt) : null;
  }

  async function _sbPatch(path, body) {
    const r = await fetch(SUPA_URL + '/rest/v1/' + path, {
      method:  'PATCH',
      headers: _headers({ 'Prefer': 'return=representation' }),
      body:    JSON.stringify(body),
    });
    const txt = await r.text();
    if (!r.ok) throw new Error('Supabase PATCH ' + r.status + ': ' + txt.slice(0, 200));
    return txt ? JSON.parse(txt) : null;
  }

  /* ════════════════════════════════════════════════════════════
     SQL PARA NOVAS TABELAS (instruções — rodar 1 vez no Supabase)
  ════════════════════════════════════════════════════════════

  -- keyo_knowledge: base permanente de conhecimento
  create table if not exists public.keyo_knowledge (
    id           text primary key default gen_random_uuid()::text,
    chave        text not null unique,
    valor        text,
    tags         text[],
    unidade_id   text,
    criado_em    timestamptz default now(),
    atualizado_em timestamptz default now()
  );
  alter table public.keyo_knowledge enable row level security;
  drop policy if exists keyo_knowledge_all on public.keyo_knowledge;
  create policy keyo_knowledge_all on public.keyo_knowledge
    for all using (true) with check (true);

  -- keyo_learning_weights: pesos de aprendizado RLHF
  create table if not exists public.keyo_learning_weights (
    id              bigint generated always as identity primary key,
    agent_id        text not null,
    initiative_type text not null,
    confidence_score numeric(5,2) default 0.5,
    approved_count  int default 0,
    rejected_count  int default 0,
    modified_count  int default 0,
    last_outcome    text,
    last_feedback   text,
    unidade_id      text,
    atualizado_em   timestamptz default now(),
    unique (agent_id, initiative_type, unidade_id)
  );
  alter table public.keyo_learning_weights enable row level security;
  drop policy if exists keyo_lw_all on public.keyo_learning_weights;
  create policy keyo_lw_all on public.keyo_learning_weights
    for all using (true) with check (true);

  ════════════════════════════════════════════════════════════ */

  /* ════════════════════════════════════════════════════════════
     TABELAS
  ════════════════════════════════════════════════════════════ */
  const T_MEMORIA    = 'keyo_memoria';       // short + medium (scope = campo na tabela)
  const T_KNOWLEDGE  = 'keyo_knowledge';     // long-term
  const T_LW         = 'keyo_learning_weights'; // RLHF

  /* ── Scope ───────────────────────────────────────────────── */
  // 'session'  → keyo_memoria, TTL 24h (limpeza via cron externo)
  // 'medium'   → keyo_memoria, sem TTL (permanente até remoção manual)
  // 'long'     → keyo_knowledge

  /* ════════════════════════════════════════════════════════════
     SALVAR MEMÓRIA
  ════════════════════════════════════════════════════════════ */
  async function _save(key, value, scope) {
    scope = scope || 'medium';
    const valStr = typeof value === 'string' ? value : JSON.stringify(value);

    if (scope === 'long') {
      // Upsert em keyo_knowledge via chave única
      const existe = await _sbGet(
        T_KNOWLEDGE + '?chave=eq.' + encodeURIComponent(key) + '&select=id'
      ).catch(() => []);
      if (Array.isArray(existe) && existe.length > 0) {
        return await _sbPatch(
          T_KNOWLEDGE + '?chave=eq.' + encodeURIComponent(key),
          { valor: valStr, atualizado_em: new Date().toISOString() }
        );
      } else {
        return await _sbPost(T_KNOWLEDGE, [{ chave: key, valor: valStr }]);
      }
    }

    // short / medium → keyo_memoria
    // Estrutura esperada: id, agente, chave, valor, escopo, criado_em
    // Se a tabela ainda não tiver 'escopo' — o módulo funciona sem ela,
    // armazenando no campo 'agente' o scope como fallback.
    const payload = {
      agente:    scope,   // reutiliza campo 'agente' para scope (backward-compat)
      chave:     key,
      valor:     valStr,
      criado_em: new Date().toISOString(),
    };
    // Tenta adicionar campo 'escopo' se existir
    try { payload.escopo = scope; } catch (_e) {}

    return await _sbPost(T_MEMORIA, [payload]).catch(async (e) => {
      // Se falhar (ex: campo 'escopo' não existe) tenta sem ele
      delete payload.escopo;
      return await _sbPost(T_MEMORIA, [payload]);
    });
  }

  /* ════════════════════════════════════════════════════════════
     RECUPERAR MEMÓRIA
  ════════════════════════════════════════════════════════════ */
  async function _get(key, scope) {
    scope = scope || 'medium';
    if (scope === 'long') {
      const rows = await _sbGet(
        T_KNOWLEDGE + '?chave=eq.' + encodeURIComponent(key) + '&select=valor&limit=1'
      ).catch(() => []);
      return rows?.[0]?.valor || null;
    }
    const rows = await _sbGet(
      T_MEMORIA + '?chave=eq.' + encodeURIComponent(key) +
      '&agente=eq.' + encodeURIComponent(scope) +
      '&select=valor&order=criado_em.desc&limit=1'
    ).catch(() => []);
    return rows?.[0]?.valor || null;
  }

  /* ════════════════════════════════════════════════════════════
     BUSCA POR RELEVÂNCIA TEXTUAL SIMPLES
     (sem vetor — pontuação por número de palavras do query
      encontradas no valor)
  ════════════════════════════════════════════════════════════ */
  async function _search(query, scope, n) {
    n = n || 5;
    scope = scope || 'medium';

    let rows = [];
    if (scope === 'long') {
      rows = await _sbGet(T_KNOWLEDGE + '?select=chave,valor&order=atualizado_em.desc&limit=100').catch(() => []);
    } else {
      rows = await _sbGet(
        T_MEMORIA + '?agente=eq.' + encodeURIComponent(scope) +
        '&select=chave,valor&order=criado_em.desc&limit=100'
      ).catch(() => []);
    }

    const palavras = query.toLowerCase().split(/\s+/).filter(Boolean);
    const scored = rows.map(function (row) {
      const texto = ((row.chave || '') + ' ' + (row.valor || '')).toLowerCase();
      const score = palavras.reduce(function (s, p) { return s + (texto.includes(p) ? 1 : 0); }, 0);
      return { chave: row.chave, valor: row.valor, score: score };
    });
    return scored.filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, n);
  }

  /* ════════════════════════════════════════════════════════════
     INJETAR CONTEXTO NO PROMPT DO AGENTE
     Chamado pelo keyo-01-ui.js antes de enviar para a Edge.
  ════════════════════════════════════════════════════════════ */
  async function _injectContext(agente) {
    try {
      // Busca memórias relevantes ao agente em médio e longo prazo
      const medium = await _search(agente, 'medium', 5);
      const long   = await _search(agente, 'long',   3);

      if (!medium.length && !long.length) return '';

      const linhas = ['╔══ MEMÓRIA DO KEYO (aprendizado acumulado) ══╗'];
      medium.forEach(function (m) {
        linhas.push('[médio prazo] ' + m.chave + ': ' + (m.valor || '').slice(0, 200));
      });
      long.forEach(function (m) {
        linhas.push('[longo prazo] ' + m.chave + ': ' + (m.valor || '').slice(0, 200));
      });
      linhas.push('╚══════════════════════════════════════════════╝');
      return linhas.join('\n');
    } catch (_e) {
      return ''; // falha silenciosa — não bloqueia o chat
    }
  }

  /* ════════════════════════════════════════════════════════════
     RLHF — REGISTRAR DECISÃO DO ADM
     Atualiza keyo_learning_weights com base em aprovação/rejeição.
     Chamado pelo keyo-14-auth.js após cada decisão.
  ════════════════════════════════════════════════════════════ */
  async function _rlhf(agentId, initiativeType, decision, feedback) {
    try {
      const uni = _unidadeAtual();
      // Busca peso existente
      let q = T_LW + '?agent_id=eq.' + encodeURIComponent(agentId) +
              '&initiative_type=eq.' + encodeURIComponent(initiativeType);
      if (uni) q += '&unidade_id=eq.' + encodeURIComponent(uni);
      q += '&limit=1';

      const rows = await _sbGet(q).catch(() => []);

      if (Array.isArray(rows) && rows.length > 0) {
        // Atualiza existente
        const row = rows[0];
        const approved = (row.approved_count || 0) + (decision === 'aprovada' ? 1 : 0);
        const rejected = (row.rejected_count || 0) + (decision === 'rejeitada' ? 1 : 0);
        const modified = (row.modified_count || 0) + (decision === 'modificada' ? 1 : 0);
        const total    = approved + rejected + modified;
        const confidence = total > 0 ? Math.min(1, approved / total) : 0.5;

        await _sbPatch(
          T_LW + '?agent_id=eq.' + encodeURIComponent(agentId) +
          '&initiative_type=eq.' + encodeURIComponent(initiativeType) +
          (uni ? '&unidade_id=eq.' + encodeURIComponent(uni) : ''),
          {
            approved_count:  approved,
            rejected_count:  rejected,
            modified_count:  modified,
            confidence_score: parseFloat(confidence.toFixed(2)),
            last_outcome:    decision,
            last_feedback:   feedback || null,
            atualizado_em:   new Date().toISOString(),
          }
        );
      } else {
        // Cria novo registro
        const payload = {
          agent_id:        agentId,
          initiative_type: initiativeType,
          approved_count:  decision === 'aprovada' ? 1 : 0,
          rejected_count:  decision === 'rejeitada' ? 1 : 0,
          modified_count:  decision === 'modificada' ? 1 : 0,
          confidence_score: decision === 'aprovada' ? 1.0 : 0.0,
          last_outcome:    decision,
          last_feedback:   feedback || null,
          atualizado_em:   new Date().toISOString(),
        };
        if (uni) payload.unidade_id = uni;
        await _sbPost(T_LW, [payload]);
      }

      // Salva também em memória de médio prazo para o agente aprender
      const memKey = 'rlhf:' + agentId + ':' + initiativeType;
      const memVal = 'Decisão: ' + decision +
        (feedback ? ' | Feedback: ' + feedback.slice(0, 100) : '') +
        ' | ' + new Date().toLocaleDateString('pt-BR');
      await _save(memKey, memVal, 'medium').catch(() => {});

      console.info('[KEYO-12] RLHF registrado:', agentId, initiativeType, decision);
    } catch (e) {
      console.warn('[KEYO-12] RLHF falhou (não bloqueante):', e.message);
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
     INJEÇÃO NO MÓDULO DE AUTORIZAÇÕES (keyo-14-auth.js)
     Quando o M14 finaliza uma decisão, dispara o RLHF aqui.
  ════════════════════════════════════════════════════════════ */
  (function _hookAuth() {
    // Aguarda o M20 carregar e envolve _decidir com RLHF
    function _tryHook() {
      const orig14 = window.keyoAuth_aprovar;
      if (!orig14) return; // M20 ainda não carregou — tenta depois

      if (window.__KEYO_M18_AUTH_HOOKED__) return;
      window.__KEYO_M18_AUTH_HOOKED__ = true;

      // Wrap das três funções de decisão
      ['keyoAuth_aprovar', 'keyoAuth_rejeitar', 'keyoAuth_modificar'].forEach(function (fn) {
        const origFn = window[fn];
        if (typeof origFn !== 'function') return;
        window[fn] = async function (id) {
          // Chama original primeiro
          await origFn.call(this, id);
          // Tenta registrar RLHF (não-bloqueante)
          try {
            const decisao = fn === 'keyoAuth_aprovar' ? 'aprovada'
                          : fn === 'keyoAuth_rejeitar' ? 'rejeitada' : 'modificada';
            // Busca card na fila para pegar agente e type
            const rows = await _sbGet(
              'keyo_auth_log?queue_id=is.null&decision=eq.' +
              encodeURIComponent(decisao) + '&order=decided_at.desc&limit=1'
            ).catch(() => []);
            // Fallback: busca no log recente
            const logRows = await _sbGet(
              'keyo_auth_log?order=decided_at.desc&limit=1'
            ).catch(() => []);
            const entry = logRows?.[0];
            if (entry && entry.agent && entry.initiative_type) {
              await _rlhf(entry.agent, entry.initiative_type, entry.decision, entry.feedback);
            }
          } catch (_e) { /* não bloqueia */ }
        };
      });
      console.info('[KEYO-12] ✅ Hook RLHF injetado nas funções de autorização.');
    }

    // Tenta na hora do boot e observa DOM para quando M20 injetar os botões
    _tryHook();
    const obs = new MutationObserver(function () { _tryHook(); });
    obs.observe(document.body, { childList: true, subtree: true });
  })();

  /* ════════════════════════════════════════════════════════════
     MÓDULO DE VISUALIZAÇÃO (opcional — painel de memórias)
  ════════════════════════════════════════════════════════════ */
  function _injetarBotaoMenu() {
    const cont = document.getElementById('keyo-agents-modulos');
    if (!cont || document.getElementById('keyo-mod-memoria')) return;
    const btn = document.createElement('button');
    btn.className = 'keyo-mod-btn';
    btn.id = 'keyo-mod-memoria';
    btn.title = 'Ver e gerenciar memórias do KEYO';
    btn.innerHTML = '<span class="keyo-mod-emoji">💾</span><span>Memória</span>';
    btn.setAttribute('onclick', "window.keyo_abrirModulo('memoria')");
    cont.appendChild(btn);
  }

  /* Handler para o módulo inline "memoria" */
  window._kMemRenderInline = async function () {
    const msgs = document.getElementById('keyo-msgs');
    if (!msgs) return;
    msgs.style.display = 'block';
    msgs.innerHTML = '<div style="padding:32px;text-align:center;color:#888">Carregando memórias…</div>';

    try {
      const medium = await _sbGet(T_MEMORIA + '?order=criado_em.desc&limit=20').catch(() => []);
      const long   = await _sbGet(T_KNOWLEDGE + '?order=atualizado_em.desc&limit=20').catch(() => []);
      const lw     = await _sbGet(T_LW + '?order=atualizado_em.desc&limit=10').catch(() => []);

      const S = function (v) {
        return typeof window.san === 'function'
          ? window.san(v)
          : String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      };

      const css = `
<style>
.kmem-wrap{padding:16px;max-width:760px;margin:0 auto;font:13px/1.5 system-ui,sans-serif}
.kmem-section{margin-bottom:20px}
.kmem-section h3{font-size:13px;font-weight:700;color:#C9A84C;margin:0 0 8px;text-transform:uppercase;letter-spacing:.04em}
.kmem-table{width:100%;border-collapse:collapse;font-size:12px}
.kmem-table th{background:#f4f4fa;padding:6px 8px;text-align:left;font-weight:600;color:#555;border-bottom:2px solid #e0e0e8}
.kmem-table td{padding:6px 8px;border-bottom:1px solid #f0f0f8;color:#333;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kmem-table tr:hover td{background:#fafafa}
.kmem-empty{color:#aaa;font-style:italic;padding:8px 0}
.kmem-score{font-size:11px;font-weight:700;padding:2px 6px;border-radius:8px;background:#e8f5e9;color:#2e7d32}
.kmem-score.low{background:#fff3e0;color:#e65100}
</style>`;

      function tableHTML(rows, cols) {
        if (!rows || !rows.length) return '<p class="kmem-empty">Nenhum registro.</p>';
        return `<table class="kmem-table">
          <tr>${cols.map(c => '<th>' + c.label + '</th>').join('')}</tr>
          ${rows.map(r => '<tr>' + cols.map(c =>
            '<td title="' + S(r[c.key] || '') + '">' + S((r[c.key] || '').toString().slice(0, 60)) + '</td>'
          ).join('') + '</tr>').join('')}
        </table>`;
      }

      msgs.innerHTML = css + `
<div class="kmem-wrap">
  <div class="kmem-section">
    <h3>💬 Memória de Médio Prazo (keyo_memoria)</h3>
    ${tableHTML(medium, [
      { key: 'agente', label: 'Escopo/Agente' },
      { key: 'chave',  label: 'Chave' },
      { key: 'valor',  label: 'Valor' },
      { key: 'criado_em', label: 'Data' },
    ])}
  </div>
  <div class="kmem-section">
    <h3>📚 Memória de Longo Prazo (keyo_knowledge)</h3>
    ${tableHTML(long, [
      { key: 'chave',  label: 'Chave' },
      { key: 'valor',  label: 'Valor' },
      { key: 'atualizado_em', label: 'Atualizado' },
    ])}
  </div>
  <div class="kmem-section">
    <h3>🧠 Pesos de Aprendizado RLHF (keyo_learning_weights)</h3>
    ${tableHTML(lw, [
      { key: 'agent_id',        label: 'Agente' },
      { key: 'initiative_type', label: 'Tipo' },
      { key: 'confidence_score',label: 'Confiança' },
      { key: 'approved_count',  label: '✅' },
      { key: 'rejected_count',  label: '❌' },
      { key: 'last_outcome',    label: 'Última' },
    ])}
  </div>
</div>`;
    } catch (e) {
      msgs.innerHTML = '<div style="padding:32px;text-align:center;color:#C0392B">Erro ao carregar memórias: ' + (e.message || '') + '</div>';
    }
  };

  /* ════════════════════════════════════════════════════════════
     BOOT
  ════════════════════════════════════════════════════════════ */
  function _boot() {
    if (document.getElementById('keyo-agents-modulos')) _injetarBotaoMenu();
    const obs = new MutationObserver(function () {
      if (document.getElementById('keyo-agents-modulos')) _injetarBotaoMenu();
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _boot);
  } else {
    _boot();
  }

  /* ════════════════════════════════════════════════════════════
     API PÚBLICA
  ════════════════════════════════════════════════════════════ */
  window.kMemSave          = _save;
  window.kMemGet           = _get;
  window.kMemSearch        = _search;
  window.kMemInjectContext = _injectContext;
  window.kMemRLHF          = _rlhf;

  console.info('[KEYO-12] ✅ Memória Evolutiva (M18) — kMemSave/Get/Search/InjectContext/RLHF disponíveis.');

})();

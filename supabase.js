// ═══════════════════════════════════════════════════════════════════════════════
// SUPABASE.JS — Integração direta server-side com o banco EXIT Games
// Lê e grava: unidades, salas, ocupacao, vendas, clientes, keyo_memoria
// ═══════════════════════════════════════════════════════════════════════════════

'use strict';

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY; // Service Role Key (server-side apenas)

if (!SUPA_URL || !SUPA_KEY) {
  console.error('[Supabase] ⚠️  SUPABASE_URL ou SUPABASE_SERVICE_KEY não definidos no .env');
}

// ── Fetch base ───────────────────────────────────────────────────────────────
async function sf(path, method = 'GET', body = null, params = '') {
  const url = `${SUPA_URL}/rest/v1/${path}${params}`;
  const opts = {
    method,
    headers: {
      'apikey':        SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        method === 'POST' ? 'return=representation' : 'return=minimal'
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase ${method} ${path}: ${res.status} — ${err}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ── Leitura de configurações do ERP ─────────────────────────────────────────
async function carregarUnidades() {
  // ERP grava como { id, dados:{...}, atualizado_em }. Desempacota o JSON `dados`.
  const rows = await sf('unidades', 'GET', null, '?select=*&order=id');
  return (rows || []).map(r => {
    const u = (r && r.dados) ? r.dados : (r || {});
    if (r && r.id != null) u.id = String(r.id);
    return u;
  });
}

async function carregarSalas(unidadeId = null) {
  const filtro = unidadeId ? `?unidade_id=eq.${unidadeId}&select=*` : '?select=*';
  const rows = await sf('salas', 'GET', null, filtro);
  return (rows || []).map(r => {
    const s = (r && r.dados) ? r.dados : (r || {});
    if (r && r.id != null) s.id = String(r.id);
    // unidade_id (coluna solta) é a fonte de verdade da unidade da sala — RLS-v59 do ERP.
    if (r && r.unidade_id != null) s.unidadeId = String(r.unidade_id);
    return s;
  });
}

async function carregarFeriados() {
  // [FIX] O ERP NÃO tem tabela `feriados` — os feriados ficam em `configuracoes`
  // como { chave: 'feriados', valor: [{data:'YYYY-MM-DD', nome:'...'}] }.
  // A função anterior retornava sempre [] causando preço errado em feriados.
  try {
    const rows = await sf('config', 'GET', null, '?chave=eq.feriados&select=valor&limit=1');
    const lista = rows?.[0]?.valor;
    if (Array.isArray(lista)) return lista; // [{data, nome}, ...]
    return [];
  } catch (e) {
    console.warn('[Supabase] carregarFeriados: erro ao buscar configuracoes:', e.message);
    return [];
  }
}

async function carregarCupons() {
  return sf('cupons', 'GET', null, '?ativo=eq.true&select=*');
}

// ── Ocupação ─────────────────────────────────────────────────────────────────
async function consultarHorarios(unidadeId, salaId, data) {
  const prefixo = salaId
    ? `${unidadeId}_${salaId}_${data}`
    : `${unidadeId}_%_${data}`;
  const rows = await sf('ocupacao', 'GET', null,
    `?chave=like.${encodeURIComponent(prefixo + '_%')}&select=chave,status`);
  return rows || [];
}

async function bloquearHorario(unidadeId, salaId, data, horario, status = 'reservado') {
  const chave = `${unidadeId}_${salaId}_${data}_${horario}`;
  return sf('ocupacao', 'POST', [{
    chave,
    unidade_id: String(unidadeId),
    status,
    atualizado_em: new Date().toISOString()
  }], '?on_conflict=chave');
}

// ── Vendas ───────────────────────────────────────────────────────────────────
async function criarVenda(venda) {
  return sf('vendas', 'POST', [{
    id: String(venda.id),
    unidade_id: String(venda.unidadeId),
    data: venda.data,
    dados: venda,
    criado_em: new Date().toISOString()
  }]);
}

async function buscarVenda(id) {
  const rows = await sf('vendas', 'GET', null, `?id=eq.${id}&select=*&limit=1`);
  return rows?.[0] || null;
}

async function listarVendasPorData(data) {
  // Busca vendas de um dia específico para Brain Loop enviar pesquisa pós-jogo.
  // data = string 'YYYY-MM-DD' ou Date object. Retorna array de vendas do dia.
  if (!data) return [];

  let dataStr;
  if (typeof data === 'string') {
    dataStr = data; // Assume já é 'YYYY-MM-DD'
  } else if (data instanceof Date) {
    const y = data.getFullYear();
    const m = String(data.getMonth() + 1).padStart(2, '0');
    const d = String(data.getDate()).padStart(2, '0');
    dataStr = `${y}-${m}-${d}`;
  } else {
    return [];
  }

  try {
    // Filtra por data exata + status !== cancelado
    const rows = await sf('vendas', 'GET', null,
      `?data=eq.${encodeURIComponent(dataStr)}&status=neq.cancelado&select=*&order=criado_em.desc`);
    
    // Normaliza como o ERP: desempacota `dados` se existir, preserva colunas soltas (telefone, etc).
    return (rows || []).map(r => {
      const v = (r && r.dados) ? r.dados : (r || {});
      if (r && r.id != null) v.id = String(r.id);
      if (r && r.unidade_id != null) v.unidadeId = String(r.unidade_id);
      if (r && r.data != null) v.data = r.data;
      if (r && r.telefone != null) v.telefone = r.telefone;
      if (r && r.status != null) v.status = r.status;
      return v;
    });
  } catch (e) {
    console.error('[listarVendasPorData] Erro ao buscar vendas:', e.message);
    return [];
  }
}

// ── Clientes ─────────────────────────────────────────────────────────────────
// Normaliza telefone para os últimos 11 dígitos, removendo código do país (55) e pontuação.
// WhatsApp envia 5579999999999; ERP guarda "(79) 99999-9999". Assim os dois batem.
function _telCore(tel) {
  let d = String(tel || '').replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  return d.slice(-11);
}

async function buscarClientePorTel(tel) {
  const alvo = _telCore(tel);
  if (!alvo) return null;
  // ERP guarda o telefone FORMATADO dentro de `dados`; não há coluna solta `telefone`.
  // Carregamos id+dados e comparamos pelo telefone normalizado.
  const rows = await sf('clientes', 'GET', null, '?select=id,dados');
  for (const r of (rows || [])) {
    const c = (r && r.dados) ? r.dados : null;
    if (c && _telCore(c.telefone) === alvo) {
      return { id: r.id, ...c };
    }
  }
  return null;
}

async function criarOuAtualizarCliente(dados) {
  const tel = _telCore(dados.telefone);
  const existente = await buscarClientePorTel(tel);

  if (existente) {
    // Atualiza nome e data de aniversário dentro de `dados`, preservando o resto do cadastro.
    const novoDados = {
      ...existente,
      nome: dados.nome || existente.nome,
      dataNascimento: dados.dataNascimento || existente.dataNascimento || '',
      id: String(existente.id)
    };
    delete novoDados.__rowId;
    await sf('clientes', 'PATCH', { dados: novoDados }, `?id=eq.${existente.id}`);
    return existente.id;
  }

  // Novo cliente — grava no MESMO formato do ERP: { id, dados:{...}, criado_em }.
  const novoId = 'cli-wa-' + Date.now();
  const clienteObj = {
    id: novoId,
    nome: dados.nome,
    telefone: tel,
    dataNascimento: dados.dataNascimento || '',
    cidade: dados.cidade || '',
    origem: 'whatsapp_keyo',
    waConsentimento: true,
    waConsentimentoData: new Date().toISOString(),
    criadoEm: new Date().toISOString()
  };
  await sf('clientes', 'POST', [{
    id: novoId,
    dados: clienteObj,
    criado_em: new Date().toISOString()
  }]);
  return novoId;
}

// ── LGPD — Exclusão de dados ─────────────────────────────────────────────────
async function excluirDadosCliente(tel) {
  const telNorm = tel.replace(/\D/g, '');
  const cliente = await buscarClientePorTel(telNorm);
  if (!cliente) return false;

  // Anonimiza (não apaga — preserva integridade financeira)
  await sf('clientes', 'PATCH', {
    nome: '[DADOS REMOVIDOS - LGPD]',
    telefone: null,
    dados: {
      lgpd_removido: true,
      lgpd_data: new Date().toISOString(),
      lgpd_motivo: 'Solicitação do titular — Art. 18 LGPD'
    }
  }, `?id=eq.${cliente.id}`);

  // Remove histórico de conversas
  await sf('keyo_memoria', 'DELETE', null,
    `?tipo=eq.whatsapp_sessao&ref_id=eq.${telNorm}`).catch(() => {});

  console.log(`[LGPD] ✅ Dados do cliente ${telNorm} anonimizados.`);
  return true;
}

// ── Memória KEYO (keyo_memoria) ──────────────────────────────────────────────
async function salvarMemoria(tipo, refId, dados) {
  return sf('keyo_memoria', 'POST', [{
    tipo,
    ref_id: String(refId),
    dados,
    criado_em: new Date().toISOString()
  }], '?on_conflict=tipo,ref_id');
}

async function buscarMemoria(tipo, refId) {
  const rows = await sf('keyo_memoria', 'GET', null,
    `?tipo=eq.${tipo}&ref_id=eq.${encodeURIComponent(refId)}&select=dados&limit=1`);
  return rows?.[0]?.dados || null;
}

// ── Auditoria ─────────────────────────────────────────────────────────────────
// [FIX] Tabela 'auditoria' nao existe no Supabase (retornava 404 nos logs).
// Conforme mapa L99: gravar em keyo_memoria com tipo='auditoria_bot'.
// ref_id = acao + timestamp para evitar colisao no on_conflict(tipo, ref_id).
async function registrarAuditoria(acao, descricao, ator = 'KEYO-BOT') {
  const refId = acao + '_' + Date.now();
  return salvarMemoria('auditoria_bot', refId, {
    acao,
    descricao,
    ator,
    criado_em: new Date().toISOString()
  }).catch(e => console.warn('[Auditoria] Falha ao registrar em keyo_memoria:', e.message));
}

module.exports = {
  supabase: {
    carregarUnidades,
    carregarSalas,
    carregarFeriados,
    carregarCupons,
    consultarHorarios,
    bloquearHorario,
    criarVenda,
    buscarVenda,
    listarVendasPorData,
    buscarClientePorTel,
    criarOuAtualizarCliente,
    excluirDadosCliente,
    salvarMemoria,
    buscarMemoria,
    registrarAuditoria
  }
};

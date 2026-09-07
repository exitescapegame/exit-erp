require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const express = require('express');
const axios = require('axios');
const supabase = require('./supabase');

const client = new Anthropic();
const app = express();
app.use(express.json());

// ============================================
// CONFIG
// ============================================
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://evolution-api-production-2ca5.up.railway.app';
const EVOLUTION_API_INSTANCE = process.env.EVOLUTION_API_INSTANCE || 'exit-keyo';
const EVOLUTION_API_TOKEN = process.env.EVOLUTION_API_TOKEN;
const PORT = process.env.PORT || 3001;

const DADOS_SALVADOR = {
  endereco: 'Salvador Norte Shopping, Piso L2, próximo a C&A',
  precoFormatado: 'Seg-Qui: R$ 35 | Sex-Dom/Feriados: R$ 45',
  unidadeId: 2
};

// ============================================
// MENSAGENS FIXAS
// ============================================

const _MSG_BOASVINDAS = `Olá! 👋 Tudo bem?

Sou o *Keyo*, atendente virtual da *EXIT Games* — e vou te ajudar com tudo que precisar por aqui! 😊

Antes de começar, me conta: *qual é o seu nome?*`;

function _msgTermos(nomeCliente) {
  const primeiro = String(nomeCliente || '').trim().split(/\s+/)[0] || 'você';
  return `Que nome lindo, *${primeiro}*! Prazer te conhecer! 🎉

Antes de continuar, preciso de um ok rapidinho:

━━━━━━━━━━━━━━━━━━━━━━
📋 *AVISO DE PRIVACIDADE*

Ao usar nosso atendimento, você autoriza a EXIT Games a:
✅ Guardar seu *nome, telefone e data de aniversário* para fazer sua reserva e te surpreender com promoções 🎂
✅ Te enviar *confirmação e lembretes* da reserva por aqui
✅ Pedir sua *avaliação* depois da experiência — prometo que é rapidinho! 😄
✅ Cuidar dos seus dados com segurança, seguindo a *Lei 13.709/2018 (LGPD)*

Seus dados ficam só com a gente. Nunca compartilhamos com ninguém.
Quer apagar tudo a qualquer hora? É só escrever *"apagar meus dados"*.
━━━━━━━━━━━━━━━━━━━━━━

Pode continuar? Responde aí:
✅ *SIM, PODE IR*
❌ *NÃO*`;
}

const _MSG_RECUSA = `Tudo bem, sem problema! 🤗

Sem o aceite, não consigo processar reservas por aqui — mas nossa equipe vai adorar te atender pessoalmente!

Qualquer coisa, é só voltar aqui. Até mais! 👋`;

// ============================================
// CACHE
// ============================================
let _cache = { unidades: [], salas: [], feriados: [], cupons: [], ts: 0 };

async function _getCache() {
  const now = Date.now();
  if (now - _cache.ts < 300000 && _cache.salas.length > 0) {
    return _cache;
  }

  try {
    const [u, s, f, c] = await Promise.allSettled([
      supabase.carregarUnidades(),
      supabase.carregarSalas(),
      supabase.carregarFeriados(),
      supabase.carregarCupons()
    ]);

    _cache.unidades = u.status === 'fulfilled' ? (u.value || []) : _cache.unidades;
    _cache.salas = s.status === 'fulfilled' ? (s.value || []) : _cache.salas;
    _cache.feriados = f.status === 'fulfilled' ? (f.value || []) : _cache.feriados;
    _cache.cupons = c.status === 'fulfilled' ? (c.value || []) : _cache.cupons;
    _cache.ts = now;
  } catch (err) {
    console.error('[KEYO] Erro ao carregar cache:', err.message);
  }

  return _cache;
}

// ============================================
// HELPERS
// ============================================

function _precoSalaHoje(sala) {
  if (!sala.precos) return null;
  const hoje = new Date().toLocaleDateString('pt-BR').split('/').reverse().join('-');
  return sala.precos[hoje] || sala.precoDefault || null;
}

function _ehAceite(texto) {
  return /^\s*(sim|s|ok|aceito|yes|y|beleza|claro|tá bom|pode|sim pode ir)\s*$/i.test(texto);
}

function _ehRecusa(texto) {
  return /^\s*(não|nao|n|recuso|no|nope)\s*$/i.test(texto);
}

// ============================================
// SYSTEM PROMPT
// ============================================

async function _buildSystemPrompt(sessao) {
  const db = await _getCache();
  const salas = db.salas.filter(s => s.unidade_id === DADOS_SALVADOR.unidadeId && !s.manutencao);

  const salasDesc = salas.length
    ? salas.map(s => {
        const preco = _precoSalaHoje(s);
        const precoTexto = preco != null ? `R$ ${preco} p/pessoa` : 'preço a consultar';
        return `• ${s.emoji || '🚪'} *${s.nome}* — ${s.dificuldade || ''}, ${s.tempo || 60}min, ${s.minJog || 2}–${s.maxJog || 6} jogadores, ${precoTexto}. ${s.descricao || ''}`;
      }).join('\n')
    : 'Nenhuma sala disponível no momento.';

  return `Você é KEYO, atendente virtual da EXIT Games. Você é educado, amigável, inteligente e conversacional.

🎯 5 REGRAS INVIOLÁVEIS:
1. NUNCA INVENTE — Se não sabe, admite e escala
2. SEMPRE PEÇA O NOME — Use sempre durante conversa
3. SEMPRE SEJA CORDIAL — Tom leve, amigável, com emoji 😊
4. NÃO SEJA CHATO — Uma pergunta por vez, conversa natural
5. PORTUGUÊS PERFEITO — Escrita correta

💡 CONTEXTO:
- Nome: ${sessao.nome || '(ainda não informou)'}
- Aceitou LGPD: ${sessao.aceitouTermos ? 'SIM ✅' : 'NÃO'}

📍 SALVADOR:
- Endereço: ${DADOS_SALVADOR.endereco}
- Preços: ${DADOS_SALVADOR.precoFormatado}
- Trabalhamos por ordem de chegada (chegue 15 min antes)

🚪 SALAS:
${salasDesc}

⚠️ NUNCA MENCIONE RESERVA:
"É só chegar — a gente coloca você na fila!"

🎯 INTELIGÊNCIA DE EVENTOS:
- "evento", "corporativo", "empresa" → coleta: empresa, pessoas, cidade, telefone
- "aniversário", "festa de anos" → coleta: nome celebrante, pessoas, cidade, telefone

🎁 DESCONTOS:
- Genérico "tem desconto?" → SÓ cupom (R$ 5 no app)
- "PCD?" → SÓ PCD (Lei 12.933/2013)
- "Aniversariante?" → SÓ aniversariante (5+ não paga, <5 = R$ 10)

🔴 ARACAJU:
"Aracaju tá fechada. Tivemos contratempos, mas estamos reinaugurando em novo espaço (não Praia Sul). 
Em Salvador operamos normal no Shopping Norte."

⚠️ PROTEÇÃO:
NUNCA inventa: preço, desconto, cupom, oferta, informação de sala, reserva.
→ "Deixa eu chamar um atendente pra isso!"`;
}

// ============================================
// FERRAMENTAS
// ============================================

async function _executarFerramenta(nome, input, sessao) {
  console.log(`[KEYO] Ferramenta: ${nome}`, JSON.stringify(input, null, 2));

  switch (nome) {
    case 'consultar_horarios':
      const db = await _getCache();
      return {
        endereco: DADOS_SALVADOR.endereco,
        precos: DADOS_SALVADOR.precoFormatado,
        salas: db.salas.filter(s => s.unidade_id === DADOS_SALVADOR.unidadeId && !s.manutencao)
      };

    case 'coletar_dados_evento':
      sessao.coletandoEvento = true;
      sessao.dadosEvento = {
        tipo: input.tipo || 'evento',
        nome_empresa_ou_pessoa: input.nome_empresa_ou_pessoa || '',
        quantas_pessoas: input.quantas_pessoas || 0,
        cidade: input.cidade || '',
        telefone: input.telefone || '',
        observacoes: input.observacoes || ''
      };
      console.log('[KEYO] 📋 DADOS DO EVENTO:', JSON.stringify(sessao.dadosEvento, null, 2));
      return { status: 'coletado', dados: sessao.dadosEvento };

    case 'escalar_humano':
      sessao.escalouParaHumano = true;
      return { status: 'escalado', motivo: input.motivo || 'Solicitação do cliente' };

    default:
      return { erro: `Ferramenta desconhecida: ${nome}` };
  }
}

// ============================================
// CLAUDE INTELIGENTE
// ============================================

async function _pensarEResponder(mensagemUsuario, sessao) {
  const systemPrompt = await _buildSystemPrompt(sessao);

  const historico = (sessao.historico || []).slice(-20).map(h => ({
    role: h.role,
    content: h.content
  }));

  historico.push({ role: 'user', content: mensagemUsuario });

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-1-20250805',
      max_tokens: 1024,
      system: systemPrompt,
      messages: historico,
      tools: [
        {
          name: 'consultar_horarios',
          description: 'Consulta horários e salas',
          input_schema: { type: 'object', properties: {}, required: [] }
        },
        {
          name: 'coletar_dados_evento',
          description: 'Coleta dados de evento',
          input_schema: {
            type: 'object',
            properties: {
              tipo: { type: 'string', enum: ['corporativo', 'aniversario', 'evento_outro'] },
              nome_empresa_ou_pessoa: { type: 'string' },
              quantas_pessoas: { type: 'number' },
              cidade: { type: 'string' },
              telefone: { type: 'string' },
              observacoes: { type: 'string' }
            },
            required: ['tipo', 'nome_empresa_ou_pessoa', 'quantas_pessoas', 'cidade', 'telefone']
          }
        },
        {
          name: 'escalar_humano',
          description: 'Escala para humano',
          input_schema: { type: 'object', properties: { motivo: { type: 'string' } }, required: ['motivo'] }
        }
      ]
    });

    let resposta = '';
    for (const bloco of response.content) {
      if (bloco.type === 'text') {
        resposta = bloco.text;
      } else if (bloco.type === 'tool_use') {
        await _executarFerramenta(bloco.name, bloco.input, sessao);
      }
    }

    if (!sessao.historico) sessao.historico = [];
    sessao.historico.push({ role: 'user', content: mensagemUsuario });
    sessao.historico.push({ role: 'assistant', content: resposta });

    return resposta;
  } catch (erro) {
    console.error('[KEYO] Erro:', erro.message);
    return 'Ué, tive um problema aqui. Deixa eu chamar alguém pra ajudar! 😊';
  }
}

// ============================================
// PROCESSAMENTO
// ============================================

const sessoes = {};

async function processarMensagem(tel, texto) {
  if (!sessoes[tel]) {
    sessoes[tel] = {
      nome: null,
      aceitouTermos: false,
      historico: [],
      etapa: 'boasvindas' // boasvindas → nome → lgpd → conversando → avaliacao
    };
  }

  const sessao = sessoes[tel];
  texto = texto.trim();

  // ETAPA 1: Boas-vindas (bot se apresenta)
  if (sessao.etapa === 'boasvindas') {
    sessao.etapa = 'nome';
    await enviarMensagem(tel, _MSG_BOASVINDAS);
    return;
  }

  // ETAPA 2: Pedir nome
  if (sessao.etapa === 'nome') {
    if (texto.length < 2) {
      await enviarMensagem(tel, 'Hmm, não peguei direito! 😄 Me conta seu nome pra eu te chamar certinho?');
      return;
    }
    sessao.nome = texto;
    sessao.etapa = 'lgpd';
    await enviarMensagem(tel, _msgTermos(texto));
    return;
  }

  // ETAPA 3: LGPD
  if (sessao.etapa === 'lgpd') {
    if (_ehAceite(texto)) {
      sessao.aceitouTermos = true;
      sessao.etapa = 'conversando';
      const primeiroNome = sessao.nome.trim().split(/\s+/)[0];
      await enviarMensagem(tel, `Ótimo, *${primeiroNome}*! Tudo certo por aqui. 🎉\n\nComo posso te ajudar hoje? Quer fazer uma reserva, saber mais sobre as salas ou tirar alguma dúvida? É só falar! 😊`);
      return;
    } else if (_ehRecusa(texto)) {
      sessao.etapa = 'recusado';
      await enviarMensagem(tel, _MSG_RECUSA);
      delete sessoes[tel];
      return;
    } else {
      await enviarMensagem(tel, 'Por favor, responda com *SIM* ou *NÃO*. 😊');
      return;
    }
  }

  // ETAPA 4: Conversando (Claude inteligente)
  if (sessao.etapa === 'conversando') {
    const resposta = await _pensarEResponder(texto, sessao);
    await enviarMensagem(tel, resposta);
    return;
  }

  // ETAPA 5: Avaliação
  if (sessao.etapa === 'avaliacao') {
    const nota = parseInt(texto.trim(), 10);
    if (nota >= 1 && nota <= 5) {
      const primeiroNome = sessao.nome.trim().split(/\s+/)[0];
      const estrelas = ['', '⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'][nota] || '⭐';
      await enviarMensagem(tel, `${estrelas} Obrigado, *${primeiroNome}*! Foi um prazer te atender. Qualquer coisa é só chamar. Até mais! 👋`);
      delete sessoes[tel];
      return;
    } else {
      await enviarMensagem(tel, 'Por favor, responda com um número de *1 a 5*. 😊');
      return;
    }
  }
}

// ============================================
// SOLICITAR AVALIAÇÃO (após timeout)
// ============================================

function _solicitarAvaliacao(tel) {
  const sessao = sessoes[tel];
  if (!sessao || sessao.etapa === 'avaliacao') return;

  sessao.etapa = 'avaliacao';
  const primeiroNome = sessao.nome.trim().split(/\s+/)[0];
  enviarMensagem(tel, `Antes de ir, *${primeiroNome}*, o que achou do meu atendimento hoje? 😊\n\nDe *1 a 5* — sua opinião nos ajuda muito!\n\n1️⃣ Ruim  2️⃣ Regular  3️⃣ Bom  4️⃣ Muito bom  5️⃣ Excelente`);
}

// ============================================
// TIMEOUT DE INATIVIDADE (10 min)
// ============================================

const _timeoutsInatividade = {};

function _iniciarTimeoutInatividade(tel) {
  if (_timeoutsInatividade[tel]) {
    clearTimeout(_timeoutsInatividade[tel]);
  }
  _timeoutsInatividade[tel] = setTimeout(() => {
    _solicitarAvaliacao(tel);
  }, 2 * 60 * 1000); // 2 minutos
}

// ============================================
// EVOLUTION API
// ============================================

async function enviarMensagem(tel, texto) {
  try {
    await axios.post(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_API_INSTANCE}`, {
      number: tel,
      text: texto
    }, {
      headers: { 'apikey': EVOLUTION_API_TOKEN }
    });
    console.log(`[KEYO] ✅ Enviado para ${tel}`);
  } catch (erro) {
    console.error(`[KEYO] ❌ Erro ${tel}:`, erro.message);
  }
}

// ============================================
// WEBHOOKS
// ============================================

app.post('/webhook/evolution', async (req, res) => {
  try {
    const { data } = req.body;
    if (data?.message?.remoteJid && data?.message?.conversation) {
      const tel = data.message.remoteJid.replace('@s.whatsapp.net', '');
      const texto = data.message.conversation;
      await processarMensagem(tel, texto);
      _iniciarTimeoutInatividade(tel);
    }
    res.json({ ok: true });
  } catch (erro) {
    console.error('[WEBHOOK] Erro:', erro);
    res.status(500).json({ erro: erro.message });
  }
});

// ============================================
// START
// ============================================

app.listen(PORT, () => {
  console.log(`🤖 KEYO rodando em http://localhost:${PORT}`);
  console.log(`Evolution API: ${EVOLUTION_API_URL}`);
});

module.exports = { processarMensagem, enviarMensagem };

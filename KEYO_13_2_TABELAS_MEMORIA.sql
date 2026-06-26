-- ════════════════════════════════════════════════════════════════
-- KEYO v3.0 — TABELAS DE MEMÓRIA EVOLUTIVA (seção 13.2)
-- Rode no Supabase: SQL Editor → cole tudo → Run.
-- Seguro: usa IF NOT EXISTS (não apaga nada existente).
-- Pré-requisito: KEYO_13_1_TABELAS.sql já executado.
-- ════════════════════════════════════════════════════════════════

-- ── 1) Base de conhecimento permanente (memória de longo prazo) ──
create table if not exists public.keyo_knowledge (
  id            text primary key default gen_random_uuid()::text,
  chave         text not null unique,
  valor         text,
  tags          text[],
  unidade_id    text,
  criado_em     timestamptz default now(),
  atualizado_em timestamptz default now()
);

create index if not exists idx_knowledge_chave
  on public.keyo_knowledge (chave);

create index if not exists idx_knowledge_atualizado
  on public.keyo_knowledge (atualizado_em desc);

alter table public.keyo_knowledge enable row level security;

drop policy if exists keyo_knowledge_all on public.keyo_knowledge;
create policy keyo_knowledge_all on public.keyo_knowledge
  for all using (true) with check (true);

-- ── 2) Pesos de aprendizado RLHF por agente/tipo de iniciativa ───
create table if not exists public.keyo_learning_weights (
  id               bigint generated always as identity primary key,
  agent_id         text not null,
  initiative_type  text not null,
  confidence_score numeric(5,2) default 0.5,
  approved_count   int default 0,
  rejected_count   int default 0,
  modified_count   int default 0,
  last_outcome     text,         -- 'aprovada' | 'rejeitada' | 'modificada'
  last_feedback    text,
  unidade_id       text,         -- '1' Aracaju, '2' Salvador, null = global
  atualizado_em    timestamptz default now(),
  unique (agent_id, initiative_type, unidade_id)
);

create index if not exists idx_lw_agent
  on public.keyo_learning_weights (agent_id, initiative_type);

create index if not exists idx_lw_atualizado
  on public.keyo_learning_weights (atualizado_em desc);

alter table public.keyo_learning_weights enable row level security;

drop policy if exists keyo_lw_all on public.keyo_learning_weights;
create policy keyo_lw_all on public.keyo_learning_weights
  for all using (true) with check (true);

-- ── 3) Coluna 'escopo' na keyo_memoria (se ainda não existir) ────
-- Permite diferenciar memórias de curto prazo ('session')
-- das de médio prazo ('medium') na mesma tabela.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'keyo_memoria'
      and column_name  = 'escopo'
  ) then
    alter table public.keyo_memoria add column escopo text default 'medium';
  end if;
end;
$$;

-- ── 4) Semente de teste (opcional) ───────────────────────────────
-- Descomente para validar que as tabelas funcionam corretamente.

-- insert into public.keyo_knowledge (chave, valor, tags)
-- values ('teste_memoria', 'Tabela criada com sucesso em ' || now()::text, ARRAY['teste']);

-- insert into public.keyo_learning_weights
--   (agent_id, initiative_type, confidence_score, approved_count, unidade_id)
-- values ('Marketing', 'sem_reservas', 0.5, 0, '1');

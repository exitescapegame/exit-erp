-- ════════════════════════════════════════════════════════════════
-- KEYO v3.0 — TABELAS DA AÇÃO IMEDIATA (seção 13.1)
-- Rode no Supabase: SQL Editor → cole tudo → Run.
-- Seguro: usa IF NOT EXISTS (não apaga nada existente). Lei 3 ✓
-- ════════════════════════════════════════════════════════════════

-- ── 1) Fila de iniciativas proativas do Brain Loop ──────────────
create table if not exists public.keyo_brain_queue (
  id            text primary key default gen_random_uuid()::text,
  agent         text,                 -- 'Marketing', 'Operações', etc.
  type          text,                 -- 'sem_reservas', 'lembrete', ...
  title         text,
  justification text,
  preview       text,
  impact        text,
  payload       jsonb default '{}'::jsonb,
  priority      int  default 1,       -- 1 baixa, 2 média, 3 alta
  status        text default 'pendente', -- pendente|aprovada|rejeitada|modificada
  unidade_id    text,                 -- '1' Aracaju, '2' Salvador, null = todas
  feedback      text,
  criado_em     timestamptz default now(),
  decidido_em   timestamptz
);

create index if not exists idx_brain_queue_status
  on public.keyo_brain_queue (status, priority desc, criado_em);

-- ── 2) Log de auditoria das decisões do ADM (RLHF + LGPD) ───────
create table if not exists public.keyo_auth_log (
  id              bigint generated always as identity primary key,
  queue_id        text,
  agent           text,
  initiative_type text,
  decision        text,               -- aprovada|rejeitada|modificada
  feedback        text,
  unidade_id      text,
  decided_at      timestamptz default now()
);

create index if not exists idx_auth_log_decided
  on public.keyo_auth_log (decided_at desc);

-- ── 3) RLS (isolamento por unidade — padrão do sistema) ─────────
alter table public.keyo_brain_queue enable row level security;
alter table public.keyo_auth_log    enable row level security;

-- Política permissiva para a chave anon (ajuste fino depois conforme L99 seção 9).
-- Mantém o padrão atual do projeto (anon lê/escreve via REST).
drop policy if exists keyo_brain_queue_all on public.keyo_brain_queue;
create policy keyo_brain_queue_all on public.keyo_brain_queue
  for all using (true) with check (true);

drop policy if exists keyo_auth_log_all on public.keyo_auth_log;
create policy keyo_auth_log_all on public.keyo_auth_log
  for all using (true) with check (true);

-- ── 4) Semente de teste (opcional) — 1 card para validar a UI ───
-- Descomente para criar um card de teste e ver na tela.
-- insert into public.keyo_brain_queue (agent,type,title,justification,preview,impact,priority,unidade_id)
-- values ('Marketing','sem_reservas','Nenhuma reserva hoje',
--         'São 14h e não há reservas para hoje em Aracaju.',
--         'Story sugerido: "Última chamada! Salas livres hoje 🔥"',
--         'Potencial de +R$ 600 em 6h', 3, '1');

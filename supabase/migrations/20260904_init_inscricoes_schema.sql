-- ============================================================
--  Schema inicial: inscricoes (formulário simples de agendamento)
--  Projeto Supabase: NovaSelecao.MasterEdu
--  Aplicado em produção via mcp__claude_ai_Supabase__apply_migration.
-- ============================================================

-- Admin allowlist (mesmo padrão usado no restante do sistema Master Educação)
create table admin_allowlist (
  email text primary key,
  created_at timestamptz not null default now()
);

insert into admin_allowlist (email) values
  ('mastereducacaoadm@gmail.com'),
  ('marcos.lucas.ti@gmail.com');

create or replace function is_admin() returns boolean
language sql stable as $$
  select exists (
    select 1 from admin_allowlist where email = (auth.jwt() ->> 'email')
  );
$$;

-- Tabela principal
create table inscricoes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  nome_completo text not null check (char_length(trim(nome_completo)) > 0),
  cpf text not null unique check (cpf ~ '^\d{11}$'),
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  telefone text not null check (telefone ~ '^\d{10,11}$'),

  dias_disponiveis text[] not null check (
    array_length(dias_disponiveis, 1) > 0
    and dias_disponiveis <@ array['terca','quarta','quinta','sexta']
  ),
  horarios_disponiveis text[] not null check (
    array_length(horarios_disponiveis, 1) > 0
    and horarios_disponiveis <@ array['10h','10h30','15h','15h30','16h']
  )
);
-- NOTA: dias_disponiveis/horarios_disponiveis foram substituídos por
-- dia_semana/horario (slot único) na migration seguinte (20260905).

create index idx_inscricoes_created_at on inscricoes(created_at);

-- RLS
alter table inscricoes enable row level security;

-- Insert público (candidato preenchendo o formulário). As CHECK constraints
-- acima já garantem a integridade dos dados independente da policy de RLS.
create policy public_insert_inscricoes on inscricoes
  for insert to anon, authenticated
  with check (true);

create policy admin_select_inscricoes on inscricoes
  for select to authenticated using (is_admin());
create policy admin_update_inscricoes on inscricoes
  for update to authenticated using (is_admin()) with check (is_admin());
create policy admin_delete_inscricoes on inscricoes
  for delete to authenticated using (is_admin());

alter table admin_allowlist enable row level security;
create policy admin_read_allowlist on admin_allowlist
  for select to authenticated using (is_admin());

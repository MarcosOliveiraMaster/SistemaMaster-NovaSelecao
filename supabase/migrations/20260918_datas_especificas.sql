-- Substitui "dia da semana recorrente" por data específica de calendário.
-- Catálogo (slots_disponiveis) passa a ter no máximo 5 datas ativas simultâneas,
-- geridas manualmente pelo admin (SistemaMaster-Central > Agendamento de Entrevistas).
-- inscricoes.data fica nullable e sem FK pro catálogo: o admin pode atribuir/mudar/
-- limpar a data de qualquer inscrição livremente, "ao vivo", independente do catálogo
-- público de 5 datas.
-- Aplicado em produção via mcp__claude_ai_Supabase__apply_migration.

-- slots_disponiveis: as 20 linhas recorrentes atuais não têm data real — descartadas.
-- O admin recadastra até 5 datas reais pela tela nova.
drop table slots_disponiveis;

create table slots_disponiveis (
  data date not null,
  horario text not null,
  ativo boolean not null default true,
  horario_ordem smallint not null,  -- HHmm como inteiro, ex. 10h30 -> 1030
  created_at timestamptz not null default now(),
  primary key (data, horario)
);

alter table slots_disponiveis enable row level security;

create policy public_select_slots_ativos on slots_disponiveis
  for select to anon, authenticated using (ativo = true);

create policy admin_select_slots on slots_disponiveis
  for select to authenticated using (is_admin());
create policy admin_insert_slots on slots_disponiveis
  for insert to authenticated with check (is_admin());
create policy admin_update_slots on slots_disponiveis
  for update to authenticated using (is_admin()) with check (is_admin());
create policy admin_delete_slots on slots_disponiveis
  for delete to authenticated using (is_admin());

-- inscricoes: dia_semana -> data (nullable, sem FK pro catálogo).
drop view slots_ocupados;

alter table inscricoes drop constraint inscricoes_slot_fk;
alter table inscricoes drop constraint inscricoes_slot_unico;

alter table inscricoes drop column dia_semana;
alter table inscricoes add column data date;

alter table inscricoes add constraint inscricoes_slot_unico unique (data, horario);

create view slots_ocupados as
  select data, horario from inscricoes where data is not null;

grant select on slots_ocupados to anon, authenticated;

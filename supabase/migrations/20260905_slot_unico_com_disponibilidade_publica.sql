-- Substitui "dias/horários disponíveis" (arrays de preferência) por um
-- único slot de entrevista (dia_semana + horario), com garantia de que
-- cada slot só pode ser reservado por um candidato (UNIQUE constraint).
-- Aplicado em produção via mcp__claude_ai_Supabase__apply_migration.

alter table inscricoes
  drop column dias_disponiveis,
  drop column horarios_disponiveis;

alter table inscricoes
  add column dia_semana text,
  add column horario text;

alter table inscricoes
  alter column dia_semana set not null,
  alter column horario set not null,
  add constraint inscricoes_dia_semana_check check (dia_semana in ('terca','quarta','quinta','sexta')),
  add constraint inscricoes_horario_check check (horario in ('10h','10h30','15h','15h30','16h')),
  add constraint inscricoes_slot_unico unique (dia_semana, horario);

-- View pública: expõe só quais combinações (dia, horário) já estão ocupadas,
-- nunca os dados pessoais de quem ocupou. Views rodam com o privilégio do
-- dono (postgres), então isso funciona mesmo com RLS bloqueando select
-- direto em `inscricoes` para o público.
create view slots_ocupados as
  select dia_semana, horario from inscricoes;

grant select on slots_ocupados to anon, authenticated;

-- Hardening: fixa o search_path da função is_admin (aviso do linter de segurança).
alter function is_admin() set search_path = public, pg_temp;

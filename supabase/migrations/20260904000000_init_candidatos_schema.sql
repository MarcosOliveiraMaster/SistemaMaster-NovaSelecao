-- ============================================================
--  Schema inicial: candidatos (formulário de pré-seleção de professores)
--  Toda escrita pública passa pela Edge Function `enviar-candidatura`,
--  que usa a service_role key (ignora RLS). Não existe policy de INSERT
--  pública em `candidatos` nem nos buckets de Storage.
-- ============================================================

-- ── Admin allowlist ──────────────────────────────────────────
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

-- ── Status do candidato ──────────────────────────────────────
create type status_candidato as enum
  ('Candidato', 'Em Entrevista', 'Aprovado', 'Reprovado', 'Contratado');

-- ── Tabela principal ─────────────────────────────────────────
create table candidatos (
  id uuid primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status status_candidato not null default 'Candidato',

  -- Dados pessoais
  cpf text not null unique check (cpf ~ '^\d{11}$'),
  nome text not null,
  email text not null,
  contato text not null,
  data_nascimento date not null,
  cep text not null,
  endereco_oficial text not null,
  complemento text not null,

  -- Localização (mapa de bairros)
  bairros text[] not null default '{}',

  -- Disponibilidade dia x turno
  disp_seg_manha boolean not null default false, disp_seg_tarde boolean not null default false,
  disp_ter_manha boolean not null default false, disp_ter_tarde boolean not null default false,
  disp_qua_manha boolean not null default false, disp_qua_tarde boolean not null default false,
  disp_qui_manha boolean not null default false, disp_qui_tarde boolean not null default false,
  disp_sex_manha boolean not null default false, disp_sex_tarde boolean not null default false,
  disp_sab_manha boolean not null default false, disp_sab_tarde boolean not null default false,

  -- Veículo
  possui_veiculo boolean not null default false,
  veiculo_carro boolean not null default false,
  veiculo_moto boolean not null default false,

  -- Atuação acadêmica
  disciplinas text[] not null default '{}',
  segmentos_pode_lecionar text[] not null default '{}',
  segmentos_ja_lecionou text[] not null default '{}',
  nivel_academico text not null check (nivel_academico in
    ('Graduando','Graduado','Mestrando','Mestre','Bacharelado','Técnico')),
  curso text not null,
  pix text not null,

  -- Experiência
  exp_aulas_particulares boolean not null default false,
  exp_aulas_particulares_desc text,
  exp_neurodivergentes boolean not null default false,
  exp_neurodivergentes_desc text,
  exp_tdics boolean not null default false,
  exp_tdics_desc text,

  -- Perfil / objetivo (perguntas indiretas, uso interno)
  tipo_renda text check (tipo_renda in ('principal','complementar','nao_informado')),
  tempo_pretendido text check (tempo_pretendido in
    ('menos_6_meses','6_a_12_meses','1_a_2_anos','mais_2_anos','nao_definido')),
  disponibilidade_semanal text check (disponibilidade_semanal in
    ('ate_10h','10_a_20h','20_a_30h','mais_30h')),
  motivacao_texto text,

  -- Uploads (paths no Storage)
  foto_path text,
  curriculo_path text,

  -- Termos / LGPD
  aceite_termos boolean not null default false,
  versao_termos text not null default '2.0',
  data_aceite_termos timestamptz not null,
  consent_dados boolean not null default false,
  consent_comunicacao boolean not null default false,
  consent_compartilhamento boolean not null default false,
  consent_imagem boolean not null default false,
  consent_curriculo boolean not null default false,

  -- Uso administrativo (preenchido depois, pelo recrutador)
  comentarios_avaliador text,
  data_entrevista timestamptz,
  link_entrevista text,

  -- Defesa em profundidade
  turnstile_verified boolean not null default false
);

create index idx_candidatos_status on candidatos(status);
create index idx_candidatos_created_at on candidatos(created_at);
create index idx_candidatos_disciplinas on candidatos using gin(disciplinas);
create index idx_candidatos_bairros on candidatos using gin(bairros);
create index idx_candidatos_segmentos on candidatos using gin(segmentos_pode_lecionar);

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_candidatos_updated_at
  before update on candidatos
  for each row execute function set_updated_at();

-- ── RLS: nenhuma policy de INSERT pública ────────────────────
alter table candidatos enable row level security;

create policy admin_select_candidatos on candidatos
  for select to authenticated using (is_admin());
create policy admin_update_candidatos on candidatos
  for update to authenticated using (is_admin()) with check (is_admin());
create policy admin_delete_candidatos on candidatos
  for delete to authenticated using (is_admin());

alter table admin_allowlist enable row level security;
create policy admin_read_allowlist on admin_allowlist
  for select to authenticated using (is_admin());
-- gestão do allowlist via migração/SQL editor, não via client

-- ── Storage buckets ──────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('candidatos-fotos', 'candidatos-fotos', false, 5242880,
   array['image/jpeg','image/png','image/webp']),
  ('candidatos-curriculos', 'candidatos-curriculos', false, 10485760,
   array['application/pdf']);

-- Nenhuma policy de INSERT pública em storage.objects — só service_role escreve.
create policy admin_read_fotos on storage.objects
  for select to authenticated using (bucket_id = 'candidatos-fotos' and is_admin());
create policy admin_read_curriculos on storage.objects
  for select to authenticated using (bucket_id = 'candidatos-curriculos' and is_admin());

# Sistema Master — Nova Seleção de Professores

Formulário público de pré-seleção de professores. Vite + JS modular no front-end, Supabase (Postgres + Storage + Edge Functions) no back-end.

## Setup local

```bash
npm install
cp .env.example .env
```

Preencha o `.env`:
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — do projeto Supabase (Settings → API).
- `VITE_TURNSTILE_SITE_KEY` — sitekey do widget Cloudflare Turnstile. Para dev, use a sitekey pública de teste `1x00000000000000000000AA` (sempre aprova).

```bash
npm run dev
```

## Provisionando o backend (Supabase)

1. Crie um projeto novo em [supabase.com](https://supabase.com).
2. Instale a CLI (`npm i -g supabase`, ou veja a doc oficial) e faça login/link:
   ```bash
   supabase login
   supabase link --project-ref <seu-project-ref>
   ```
3. Aplique a migration (cria a tabela `candidatos`, buckets de Storage e políticas de RLS):
   ```bash
   supabase db push
   ```
4. Crie um site Turnstile em [dash.cloudflare.com](https://dash.cloudflare.com) → Turnstile, e configure o secret na Edge Function:
   ```bash
   supabase secrets set TURNSTILE_SECRET_KEY=<seu-secret-key>
   ```
5. Faça o deploy das Edge Functions:
   ```bash
   supabase functions deploy verificar-cpf
   supabase functions deploy enviar-candidatura
   ```
6. Cadastre os admins que poderão ler os candidatos: crie usuários no Supabase Auth com os emails já listados em `admin_allowlist` (migração inicial), ou adicione novos emails via SQL editor.

## Mapa de bairros

O mapa usa `public/data/bairros-maceio.geojson`, gerado a partir do GeoJSON oficial do IBGE (Censo 2022, Alagoas) em `research/bairros_al.geojson`. Para regenerar:

```bash
npm run build:bairros
```

## Deploy do front-end

```bash
npm run build
```

Publique a pasta `dist/` em qualquer hosting estático (Vercel, Netlify, Cloudflare Pages). O arquivo `public/_headers` já define CSP compatível com Supabase e Turnstile (funciona nativamente no Netlify/Cloudflare Pages; para Vercel, converta para `vercel.json`).

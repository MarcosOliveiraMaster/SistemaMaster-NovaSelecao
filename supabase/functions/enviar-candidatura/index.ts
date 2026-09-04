// Recebe a candidatura completa (multipart/form-data), valida server-side
// (Turnstile + CPF + campos obrigatórios + arquivos), sobe foto/currículo
// pro Storage e insere a linha em `candidatos` — tudo com service_role,
// que ignora RLS por design. O client nunca fala direto com a tabela
// nem com o Storage.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, handleCors, jsonResponse } from '../_shared/cors.ts';
import { validarCPF } from '../_shared/cpf.ts';

const LIMITES = {
  foto: { maxBytes: 5 * 1024 * 1024, mimes: ['image/jpeg', 'image/png', 'image/webp'] },
  curriculo: { maxBytes: 10 * 1024 * 1024, mimes: ['application/pdf'] }
};

const EXT_POR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf'
};

// Campos que o client pode enviar — nunca aceitar 'status', 'comentarios_avaliador' etc. do payload do candidato.
const CAMPOS_TEXTO_OBRIGATORIOS = [
  'cpf', 'nome', 'email', 'contato', 'data_nascimento', 'cep', 'endereco_oficial', 'complemento',
  'nivel_academico', 'curso', 'pix', 'tipo_renda', 'tempo_pretendido', 'disponibilidade_semanal',
  'data_aceite_termos'
];

const CAMPOS_PERMITIDOS = [
  ...CAMPOS_TEXTO_OBRIGATORIOS,
  'bairros',
  'disp_seg_manha', 'disp_seg_tarde', 'disp_ter_manha', 'disp_ter_tarde',
  'disp_qua_manha', 'disp_qua_tarde', 'disp_qui_manha', 'disp_qui_tarde',
  'disp_sex_manha', 'disp_sex_tarde', 'disp_sab_manha', 'disp_sab_tarde',
  'possui_veiculo', 'veiculo_carro', 'veiculo_moto',
  'disciplinas', 'segmentos_pode_lecionar', 'segmentos_ja_lecionou',
  'exp_aulas_particulares', 'exp_aulas_particulares_desc',
  'exp_neurodivergentes', 'exp_neurodivergentes_desc',
  'exp_tdics', 'exp_tdics_desc',
  'motivacao_texto',
  'aceite_termos', 'versao_termos',
  'consent_dados', 'consent_comunicacao', 'consent_compartilhamento', 'consent_imagem', 'consent_curriculo'
];

function erro(msg: string, status = 400) {
  return jsonResponse({ success: false, error: msg }, status);
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') return erro('Método não permitido.', 405);

  let candidatoId: string | null = null;
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const form = await req.formData();
    const dadosRaw = form.get('dados');
    const turnstileToken = form.get('turnstileToken');
    const foto = form.get('foto');
    const curriculo = form.get('curriculo');

    if (typeof dadosRaw !== 'string') return erro('Dados do formulário ausentes.');
    if (typeof turnstileToken !== 'string' || !turnstileToken) return erro('Verificação anti-robô ausente.');
    if (!(foto instanceof File)) return erro('Foto ausente.');
    if (!(curriculo instanceof File)) return erro('Currículo ausente.');

    // 1. Verifica Turnstile
    const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: Deno.env.get('TURNSTILE_SECRET_KEY')!,
        response: turnstileToken
      })
    }).then(r => r.json());

    if (!verify.success) return erro('Falha na verificação anti-robô. Recarregue a página e tente novamente.');

    // 2. Parseia e valida o payload de dados
    let dados: Record<string, unknown>;
    try {
      dados = JSON.parse(dadosRaw);
    } catch {
      return erro('Dados do formulário em formato inválido.');
    }

    for (const campo of CAMPOS_TEXTO_OBRIGATORIOS) {
      const v = dados[campo];
      if (v === undefined || v === null || v === '') return erro(`Campo obrigatório ausente: ${campo}.`);
    }

    const cpfNums = String(dados.cpf).replace(/\D/g, '');
    if (!validarCPF(cpfNums)) return erro('CPF inválido.');

    if (!Array.isArray(dados.bairros) || dados.bairros.length === 0) return erro('Selecione ao menos um bairro.');
    if (!Array.isArray(dados.disciplinas) || dados.disciplinas.length === 0) return erro('Selecione ao menos uma disciplina.');
    if (!Array.isArray(dados.segmentos_pode_lecionar) || dados.segmentos_pode_lecionar.length === 0) {
      return erro('Selecione ao menos um segmento/turma que você pode atender.');
    }
    if (dados.aceite_termos !== true) return erro('É necessário aceitar os Termos de Uso.');
    if (dados.consent_dados !== true || dados.consent_comunicacao !== true ||
        dados.consent_imagem !== true || dados.consent_curriculo !== true) {
      return erro('Todos os consentimentos obrigatórios precisam ser aceitos.');
    }

    // 3. Revalida duplicidade de CPF (condição de corrida além da constraint UNIQUE)
    const { data: existente, error: erroConsulta } = await admin
      .from('candidatos')
      .select('id')
      .eq('cpf', cpfNums)
      .maybeSingle();
    if (erroConsulta) throw erroConsulta;
    if (existente) return erro('Este CPF já está cadastrado.', 409);

    // 4. Valida arquivos
    if (!LIMITES.foto.mimes.includes(foto.type)) return erro('Formato de foto não aceito.');
    if (foto.size > LIMITES.foto.maxBytes) return erro('Foto excede o tamanho máximo de 5MB.');
    if (!LIMITES.curriculo.mimes.includes(curriculo.type)) return erro('Currículo precisa ser um PDF.');
    if (curriculo.size > LIMITES.curriculo.maxBytes) return erro('Currículo excede o tamanho máximo de 10MB.');

    // 5. Upload dos arquivos
    candidatoId = crypto.randomUUID();
    const extFoto = EXT_POR_MIME[foto.type];
    const pathFoto = `${candidatoId}/foto.${extFoto}`;
    const pathCurriculo = `${candidatoId}/curriculo.pdf`;

    const { error: erroFoto } = await admin.storage.from('candidatos-fotos').upload(pathFoto, foto, {
      contentType: foto.type,
      upsert: false
    });
    if (erroFoto) throw erroFoto;

    const { error: erroCurriculo } = await admin.storage.from('candidatos-curriculos').upload(pathCurriculo, curriculo, {
      contentType: curriculo.type,
      upsert: false
    });
    if (erroCurriculo) {
      await admin.storage.from('candidatos-fotos').remove([pathFoto]);
      throw erroCurriculo;
    }

    // 6. Monta a linha final, restrita ao allowlist de campos
    const linha: Record<string, unknown> = { id: candidatoId, cpf: cpfNums, turnstile_verified: true };
    for (const campo of CAMPOS_PERMITIDOS) {
      if (campo === 'cpf') continue;
      if (dados[campo] !== undefined) linha[campo] = dados[campo];
    }
    linha.foto_path = pathFoto;
    linha.curriculo_path = pathCurriculo;

    const { error: erroInsert } = await admin.from('candidatos').insert(linha);
    if (erroInsert) {
      await admin.storage.from('candidatos-fotos').remove([pathFoto]);
      await admin.storage.from('candidatos-curriculos').remove([pathCurriculo]);
      throw erroInsert;
    }

    return jsonResponse({ success: true, id: candidatoId });
  } catch (err) {
    console.error('enviar-candidatura error:', err);
    return erro('Erro interno ao enviar a candidatura. Tente novamente em instantes.', 500);
  }
});

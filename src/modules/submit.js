import { supabase } from '../config/supabaseClient.js';

/**
 * Verifica se um CPF já está cadastrado, via Edge Function `verificar-cpf`.
 * Retorna { valido, disponivel } — valido = passou na validação de dígitos,
 * disponivel = ainda não existe candidato com esse CPF.
 */
export async function verificarCPF(cpf) {
  const { data, error } = await supabase.functions.invoke('verificar-cpf', {
    body: { cpf }
  });
  if (error) throw error;
  return data;
}

/**
 * Envia a candidatura completa (dados + arquivos) para a Edge Function `enviar-candidatura`.
 * dados: objeto com os campos de texto/boolean/array já validados no client.
 * arquivos: { foto: File, curriculo: File }
 * turnstileToken: token do widget Cloudflare Turnstile.
 */
export async function enviarCandidatura(dados, arquivos, turnstileToken) {
  const form = new FormData();
  form.append('dados', JSON.stringify(dados));
  form.append('turnstileToken', turnstileToken);
  if (arquivos.foto) form.append('foto', arquivos.foto);
  if (arquivos.curriculo) form.append('curriculo', arquivos.curriculo);

  const { data, error } = await supabase.functions.invoke('enviar-candidatura', {
    body: form
  });

  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'Falha ao enviar candidatura.');
  return data;
}

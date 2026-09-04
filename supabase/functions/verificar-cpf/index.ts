// Dá feedback imediato de "CPF já cadastrado" na seção 2 do formulário.
// Baixa sensibilidade (só retorna booleans) — não exige Turnstile, mas
// NÃO é a guarda de autoridade contra duplicidade: isso é reforçado pela
// constraint UNIQUE(cpf) na tabela e revalidado em `enviar-candidatura`.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, handleCors, jsonResponse } from '../_shared/cors.ts';
import { validarCPF } from '../_shared/cpf.ts';

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { cpf } = await req.json();
    const nums = String(cpf || '').replace(/\D/g, '');

    if (!validarCPF(nums)) {
      return jsonResponse({ valido: false, disponivel: false });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data, error } = await supabase
      .from('candidatos')
      .select('id')
      .eq('cpf', nums)
      .maybeSingle();

    if (error) throw error;

    return jsonResponse({ valido: true, disponivel: !data });
  } catch (err) {
    console.error('verificar-cpf error:', err);
    return jsonResponse({ error: 'Erro interno ao verificar CPF.' }, 500);
  }
});

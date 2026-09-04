export async function buscarCEP(cepNumeros) {
  const cep = String(cepNumeros).replace(/\D/g, '');
  if (cep.length !== 8) return { ok: false, endereco: '' };
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
    if (!res.ok) throw new Error('CEP não encontrado');
    const data = await res.json();
    const endereco = `${data.street}, ${data.neighborhood}, ${data.city} - ${data.state}`;
    return { ok: true, endereco };
  } catch {
    return { ok: false, endereco: '' };
  }
}

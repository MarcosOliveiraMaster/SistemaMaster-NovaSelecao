export function validarCPF(cpfRaw: string): boolean {
  const n = (cpfRaw || '').replace(/\D/g, '');
  if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(n[i], 10) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10 || d1 === 11) d1 = 0;
  if (d1 !== parseInt(n[9], 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(n[i], 10) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10 || d2 === 11) d2 = 0;
  return d2 === parseInt(n[10], 10);
}

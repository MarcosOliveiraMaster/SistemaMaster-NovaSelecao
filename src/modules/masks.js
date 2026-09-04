export function maskCPF(value) {
  let v = value.replace(/\D/g, '');
  if (v.length > 11) v = v.slice(0, 11);
  v = v.replace(/(\d{3})(\d)/, '$1.$2')
       .replace(/(\d{3})(\d)/, '$1.$2')
       .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  return v;
}

export function maskTelefone(value) {
  let v = value.replace(/\D/g, '');
  if (v.length > 11) v = v.slice(0, 11);
  let out = '';
  if (v.length > 0) out = '(' + v.substring(0, 2);
  if (v.length > 2) {
    out += v.length >= 11
      ? ') ' + v.substring(2, 7) + '-' + v.substring(7, 11)
      : ') ' + v.substring(2, 6) + (v.length > 6 ? '-' + v.substring(6) : '');
  }
  return out;
}

export function maskDataNascimento(value) {
  let v = value.replace(/\D/g, '');
  if (v.length > 2) v = v.substring(0, 2) + '/' + v.substring(2);
  if (v.length > 5) v = v.substring(0, 5) + '/' + v.substring(5, 9);
  return v;
}

export function maskCEP(value) {
  let v = value.replace(/\D/g, '');
  if (v.length > 8) v = v.slice(0, 8);
  if (v.length > 5) v = v.replace(/(\d{5})(\d)/, '$1-$2');
  return v;
}

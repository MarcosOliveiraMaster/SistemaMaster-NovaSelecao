export const DISCIPLINAS = [
  'Artes', 'Biologia', 'Ciências', 'Educação Física', 'Espanhol', 'Filosofia',
  'Física', 'Geografia', 'História', 'Inglês', 'Literatura', 'Matemática',
  'Pedagogia', 'Português', 'Química', 'Redação', 'Sociologia'
];

export const SEGMENTOS = [
  { value: 'fundamental1', label: 'Ensino Fundamental I (1º ao 5º ano)' },
  { value: 'fundamental2', label: 'Ensino Fundamental II (6º ao 9º ano)' },
  { value: 'medio', label: 'Ensino Médio' },
  { value: 'eja', label: 'EJA' },
  { value: 'superior', label: 'Ensino Superior' },
  { value: 'prevestibular', label: 'Pré-vestibular / ENEM' }
];

export const NIVEIS_ACADEMICOS = [
  'Graduando', 'Graduado', 'Mestrando', 'Mestre', 'Bacharelado', 'Técnico'
];

export const TIPO_RENDA = [
  { value: 'principal', label: 'Renda principal' },
  { value: 'complementar', label: 'Renda complementar' },
  { value: 'nao_informado', label: 'Prefiro não informar' }
];

export const TEMPO_PRETENDIDO = [
  { value: 'menos_6_meses', label: 'Menos de 6 meses' },
  { value: '6_a_12_meses', label: 'De 6 meses a 1 ano' },
  { value: '1_a_2_anos', label: 'De 1 a 2 anos' },
  { value: 'mais_2_anos', label: 'Mais de 2 anos' },
  { value: 'nao_definido', label: 'Ainda não sei' }
];

export const DISPONIBILIDADE_SEMANAL = [
  { value: 'ate_10h', label: 'Até 10h' },
  { value: '10_a_20h', label: '10 a 20h' },
  { value: '20_a_30h', label: '20 a 30h' },
  { value: 'mais_30h', label: 'Mais de 30h' }
];

export const ARQUIVO_LIMITES = {
  foto: {
    maxSizeBytes: 5 * 1024 * 1024,
    tiposAceitos: ['image/jpeg', 'image/png', 'image/webp'],
    extensoesAceitas: '.jpg,.jpeg,.png,.webp'
  },
  curriculo: {
    maxSizeBytes: 10 * 1024 * 1024,
    tiposAceitos: ['application/pdf'],
    extensoesAceitas: '.pdf'
  }
};

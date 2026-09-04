import { ARQUIVO_LIMITES } from '../config/constants.js';

function formatBytes(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function validarArquivo(file, tipo) {
  const limites = ARQUIVO_LIMITES[tipo];
  if (!limites.tiposAceitos.includes(file.type)) {
    return { ok: false, erro: `Formato não aceito. Envie um arquivo ${limites.extensoesAceitas}.` };
  }
  if (file.size > limites.maxSizeBytes) {
    return { ok: false, erro: `Arquivo muito grande (${formatBytes(file.size)}). Limite: ${formatBytes(limites.maxSizeBytes)}.` };
  }
  return { ok: true };
}

export function setupUploadFoto({ inputId, previewId, statusId, onChange }) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  const status = document.getElementById(statusId);
  if (!input) return { getArquivo: () => null };

  let arquivoValido = null;

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    arquivoValido = null;
    if (preview) preview.innerHTML = '';
    if (!file) { status.textContent = ''; onChange?.(null); return; }

    const resultado = validarArquivo(file, 'foto');
    if (!resultado.ok) {
      status.textContent = resultado.erro;
      status.className = 'upload-status error';
      input.value = '';
      onChange?.(null);
      return;
    }

    arquivoValido = file;
    status.textContent = `${file.name} (${formatBytes(file.size)})`;
    status.className = 'upload-status success';

    if (preview) {
      const url = URL.createObjectURL(file);
      const img = document.createElement('img');
      img.src = url;
      img.alt = 'Pré-visualização da foto';
      img.className = 'foto-preview-img';
      img.onload = () => URL.revokeObjectURL(url);
      preview.appendChild(img);
    }

    onChange?.(arquivoValido);
  });

  return { getArquivo: () => arquivoValido };
}

export function setupUploadCurriculo({ inputId, statusId, onChange }) {
  const input = document.getElementById(inputId);
  const status = document.getElementById(statusId);
  if (!input) return { getArquivo: () => null };

  let arquivoValido = null;

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    arquivoValido = null;
    if (!file) { status.textContent = ''; onChange?.(null); return; }

    const resultado = validarArquivo(file, 'curriculo');
    if (!resultado.ok) {
      status.textContent = resultado.erro;
      status.className = 'upload-status error';
      input.value = '';
      onChange?.(null);
      return;
    }

    arquivoValido = file;
    status.textContent = `${file.name} (${formatBytes(file.size)})`;
    status.className = 'upload-status success';
    onChange?.(arquivoValido);
  });

  return { getArquivo: () => arquivoValido };
}

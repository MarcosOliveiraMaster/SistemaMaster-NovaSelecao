import { maskCPF, maskTelefone, maskDataNascimento, maskCEP } from './masks.js';
import { validateCPF, validateDataNascimento, sanitize } from './validation.js';
import { buscarCEP } from './cep.js';
import { MapaBairros } from './mapaBairros.js';
import { setupUploadFoto, setupUploadCurriculo } from './uploadArquivos.js';
import { renderTurnstile, getTurnstileToken, resetTurnstile } from './turnstile.js';
import { verificarCPF, enviarCandidatura } from './submit.js';
import {
  DISCIPLINAS, SEGMENTOS, NIVEIS_ACADEMICOS,
  TIPO_RENDA, TEMPO_PRETENDIDO, DISPONIBILIDADE_SEMANAL
} from '../config/constants.js';

const TOTAL_SECOES = 9;
const ULTIMA_SECAO_PROGRESS = 8;

export class FormularioApp {
  constructor() {
    this.currentSection = 1;
    this.state = {
      cpf: '',
      possuiVeiculo: false,
      veiculoCarro: false,
      veiculoMoto: false,
      disciplinas: [],
      segmentosPode: [],
      segmentosJa: [],
      nivel: '',
      tipoRenda: '',
      tempoPretendido: '',
      disponibilidadeSemanal: '',
      dataAceiteTermos: null
    };
    this.mapaBairros = null;
    this.uploadFoto = null;
    this.uploadCurriculo = null;
    this.init();
  }

  init() {
    this.renderDynamicGroups();
    this.setupNavigation();
    this.setupSection2();
    this.setupSection3();
    this.setupSection4();
    this.setupSection5();
    this.setupSection6();
    this.setupSection7();
    this.setupSection8();
    this.setupTermosModal();
    this.setupFormSubmit();
  }

  // ────────────────────────────────────────────────────────
  //  RENDERIZAÇÃO DINÂMICA (a partir de constants.js)
  // ────────────────────────────────────────────────────────
  renderDynamicGroups() {
    const dropdownContent = document.getElementById('dropdownContent');
    dropdownContent.innerHTML = DISCIPLINAS.map(d =>
      `<label><input type="checkbox" name="disciplinas" value="${d}"> ${d}</label>`
    ).join('');

    document.getElementById('segmentosPodeLecionar').innerHTML = SEGMENTOS.map(s =>
      `<label class="checkbox-container"><input type="checkbox" name="segPode" value="${s.value}"><span class="checkmark"></span>${s.label}</label>`
    ).join('');

    document.getElementById('segmentosJaLecionou').innerHTML = SEGMENTOS.map(s =>
      `<label class="checkbox-container"><input type="checkbox" name="segJa" value="${s.value}"><span class="checkmark"></span>${s.label}</label>`
    ).join('');

    document.getElementById('nivelAcademicoGroup').innerHTML = NIVEIS_ACADEMICOS.map(n =>
      `<label class="radio-container"><input type="radio" name="nivel" class="item-radio" value="${n}"><span class="radio-checkmark"></span>${n}</label>`
    ).join('');

    document.getElementById('tipoRendaGroup').innerHTML = TIPO_RENDA.map(t =>
      `<label class="radio-container"><input type="radio" name="tipoRenda" class="item-radio" value="${t.value}"><span class="radio-checkmark"></span>${t.label}</label>`
    ).join('');

    document.getElementById('tempoPretendidoGroup').innerHTML = TEMPO_PRETENDIDO.map(t =>
      `<label class="radio-container"><input type="radio" name="tempoPretendido" class="item-radio" value="${t.value}"><span class="radio-checkmark"></span>${t.label}</label>`
    ).join('');

    document.getElementById('disponibilidadeSemanalGroup').innerHTML = DISPONIBILIDADE_SEMANAL.map(t =>
      `<label class="radio-container"><input type="radio" name="dispSemanal" class="item-radio" value="${t.value}"><span class="radio-checkmark"></span>${t.label}</label>`
    ).join('');
  }

  // ────────────────────────────────────────────────────────
  //  NAVEGAÇÃO
  // ────────────────────────────────────────────────────────
  setupNavigation() {
    document.querySelectorAll('[data-goto]').forEach(btn => {
      btn.addEventListener('click', () => {
        const n = parseInt(btn.dataset.goto, 10);
        this.showSection(n);
      });
    });
  }

  showSection(n) {
    document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.progress-step').forEach(s => s.classList.remove('active'));
    document.getElementById(`section${n}`)?.classList.add('active');
    document.querySelector(`.progress-step:nth-child(${Math.min(n, ULTIMA_SECAO_PROGRESS)})`)?.classList.add('active');
    this.currentSection = n;

    if (n === 4 && !this.mapaBairros) {
      this.mapaBairros = new MapaBairros('mapaBairros', {
        onChange: (selecionados) => this.atualizarResumoBairros(selecionados)
      });
      this.mapaBairros.carregar();
    } else if (n === 4) {
      this.mapaBairros.invalidateSize();
    }

    if (n === 8) {
      this.setupTurnstileOnce();
    }
  }

  atualizarResumoBairros(selecionados) {
    const el = document.getElementById('bairrosSelecionadosResumo');
    if (!el) return;
    el.textContent = selecionados.length
      ? `Bairros selecionados (${selecionados.length}): ${selecionados.join(', ')}`
      : 'Nenhum bairro selecionado ainda.';
  }

  // ────────────────────────────────────────────────────────
  //  SEÇÃO 2 — CPF
  // ────────────────────────────────────────────────────────
  setupSection2() {
    const input = document.getElementById('cpf');
    const msgEl = document.getElementById('cpfMessage');
    const btn = document.getElementById('section2-next');
    if (!input) return;

    let debounceTimer = null;

    input.addEventListener('input', () => {
      input.value = maskCPF(input.value);
      const nums = input.value.replace(/\D/g, '');
      btn.disabled = true;
      msgEl.textContent = '';
      msgEl.className = 'cpf-message';

      if (nums.length < 11) return;

      if (!validateCPF(nums)) {
        msgEl.textContent = 'CPF inválido';
        msgEl.className = 'cpf-message error';
        return;
      }

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        msgEl.textContent = 'Verificando...';
        msgEl.className = 'cpf-message';
        try {
          const resultado = await verificarCPF(nums);
          if (!resultado.valido) {
            msgEl.textContent = 'CPF inválido';
            msgEl.className = 'cpf-message error';
          } else if (!resultado.disponivel) {
            msgEl.textContent = 'CPF já cadastrado';
            msgEl.className = 'cpf-message error';
          } else {
            msgEl.textContent = 'CPF válido';
            msgEl.className = 'cpf-message success';
            btn.disabled = false;
          }
        } catch (err) {
          console.error('Erro ao verificar CPF:', err);
          msgEl.textContent = 'Não foi possível verificar o CPF agora. Tente novamente.';
          msgEl.className = 'cpf-message error';
        }
      }, 500);
    });

    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      this.state.cpf = input.value.replace(/\D/g, '');
      this.showSection(3);
    });
  }

  // ────────────────────────────────────────────────────────
  //  SEÇÃO 3 — DADOS PESSOAIS
  // ────────────────────────────────────────────────────────
  setupSection3() {
    const contato = document.getElementById('contato');
    const dataNasc = document.getElementById('dataNascimento');
    const cep = document.getElementById('enderecoOficial') ? document.getElementById('cep') : null;
    const btn = document.getElementById('section3-next');

    contato?.addEventListener('input', e => { e.target.value = maskTelefone(e.target.value); this.validateSection3(); });
    dataNasc?.addEventListener('input', e => { e.target.value = maskDataNascimento(e.target.value); this.validateSection3(); });

    cep?.addEventListener('input', async e => {
      e.target.value = maskCEP(e.target.value);
      this.validateSection3();
      const nums = e.target.value.replace(/\D/g, '');
      if (nums.length === 8) await this.executarBuscaCEP(nums);
    });
    cep?.addEventListener('blur', async e => {
      const nums = e.target.value.replace(/\D/g, '');
      if (nums.length === 8) await this.executarBuscaCEP(nums);
    });

    ['nome', 'email', 'endereco'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.validateSection3());
    });

    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      this.showSection(4);
    });
  }

  async executarBuscaCEP(nums) {
    const endField = document.getElementById('enderecoOficial');
    const { ok, endereco } = await buscarCEP(nums);
    if (ok) {
      endField.value = endereco;
      endField.readOnly = true;
      endField.style.background = '';
      endField.style.borderColor = '';
      endField.placeholder = 'Endereço';
    } else {
      endField.value = '';
      endField.readOnly = false;
      endField.style.background = 'white';
      endField.style.borderColor = '#ff7b33';
      endField.placeholder = 'CEP não encontrado. Digite o endereço manualmente';
    }
    this.validateSection3();
  }

  validateSection3() {
    const btn = document.getElementById('section3-next');
    if (!btn) return;
    btn.disabled = !(
      document.getElementById('nome')?.value.trim() !== '' &&
      document.getElementById('email')?.value.trim() !== '' && document.getElementById('email')?.checkValidity() &&
      document.getElementById('contato')?.value.replace(/\D/g, '').length >= 10 &&
      validateDataNascimento(document.getElementById('dataNascimento')?.value) &&
      document.getElementById('cep')?.value.replace(/\D/g, '').length === 8 &&
      document.getElementById('enderecoOficial')?.value.trim() !== '' &&
      document.getElementById('endereco')?.value.trim() !== ''
    );
  }

  // ────────────────────────────────────────────────────────
  //  SEÇÃO 4 — LOCALIZAÇÃO / DISPONIBILIDADE / VEÍCULO
  // ────────────────────────────────────────────────────────
  setupSection4() {
    const possuiVeiculo = document.getElementById('possuiVeiculo');
    const box = document.getElementById('veiculoTiposBox');
    possuiVeiculo?.addEventListener('change', () => {
      this.state.possuiVeiculo = possuiVeiculo.checked;
      box.classList.toggle('hidden', !possuiVeiculo.checked);
      if (!possuiVeiculo.checked) {
        document.getElementById('veiculoCarro').checked = false;
        document.getElementById('veiculoMoto').checked = false;
        this.state.veiculoCarro = false;
        this.state.veiculoMoto = false;
      }
    });
    document.getElementById('veiculoCarro')?.addEventListener('change', e => { this.state.veiculoCarro = e.target.checked; });
    document.getElementById('veiculoMoto')?.addEventListener('change', e => { this.state.veiculoMoto = e.target.checked; });
  }

  coletarDisponibilidade() {
    const disp = {};
    document.querySelectorAll('.schedule-checkbox').forEach(cb => {
      const key = `disp_${cb.dataset.dia}_${cb.dataset.turno.toLowerCase()}`;
      disp[key] = cb.checked;
    });
    return disp;
  }

  // ────────────────────────────────────────────────────────
  //  SEÇÃO 5 — ATUAÇÃO ACADÊMICA
  // ────────────────────────────────────────────────────────
  setupSection5() {
    const wrap = document.querySelector('.dropdown');
    const btn = document.getElementById('dropdownBtn');
    const content = document.getElementById('dropdownContent');

    this.updateDropdownText();
    btn?.addEventListener('click', e => {
      e.stopPropagation();
      wrap.classList.toggle('open');
      content.style.display = wrap.classList.contains('open') ? 'block' : 'none';
    });
    content?.addEventListener('click', e => e.stopPropagation());
    content?.querySelectorAll('input[name="disciplinas"]').forEach(cb => {
      cb.addEventListener('change', () => this.updateDropdownText());
    });
    document.addEventListener('click', () => {
      wrap?.classList.remove('open');
      if (content) content.style.display = 'none';
    });
  }

  updateDropdownText() {
    const btn = document.getElementById('dropdownBtn');
    const content = document.getElementById('dropdownContent');
    if (!btn || !content) return;
    const sel = Array.from(content.querySelectorAll('input[name="disciplinas"]:checked')).map(c => c.value);
    btn.textContent = sel.length ? sel.join(', ') : 'Selecione as disciplinas que você pode lecionar';
  }

  // ────────────────────────────────────────────────────────
  //  SEÇÃO 6 — EXPERIÊNCIA / PERFIL
  // ────────────────────────────────────────────────────────
  setupSection6() {
    this.setupToggle('expAulasToggle', 'expAulasBox');
    this.setupToggle('expNeuroToggle', 'expNeuroBox');
    this.setupToggle('expTdicsToggle', 'expTdicsBox');
  }

  setupToggle(toggleId, boxId) {
    const toggle = document.getElementById(toggleId);
    const box = document.getElementById(boxId);
    const textarea = box?.querySelector('textarea');
    if (!toggle || !box || !textarea) return;
    toggle.addEventListener('change', () => {
      box.classList.toggle('hidden', !toggle.checked);
      if (!toggle.checked) textarea.value = '';
    });
  }

  // ────────────────────────────────────────────────────────
  //  SEÇÃO 7 — DOCUMENTOS
  // ────────────────────────────────────────────────────────
  setupSection7() {
    this.uploadFoto = setupUploadFoto({ inputId: 'fotoInput', previewId: 'fotoPreview', statusId: 'fotoStatus' });
    this.uploadCurriculo = setupUploadCurriculo({ inputId: 'curriculoInput', statusId: 'curriculoStatus' });
  }

  // ────────────────────────────────────────────────────────
  //  SEÇÃO 8 — FINANCEIRO / CONSENTIMENTOS / TURNSTILE
  // ────────────────────────────────────────────────────────
  setupSection8() {
    // validações ficam a cargo do checkValidity() nativo do form no submit
  }

  setupTurnstileOnce() {
    const container = document.getElementById('turnstileWidget');
    if (!container || container.dataset.rendered) return;
    container.dataset.rendered = 'true';
    renderTurnstile('turnstileWidget');
  }

  setupTermosModal() {
    const modal = document.getElementById('termosModal');
    const abrir = document.getElementById('linkAbrirTermos');
    const fechar = document.getElementById('btnFecharTermos');
    const aceitar = document.getElementById('btnAceitarTermos');

    abrir?.addEventListener('click', e => {
      e.preventDefault();
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    });
    const fecharModal = () => { modal.style.display = 'none'; document.body.style.overflow = ''; };
    fechar?.addEventListener('click', fecharModal);
    aceitar?.addEventListener('click', () => {
      document.getElementById('aceiteTermos').checked = true;
      this.state.dataAceiteTermos = new Date().toISOString();
      fecharModal();
    });
    modal?.addEventListener('click', e => { if (e.target === modal) fecharModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.style.display === 'flex') fecharModal(); });
  }

  // ────────────────────────────────────────────────────────
  //  ENVIO
  // ────────────────────────────────────────────────────────
  checkRateLimit() {
    const KEY = 'form_last_submit';
    const LIMIT = 60000;
    const last = localStorage.getItem(KEY);
    if (last && Date.now() - parseInt(last, 10) < LIMIT) {
      const wait = Math.ceil((LIMIT - (Date.now() - parseInt(last, 10))) / 1000);
      throw new Error(`Aguarde ${wait} segundos antes de tentar novamente.`);
    }
    localStorage.setItem(KEY, Date.now().toString());
  }

  setupFormSubmit() {
    document.getElementById('meuFormulario')?.addEventListener('submit', async e => {
      e.preventDefault();
      await this.handleFormSubmit();
    });
  }

  validarSecaoFinal() {
    const erros = [];
    if (!document.getElementById('pix')?.value.trim()) erros.push('Informe seu Pix.');
    if (!document.getElementById('aceiteTermos')?.checked) erros.push('Você precisa aceitar os Termos de Uso.');
    if (!document.getElementById('consentDados')?.checked) erros.push('Consentimento de uso de dados é obrigatório.');
    if (!document.getElementById('consentComunicacao')?.checked) erros.push('Consentimento de comunicação é obrigatório.');
    if (!document.getElementById('consentImagem')?.checked) erros.push('Consentimento de uso de imagem é obrigatório.');
    if (!document.getElementById('consentCurriculo')?.checked) erros.push('Consentimento de armazenamento do currículo é obrigatório.');
    if (!getTurnstileToken()) erros.push('Confirme a verificação anti-robô.');

    const disciplinas = Array.from(document.querySelectorAll('input[name="disciplinas"]:checked'));
    if (disciplinas.length === 0) erros.push('Selecione ao menos uma disciplina.');

    const segPode = Array.from(document.querySelectorAll('input[name="segPode"]:checked'));
    if (segPode.length === 0) erros.push('Selecione ao menos um segmento/turma que você pode atender.');

    if (!document.querySelector('input[name="nivel"]:checked')) erros.push('Selecione seu nível acadêmico.');
    if (!document.getElementById('curso')?.value.trim()) erros.push('Informe seu curso de formação.');

    if (!document.querySelector('input[name="tipoRenda"]:checked')) erros.push('Responda sobre o tipo de renda.');
    if (!document.querySelector('input[name="tempoPretendido"]:checked')) erros.push('Responda por quanto tempo pretende dar aulas.');
    if (!document.querySelector('input[name="dispSemanal"]:checked')) erros.push('Responda sua disponibilidade semanal.');

    if (!this.mapaBairros || this.mapaBairros.getSelecionados().length === 0) erros.push('Selecione ao menos um bairro no mapa.');

    if (!this.uploadFoto?.getArquivo()) erros.push('Envie sua foto.');
    if (!this.uploadCurriculo?.getArquivo()) erros.push('Envie seu currículo em PDF.');

    return erros;
  }

  coletarDados() {
    const disciplinas = Array.from(document.querySelectorAll('input[name="disciplinas"]:checked')).map(c => c.value);
    const segPode = Array.from(document.querySelectorAll('input[name="segPode"]:checked')).map(c => c.value);
    const segJa = Array.from(document.querySelectorAll('input[name="segJa"]:checked')).map(c => c.value);
    const nivel = document.querySelector('input[name="nivel"]:checked')?.value ?? '';
    const tipoRenda = document.querySelector('input[name="tipoRenda"]:checked')?.value ?? '';
    const tempoPretendido = document.querySelector('input[name="tempoPretendido"]:checked')?.value ?? '';
    const dispSemanal = document.querySelector('input[name="dispSemanal"]:checked')?.value ?? '';

    const expAulas = document.getElementById('expAulasToggle').checked;
    const expNeuro = document.getElementById('expNeuroToggle').checked;
    const expTdics = document.getElementById('expTdicsToggle').checked;

    const disp = this.coletarDisponibilidade();

    return {
      cpf: this.state.cpf,
      nome: sanitize(document.getElementById('nome').value),
      email: sanitize(document.getElementById('email').value),
      contato: document.getElementById('contato').value.replace(/\D/g, ''),
      data_nascimento: this.converterDataParaISO(document.getElementById('dataNascimento').value),
      cep: document.getElementById('cep').value.replace(/\D/g, ''),
      endereco_oficial: sanitize(document.getElementById('enderecoOficial').value),
      complemento: sanitize(document.getElementById('endereco').value),

      bairros: this.mapaBairros?.getSelecionados() ?? [],

      ...disp,

      possui_veiculo: this.state.possuiVeiculo,
      veiculo_carro: this.state.veiculoCarro,
      veiculo_moto: this.state.veiculoMoto,

      disciplinas,
      segmentos_pode_lecionar: segPode,
      segmentos_ja_lecionou: segJa,
      nivel_academico: nivel,
      curso: sanitize(document.getElementById('curso').value),
      pix: sanitize(document.getElementById('pix').value),

      exp_aulas_particulares: expAulas,
      exp_aulas_particulares_desc: expAulas ? sanitize(document.getElementById('expAulasText').value) : '',
      exp_neurodivergentes: expNeuro,
      exp_neurodivergentes_desc: expNeuro ? sanitize(document.getElementById('expNeuroText').value) : '',
      exp_tdics: expTdics,
      exp_tdics_desc: expTdics ? sanitize(document.getElementById('expTdicsText').value) : '',

      tipo_renda: tipoRenda,
      tempo_pretendido: tempoPretendido,
      disponibilidade_semanal: dispSemanal,
      motivacao_texto: sanitize(document.getElementById('motivacaoTexto').value),

      aceite_termos: document.getElementById('aceiteTermos').checked,
      versao_termos: '2.0',
      data_aceite_termos: this.state.dataAceiteTermos ?? new Date().toISOString(),
      consent_dados: document.getElementById('consentDados').checked,
      consent_comunicacao: document.getElementById('consentComunicacao').checked,
      consent_compartilhamento: document.getElementById('consentCompartilhamento').checked,
      consent_imagem: document.getElementById('consentImagem').checked,
      consent_curriculo: document.getElementById('consentCurriculo').checked
    };
  }

  converterDataParaISO(dataBR) {
    const m = dataBR.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    const [, d, mo, y] = m;
    return `${y}-${mo}-${d}`;
  }

  mostrarErroSubmit(mensagem) {
    const el = document.getElementById('submitError');
    el.textContent = mensagem;
    el.classList.remove('hidden');
  }

  esconderErroSubmit() {
    document.getElementById('submitError')?.classList.add('hidden');
  }

  async handleFormSubmit() {
    this.esconderErroSubmit();

    const erros = this.validarSecaoFinal();
    if (erros.length > 0) {
      this.mostrarErroSubmit(erros[0]);
      return;
    }

    const btn = document.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

    try {
      this.checkRateLimit();
      const dados = this.coletarDados();
      const arquivos = {
        foto: this.uploadFoto.getArquivo(),
        curriculo: this.uploadCurriculo.getArquivo()
      };
      const token = getTurnstileToken();
      await enviarCandidatura(dados, arquivos, token);
      this.showSection(9);
    } catch (error) {
      console.error('Erro ao enviar formulário:', error);
      this.mostrarErroSubmit(error.message || 'Erro ao enviar. Tente novamente.');
      resetTurnstile();
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Enviar Cadastro'; }
    }
  }
}

// ============================================================
//  Formulário de inscrição para entrevista — Supabase (NovaSelecao.MasterEdu)
// ============================================================

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// ── Animações: reveal on scroll + contador dos números ────────
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function animarContador(el) {
    const target = parseInt(el.dataset.count, 10);
    if (prefersReducedMotion || isNaN(target)) { el.textContent = target || 0; return; }
    const duracao = 1200;
    const inicio = performance.now();
    function passo(agora) {
        const progresso = Math.min((agora - inicio) / duracao, 1);
        const valor = Math.round(target * (1 - Math.pow(1 - progresso, 3))); // ease-out cubic
        el.textContent = valor;
        if (progresso < 1) requestAnimationFrame(passo);
    }
    requestAnimationFrame(passo);
}

const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        entry.target.querySelectorAll('.stat-number').forEach(animarContador);
        revealObserver.unobserve(entry.target);
    });
}, { threshold: 0.15 });

document.querySelectorAll('.reveal').forEach((el, i) => {
    el.style.transitionDelay = prefersReducedMotion ? '0s' : `${Math.min(i * 60, 300)}ms`;
    revealObserver.observe(el);
});

// ── Navegação em 2 telas no mobile: apresentação -> formulário ─
const pageEl = document.querySelector('.page');
const btnAvancar = document.getElementById('btnAvancar');
const btnVoltar = document.getElementById('btnVoltar');

btnAvancar?.addEventListener('click', () => {
    pageEl.classList.add('show-form');
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
});

btnVoltar?.addEventListener('click', () => {
    pageEl.classList.remove('show-form');
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
});

// ── Máscaras ─────────────────────────────────────────────────
function maskCPF(value) {
    let v = value.replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);
    v = v.replace(/(\d{3})(\d)/, '$1.$2')
         .replace(/(\d{3})(\d)/, '$1.$2')
         .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    return v;
}

function maskTelefone(value) {
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

// ── Validação de CPF ─────────────────────────────────────────
function validateCPF(cpf) {
    const n = cpf.replace(/\D/g, '');
    if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(n[i]) * (10 - i);
    let d1 = (sum * 10) % 11;
    if (d1 === 10 || d1 === 11) d1 = 0;
    if (d1 !== parseInt(n[9])) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(n[i]) * (11 - i);
    let d2 = (sum * 10) % 11;
    if (d2 === 10 || d2 === 11) d2 = 0;
    return d2 === parseInt(n[10]);
}

function sanitize(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
        .trim().substring(0, 200);
}

// ── Rate limiting (anti-spam simples, sem captcha) ────────────
function checkRateLimit() {
    const KEY = 'inscricao_last_submit';
    const LIMIT = 60000;
    const last = localStorage.getItem(KEY);
    if (last && Date.now() - parseInt(last, 10) < LIMIT) {
        const wait = Math.ceil((LIMIT - (Date.now() - parseInt(last, 10))) / 1000);
        throw new Error(`Aguarde ${wait} segundos antes de tentar novamente.`);
    }
    localStorage.setItem(KEY, Date.now().toString());
}

// ── Máscaras nos campos ────────────────────────────────────────
const cpfInput = document.getElementById('cpf');
const cpfMessage = document.getElementById('cpfMessage');
cpfInput.addEventListener('input', () => {
    cpfInput.value = maskCPF(cpfInput.value);
    const nums = cpfInput.value.replace(/\D/g, '');
    if (nums.length < 11) {
        cpfMessage.textContent = '';
        cpfMessage.className = 'field-message';
    } else if (!validateCPF(nums)) {
        cpfMessage.textContent = 'CPF inválido';
        cpfMessage.className = 'field-message error';
    } else {
        cpfMessage.textContent = 'CPF válido';
        cpfMessage.className = 'field-message success';
    }
});

const telefoneInput = document.getElementById('telefone');
telefoneInput.addEventListener('input', () => {
    telefoneInput.value = maskTelefone(telefoneInput.value);
});

// ── Seleção de data/horário (slot único, catálogo dinâmico via Supabase) ──
// Datas/horários oferecidos não são mais fixos no código: vêm da tabela
// `slots_disponiveis`, editável em SistemaMaster-Central > Dashboard >
// Professores > Agendamento de Entrevistas.
function formatarDataLabel(dataISO) {
    if (!dataISO) return '';
    const [ano, mes, dia] = dataISO.split('-').map(Number);
    const d = new Date(ano, mes - 1, dia);
    const diaSemana = d.toLocaleDateString('pt-BR', { weekday: 'long' }).split('-feira')[0];
    return `${diaSemana} ${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
}

let DATAS = [];                  // datas com ao menos 1 horário ativo, em ordem cronológica
let horariosPorData = {};        // { data: [horario, ...] }
let slotsOcupados = new Set();   // "data|horario"
let dataAtiva = null;
let slotSelecionado = null;      // { data, horario }

const dayTabsEl = document.getElementById('dayTabs');
const horariosGridEl = document.getElementById('horariosGrid');
const slotResumoEl = document.getElementById('slotSelecionadoResumo');
const toastEl = document.getElementById('toast');

let toastTimer = null;
function mostrarToast(mensagem) {
    toastEl.textContent = mensagem;
    toastEl.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 3000);
}

async function carregarCatalogoSlots() {
    try {
        const { data, error } = await supabaseClient
            .from('slots_disponiveis')
            .select('data,horario')
            .eq('ativo', true)
            .order('data', { ascending: true })
            .order('horario_ordem', { ascending: true });
        if (error) throw error;

        horariosPorData = {};
        DATAS = [];
        (data || []).forEach(({ data: dataSlot, horario }) => {
            if (!horariosPorData[dataSlot]) { horariosPorData[dataSlot] = []; DATAS.push(dataSlot); }
            horariosPorData[dataSlot].push(horario);
        });
    } catch (err) {
        console.error('Erro ao carregar catálogo de horários:', err);
        DATAS = [];
        horariosPorData = {};
    }
}

async function carregarSlotsOcupados() {
    try {
        const { data, error } = await supabaseClient.from('slots_ocupados').select('data,horario');
        if (error) throw error;
        slotsOcupados = new Set((data || []).map(r => `${r.data}|${r.horario}`));
    } catch (err) {
        console.error('Erro ao carregar disponibilidade:', err);
    }
}

function renderDayTabs() {
    dayTabsEl.style.setProperty('--dias-count', DATAS.length || 1);
    dayTabsEl.innerHTML = DATAS.map(data =>
        `<button type="button" class="day-tab" data-data="${data}" role="tab">${formatarDataLabel(data)}</button>`
    ).join('');
}

function atualizarResumoSlot() {
    slotResumoEl.textContent = slotSelecionado
        ? `Selecionado: ${formatarDataLabel(slotSelecionado.data)}, ${slotSelecionado.horario}`
        : '';
}

function renderHorarios(data) {
    dataAtiva = data;

    dayTabsEl.querySelectorAll('.day-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.data === data);
    });

    const horarios = horariosPorData[data] || [];
    horariosGridEl.style.setProperty('--horarios-count', horarios.length || 1);
    horariosGridEl.innerHTML = horarios.map(horario => {
        const ocupado = slotsOcupados.has(`${data}|${horario}`);
        const marcado = slotSelecionado && slotSelecionado.data === data && slotSelecionado.horario === horario;
        return `<label class="checkbox-container${ocupado ? ' slot-ocupado' : ''}" data-data="${data}" data-horario="${horario}">
            <input type="checkbox" ${marcado ? 'checked' : ''} ${ocupado ? 'disabled' : ''}>
            <span class="checkmark"></span>
            <span class="checkbox-label">${horario}</span>
        </label>`;
    }).join('');
}

dayTabsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.day-tab');
    if (!btn) return;
    renderHorarios(btn.dataset.data);
});

horariosGridEl.addEventListener('click', (e) => {
    const label = e.target.closest('.checkbox-container');
    if (!label) return;

    if (label.classList.contains('slot-ocupado')) {
        e.preventDefault();
        mostrarToast('Esse horário já está preenchido. Por favor, selecione outro.');
        return;
    }

    e.preventDefault();
    const data = label.dataset.data;
    const horario = label.dataset.horario;
    const jaEstaSelecionado = slotSelecionado && slotSelecionado.data === data && slotSelecionado.horario === horario;
    slotSelecionado = jaEstaSelecionado ? null : { data, horario };
    atualizarResumoSlot();
    renderHorarios(dataAtiva);
});

(async function initSlots() {
    horariosGridEl.innerHTML = '<p class="slots-loading">Carregando horários…</p>';

    await Promise.all([carregarCatalogoSlots(), carregarSlotsOcupados()]);

    if (DATAS.length === 0) {
        dayTabsEl.innerHTML = '';
        horariosGridEl.innerHTML = '<p class="slots-loading">Nenhum horário disponível no momento. Por favor, tente novamente mais tarde.</p>';
        return;
    }

    renderDayTabs();
    dataAtiva = DATAS[0];
    renderHorarios(dataAtiva);
})();

// ── Envio ────────────────────────────────────────────────────
const form = document.getElementById('formInscricao');
const btnSubmit = document.getElementById('btnSubmit');
const submitError = document.getElementById('submitError');

function mostrarErro(mensagem) {
    submitError.textContent = mensagem;
    submitError.classList.remove('hidden');
}

function esconderErro() {
    submitError.classList.add('hidden');
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    esconderErro();

    const nomeCompleto = sanitize(document.getElementById('nomeCompleto').value);
    const cpfNums = cpfInput.value.replace(/\D/g, '');
    const email = sanitize(document.getElementById('email').value);
    const telefoneNums = telefoneInput.value.replace(/\D/g, '');

    if (!nomeCompleto) return mostrarErro('Informe seu nome completo.');
    if (!validateCPF(cpfNums)) return mostrarErro('CPF inválido.');
    if (!email || !document.getElementById('email').checkValidity()) return mostrarErro('Informe um e-mail válido.');
    if (telefoneNums.length < 10) return mostrarErro('Informe um telefone válido.');
    if (!slotSelecionado) return mostrarErro('Selecione o dia e o horário da sua entrevista.');

    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Enviando...';

    try {
        checkRateLimit();

        // Revalida a disponibilidade bem antes de enviar, pra reduzir a chance
        // de o usuário só descobrir que perdeu o horário depois do clique final.
        await carregarSlotsOcupados();
        if (slotsOcupados.has(`${slotSelecionado.data}|${slotSelecionado.horario}`)) {
            slotSelecionado = null;
            atualizarResumoSlot();
            renderHorarios(dataAtiva);
            throw new Error('Esse horário acabou de ser preenchido por outra pessoa. Por favor, selecione outro.');
        }

        const { error } = await supabaseClient.from('inscricoes').insert([{
            nome_completo: nomeCompleto,
            cpf: cpfNums,
            email,
            telefone: telefoneNums,
            data: slotSelecionado.data,
            horario: slotSelecionado.horario
        }]);

        if (error) {
            if (error.code === '23505' && error.message?.includes('slot')) {
                await carregarSlotsOcupados();
                slotSelecionado = null;
                atualizarResumoSlot();
                renderHorarios(dataAtiva);
                throw new Error('Esse horário acabou de ser preenchido por outra pessoa. Por favor, selecione outro.');
            }
            if (error.code === '23505') throw new Error('Este CPF já está cadastrado.');
            throw error;
        }

        form.classList.add('hidden');
        document.getElementById('successBox').classList.remove('hidden');
    } catch (err) {
        console.error('Erro ao enviar inscrição:', err);
        mostrarErro(err.message || 'Erro ao enviar. Tente novamente.');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Enviar Inscrição';
    }
});

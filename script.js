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
    const dias = Array.from(document.querySelectorAll('input[name="dia"]:checked')).map(c => c.value);
    const horarios = Array.from(document.querySelectorAll('input[name="horario"]:checked')).map(c => c.value);

    if (!nomeCompleto) return mostrarErro('Informe seu nome completo.');
    if (!validateCPF(cpfNums)) return mostrarErro('CPF inválido.');
    if (!email || !document.getElementById('email').checkValidity()) return mostrarErro('Informe um e-mail válido.');
    if (telefoneNums.length < 10) return mostrarErro('Informe um telefone válido.');
    if (dias.length === 0) return mostrarErro('Selecione ao menos um dia disponível.');
    if (horarios.length === 0) return mostrarErro('Selecione ao menos um horário disponível.');

    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Enviando...';

    try {
        checkRateLimit();

        const { error } = await supabaseClient.from('inscricoes').insert([{
            nome_completo: nomeCompleto,
            cpf: cpfNums,
            email,
            telefone: telefoneNums,
            dias_disponiveis: dias,
            horarios_disponiveis: horarios
        }]);

        if (error) {
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

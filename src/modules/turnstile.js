import { TURNSTILE_SITE_KEY } from '../config/supabaseClient.js';

let widgetId = null;
let currentToken = null;

function loadScript() {
  return new Promise((resolve, reject) => {
    if (window.turnstile) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Não foi possível carregar o Turnstile.'));
    document.head.appendChild(script);
  });
}

export async function renderTurnstile(containerId, { onSuccess, onError, onExpire } = {}) {
  await loadScript();

  const tryRender = () => {
    if (!window.turnstile) { setTimeout(tryRender, 100); return; }
    widgetId = window.turnstile.render(`#${containerId}`, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token) => { currentToken = token; onSuccess?.(token); },
      'error-callback': () => { currentToken = null; onError?.(); },
      'expired-callback': () => { currentToken = null; onExpire?.(); }
    });
  };
  tryRender();
}

export function getTurnstileToken() {
  return currentToken;
}

export function resetTurnstile() {
  currentToken = null;
  if (window.turnstile && widgetId !== null) {
    window.turnstile.reset(widgetId);
  }
}

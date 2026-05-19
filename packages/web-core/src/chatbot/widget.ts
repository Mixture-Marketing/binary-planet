/**
 * Chatbot widget — vanilla HTML+CSS+JS string generator for klient sites.
 *
 * Why vanilla: klient site is Astro static + minimal hydration. No framework
 * dependency here. Widget renders as `<script>` injected by Astro layout.
 *
 * Endpoint contract: POST {apiPath} { messages: ChatMessage[] } → ChatResponse
 */

export interface ChatWidgetOptions {
  apiPath: string;
  brandColor: string;
  introMessage: string;
  businessName: string;
  /** Optional intro buttons shown before user types. */
  starterQuestions?: string[];
}

const DEFAULT_STARTERS = ["Jakie są ceny?", "Kiedy mogę przyjść?", "Gdzie jesteście?"];

/** Returns full HTML+CSS+JS for the floating chat widget — drop into <body>. */
export function buildChatWidgetHtml(opts: ChatWidgetOptions): string {
  const optsJson = JSON.stringify({
    apiPath: opts.apiPath,
    brandColor: opts.brandColor,
    introMessage: opts.introMessage,
    businessName: opts.businessName,
    starterQuestions: opts.starterQuestions ?? DEFAULT_STARTERS,
  });

  return `<div id="mm-chat-root"></div>
<style>
  #mm-chat-root { position: fixed; bottom: 24px; right: 24px; z-index: 9999; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  #mm-chat-toggle {
    width: 60px; height: 60px; border-radius: 50%; border: none;
    background: var(--mm-chat-brand, #047857); color: white; cursor: pointer;
    box-shadow: 0 6px 20px rgba(0,0,0,0.18);
    display: flex; align-items: center; justify-content: center;
    transition: transform .2s;
  }
  #mm-chat-toggle:hover { transform: scale(1.05); }
  #mm-chat-toggle svg { width: 28px; height: 28px; }
  #mm-chat-panel {
    position: absolute; bottom: 76px; right: 0;
    width: min(360px, 90vw); height: min(560px, 80vh);
    background: white; border-radius: 16px; box-shadow: 0 20px 50px rgba(0,0,0,0.25);
    display: none; flex-direction: column; overflow: hidden;
  }
  #mm-chat-panel.open { display: flex; }
  .mm-chat-header { background: var(--mm-chat-brand, #047857); color: white; padding: 14px 16px; }
  .mm-chat-header h3 { margin: 0; font-size: 1rem; font-weight: 700; }
  .mm-chat-header p { margin: 2px 0 0 0; font-size: 0.78rem; opacity: 0.9; }
  .mm-chat-close { position: absolute; right: 14px; top: 14px; background: none; border: none; color: white; cursor: pointer; padding: 4px; font-size: 1.4rem; line-height: 1; }
  .mm-chat-messages { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 8px; background: #f8fafc; }
  .mm-msg { padding: 10px 12px; border-radius: 14px; max-width: 85%; font-size: 0.92rem; line-height: 1.4; word-wrap: break-word; }
  .mm-msg-bot { background: white; border: 1px solid #e2e8f0; align-self: flex-start; }
  .mm-msg-user { background: var(--mm-chat-brand, #047857); color: white; align-self: flex-end; }
  .mm-quick-replies { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 14px 0 14px; }
  .mm-quick-reply { background: white; border: 1px solid var(--mm-chat-brand, #047857); color: var(--mm-chat-brand, #047857); border-radius: 16px; padding: 6px 12px; font-size: 0.82rem; cursor: pointer; white-space: nowrap; }
  .mm-lead-form { padding: 12px 14px; background: #fef3c7; border-top: 1px solid #fbbf24; display: none; flex-direction: column; gap: 6px; }
  .mm-lead-form.show { display: flex; }
  .mm-lead-form input { padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.92rem; }
  .mm-lead-form button { padding: 8px 12px; background: var(--mm-chat-brand, #047857); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; }
  .mm-chat-form { display: flex; gap: 8px; padding: 12px; border-top: 1px solid #e2e8f0; background: white; }
  .mm-chat-form input { flex: 1; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 24px; font-size: 0.92rem; outline: none; }
  .mm-chat-form input:focus { border-color: var(--mm-chat-brand, #047857); }
  .mm-chat-form button { background: var(--mm-chat-brand, #047857); color: white; border: none; padding: 10px 16px; border-radius: 24px; font-weight: 600; cursor: pointer; }
  .mm-chat-form button:disabled { opacity: 0.5; cursor: not-allowed; }
  .mm-typing { color: #64748b; font-size: 0.85rem; padding: 4px 14px; font-style: italic; }
  .mm-powered-by { padding: 6px 14px; text-align: center; font-size: 0.7rem; color: #94a3b8; background: #f8fafc; }
</style>
<script>
(function() {
  const opts = ${optsJson};
  const root = document.getElementById('mm-chat-root');
  root.style.setProperty('--mm-chat-brand', opts.brandColor);

  root.innerHTML = \`
    <button id="mm-chat-toggle" aria-label="Otwórz czat">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
      </svg>
    </button>
    <div id="mm-chat-panel" role="dialog" aria-label="Czat z asystentem">
      <div class="mm-chat-header">
        <button class="mm-chat-close" aria-label="Zamknij czat">×</button>
        <h3>Asystent \${opts.businessName}</h3>
        <p>Odpowiadam zwykle w kilka sekund</p>
      </div>
      <div class="mm-chat-messages" id="mm-msgs"></div>
      <div class="mm-quick-replies" id="mm-quick"></div>
      <div class="mm-lead-form" id="mm-lead">
        <p style="margin:0 0 4px 0;font-size:0.85rem;font-weight:600;">Zostaw kontakt — oddzwonimy:</p>
        <input type="tel" placeholder="Twój numer telefonu" id="mm-lead-phone" required>
        <button type="button" id="mm-lead-send">Wyślij</button>
      </div>
      <form class="mm-chat-form" id="mm-form">
        <input type="text" id="mm-input" placeholder="Napisz wiadomość…" required autocomplete="off" maxlength="500">
        <button type="submit">Wyślij</button>
      </form>
      <div class="mm-powered-by">Wspomagane AI · MixtureMarketing</div>
    </div>
  \`;

  const panel = document.getElementById('mm-chat-panel');
  const msgsEl = document.getElementById('mm-msgs');
  const quickEl = document.getElementById('mm-quick');
  const leadEl = document.getElementById('mm-lead');
  const form = document.getElementById('mm-form');
  const input = document.getElementById('mm-input');
  const submitBtn = form.querySelector('button');

  let history = [];
  let opened = false;

  function open() {
    panel.classList.add('open');
    if (!opened) {
      opened = true;
      addBotMessage(opts.introMessage);
      renderQuickReplies(opts.starterQuestions || []);
    }
    input.focus();
  }
  function close() { panel.classList.remove('open'); }

  document.getElementById('mm-chat-toggle').addEventListener('click', () => panel.classList.contains('open') ? close() : open());
  document.querySelector('.mm-chat-close').addEventListener('click', close);

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\\'':'&#39;'}[c]));
  }
  function addBotMessage(text) {
    const el = document.createElement('div');
    el.className = 'mm-msg mm-msg-bot';
    el.innerHTML = escapeHtml(text);
    msgsEl.appendChild(el);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  function addUserMessage(text) {
    const el = document.createElement('div');
    el.className = 'mm-msg mm-msg-user';
    el.innerHTML = escapeHtml(text);
    msgsEl.appendChild(el);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  function showTyping() {
    const el = document.createElement('div');
    el.className = 'mm-typing';
    el.id = 'mm-typing';
    el.textContent = 'Asystent pisze…';
    msgsEl.appendChild(el);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  function hideTyping() {
    const t = document.getElementById('mm-typing');
    if (t) t.remove();
  }
  function renderQuickReplies(list) {
    quickEl.innerHTML = '';
    for (const q of list) {
      const btn = document.createElement('button');
      btn.className = 'mm-quick-reply';
      btn.type = 'button';
      btn.textContent = q;
      btn.addEventListener('click', () => sendMessage(q));
      quickEl.appendChild(btn);
    }
  }

  async function sendMessage(text) {
    if (!text || !text.trim()) return;
    text = text.trim();
    addUserMessage(text);
    history.push({ role: 'user', content: text });
    input.value = '';
    submitBtn.disabled = true;
    quickEl.innerHTML = '';
    leadEl.classList.remove('show');
    showTyping();
    try {
      const res = await fetch(opts.apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });
      hideTyping();
      const data = await res.json();
      if (!res.ok || !data.ok) {
        addBotMessage('Przepraszam, asystent jest tymczasowo niedostępny. Zadzwoń do nas.');
        return;
      }
      const chat = data.data;
      addBotMessage(chat.reply);
      history.push({ role: 'assistant', content: chat.reply });
      renderQuickReplies(chat.quick_replies || []);
      if (chat.lead_capture_cta) {
        leadEl.classList.add('show');
      }
    } catch (e) {
      hideTyping();
      addBotMessage('Wystąpił problem z połączeniem. Spróbuj ponownie.');
    } finally {
      submitBtn.disabled = false;
      input.focus();
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage(input.value);
  });

  document.getElementById('mm-lead-send').addEventListener('click', async () => {
    const phone = document.getElementById('mm-lead-phone').value.trim();
    if (!phone || phone.length < 6) return;
    leadEl.innerHTML = '<p style="margin:0;color:#047857;font-weight:600;">Dzięki! Oddzwonimy w ciągu 24h.</p>';
    // Reuse existing lead form endpoint
    try {
      await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, source: 'chatbot', message: 'Lead z czatu AI' }),
      });
    } catch (e) { /* swallow — UX already says success */ }
  });
})();
</script>`;
}

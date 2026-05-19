/**
 * Newsletter + SMS subscribe widget.
 *
 * Activated as addon `newsletter_sms` (50 zł/mc).
 * Toggle via env: NEWSLETTER_SMS_ENABLED=true.
 *
 * Two render modes:
 *   - inline:   embed in a section of the site (e.g. footer)
 *   - sticky:   bottom-right card with close button (cooldown 14 days)
 *
 * Posts to /api/newsletter/subscribe (klient site → hub).
 * Double opt-in: klient gets confirmation email, clicks link, becomes active subscriber.
 */

export interface NewsletterWidgetOptions {
  title: string;
  body: string;
  brandColor: string;
  /** Show phone field for SMS opt-in (default false — email only). */
  collectPhone?: boolean;
  /** "sticky" (bottom-right) | "inline" (caller places the div) */
  mode?: "sticky" | "inline";
  /** Days between showing sticky after dismissal (default 14). */
  cooldownDays?: number;
}

export function buildNewsletterHtml(opts: NewsletterWidgetOptions): string {
  const cfg = {
    title: opts.title,
    body: opts.body,
    brandColor: opts.brandColor,
    collectPhone: opts.collectPhone ?? false,
    mode: opts.mode ?? "sticky",
    cooldownDays: opts.cooldownDays ?? 14,
  };
  const cfgJson = JSON.stringify(cfg);

  return `<div id="mm-newsletter"></div>
<style>
  #mm-newsletter[data-mode="sticky"] {
    position: fixed; bottom: 24px; right: 24px; z-index: 9985;
    width: min(360px, calc(100vw - 32px));
    background: white; border-radius: 14px; box-shadow: 0 12px 32px rgba(0,0,0,0.2);
    padding: 20px; display: none;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    border-top: 4px solid var(--mm-nl-brand);
  }
  #mm-newsletter[data-mode="sticky"].open { display: block; }
  #mm-newsletter[data-mode="inline"] {
    background: #f8fafc; border-radius: 12px; padding: 24px;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    max-width: 540px; margin: 24px auto;
    border-left: 4px solid var(--mm-nl-brand);
  }
  .mm-nl-close { position: absolute; top: 8px; right: 12px; background: none; border: none; font-size: 1.4rem; color: #94a3b8; cursor: pointer; line-height: 1; }
  .mm-nl-emoji { font-size: 1.8rem; margin: 0 0 6px 0; }
  .mm-nl-title { font-size: 1.1rem; font-weight: 700; margin: 0 0 6px 0; }
  .mm-nl-body { color: #475569; font-size: 0.88rem; margin: 0 0 12px 0; line-height: 1.4; }
  .mm-nl-form input { width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.92rem; margin-bottom: 8px; box-sizing: border-box; }
  .mm-nl-form input:focus { border-color: var(--mm-nl-brand); outline: none; }
  .mm-nl-form button { width: 100%; padding: 10px; background: var(--mm-nl-brand); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; }
  .mm-nl-form button:disabled { opacity: 0.6; }
  .mm-nl-consent { font-size: 0.72rem; color: #64748b; margin-top: 8px; line-height: 1.4; }
  .mm-nl-success { text-align: center; padding: 8px 0; color: #047857; font-weight: 600; }
</style>
<script>
(function() {
  const cfg = ${cfgJson};
  const root = document.getElementById('mm-newsletter');
  if (!root) return;
  root.setAttribute('data-mode', cfg.mode);
  root.style.setProperty('--mm-nl-brand', cfg.brandColor);

  // Cooldown check (sticky only)
  if (cfg.mode === 'sticky') {
    const last = localStorage.getItem('mm_nl_dismissed_at');
    if (last && (Date.now() - parseInt(last, 10)) / 86400000 < cfg.cooldownDays) return;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\\'':'&#39;'}[c]));
  }

  root.innerHTML = \`
    \${cfg.mode === 'sticky' ? '<button type="button" class="mm-nl-close" aria-label="Zamknij">×</button>' : ''}
    <p class="mm-nl-emoji">📬</p>
    <h3 class="mm-nl-title">\${escapeHtml(cfg.title)}</h3>
    <p class="mm-nl-body">\${escapeHtml(cfg.body)}</p>
    <form class="mm-nl-form" id="mm-nl-form" novalidate>
      <input type="email" name="email" placeholder="Twój email" required autocomplete="email">
      \${cfg.collectPhone ? '<input type="tel" name="phone" placeholder="Telefon (opcjonalnie SMS)" autocomplete="tel">' : ''}
      <button type="submit">Zapisuję się</button>
      <p class="mm-nl-consent">Wyślemy email potwierdzający. Wypisać się można jednym klikiem. Bez spamu.</p>
    </form>
  \`;

  // Auto-show sticky after 6s
  if (cfg.mode === 'sticky') {
    setTimeout(() => root.classList.add('open'), 6000);
    root.querySelector('.mm-nl-close').addEventListener('click', () => {
      root.classList.remove('open');
      localStorage.setItem('mm_nl_dismissed_at', String(Date.now()));
    });
  }

  document.getElementById('mm-nl-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Zapisuję…';
    const email = form.email.value.trim();
    const phone = form.phone ? form.phone.value.trim() : '';
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone, source: cfg.mode === 'sticky' ? 'sticky_widget' : 'inline_widget' }),
      });
      const json = await res.json();
      if (json.ok) {
        form.parentElement.innerHTML = '<div class="mm-nl-success">✅ Dzięki! Sprawdź email i potwierdź zapis.</div>';
      } else {
        btn.disabled = false;
        btn.textContent = 'Zapisuję się';
        alert('Błąd: ' + (json.error || 'spróbuj ponownie'));
      }
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Zapisuję się';
      alert('Network: ' + err);
    }
  });
})();
</script>`;
}

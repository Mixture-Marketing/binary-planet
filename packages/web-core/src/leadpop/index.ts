/**
 * Leadpop — popup with discount code, captures email + phone.
 *
 * Activated as addon `leadpop_discount` (20 zł/mc).
 * Toggles via env: LEADPOP_ENABLED=true.
 *
 * Strategy:
 *   - Triggers: time-based (default 25s) OR scroll-based (default 60%) OR exit-intent (desktop)
 *   - Frequency cap: shown max once per 7 days (localStorage)
 *   - Lead capture: posts to /api/lead with source="leadpop"
 *   - Returns discount code shown after submit
 */

export interface LeadpopOptions {
  /** Heading line. */
  title: string;
  /** Body line. */
  body: string;
  /** Discount code shown after submit (e.g. "PIERWSZA10"). */
  discountCode: string;
  /** Brand color (CSS). */
  brandColor: string;
  /** Trigger after this many seconds on site (default 25). */
  triggerAfterSec?: number;
  /** Or trigger when user scrolls past this % (default 60). */
  triggerScrollPct?: number;
  /** Show once per this many days (default 7). */
  cooldownDays?: number;
}

export function buildLeadpopHtml(opts: LeadpopOptions): string {
  const cfg = {
    title: opts.title,
    body: opts.body,
    discountCode: opts.discountCode,
    brandColor: opts.brandColor,
    triggerAfterSec: opts.triggerAfterSec ?? 25,
    triggerScrollPct: opts.triggerScrollPct ?? 60,
    cooldownDays: opts.cooldownDays ?? 7,
  };
  const cfgJson = JSON.stringify(cfg);
  return `<div id="mm-leadpop"></div>
<style>
  #mm-leadpop { position: fixed; inset: 0; z-index: 9998; display: none; align-items: center; justify-content: center; background: rgba(0,0,0,0.55); padding: 16px; }
  #mm-leadpop.open { display: flex; }
  .mm-lp-card { background: white; border-radius: 18px; max-width: 440px; width: 100%; padding: 28px 24px; position: relative; box-shadow: 0 20px 60px rgba(0,0,0,0.3); animation: mm-lp-in .3s ease; }
  @keyframes mm-lp-in { from { opacity: 0; transform: scale(.95) translateY(8px); } to { opacity: 1; transform: scale(1); } }
  .mm-lp-close { position: absolute; top: 10px; right: 14px; background: none; border: none; font-size: 1.6rem; color: #94a3b8; cursor: pointer; line-height: 1; padding: 4px; }
  .mm-lp-emoji { font-size: 2.6rem; text-align: center; margin: 0; }
  .mm-lp-title { font-size: 1.4rem; font-weight: 800; margin: 12px 0 6px 0; text-align: center; color: #0f172a; }
  .mm-lp-body { color: #475569; text-align: center; margin: 0 0 18px 0; font-size: 0.95rem; }
  .mm-lp-form input { width: 100%; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 1rem; margin-bottom: 10px; box-sizing: border-box; }
  .mm-lp-form input:focus { border-color: var(--mm-lp-brand); outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--mm-lp-brand) 20%, transparent); }
  .mm-lp-form button { width: 100%; padding: 14px; background: var(--mm-lp-brand); color: white; border: none; border-radius: 10px; font-weight: 700; font-size: 1rem; cursor: pointer; }
  .mm-lp-form button:disabled { opacity: 0.6; cursor: not-allowed; }
  .mm-lp-success { text-align: center; padding: 8px 0; }
  .mm-lp-code { display: inline-block; background: #f1f5f9; padding: 12px 20px; border-radius: 12px; font-family: ui-monospace, "SF Mono", monospace; font-size: 1.5rem; font-weight: 700; color: #0f172a; margin: 12px 0; letter-spacing: 0.05em; border: 2px dashed var(--mm-lp-brand); }
  .mm-lp-privacy { font-size: 0.72rem; color: #94a3b8; text-align: center; margin-top: 12px; }
</style>
<script>
(function() {
  const cfg = ${cfgJson};
  const root = document.getElementById('mm-leadpop');
  if (!root) return;
  root.style.setProperty('--mm-lp-brand', cfg.brandColor);

  // Cooldown check
  const cookieKey = 'mm_lp_seen_at';
  const lastSeen = localStorage.getItem(cookieKey);
  if (lastSeen) {
    const days = (Date.now() - parseInt(lastSeen, 10)) / 86400000;
    if (days < cfg.cooldownDays) return; // still in cooldown
  }

  root.innerHTML = \`
    <div class="mm-lp-card" role="dialog" aria-labelledby="mm-lp-title">
      <button type="button" class="mm-lp-close" aria-label="Zamknij">×</button>
      <p class="mm-lp-emoji">🎁</p>
      <h2 id="mm-lp-title" class="mm-lp-title">\${cfg.title}</h2>
      <p class="mm-lp-body">\${cfg.body}</p>
      <form class="mm-lp-form" id="mm-lp-form" novalidate>
        <input type="email" name="email" placeholder="Twój email" required autocomplete="email">
        <input type="tel" name="phone" placeholder="Telefon (opcjonalnie)" autocomplete="tel">
        <button type="submit">Wyślij mi kod rabatowy</button>
      </form>
      <div class="mm-lp-privacy">Możesz wypisać się w każdej chwili. Nie spamujemy.</div>
    </div>
  \`;

  let opened = false;
  function open() {
    if (opened) return;
    opened = true;
    root.classList.add('open');
    localStorage.setItem(cookieKey, String(Date.now()));
  }
  function close() { root.classList.remove('open'); }

  // Auto-trigger after N seconds
  const tTimer = setTimeout(open, cfg.triggerAfterSec * 1000);

  // Scroll trigger
  function onScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (max <= 0) return;
    const pct = (window.scrollY / max) * 100;
    if (pct >= cfg.triggerScrollPct) {
      open();
      clearTimeout(tTimer);
      window.removeEventListener('scroll', onScroll);
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  // Exit intent (desktop only)
  function onMouseOut(e) {
    if (e.clientY <= 5 && !opened) {
      open();
      clearTimeout(tTimer);
      document.removeEventListener('mouseout', onMouseOut);
    }
  }
  if (window.innerWidth >= 768) document.addEventListener('mouseout', onMouseOut);

  // Close handlers
  root.querySelector('.mm-lp-close').addEventListener('click', close);
  root.addEventListener('click', (e) => { if (e.target === root) close(); });

  // Form submit
  document.getElementById('mm-lp-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const submit = form.querySelector('button');
    submit.disabled = true;
    submit.textContent = 'Wysyłam…';
    const email = form.email.value.trim();
    const phone = form.phone.value.trim();
    try {
      await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone, source: 'leadpop', message: 'Kod rabatowy — ' + cfg.discountCode }),
      });
    } catch (e) { /* swallow */ }
    form.parentElement.innerHTML = \`
      <p class="mm-lp-emoji">✅</p>
      <h2 class="mm-lp-title">Twój kod rabatowy:</h2>
      <div style="text-align:center;"><span class="mm-lp-code">\${cfg.discountCode}</span></div>
      <p class="mm-lp-body">Pokaż ten kod przy zamówieniu/wizycie. Również wysłaliśmy go na Twojego maila.</p>
      <button type="button" onclick="document.getElementById('mm-leadpop').classList.remove('open')" style="margin-top:12px;width:100%;padding:12px;background:transparent;border:1px solid #cbd5e1;border-radius:10px;cursor:pointer;color:#475569;">Zamknij</button>
    \`;
  });
})();
</script>`;
}

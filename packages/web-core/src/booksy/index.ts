/**
 * Booksy embed — sticky "Zarezerwuj wizytę" button + optional iframe modal.
 *
 * Activated by Starter pakiet (per Track 25 — Booksy embed jest w cenie!) OR
 * by one-time addon `booking_integration` (149-199 zł) for non-Booksy systems
 * (Calendly, Bookero).
 *
 * Toggles via env: BOOKSY_URL=https://booksy.com/pl-pl/12345_klient-name
 * Empty/missing → widget nie renderuje się.
 */

export interface BooksyOptions {
  /** Klient's Booksy profile URL (or Calendly/Bookero — any URL that opens a booking page). */
  bookingUrl: string;
  /** CTA label (default "Zarezerwuj wizytę"). */
  ctaLabel?: string;
  /** Brand color. */
  brandColor: string;
  /** Display mode: 'sticky' (button bottom-right) | 'modal' (button opens iframe) | 'both'. Default 'sticky'. */
  mode?: "sticky" | "modal" | "both";
}

export function buildBooksyHtml(opts: BooksyOptions): string {
  if (!opts.bookingUrl) return "";
  const cfg = {
    bookingUrl: opts.bookingUrl,
    ctaLabel: opts.ctaLabel ?? "Zarezerwuj wizytę",
    brandColor: opts.brandColor,
    mode: opts.mode ?? "sticky",
  };
  const cfgJson = JSON.stringify(cfg);

  return `<div id="mm-booksy"></div>
<style>
  #mm-booksy { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .mm-booksy-cta {
    position: fixed; bottom: 22px; right: 22px; z-index: 9988;
    background: var(--mm-booksy-brand);
    color: white !important;
    padding: 14px 22px;
    border-radius: 999px;
    text-decoration: none;
    font-weight: 700;
    font-size: 0.95rem;
    box-shadow: 0 8px 24px rgba(0,0,0,0.22);
    display: inline-flex; align-items: center; gap: 8px;
    border: none; cursor: pointer;
    transition: transform .2s, box-shadow .2s;
  }
  .mm-booksy-cta:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(0,0,0,0.28); }
  .mm-booksy-cta svg { width: 18px; height: 18px; }
  /* If chatbot widget is also present, stack booksy ABOVE chatbot */
  body:has(#mm-chat-root) .mm-booksy-cta { bottom: 96px; }

  .mm-booksy-modal { position: fixed; inset: 0; z-index: 9989; display: none; background: rgba(0,0,0,0.6); padding: 20px; }
  .mm-booksy-modal.open { display: flex; align-items: center; justify-content: center; }
  .mm-booksy-modal-card { background: white; border-radius: 14px; width: 100%; max-width: 760px; height: min(640px, 88vh); position: relative; overflow: hidden; }
  .mm-booksy-modal-close { position: absolute; top: 10px; right: 14px; background: white; border: none; font-size: 1.6rem; cursor: pointer; color: #64748b; line-height: 1; z-index: 1; border-radius: 50%; width: 32px; height: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
  .mm-booksy-modal-card iframe { width: 100%; height: 100%; border: 0; display: block; }

  @media (max-width: 480px) {
    .mm-booksy-cta { right: 12px; bottom: 12px; padding: 12px 16px; font-size: 0.85rem; }
    body:has(#mm-chat-root) .mm-booksy-cta { bottom: 80px; }
  }
</style>
<script>
(function() {
  const cfg = ${cfgJson};
  const root = document.getElementById('mm-booksy');
  if (!root) return;
  root.style.setProperty('--mm-booksy-brand', cfg.brandColor);

  const calendarIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';

  if (cfg.mode === 'sticky' || cfg.mode === 'both') {
    // Direct external link — opens Booksy in new tab
    const a = document.createElement('a');
    a.className = 'mm-booksy-cta';
    a.href = cfg.bookingUrl;
    a.target = '_blank';
    a.rel = 'noopener';
    a.innerHTML = calendarIcon + '<span>' + cfg.ctaLabel + '</span>';
    root.appendChild(a);
  }

  if (cfg.mode === 'modal' || cfg.mode === 'both') {
    // Modal mode: button opens iframe (works only if Booksy allows iframe embedding, which they sometimes block via X-Frame-Options)
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mm-booksy-cta';
    btn.innerHTML = calendarIcon + '<span>' + cfg.ctaLabel + '</span>';
    root.appendChild(btn);

    const modal = document.createElement('div');
    modal.className = 'mm-booksy-modal';
    modal.innerHTML = \`
      <div class="mm-booksy-modal-card">
        <button type="button" class="mm-booksy-modal-close" aria-label="Zamknij">×</button>
        <iframe src="\${cfg.bookingUrl}" title="Rezerwacja wizyty" loading="lazy"></iframe>
      </div>
    \`;
    document.body.appendChild(modal);

    btn.addEventListener('click', () => modal.classList.add('open'));
    modal.querySelector('.mm-booksy-modal-close').addEventListener('click', () => modal.classList.remove('open'));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });
  }
})();
</script>`;
}

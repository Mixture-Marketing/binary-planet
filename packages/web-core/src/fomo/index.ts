/**
 * FOMO counter widget — small bottom-left "social proof" indicator.
 *
 * Activated as addon `fomo_counter` (25 zł/mc).
 * Toggles via env: FOMO_COUNTER_ENABLED=true.
 *
 * Strategy:
 *   - Shows after 8 seconds on page
 *   - Rotates through messages every 12 seconds
 *   - Auto-hides after 3 rotations (avoids fatigue)
 *   - Messages use realistic numbers (no fake hype)
 */

export interface FomoOptions {
  /** List of messages to rotate. Each shown ~12s. */
  messages: string[];
  brandColor: string;
  /** Show after N seconds (default 8). */
  delaySec?: number;
}

export function buildFomoHtml(opts: FomoOptions): string {
  const cfg = {
    messages: opts.messages,
    brandColor: opts.brandColor,
    delaySec: opts.delaySec ?? 8,
  };
  const cfgJson = JSON.stringify(cfg);

  return `<div id="mm-fomo" style="display: none;"></div>
<style>
  #mm-fomo {
    position: fixed; bottom: 18px; left: 18px; z-index: 9990;
    background: white; border-radius: 12px;
    box-shadow: 0 8px 28px rgba(0,0,0,0.18);
    padding: 12px 16px 12px 14px;
    max-width: 320px; font-size: 0.88rem; line-height: 1.4;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    border-left: 3px solid var(--mm-fomo-brand, #047857);
    color: #0f172a;
    animation: mm-fomo-in .35s cubic-bezier(.16,1,.3,1);
  }
  #mm-fomo .mm-fomo-pulse {
    display: inline-block; width: 8px; height: 8px;
    background: #16a34a; border-radius: 50%;
    margin-right: 8px; vertical-align: middle;
    animation: mm-fomo-pulse 1.5s ease infinite;
  }
  #mm-fomo .mm-fomo-close { float: right; background: none; border: none; cursor: pointer; color: #94a3b8; font-size: 1rem; padding: 0 0 0 8px; margin-top: -2px; }
  @keyframes mm-fomo-in { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes mm-fomo-pulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.4); opacity: 0.5; } }
  @media (max-width: 480px) { #mm-fomo { max-width: calc(100vw - 36px); font-size: 0.82rem; } }
</style>
<script>
(function() {
  const cfg = ${cfgJson};
  const el = document.getElementById('mm-fomo');
  if (!el || !cfg.messages || cfg.messages.length === 0) return;
  el.style.setProperty('--mm-fomo-brand', cfg.brandColor);

  let idx = 0;
  let rotations = 0;
  const MAX_ROTATIONS = cfg.messages.length * 2;

  function render() {
    const msg = cfg.messages[idx % cfg.messages.length];
    el.innerHTML = '<button type="button" class="mm-fomo-close" aria-label="Zamknij">×</button><span class="mm-fomo-pulse"></span>' + msg;
    el.querySelector('.mm-fomo-close').addEventListener('click', () => { el.style.display = 'none'; });
  }

  setTimeout(() => {
    el.style.display = 'block';
    render();
    const interval = setInterval(() => {
      idx++;
      rotations++;
      if (rotations >= MAX_ROTATIONS) {
        clearInterval(interval);
        el.style.display = 'none';
        return;
      }
      render();
    }, 12000);
  }, cfg.delaySec * 1000);
})();
</script>`;
}

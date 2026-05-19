/**
 * Wolt/Glovo/Pyszne delivery widget.
 *
 * Activated as one-time addon `wolt_glovo` (199 zł 1×).
 * Toggle via env: DELIVERY_URL=https://wolt.com/pl/poland/warsaw/restaurant/u-marka
 *                  DELIVERY_PROVIDER=wolt|glovo|pyszne (optional, for branding)
 *
 * Renders sticky "Zamów online" button. On click opens delivery page in new tab.
 * Restaurants/cafes konkretnie tego potrzebują.
 */

export interface DeliveryOptions {
  deliveryUrl: string;
  ctaLabel?: string;
  brandColor: string;
  provider?: "wolt" | "glovo" | "pyszne" | "uber_eats" | "generic";
}

const PROVIDER_COLORS: Record<string, string> = {
  wolt: "#009DE0",
  glovo: "#FFC244",
  pyszne: "#FA8072",
  uber_eats: "#06C167",
};

export function buildDeliveryHtml(opts: DeliveryOptions): string {
  if (!opts.deliveryUrl) return "";
  const cfg = {
    deliveryUrl: opts.deliveryUrl,
    ctaLabel: opts.ctaLabel ?? "Zamów online",
    brandColor: opts.brandColor,
    providerColor: opts.provider ? (PROVIDER_COLORS[opts.provider] ?? opts.brandColor) : opts.brandColor,
    provider: opts.provider ?? "generic",
  };
  const cfgJson = JSON.stringify(cfg);

  return `<div id="mm-delivery"></div>
<style>
  .mm-delivery-cta {
    position: fixed; bottom: 22px; left: 22px; z-index: 9987;
    background: var(--mm-delivery-color);
    color: white !important;
    padding: 14px 22px;
    border-radius: 999px;
    text-decoration: none;
    font-weight: 700;
    font-size: 0.95rem;
    box-shadow: 0 8px 24px rgba(0,0,0,0.22);
    display: inline-flex; align-items: center; gap: 8px;
    border: none; cursor: pointer;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    transition: transform .2s, box-shadow .2s;
  }
  .mm-delivery-cta:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(0,0,0,0.28); }
  .mm-delivery-cta svg { width: 18px; height: 18px; }
  @media (max-width: 480px) {
    .mm-delivery-cta { left: 12px; bottom: 12px; padding: 12px 16px; font-size: 0.85rem; }
  }
</style>
<script>
(function() {
  const cfg = ${cfgJson};
  const root = document.getElementById('mm-delivery');
  if (!root) return;
  root.style.setProperty('--mm-delivery-color', cfg.providerColor);
  const cartIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>';
  const a = document.createElement('a');
  a.className = 'mm-delivery-cta';
  a.href = cfg.deliveryUrl;
  a.target = '_blank';
  a.rel = 'noopener';
  a.innerHTML = cartIcon + '<span>' + cfg.ctaLabel + '</span>';
  root.appendChild(a);
})();
</script>`;
}

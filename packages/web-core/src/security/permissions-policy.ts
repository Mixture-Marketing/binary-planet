/**
 * Permissions-Policy header builder.
 *
 * Modern replacement for Feature-Policy. Controls browser features per origin.
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy
 *
 * Default policy for LocalBusiness sites: disable everything not needed.
 * (Locksmith site doesn't need camera/microphone/geolocation/payment.)
 *
 * Override per-feature with origin allowlist or "self"/"*"/"()" sentinels.
 */

export const KNOWN_FEATURES = [
  "accelerometer",
  "ambient-light-sensor",
  "autoplay",
  "battery",
  "camera",
  "clipboard-read",
  "clipboard-write",
  "cross-origin-isolated",
  "display-capture",
  "encrypted-media",
  "fullscreen",
  "geolocation",
  "gyroscope",
  "hid",
  "idle-detection",
  "interest-cohort", // FLoC — explicitly opt out
  "keyboard-map",
  "magnetometer",
  "microphone",
  "midi",
  "navigation-override",
  "payment",
  "picture-in-picture",
  "publickey-credentials-get",
  "screen-wake-lock",
  "serial",
  "sync-xhr",
  "usb",
  "web-share",
  "xr-spatial-tracking",
] as const;

export type PermissionsFeature = (typeof KNOWN_FEATURES)[number];

/**
 * Allow list per feature:
 *  - 'none'  → "()"           (deny everywhere)
 *  - 'self'  → "(self)"
 *  - '*'     → "*"            (allow everywhere — almost never use)
 *  - string[] → "(self \"https://x.pl\")" — explicit origin allowlist
 */
export type FeatureAllow = "none" | "self" | "*" | readonly string[];

export type PermissionsPolicyInput = Partial<Record<PermissionsFeature, FeatureAllow>>;

/**
 * Default LocalBusiness policy: deny everything not actively used.
 * Sites that need a feature override per-deploy.
 */
export const DEFAULT_DENY_ALL: PermissionsPolicyInput = {
  accelerometer: "none",
  "ambient-light-sensor": "none",
  autoplay: "none",
  battery: "none",
  camera: "none",
  "clipboard-read": "none",
  "clipboard-write": "self", // tolerated — "copy phone number" UX
  "cross-origin-isolated": "none",
  "display-capture": "none",
  "encrypted-media": "none",
  fullscreen: "self", // image galleries
  geolocation: "none", // location selected from list, never auto-detect
  gyroscope: "none",
  hid: "none",
  "idle-detection": "none",
  "interest-cohort": "none", // FLoC opt-out
  "keyboard-map": "none",
  magnetometer: "none",
  microphone: "none",
  midi: "none",
  "navigation-override": "none",
  payment: "none", // payments happen on Stripe/P24 redirect, not on klient site
  "picture-in-picture": "none",
  "publickey-credentials-get": "none",
  "screen-wake-lock": "none",
  serial: "none",
  "sync-xhr": "none", // deprecated anyway
  usb: "none",
  "web-share": "self",
  "xr-spatial-tracking": "none",
};

/**
 * Build Permissions-Policy header value.
 * Returns comma-separated directives, e.g. "camera=(), geolocation=()".
 */
export function buildPermissionsPolicy(input: PermissionsPolicyInput = DEFAULT_DENY_ALL): string {
  const parts: string[] = [];
  for (const feature of Object.keys(input) as PermissionsFeature[]) {
    const allow = input[feature];
    if (allow === undefined) continue;
    parts.push(`${feature}=${renderAllow(allow)}`);
  }
  return parts.join(", ");
}

function renderAllow(allow: FeatureAllow): string {
  if (allow === "none") return "()";
  if (allow === "*") return "*";
  if (allow === "self") return "(self)";
  // origin list
  const quoted = allow.map((origin) => {
    if (origin === "self") return "self";
    return `"${origin}"`;
  });
  return `(${quoted.join(" ")})`;
}

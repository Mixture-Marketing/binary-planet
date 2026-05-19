#!/usr/bin/env node
/**
 * Verify Stripe credentials + tier price IDs locally.
 *
 * Reads STRIPE_SECRET_KEY + STRIPE_PRICE_STARTER/STANDARD/PREMIUM from env.
 * Run:
 *   node --env-file=.dev.vars scripts/verify-stripe.mjs
 */

const SECRET = process.env["STRIPE_SECRET_KEY"];
const PRICES = {
  starter: process.env["STRIPE_PRICE_STARTER"],
  standard: process.env["STRIPE_PRICE_STANDARD"],
  premium: process.env["STRIPE_PRICE_PREMIUM"],
};
const WEBHOOK_SECRET = process.env["STRIPE_WEBHOOK_SECRET"];

if (!SECRET) {
  console.error("Missing STRIPE_SECRET_KEY in env / .dev.vars");
  process.exit(1);
}

async function stripeGet(path) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${SECRET}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

async function step(label, fn, hint) {
  process.stdout.write(`  ${label} ... `);
  try {
    const out = await fn();
    console.log(`OK ${out ? `(${out})` : ""}`);
    return true;
  } catch (e) {
    console.log("FAIL");
    console.log(`    error: ${e.message}`);
    if (hint) console.log(`    hint:  ${hint}`);
    return false;
  }
}

const isLive = SECRET.startsWith("sk_live_");
const mode = isLive ? "LIVE (real money!)" : "TEST";
console.log(`Stripe credentials check — mode ${mode}`);
console.log("");

let ok = true;
ok &&= await step("GET /v1/account (key auth)", async () => {
  const a = await stripeGet("/account");
  return `${a.id} · ${a.country} · ${a.business_profile?.name ?? "no name"}`;
});

ok &&= await step("Account onboarding complete", async () => {
  const a = await stripeGet("/account");
  if (!a.charges_enabled) throw new Error("charges_enabled=false (finish Stripe onboarding)");
  if (!a.details_submitted) throw new Error("details_submitted=false");
  return "charges enabled";
});

for (const [tier, priceId] of Object.entries(PRICES)) {
  if (!priceId) {
    console.log(`  STRIPE_PRICE_${tier.toUpperCase()} ... SKIP (not set)`);
    continue;
  }
  ok &&= await step(`Price ${tier} (${priceId})`, async () => {
    const p = await stripeGet(`/prices/${priceId}`);
    if (!p.active) throw new Error("price not active");
    if (p.recurring?.interval !== "month") throw new Error(`expected monthly recurring, got ${p.recurring?.interval ?? "one_time"}`);
    return `${(p.unit_amount / 100).toFixed(2)} ${p.currency.toUpperCase()}/mc`;
  }, `Create the price in Stripe dashboard → Products → New product → Recurring monthly`);
}

if (!WEBHOOK_SECRET) {
  console.log(`  STRIPE_WEBHOOK_SECRET ... SKIP (not set — webhooks won't verify)`);
} else if (!WEBHOOK_SECRET.startsWith("whsec_")) {
  console.log(`  STRIPE_WEBHOOK_SECRET ... FAIL (must start with "whsec_")`);
  ok = false;
} else {
  console.log(`  STRIPE_WEBHOOK_SECRET ... OK (format whsec_…)`);
}

console.log("");
console.log(ok ? "ALL CHECKS PASSED" : "ONE OR MORE CHECKS FAILED");
process.exit(ok ? 0 : 1);

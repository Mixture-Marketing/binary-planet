#!/usr/bin/env node
/**
 * Verify Fakturownia.pl credentials locally.
 *
 * Reads FAKTUROWNIA_LOGIN + FAKTUROWNIA_API_TOKEN from env.
 * Run: node --env-file=.dev.vars scripts/verify-fakturownia.mjs
 */

const LOGIN = process.env["FAKTUROWNIA_LOGIN"];
const TOKEN = process.env["FAKTUROWNIA_API_TOKEN"];

if (!LOGIN || !TOKEN) {
  console.error("Missing FAKTUROWNIA_LOGIN or FAKTUROWNIA_API_TOKEN in env / .dev.vars");
  console.error("Get your token: https://{login}.fakturownia.pl → Ustawienia → Integracje → API");
  process.exit(1);
}

const BASE = `https://${LOGIN}.fakturownia.pl`;

async function get(path) {
  const url = `${BASE}${path}${path.includes("?") ? "&" : "?"}api_token=${encodeURIComponent(TOKEN)}`;
  const res = await fetch(url);
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

console.log(`Fakturownia credentials check — ${BASE}`);
console.log("");

let ok = true;

ok &&= await step("GET /account.json", async () => {
  const a = await get("/account.json");
  return `${a.name ?? a.login ?? "account"}${a.id ? ` (id=${a.id})` : ""}`;
}, "If 401: token wrong / revoked. Generate new in Ustawienia → Integracje → API");

ok &&= await step("GET /invoices.json?per_page=1 (read scope)", async () => {
  const inv = await get("/invoices.json?per_page=1");
  const count = Array.isArray(inv) ? inv.length : 0;
  return `${count} invoice(s) visible`;
}, "Token needs read scope for invoices");

ok &&= await step("POST /invoices.json (sandbox draft)", async () => {
  const url = `${BASE}/invoices.json?api_token=${encodeURIComponent(TOKEN)}`;
  const body = {
    api_token: TOKEN,
    invoice: {
      kind: "vat",
      buyer_name: "VERIFY-SCRIPT — Test Buyer",
      buyer_tax_no: "0000000000",
      payment_to: new Date().toISOString().slice(0, 10),
      issue_date: new Date().toISOString().slice(0, 10),
      status: "draft", // try to keep it as draft, won't always work — we delete after
      positions: [{ name: "TEST verify-fakturownia.mjs", quantity: 1, tax: 23, total_price_gross: "1.23" }],
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 200)}`);
  const inv = JSON.parse(text);
  // Try to delete the sandbox invoice
  const del = await fetch(`${BASE}/invoices/${inv.id}.json?api_token=${encodeURIComponent(TOKEN)}`, {
    method: "DELETE",
  });
  return `created id=${inv.id} number=${inv.number}${del.ok ? " (cleaned up)" : " (NOT cleaned up — manual delete)"}`;
}, "Token needs write scope. NOTE: if 422 errors about VAT/NIP fields, your account isn't configured for VAT invoices yet — finish onboarding in Fakturownia UI.");

console.log("");
console.log(ok ? "ALL CHECKS PASSED" : "ONE OR MORE CHECKS FAILED");
process.exit(ok ? 0 : 1);

#!/usr/bin/env node
/**
 * Verify OVH API credentials locally.
 *
 * Reads OVH_APP_KEY, OVH_APP_SECRET, OVH_CONSUMER_KEY, OVH_ENDPOINT from env.
 * If you keep them in apps/control-plane/.dev.vars, run with:
 *
 *   node --env-file=.dev.vars scripts/verify-ovh.mjs           (Node 20.6+)
 *   # or:
 *   pnpm dlx dotenv-cli -e .dev.vars -- node scripts/verify-ovh.mjs
 *
 * What it does:
 *   1. GET /auth/time            (no auth — confirms reachability)
 *   2. GET /me                    (signed — proves AK/AS/CK match)
 *   3. GET /domain/zone           (signed — proves DNS scope granted)
 *   4. GET /domain                (signed — proves /domain/* GET works)
 *   5. POST /order/cart  + cleanup (signed — proves /order/cart POST works)
 *
 * If any step fails, message tells you which OVH access rule is missing.
 */
import { createHash } from "node:crypto";

const AK = process.env["OVH_APP_KEY"];
const AS = process.env["OVH_APP_SECRET"];
const CK = process.env["OVH_CONSUMER_KEY"];
const ENDPOINT = process.env["OVH_ENDPOINT"] ?? "ovh-eu";

const BASES = {
  "ovh-eu": "https://eu.api.ovh.com/1.0",
  "ovh-us": "https://api.us.ovhcloud.com/1.0",
  "ovh-ca": "https://ca.api.ovh.com/1.0",
};
const BASE = BASES[ENDPOINT] ?? BASES["ovh-eu"];

if (!AK || !AS || !CK) {
  console.error("Missing OVH credentials. Set OVH_APP_KEY, OVH_APP_SECRET, OVH_CONSUMER_KEY.");
  process.exit(1);
}

function sha1Hex(input) {
  return createHash("sha1").update(input).digest("hex");
}

async function getServerTime() {
  const res = await fetch(`${BASE}/auth/time`);
  if (!res.ok) throw new Error(`auth/time ${res.status}`);
  return Number(await res.text());
}

async function signedRequest(method, path, body = "") {
  const ts = await getServerTime();
  const url = `${BASE}${path}`;
  const bodyStr = body && typeof body !== "string" ? JSON.stringify(body) : (body || "");
  const sig = `$1$${sha1Hex([AS, CK, method, url, bodyStr, String(ts)].join("+"))}`;
  const headers = {
    "X-Ovh-Application": AK,
    "X-Ovh-Consumer": CK,
    "X-Ovh-Timestamp": String(ts),
    "X-Ovh-Signature": sig,
  };
  if (bodyStr) headers["Content-Type"] = "application/json";
  return fetch(url, { method, headers, ...(bodyStr ? { body: bodyStr } : {}) });
}

async function step(label, fn, hint) {
  process.stdout.write(`  ${label} ... `);
  try {
    const out = await fn();
    console.log(`OK ${out ? `(${out})` : ""}`);
    return true;
  } catch (e) {
    console.log(`FAIL`);
    console.log(`    error: ${e.message}`);
    if (hint) console.log(`    hint:  ${hint}`);
    return false;
  }
}

console.log(`OVH credentials check — endpoint ${ENDPOINT} (${BASE})`);
console.log("");

let ok = true;
ok &&= await step("/auth/time reachable", async () => {
  const t = await getServerTime();
  return `server epoch ${t}`;
});

ok &&= await step("GET /me", async () => {
  const r = await signedRequest("GET", "/me");
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return `nichandle=${j.nichandle}`;
}, "Access rule needed: GET /me");

ok &&= await step("GET /domain/zone", async () => {
  const r = await signedRequest("GET", "/domain/zone");
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return `${Array.isArray(j) ? j.length : 0} zones`;
}, "Access rule needed: GET /domain/zone");

ok &&= await step("GET /domain", async () => {
  const r = await signedRequest("GET", "/domain");
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return `${Array.isArray(j) ? j.length : 0} domains`;
}, "Access rule needed: GET /domain");

ok &&= await step("POST /order/cart (sandbox, then delete)", async () => {
  const create = await signedRequest("POST", "/order/cart", { ovhSubsidiary: "PL", description: "credential-check" });
  if (!create.ok) throw new Error(`create ${create.status} ${(await create.text()).slice(0, 200)}`);
  const cart = await create.json();
  // Try to delete the cart (cleanup). If it fails we don't fail the whole step.
  const del = await signedRequest("DELETE", `/order/cart/${cart.cartId}`);
  return `cartId=${cart.cartId}${del.ok ? " (cleaned up)" : " (NOT cleaned up — DELETE /order/cart/* not granted)"}`;
}, "Access rule needed: POST /order/cart");

console.log("");
console.log(ok ? "ALL CHECKS PASSED" : "ONE OR MORE CHECKS FAILED — see error messages above.");
process.exit(ok ? 0 : 1);

#!/usr/bin/env node
/**
 * Verify Anthropic API key works.
 *
 * Reads ANTHROPIC_API_KEY from env. Calls minimal claude-haiku with cost estimate.
 * Run: node --env-file=.dev.vars scripts/verify-anthropic.mjs
 */

const KEY = process.env["ANTHROPIC_API_KEY"];

if (!KEY) {
  console.error("Missing ANTHROPIC_API_KEY in env / .dev.vars");
  console.error("Get key: https://console.anthropic.com/settings/keys");
  process.exit(1);
}

async function step(label, fn) {
  process.stdout.write(`  ${label} ... `);
  try {
    const out = await fn();
    console.log(`OK ${out ? `(${out})` : ""}`);
    return true;
  } catch (e) {
    console.log("FAIL");
    console.log(`    error: ${e.message}`);
    return false;
  }
}

console.log("Anthropic API check");
console.log("");

let ok = true;

ok &&= await step("POST /v1/messages (haiku — minimal ping)", async () => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 50,
      messages: [{ role: "user", content: "Powiedz \"PING\" i nic więcej." }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  const text = json.content?.[0]?.text ?? "";
  const usage = json.usage ?? {};
  return `model=${json.model} · in=${usage.input_tokens}t out=${usage.output_tokens}t · "${text.slice(0, 40)}"`;
});

ok &&= await step("Sonnet 4.6 reachable", async () => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 30,
      messages: [{ role: "user", content: "ping" }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  return `usage in=${json.usage?.input_tokens}t out=${json.usage?.output_tokens}t`;
});

console.log("");
console.log(ok ? "ALL CHECKS PASSED" : "ONE OR MORE CHECKS FAILED");
process.exit(ok ? 0 : 1);

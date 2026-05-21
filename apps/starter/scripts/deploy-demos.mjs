#!/usr/bin/env node
/**
 * Deploy 4 demo Workers (one per theme preset).
 *
 * Each demo gets:
 *   - own client.config.ts from demo-fixtures/{theme}.config.ts
 *   - own Worker name (demo-{theme})
 *   - own custom domain (demo-{theme}.mixturemarketing.pl)
 *
 * Usage:
 *   pnpm --filter mm-starter run deploy:demos
 *
 * Or filter to a subset:
 *   pnpm --filter mm-starter run deploy:demos minimalist editorial
 *
 * Required env:
 *   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
 */
import { execSync } from "node:child_process";
import { copyFileSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(__dirname, "..");
const CONFIG_TARGET = resolve(APP_ROOT, "src/client.config.ts");
const CONFIG_BACKUP = resolve(APP_ROOT, "src/client.config.ts.original");
const WRANGLER_PATH = resolve(APP_ROOT, "wrangler.jsonc");

const ALL_THEMES = ["minimalist", "elegant", "dynamic", "editorial"];
const requested = process.argv.slice(2);
const themes = requested.length > 0
  ? requested.filter((t) => ALL_THEMES.includes(t))
  : ALL_THEMES;

if (themes.length === 0) {
  console.error(`No valid themes. Available: ${ALL_THEMES.join(", ")}`);
  process.exit(1);
}

if (!process.env["CLOUDFLARE_API_TOKEN"]) {
  console.error("Missing CLOUDFLARE_API_TOKEN env var");
  process.exit(1);
}

console.log(`Deploying ${themes.length} demo(s): ${themes.join(", ")}`);

// Backup original client.config.ts so we can restore even on failure
if (!existsSync(CONFIG_BACKUP)) {
  copyFileSync(CONFIG_TARGET, CONFIG_BACKUP);
  console.log(`Backed up original config → ${CONFIG_BACKUP}`);
}

const originalWrangler = readFileSync(WRANGLER_PATH, "utf-8");

let failures = 0;
for (const theme of themes) {
  console.log(`\n=== Deploying demo-${theme} ===`);
  const demoConfig = resolve(APP_ROOT, `demo-fixtures/${theme}.config.ts`);
  if (!existsSync(demoConfig)) {
    console.error(`Missing ${demoConfig} — skipping`);
    failures += 1;
    continue;
  }

  // Swap config + wrangler name
  copyFileSync(demoConfig, CONFIG_TARGET);
  const wranglerDemo = originalWrangler.replace(
    /"name":\s*"mm-client-template"/,
    `"name": "demo-${theme}"`,
  );
  writeFileSync(WRANGLER_PATH, wranglerDemo);

  try {
    execSync(`pnpm exec astro build`, { cwd: APP_ROOT, stdio: "inherit" });
    execSync(
      `pnpm exec wrangler deploy --name demo-${theme}`,
      { cwd: APP_ROOT, stdio: "inherit" },
    );
    console.log(`✓ demo-${theme} deployed`);
  } catch (e) {
    console.error(`✗ demo-${theme} failed: ${e.message}`);
    failures += 1;
  }
}

// Restore original config + wrangler
copyFileSync(CONFIG_BACKUP, CONFIG_TARGET);
writeFileSync(WRANGLER_PATH, originalWrangler);
console.log(`\nRestored original client.config.ts + wrangler.jsonc`);

if (failures > 0) {
  console.error(`\n${failures}/${themes.length} demo deploys failed`);
  process.exit(1);
}
console.log(`\nAll ${themes.length} demo(s) deployed successfully`);

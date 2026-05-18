// Quick migration validator — runs all .sql files against in-memory sqlite.
// Usage: node --experimental-sqlite apps/control-plane/migrations/.validate.mjs
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readdirSync(__dirname).filter((f) => f.endsWith(".sql")).sort();

console.log(`Validating ${files.length} migration files in ${__dirname}\n`);

const db = new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys = ON");

let allOk = true;
for (const file of files) {
  const sql = fs.readFileSync(path.join(__dirname, file), "utf-8");
  try {
    db.exec(sql);
    console.log(`  OK    ${file}`);
  } catch (err) {
    console.log(`  FAIL  ${file}`);
    console.log(`        ${err.message}`);
    allOk = false;
  }
}
console.log();

if (!allOk) {
  process.exit(1);
}

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all();
const indexes = db
  .prepare("SELECT count(*) AS c FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'")
  .get();
const triggers = db.prepare("SELECT count(*) AS c FROM sqlite_master WHERE type='trigger'").get();

console.log(`Tables (${tables.length}):`);
for (const t of tables) console.log(`  - ${t.name}`);
console.log();
console.log(`Indexes: ${indexes.c}`);
console.log(`Triggers: ${triggers.c}`);

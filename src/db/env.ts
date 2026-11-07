import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// The Next.js runtime loads .env/.env.local on its own, but the scripts that
// talk to the database (migrate, seed) run on plain node, so they read the
// same files here. .env.local wins over .env, and a variable already present
// in the environment always wins over both.
const ENV_FILES = [".env.local", ".env"];

function parseEnvFile(content: string): void {
  for (const line of content.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1];
    if (process.env[key] !== undefined) continue;
    const value = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
    process.env[key] = value;
  }
}

export function loadEnvFiles(): void {
  for (const name of ENV_FILES) {
    const path = resolve(process.cwd(), name);
    if (existsSync(path)) {
      parseEnvFile(readFileSync(path, "utf8"));
    }
  }
}

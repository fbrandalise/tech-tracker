/**
 * Minimal .env loader (no dependencies).
 * Loads KEY=VALUE pairs from the project root .env without overriding existing env vars.
 */
const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '../.env');

if (fs.existsSync(ENV_PATH)) {
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || line.trim().startsWith('#')) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
    if (process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
}

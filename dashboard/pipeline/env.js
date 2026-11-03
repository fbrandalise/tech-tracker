'use strict';
const fs = require('fs');
const path = require('path');

// .env local (opcional): procura na pasta do painel e na raiz do repositório; variáveis já definidas no ambiente vencem
function loadEnvFile() {
  for (const dir of [path.join(__dirname, '..'), path.join(__dirname, '..', '..')]) {
    const f = path.join(dir, '.env');
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

module.exports = { loadEnvFile };

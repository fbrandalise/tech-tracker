'use strict';
// Reavalia as respostas guardadas em results/llm-<nome>.json com o corretor atual (tasks.js), para toda execução, dos dois servidores.
// Uso: node mcp/bench/regrade.js [nome=nothink]   Mostra o que mudou e grava (mantém o veredito original em `correctOriginal`).
const fs = require('fs');
const path = require('path');
const { TASKS, grade } = require('./tasks');

const file = path.join(__dirname, 'results', `llm-${process.argv[2] || 'nothink'}.json`);
const d = JSON.parse(fs.readFileSync(file, 'utf8'));
const truth = Object.fromEntries(TASKS.map((t) => [t.id, t.truth()]));
let changed = 0;
for (const r of d.runs) {
  const g = grade(r.answer, truth[r.task]);
  if (r.correctOriginal === undefined) r.correctOriginal = r.correct;
  if (g.ok !== r.correct) { changed++; console.log(`${r.task} ${r.kind} #${r.trial}: ${r.correct ? 'certo' : 'errado'} -> ${g.ok ? 'certo' : 'errado'}`); }
  Object.assign(r, { correct: g.ok, missing: g.missing, forbidden: g.forbidden });
}
fs.writeFileSync(file, JSON.stringify(d, null, 2));
console.log(`${changed} veredito(s) alterado(s) de ${d.runs.length}`);

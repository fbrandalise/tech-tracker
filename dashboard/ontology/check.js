'use strict';
/*
 * Confere se a ontologia ainda bate com o banco: roda cada SQL de exemplo e verifica se as colunas citadas existem nas views.
 * Uso: node ontology/check.js [pasta_de_dados]   (padrão: data/cache; DB_PATH sobrescreve)
 * Abrir o banco aplica as migrações pendentes (é o mesmo que acontece ao subir o servidor).
 */
const fs = require('fs');
const path = require('path');
const store = require('../pipeline/db');

const dir = path.resolve(process.argv[2] || path.join(__dirname, '..', 'data', 'cache'));
const db = store.open(process.env.DB_PATH || path.join(dir, 'earnings.db'));
const text = fs.readFileSync(path.join(__dirname, 'earnings.yaml'), 'utf8');
let bad = 0;
const fail = (msg) => { bad++; console.log('FALHA', msg); };

// colunas das views
const cols = new Set();
for (const v of ['v_company', 'v_quarter', 'v_ttm', 'v_latest', 'v_segment']) for (const c of db.prepare(`PRAGMA table_info(${v})`).all()) cols.add(c.name);

// exemplos: bloco "question:" seguido de "sql: |" com linhas indentadas
const examples = [...text.matchAll(/- question: "(.+?)"\n\s+sql: \|\n((?:\s{6}.*\n?)+)/g)].map((m) => ({ q: m[1], sql: m[2].replace(/^\s{6}/gm, '').trim() }));
if (!examples.length) fail('nenhum exemplo encontrado no YAML (formato mudou?)');
for (const e of examples) {
  try {
    const rows = db.prepare(e.sql).all();
    console.log(rows.length ? 'ok   ' : 'vazio', `${String(rows.length).padStart(2)} linhas  ${e.q}`);
    if (!rows.length) bad++;
  } catch (err) { fail(`${e.q}\n       ${err.message}`); }
}

// colunas citadas em "columns: [a, b]"
for (const m of text.matchAll(/columns: \[(.+?)\]/g)) for (const c of m[1].split(',').map((s) => s.trim())) if (!cols.has(c)) fail(`coluna "${c}" citada na ontologia não existe em nenhuma view`);

// toda coluna das views precisa aparecer no YAML (sem isso o dicionário envelhece em silêncio)
for (const c of [...cols].sort()) if (!new RegExp(`\\b${c}\\b`).test(text)) fail(`coluna "${c}" das views não está documentada na ontologia`);

db.close();
console.log(bad ? `\n${bad} problema(s)` : `\nOntologia ok: ${examples.length} exemplos, ${cols.size} colunas nas views`);
process.exit(bad ? 1 : 0);

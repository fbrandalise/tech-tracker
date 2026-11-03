'use strict';
/*
 * Gera as tabelas em Markdown a partir de results/llm-<nome>.json (e results/security-*.json).
 * Uso: node mcp/bench/report.js [nome=nothink]      (imprime e grava results/report-<nome>.md)
 */
const fs = require('fs');
const path = require('path');

const name = process.argv[2] || 'nothink';
const dir = path.join(__dirname, 'results');
const data = JSON.parse(fs.readFileSync(path.join(dir, `llm-${name}.json`), 'utf8'));
const LABEL = { traditional: 'Tradicional', 'code-exec': 'Code exec', 'traditional-nosql': 'Tradicional sem SQL', 'code-exec-nosql': 'Code exec sem SQL' };
const KINDS = [...new Set(data.runs.map((r) => r.kind))];

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const fmt = (n, d = 0) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (a, b) => (b ? `${fmt((a / b) * 100)}%` : '-');
const ratio = (a, b) => (b ? `${fmt(a / b, 1)}×` : '-');

const runs = data.runs;
const by = (f) => KINDS.map((k) => runs.filter((r) => r.kind === k && f(r)));
const stats = (rs) => ({
  n: rs.length, ok: rs.filter((r) => r.correct).length, steps: mean(rs.map((r) => r.steps)), calls: mean(rs.map((r) => r.toolCalls)), errs: mean(rs.map((r) => r.toolErrors || 0)),
  input: mean(rs.map((r) => r.inputTokens)), newInput: mean(rs.map((r) => r.newInputTokens)), output: mean(rs.map((r) => r.outputTokens)),
  peak: mean(rs.map((r) => r.peakContext)), result: mean(rs.map((r) => r.toolResultBytes)), s: mean(rs.map((r) => r.ms / 1000)),
});

const out = [];
const p = (s = '') => out.push(s);

p(`# Resultados — ${name}`);
p();
p(`Modelo: \`${data.llm.model}\` (llama-server, temperatura ${data.llm.temperature}, thinking ${data.llm.thinking ? 'ligado' : 'desligado'}). Isolamento do sandbox: \`${data.isolation}\`. ${data.trials} tentativa(s) por tarefa e servidor, ${runs.length} execuções. Gerado em ${data.date}.`);
p();
p('## 1. Custo fixo: definições de ferramentas no contexto');
p();
p('| | Ferramentas | Bytes | Tokens (medidos) |');
p('|---|---:|---:|---:|');
for (const k of KINDS) p(`| ${LABEL[k]} | ${data.defs[k].tools} | ${fmt(data.defs[k].bytes)} | ${fmt(data.defs[k].tokens)} |`);
p();

p('## 2. Visão geral (média por execução)');
p();
const [T, C] = by(() => true).map(stats);
p(`| Métrica | ${LABEL[KINDS[0]]} | ${LABEL[KINDS[1]]} | ${LABEL[KINDS[1]]} ÷ ${LABEL[KINDS[0]]} |`);
p('|---|---:|---:|---:|');
p(`| Acertos | ${T.ok}/${T.n} (${pct(T.ok, T.n)}) | ${C.ok}/${C.n} (${pct(C.ok, C.n)}) | |`);
for (const [label, key, d] of [['Passos (turnos do modelo)', 'steps', 1], ['Chamadas de ferramenta MCP', 'calls', 1], ['Erros de ferramenta', 'errs', 1], ['Tokens de entrada (soma dos passos)', 'input', 0], ['Tokens de entrada novos (com cache de prefixo)', 'newInput', 0], ['Tokens de saída', 'output', 0], ['Pico de contexto (tokens)', 'peak', 0], ['Bytes de resultado de ferramenta no contexto', 'result', 0], ['Tempo (s)', 's', 1]]) {
  p(`| ${label} | ${fmt(T[key], d)} | ${fmt(C[key], d)} | ${ratio(C[key], T[key])} |`);
}
p();

p('## 3. Por tarefa');
p();
p('| Tarefa | Volume | Servidor | Acertos | Passos | Chamadas | Entrada | Saída | Pico ctx | Resultado no ctx (B) | Tempo (s) |');
p('|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|');
const taskIds = [...new Set(runs.map((r) => r.task))];
for (const id of taskIds) {
  const vol = runs.find((r) => r.task === id).volume;
  for (const k of KINDS) {
    const s = stats(runs.filter((r) => r.task === id && r.kind === k));
    p(`| ${k === KINDS[0] ? `\`${id}\`` : ''} | ${k === KINDS[0] ? vol : ''} | ${LABEL[k]} | ${s.ok}/${s.n} | ${fmt(s.steps, 1)} | ${fmt(s.calls, 1)} | ${fmt(s.input)} | ${fmt(s.output)} | ${fmt(s.peak)} | ${fmt(s.result)} | ${fmt(s.s, 0)} |`);
  }
}
p();

p('## 4. Por volume de dados da tarefa');
p();
p('| Volume | Servidor | Acertos | Passos | Entrada (tokens) | Saída (tokens) | Pico ctx | Tempo (s) |');
p('|---|---|---:|---:|---:|---:|---:|---:|');
for (const v of ['pequeno', 'médio', 'grande']) {
  for (const k of KINDS) {
    const s = stats(runs.filter((r) => r.volume === v && r.kind === k));
    if (s.n) p(`| ${k === KINDS[0] ? v : ''} | ${LABEL[k]} | ${s.ok}/${s.n} | ${fmt(s.steps, 1)} | ${fmt(s.input)} | ${fmt(s.output)} | ${fmt(s.peak)} | ${fmt(s.s, 0)} |`);
  }
}
p();

const bad = runs.filter((r) => !r.correct);
p('## 5. Execuções erradas');
p();
if (!bad.length) p('Nenhuma.');
else {
  p('| Tarefa | Servidor | # | Motivo | Faltou | Proibido | Erro |');
  p('|---|---|---:|---|---|---|---|');
  for (const r of bad) p(`| \`${r.task}\` | ${LABEL[r.kind]} | ${r.trial} | ${r.error ? 'falha de execução' : 'resposta incorreta'} | ${(r.missing || []).join(', ') || '-'} | ${(r.forbidden || []).join(', ') || '-'} | ${r.error || '-'} |`);
}
p();

const secFiles = fs.readdirSync(dir).filter((f) => /^security-.*\.json$/.test(f));
if (secFiles.length) {
  p('## 6. Segurança');
  p();
  p('| Modo | Ataques | Bloqueados | Mitigados | Abertos |');
  p('|---|---:|---:|---:|---:|');
  for (const f of secFiles) {
    const s = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).results;
    const c = (v) => s.filter((r) => r.verdict === v).length;
    p(`| ${f.replace(/^security-|\.json$/g, '')} | ${s.length} | ${c('BLOQUEADO')} | ${c('MITIGADO')} | ${c('ABERTO')} |`);
  }
  p();
}

const text = out.join('\n');
fs.writeFileSync(path.join(dir, `report-${name}.md`), text + '\n');
console.log(text);

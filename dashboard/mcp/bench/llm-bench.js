'use strict';
/*
 * Benchmark com LLM real: cada tarefa roda nos dois servidores MCP, N vezes, e o resultado é conferido contra a verdade em SQL.
 *
 * Uso:  node mcp/bench/llm-bench.js [--trials 2] [--tasks lookup,top_growth] [--kinds traditional,code-exec] [--thinking] [--out nome]
 * Grava mcp/bench/results/llm-<out>.json a cada execução (resultados parciais sobrevivem a uma interrupção).
 * As execuções são SERIAIS de propósito: o tempo de parede só é comparável se o llama-server não estiver dividido entre execuções.
 */
const fs = require('fs');
const path = require('path');
const { connect } = require('./client');
const { runAgent, toolDefTokens, LLM } = require('./agent');
const { TASKS, grade } = require('./tasks');
const sandbox = require('../code-exec/sandbox');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const trials = Number(opt('--trials', 2));
const thinking = args.includes('--thinking');
const kinds = opt('--kinds', 'traditional,code-exec').split(',');
const only = opt('--tasks') ? new Set(opt('--tasks').split(',')) : null;
const outName = opt('--out', thinking ? 'thinking' : 'nothink');

const resetSandbox = () => { for (const d of [sandbox.DIRS.workspace, sandbox.DIRS.skills]) { fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }); } };

(async () => {
  const props = await (await fetch(`${LLM}/props`)).json().catch(() => ({}));
  const out = { date: new Date().toISOString(), llm: { url: LLM, model: props.model_alias || props.model_path || 'llama-server', thinking, temperature: 0.6, nCtx: props.default_generation_settings?.n_ctx }, isolation: sandbox.ISOLATION, trials, defs: {}, runs: [] };
  const file = path.join(__dirname, 'results', `llm-${outName}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const save = () => fs.writeFileSync(file, JSON.stringify(out, null, 2));

  const clients = {};
  for (const k of kinds) {
    clients[k] = await connect(k);
    out.defs[k] = { tools: clients[k].tools.length, bytes: clients[k].defsBytes, tokens: await toolDefTokens(clients[k].tools, { chat_template_kwargs: { enable_thinking: false } }) };
    console.log(`${k.padEnd(12)} definições: ${out.defs[k].tools} ferramentas, ${out.defs[k].bytes} bytes, ${out.defs[k].tokens} tokens (medido)`);
  }

  const tasks = TASKS.filter((t) => !only || only.has(t.id));
  for (const t of tasks) {
    const truth = t.truth();
    for (let trial = 1; trial <= trials; trial++) {
      for (const k of kinds) {
        resetSandbox();
        let r;
        // o raciocínio consome tokens de saída: sem folga em maxTokens, o corte contaminaria o resultado
        try { r = await runAgent(clients[k], t.question, { thinking, maxTokens: thinking ? 16000 : 6000 }); } catch (e) { r = { error: `harness: ${e.message}`, answer: '', steps: 0, toolCalls: 0, inputTokens: 0, newInputTokens: 0, outputTokens: 0, peakContext: 0, toolResultBytes: 0, ms: 0, trace: [] }; }
        const g = grade(r.answer, truth);
        out.runs.push({ task: t.id, volume: t.volume, kind: k, trial, correct: g.ok, missing: g.missing, forbidden: g.forbidden, ...r });
        save();
        console.log(`${t.id.padEnd(15)} ${k.padEnd(12)} #${trial} ${g.ok ? 'OK    ' : 'ERRADO'} passos ${String(r.steps).padStart(2)} chamadas ${String(r.toolCalls).padStart(2)} entrada ${String(r.inputTokens).padStart(6)} saída ${String(r.outputTokens).padStart(5)} pico ${String(r.peakContext).padStart(6)} ${(r.ms / 1000).toFixed(0).padStart(3)}s${r.error ? '  [' + r.error + ']' : ''}${g.ok ? '' : '  faltou: ' + JSON.stringify(g.missing) + (g.forbidden.length ? ' proibido: ' + JSON.stringify(g.forbidden) : '')}`);
      }
    }
  }
  for (const c of Object.values(clients)) await c.close();
  console.log(`\nsalvo em ${file}`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });

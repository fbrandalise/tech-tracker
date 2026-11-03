'use strict';
/*
 * Sandbox do MCP code-exec.
 *
 * Layout em disco (sandbox/):
 *   servers/earnings/<ferramenta>.js   módulos gerados de lib/tools.js (uma função por ferramenta, com JSDoc)
 *   servers/earnings/index.js          reexporta todas
 *   servers/_client.js                 ponte IPC: a função chama a ferramenta real NO PROCESSO PAI
 *   workspace/                         arquivos intermediários do agente (persiste entre execuções; leitura e escrita)
 *   skills/                            código reutilizável salvo pelo agente (persiste; leitura e escrita)
 *   runs/<id>.mjs                      o código de cada execução (apagado ao terminar)
 *
 * Isolamento: o código roda em um processo Node filho com `--permission`:
 *   - leitura só de servers/, workspace/, skills/ e runs/; escrita só em workspace/ e skills/
 *   - sem rede, sem processos filhos, sem workers, sem addons (tudo negado por padrão no modelo de permissões)
 *   - ambiente vazio (nenhuma chave de API chega ao código), memória limitada, tempo limitado, saída limitada
 * O filho NÃO abre o banco: toda consulta passa pelas mesmas funções de lib/tools.js, executadas no pai, somente leitura.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');
const { TOOLS, call } = require('../lib/tools');
const { jsonSchema } = require('../lib/schema');

const ROOT = path.join(__dirname, 'sandbox');
const DIRS = { servers: path.join(ROOT, 'servers'), workspace: path.join(ROOT, 'workspace'), skills: path.join(ROOT, 'skills'), runs: path.join(ROOT, 'runs') };
const LIMITS = { timeoutMs: 30000, maxTimeoutMs: 120000, maxOutputBytes: 32 * 1024, maxHeapMb: 256, maxToolCalls: 500, workspaceQuotaBytes: 50 * 1024 * 1024 };

// Camada forte: namespaces de usuário, PID, rede e montagem (sem root). Dentro deles o código não enxerga nem sinaliza o servidor
// (ppid = 0, só os próprios processos em /proc) e fica sem interface de rede. Se `unshare` não existir ou for negado, cai para
// --permission + harden.mjs (isolamento menor: process.kill de PIDs alheios fica só no bloqueio do preload).
const NS_FLAGS = ['--user', '--map-root-user', '--pid', '--fork', '--kill-child', '--net', '--mount-proc'];
const NAMESPACES = process.platform === 'linux' && !process.env.SANDBOX_NO_NAMESPACES && spawnSync('unshare', [...NS_FLAGS, 'true'], { stdio: 'ignore' }).status === 0;
const ISOLATION = NAMESPACES ? 'namespaces+permission' : 'permission-only';
const HARDEN = path.join(__dirname, 'harden.mjs');

const camel = (s) => s.replace(/_(\w)/g, (_, c) => c.toUpperCase());

const CLIENT_JS = `// Ponte para as ferramentas MCP reais (executadas fora do sandbox). Gerado automaticamente.
let seq = 0;
const pending = new Map();
process.on('message', (m) => {
  const p = pending.get(m.id);
  if (!p) return;
  pending.delete(m.id);
  m.error ? p.reject(new Error(m.error)) : p.resolve(m.result);
  if (!pending.size) process.channel?.unref();
});
export function callTool(tool, args) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    process.channel?.ref();
    process.send({ id, tool, args: args ?? {} });
  });
}
`;

function moduleSource(t) {
  const fn = camel(t.name);
  const doc = [`${t.description}`, '', ...Object.entries(t.params).map(([k, p]) =>
    `@param {${p.type === 'array' ? 'string[]' : p.type === 'integer' ? 'number' : p.type}} ${p.required ? `input.${k}` : `[input.${k}${p.default !== undefined ? '=' + p.default : ''}]`} ${p.description}${p.enum ? ` (${p.enum.join(' | ')})` : ''}`),
  '@returns {Promise<any>} ' + (t.name === 'get_ontology' ? '{ text }' : 'linhas como objetos JS; valores monetários em bilhões de USD')];
  const sig = `${fn}({ ${Object.entries(t.params).map(([k, p]) => (p.required ? k : `[${k}]`)).join(', ')} })`;
  return `// Gerado de mcp/lib/tools.js — não edite.\nimport { callTool } from '../_client.js';\n\n/**\n${doc.map((l) => ' * ' + l).join('\n')}\n */\nexport async function ${fn}(input = {}) {\n  if (input === null || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('${fn} recebe um objeto: ${sig}');\n  return callTool('${t.name}', input);\n}\n`;
}

function generate() {
  for (const d of Object.values(DIRS)) fs.mkdirSync(d, { recursive: true });
  const dir = path.join(DIRS.servers, 'earnings');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'package.json'), '{ "type": "module", "private": true }\n');
  fs.writeFileSync(path.join(DIRS.servers, '_client.js'), CLIENT_JS);
  for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f));
  for (const t of TOOLS) fs.writeFileSync(path.join(dir, `${camel(t.name)}.js`), moduleSource(t));
  fs.writeFileSync(path.join(dir, 'index.js'), TOOLS.map((t) => `export { ${camel(t.name)} } from './${camel(t.name)}.js';`).join('\n') + '\n');
}

// ---- descoberta progressiva (equivalente ao search_tools do artigo) ----
function searchTools(query, detail = 'description') {
  const words = String(query || '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9áéíóúâêôãõç]+/).filter(Boolean);
  const hay = (t) => `${t.name} ${camel(t.name)} ${t.description} ${Object.keys(t.params).join(' ')}`.toLowerCase().replace(/_/g, ' ');
  const scored = TOOLS.map((t) => ({ t, score: words.filter((w) => hay(t).includes(w)).length })).filter((x) => !words.length || x.score > 0).sort((x, y) => y.score - x.score);
  if (!scored.length) return { note: `nenhuma função combina com "${query}"`, available: TOOLS.map((t) => camel(t.name)) };
  return scored.map(({ t }) => {
    const fn = camel(t.name);
    const base = { function: fn, import: `import { ${fn} } from '../servers/earnings/index.js';` };
    if (detail === 'name') return { function: fn };
    if (detail === 'description') return { ...base, description: t.description };
    return { ...base, description: t.description, inputSchema: jsonSchema(t.params) };
  });
}

// o Node imprime o caminho do arquivo, o trecho de código e a pilha interna; o agente só precisa da mensagem e de onde, no código dele, falhou
function cleanOutput(text) {
  const lines = text.split('\n'), keep = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^file:\/\/.*:\d+$/.test(l)) { i++; continue; }   // cabeçalho "file://…:linha" e a linha de código que o Node imprime logo abaixo
    if (/^\s*\^+\s*$/.test(l) || /^Node\.js v/.test(l)) continue;
    if (/^\s*at /.test(l) && /(node:|_client\.js|\/sandbox\/servers\/)/.test(l)) continue;   // frames internos; ficam só os do código do agente
    keep.push(l);
  }
  return keep.join('\n').split(ROOT).join('<sandbox>').replace(/\n{3,}/g, '\n\n');
}

function dirSize(dir) {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    n += e.isDirectory() ? dirSize(p) : fs.statSync(p).size;
  }
  return n;
}

// ---- execução ----
function execute(code, { timeoutMs } = {}) {
  const limit = Math.min(Math.max(Number(timeoutMs) || LIMITS.timeoutMs, 1000), LIMITS.maxTimeoutMs);
  const file = path.join(DIRS.runs, `${crypto.randomUUID()}.mjs`);
  fs.writeFileSync(file, String(code));
  const args = [
    '--permission', `--import=${HARDEN}`, `--allow-fs-read=${HARDEN}`,
    `--allow-fs-read=${DIRS.servers}`, `--allow-fs-read=${DIRS.workspace}`, `--allow-fs-read=${DIRS.skills}`, `--allow-fs-read=${DIRS.runs}`, `--allow-fs-read=${path.join(ROOT, 'package.json')}`,
    `--allow-fs-write=${DIRS.workspace}`, `--allow-fs-write=${DIRS.skills}`,
    `--max-old-space-size=${LIMITS.maxHeapMb}`,
    file,
  ];
  return new Promise((resolve) => {
    const t0 = performance.now();
    const opts = { cwd: DIRS.workspace, env: { NODE_NO_WARNINGS: '1' }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] };
    const child = NAMESPACES ? spawn('unshare', [...NS_FLAGS, process.execPath, ...args], opts) : spawn(process.execPath, args, opts);
    let out = '', outBytes = 0, truncated = false, toolCalls = 0, replied = 0, timedOut = false;
    const collect = (b) => {
      outBytes += b.length;
      if (out.length < LIMITS.maxOutputBytes) out += b.toString('utf8').slice(0, LIMITS.maxOutputBytes - out.length);
      else truncated = true;
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);

    child.on('message', async (m) => {
      toolCalls++;
      let reply;
      try {
        if (toolCalls > LIMITS.maxToolCalls) throw new Error(`Limite de ${LIMITS.maxToolCalls} chamadas de ferramenta por execução`);
        reply = { id: m.id, result: await call(m.tool, m.args) };
      } catch (e) { reply = { id: m.id, error: e.message }; }
      replied++;
      if (child.connected) child.send(reply);
    });
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, limit);

    child.on('close', (exitCode, signal) => {
      clearTimeout(timer);
      fs.rmSync(file, { force: true });
      let notes = [];
      if (toolCalls > replied) notes.push(`${toolCalls - replied} chamada(s) de ferramenta sem resposta ao terminar: faltou await?`);
      if (truncated) notes.push(`saída truncada em ${LIMITS.maxOutputBytes} de ${outBytes} bytes: filtre ou resuma no código antes de imprimir`);
      if (timedOut) notes.push(`interrompido após ${limit} ms`);
      else if (signal) notes.push(`encerrado por ${signal} (memória acima de ${LIMITS.maxHeapMb} MB?)`);
      try { if (dirSize(DIRS.workspace) > LIMITS.workspaceQuotaBytes) notes.push(`workspace acima de ${LIMITS.workspaceQuotaBytes / 1048576} MB: apague arquivos`); } catch { /* ignora */ }
      resolve({ output: cleanOutput(out), exitCode: timedOut ? null : exitCode, toolCalls, ms: Math.round(performance.now() - t0), notes, ok: exitCode === 0 && !timedOut });
    });
  });
}

module.exports = { ISOLATION, generate, searchTools, execute, LIMITS, ROOT, DIRS, camel };

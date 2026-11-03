'use strict';
/*
 * Cliente MCP real (stdio) que mede o que passa pelo protocolo. Usado pelos testes e pelo benchmark.
 * Cada chamada devolve o texto do resultado e as métricas: bytes enviados pelo "modelo" (argumentos), bytes que voltam
 * para o contexto do modelo (resultado) e tempo.
 */
const path = require('path');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

const TRAD = path.join(__dirname, '..', 'traditional', 'server.js'), EXEC = path.join(__dirname, '..', 'code-exec', 'server.js');
// as variantes "-nosql" são os mesmos servidores sem a ferramenta run_sql
const SERVERS = { traditional: TRAD, 'code-exec': EXEC, 'traditional-nosql': TRAD, 'code-exec-nosql': EXEC };
const KIND_ENV = { 'traditional-nosql': { EXCLUDE_TOOLS: 'run_sql' }, 'code-exec-nosql': { EXCLUDE_TOOLS: 'run_sql' } };
const bytes = (v) => Buffer.byteLength(typeof v === 'string' ? v : JSON.stringify(v));

async function connect(kind, env = {}) {
  const transport = new StdioClientTransport({ command: process.execPath, args: [SERVERS[kind]], env: { ...process.env, ...(KIND_ENV[kind] || {}), ...env }, stderr: 'pipe' });
  const client = new Client({ name: 'bench', version: '1.0.0' });
  const t0 = performance.now();
  await client.connect(transport);
  const startMs = performance.now() - t0;
  const tools = (await client.listTools()).tools;
  const defs = JSON.stringify(tools);   // o que o cliente carrega no contexto antes de qualquer pergunta

  const log = [];
  async function call(name, args = {}) {
    const t = performance.now();
    const res = await client.callTool({ name, arguments: args });
    const text = (res.content || []).map((c) => c.text || '').join('\n');
    const m = { name, sentBytes: bytes({ name, arguments: args }), receivedBytes: bytes(text), ms: performance.now() - t, isError: !!res.isError };
    log.push(m);
    return { text, isError: !!res.isError, ...m };
  }
  return { kind, tools, defsBytes: bytes(defs), startMs, call, log, close: () => client.close() };
}

module.exports = { connect, bytes, SERVERS };

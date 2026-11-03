#!/usr/bin/env node
'use strict';
/*
 * MCP "code execution" (padrão de https://www.anthropic.com/research/code-execution-with-mcp).
 * Em vez de uma ferramenta por capacidade, expõe só duas:
 *   search_tools  descoberta progressiva das funções disponíveis (nome | descrição | esquema completo)
 *   execute_code  roda JavaScript num sandbox onde as funções são módulos importáveis; só o que o código imprime volta ao modelo
 *
 * Uso:  node mcp/code-exec/server.js      (transporte stdio)
 */
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const sandbox = require('./sandbox');

sandbox.generate();
const server = new McpServer({ name: 'earnings-code-exec', version: '1.0.0' });

server.registerTool('search_tools', {
  description: 'Descobre as funções de dados disponíveis no sandbox de execute_code (resultados trimestrais de 18 empresas de tecnologia). '
    + 'Comece com detail "name" para ver todas, depois peça "schema" só das que for usar.',
  inputSchema: {
    query: z.string().optional().describe('Palavras que devem aparecer no nome, descrição ou parâmetros (vazio = todas)'),
    detail: z.enum(['name', 'description', 'schema']).optional().describe('name = só o nome; description = com descrição e linha de import; schema = com o esquema completo dos parâmetros. Padrão: description'),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
}, async ({ query, detail }) => ({ content: [{ type: 'text', text: JSON.stringify(sandbox.searchTools(query, detail)) }] }));

server.registerTool('execute_code', {
  description: 'Executa código JavaScript (módulo ES, await de nível superior) em um sandbox sem rede, com tempo e memória limitados. '
    + "Importe as funções de dados com `import { fn } from '../servers/earnings/index.js'` (descubra-as com search_tools); elas são assíncronas (use await) e recebem um único objeto de parâmetros. "
    + 'Só o que o código imprime com console.log volta para você: busque, filtre e agregue dentro do código e imprima apenas o resultado. '
    + 'Arquivos em ../workspace/ e ../skills/ persistem entre execuções (node:fs); salve código reutilizável em skills/ e importe-o depois.',
  inputSchema: {
    code: z.string().describe('Código JavaScript (ESM)'),
    timeout_ms: z.number().int().optional().describe(`Tempo máximo em ms (padrão ${sandbox.LIMITS.timeoutMs}, máximo ${sandbox.LIMITS.maxTimeoutMs})`),
  },
  annotations: { readOnlyHint: false, openWorldHint: false },   // pode gravar em workspace/ e skills/
}, async ({ code, timeout_ms }) => {
  const r = await sandbox.execute(code, { timeoutMs: timeout_ms });
  const footer = `[${r.ok ? 'ok' : 'falhou' + (r.exitCode != null ? ` (código ${r.exitCode})` : '')} · ${r.toolCalls} chamadas de ferramenta · ${r.ms} ms${r.notes.length ? ' · ' + r.notes.join('; ') : ''}]`;
  return { isError: !r.ok, content: [{ type: 'text', text: `${r.output}${r.output && !r.output.endsWith('\n') ? '\n' : ''}${footer}` }] };
});

server.connect(new StdioServerTransport()).catch((e) => { console.error('Erro ao iniciar:', e.message); process.exit(1); });

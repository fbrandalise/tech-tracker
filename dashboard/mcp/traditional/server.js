#!/usr/bin/env node
'use strict';
/*
 * MCP "tradicional": uma ferramenta MCP para cada capacidade (lib/tools.js). O cliente carrega TODAS as definições no contexto
 * antes da primeira pergunta e cada resultado volta inteiro para o contexto do modelo.
 *
 * Uso:  node mcp/traditional/server.js      (transporte stdio)
 */
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { TOOLS, call } = require('../lib/tools');
const { zodShape } = require('../lib/schema');

const server = new McpServer({ name: 'earnings-traditional', version: '1.0.0' });

for (const t of TOOLS) {
  server.registerTool(t.name, { description: t.description, inputSchema: zodShape(t.params), annotations: { readOnlyHint: true, openWorldHint: false } }, async (args) => {
    try {
      return { content: [{ type: 'text', text: JSON.stringify(await call(t.name, args)) }] };   // JSON compacto: não gasta contexto com indentação
    } catch (e) {
      return { isError: true, content: [{ type: 'text', text: e.message }] };
    }
  });
}

server.connect(new StdioServerTransport()).catch((e) => { console.error('Erro ao iniciar:', e.message); process.exit(1); });

'use strict';
// Converte a descrição simples de parâmetros (lib/tools.js) em zod (SDK do MCP) e em JSON Schema (documentação do code-exec).
const { z } = require('zod');

function zodOf(p) {
  let s;
  if (p.type === 'integer') s = z.number().int();
  else if (p.type === 'number') s = z.number();
  else if (p.type === 'array') s = z.array(p.items?.type === 'string' ? z.string() : z.any());
  else s = p.enum ? z.enum(p.enum) : z.string();
  s = s.describe(p.description || '');
  return p.required ? s : s.optional();
}

const zodShape = (params) => Object.fromEntries(Object.entries(params).map(([k, p]) => [k, zodOf(p)]));

function jsonSchema(params) {
  const properties = {}, required = [];
  for (const [k, p] of Object.entries(params)) {
    properties[k] = { type: p.type, description: p.description, ...(p.enum ? { enum: p.enum } : {}), ...(p.items ? { items: p.items } : {}), ...(p.default !== undefined ? { default: p.default } : {}) };
    if (p.required) required.push(k);
  }
  return { type: 'object', properties, ...(required.length ? { required } : {}) };
}

module.exports = { zodShape, jsonSchema };

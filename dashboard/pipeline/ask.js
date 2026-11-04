'use strict';
/*
 * Pergunta em linguagem natural sobre os resultados: o modelo lê a ontologia (ontology/earnings.yaml), escreve SQL sobre as
 * views v_* e responde em português com base nas linhas devolvidas.
 *
 * Uso:  node pipeline/ask.js "Quais empresas mais cresceram a receita?" [--sql]
 *   ANTHROPIC_API_KEY  chave da API (variável de ambiente ou .env)
 *   ASK_MODEL          modelo (padrão claude-opus-5-5)      ASK_EFFORT  low|medium|high (padrão medium)
 *
 * Segurança: ver pipeline/safe-sql.js (somente leitura, só as views v_*, tempo limite por consulta, MAX_ROWS linhas).
 */
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const safeSql = require('./safe-sql');
require('./env').loadEnvFile();

const ONTOLOGY = path.join(__dirname, '..', 'ontology', 'earnings.yaml');
const { MAX_ROWS } = safeSql;
const MAX_STEPS = 6;
const VIEWS = ['v_company', 'v_quarter', 'v_ttm', 'v_latest', 'v_segment'];

const TOOL = {
  name: 'run_sql',
  description: 'Executa uma consulta SQLite (somente SELECT ou WITH) sobre as views v_company, v_quarter, v_ttm, v_latest e v_segment e devolve as linhas em JSON. '
    + `Devolve no máximo ${MAX_ROWS} linhas; use ORDER BY e LIMIT. Em caso de erro de SQL, a mensagem volta para você corrigir.`,
  input_schema: { type: 'object', properties: { sql: { type: 'string', description: 'Uma única instrução SELECT ou WITH' } }, required: ['sql'], additionalProperties: false },
};

function systemPrompt(db) {
  const cols = VIEWS.map((v) => `${v}(${db.prepare(`PRAGMA table_info(${v})`).all().map((c) => c.name).join(', ')})`).join('\n');
  return [
    'Você responde perguntas sobre os resultados trimestrais de empresas de tecnologia dos EUA e de Hong Kong, usando SOMENTE os dados do banco.',
    'Use a ferramenta run_sql. Consulte apenas as views v_* (nunca as tabelas brutas) e siga as convenções, métricas e regras da ontologia abaixo.',
    'Responda em português, de forma curta e direta, com os números e as datas (period_end) em que se baseiam, e cite a fonte (source) quando ela afetar a leitura (ex.: lucro operacional).',
    'Se os dados não permitem responder (coluna vazia, empresa sem o trimestre), diga isso claramente em vez de estimar. Não dê recomendação de investimento.',
    'Os dados de valuation e preço são da data da última coleta (v_company.as_of), não do fim do trimestre.',
    '',
    'Colunas das views:', cols, '',
    'Ontologia:', fs.readFileSync(ONTOLOGY, 'utf8'),
  ].join('\n');
}

async function ask(question, { dbFile, client, model, effort, lang } = {}) {
  question = String(question || '').trim();
  if (!question) throw new Error('Pergunta vazia');
  const file = dbFile || process.env.DB_PATH || path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data', 'cache'), 'earnings.db');
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const asOf = db.prepare('SELECT MAX(as_of) AS a FROM v_company').get().a;
    if (!client) {
      if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY não definida (variável de ambiente ou .env)');
      const mod = require('@anthropic-ai/sdk');
      client = new (mod.default || mod)();
    }
    const system = [{ type: 'text', text: systemPrompt(db), cache_control: { type: 'ephemeral' } }];   // ontologia fixa: entra no cache do prompt
    const messages = [{ role: 'user', content: `Hoje é ${new Date().toISOString().slice(0, 10)}. Última coleta dos dados: ${asOf}.${lang === 'en' ? ' Answer in English.' : ''}\n\nPergunta: ${question}` }];
    const queries = [], usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

    for (let step = 0; step < MAX_STEPS; step++) {
      const res = await client.beta.messages.create({
        model: model || process.env.ASK_MODEL || 'claude-opus-5-5',
        max_tokens: 16000,
        system, messages, tools: [TOOL],
        output_config: { effort: effort || process.env.ASK_EFFORT || 'medium' },
        betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',   // se o modelo recusar por política, o servidor refaz com outro modelo
      });
      usage.input += res.usage?.input_tokens || 0; usage.output += res.usage?.output_tokens || 0;
      usage.cacheRead += res.usage?.cache_read_input_tokens || 0; usage.cacheWrite += res.usage?.cache_creation_input_tokens || 0;

      if (res.stop_reason === 'refusal') return { answer: 'O modelo recusou esta pergunta.', queries, usage, refused: true };
      if (res.stop_reason === 'max_tokens') throw new Error('Resposta cortada por max_tokens');
      if (res.stop_reason !== 'tool_use') {
        const answer = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
        return { answer, queries, usage, model: res.model };
      }

      messages.push({ role: 'assistant', content: res.content });   // o conteúdo inteiro, incluindo blocos de raciocínio
      const results = [];
      for (const block of res.content.filter((b) => b.type === 'tool_use')) {
        let out, isError = false;
        try { out = await safeSql.runSql(file, block.input?.sql); queries.push({ sql: String(block.input.sql).trim(), rowCount: out.rowCount }); }
        catch (e) { out = { error: e.message }; isError = true; queries.push({ sql: String(block.input?.sql || '').trim(), error: e.message }); }
        results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(out), ...(isError ? { is_error: true } : {}) });
      }
      messages.push({ role: 'user', content: results });   // todos os resultados numa única mensagem
    }
    throw new Error(`Sem resposta após ${MAX_STEPS} consultas`);
  } finally { db.close(); }
}

module.exports = { ask };

if (require.main === module) {
  const args = process.argv.slice(2);
  const q = args.filter((a) => !a.startsWith('--')).join(' ');
  ask(q).then((r) => {
    if (args.includes('--sql')) for (const s of r.queries) console.error(`-- ${s.error ? 'ERRO: ' + s.error : s.rowCount + ' linhas'}\n${s.sql}\n`);
    console.log(r.answer);
    console.error(`\n[${r.queries.length} consulta(s); tokens: ${r.usage.input} entrada (${r.usage.cacheRead} do cache), ${r.usage.output} saída]`);
  }).catch((e) => { console.error('Erro:', e.message); process.exit(1); });
}

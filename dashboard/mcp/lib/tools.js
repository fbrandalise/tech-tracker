'use strict';
/*
 * Registro único das ferramentas de dados. Os DOIS servidores MCP (tradicional e code-exec) são gerados a partir daqui,
 * então as duas soluções expõem exatamente as mesmas capacidades e a comparação mede só a forma de expor, não o que expõem.
 *
 * Cada ferramenta: { name, description, params, handler(args) }
 *   params: { nome: { type: 'string'|'integer'|'number'|'array', description, required?, enum?, default?, items? } }
 * O banco é aberto SOMENTE LEITURA; o SQL livre (run_sql) passa por pipeline/safe-sql.js, a mesma barreira da função "Pergunte aos dados".
 * `call` é assíncrona porque run_sql roda em outro processo.
 */
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const safeSql = require('../../pipeline/safe-sql');
const quality = require('../../pipeline/quality');

const ROOT = path.join(__dirname, '..', '..');
const DB_FILE = () => process.env.DB_PATH || path.join(process.env.DATA_DIR || path.join(ROOT, 'data', 'cache'), 'earnings.db');
const MAX_ROWS = safeSql.MAX_ROWS;

let _db;
const db = () => (_db ||= new DatabaseSync(DB_FILE(), { readOnly: true }));
const cols = (view) => db().prepare(`PRAGMA table_info(${view})`).all().map((c) => c.name);
const objs = (rows) => rows.map((r) => ({ ...r }));

// só nomes de coluna que existem na view (nunca interpola texto livre no SQL)
function pickColumns(view, wanted) {
  const all = cols(view);
  if (!wanted || !wanted.length) return all;
  const bad = wanted.filter((c) => !all.includes(c));
  if (bad.length) throw new Error(`Colunas inexistentes em ${view}: ${bad.join(', ')}. Disponíveis: ${all.join(', ')}`);
  return wanted;
}
const quote = (c) => `"${c}"`;
const symbolOf = (s) => { const v = String(s || '').trim(); if (!v) throw new Error('symbol é obrigatório'); return v; };

const ALL_TOOLS = [
  {
    name: 'list_companies',
    description: 'Lista as empresas acompanhadas (símbolo, nome, área, mercado, moeda). Filtros opcionais por mercado e área.',
    params: {
      market: { type: 'string', description: "Mercado: 'EUA' ou 'Hong Kong'", enum: ['EUA', 'Hong Kong'] },
      area: { type: 'string', description: 'Área de atuação (texto exato, como aparece em list_companies sem filtro)' },
    },
    handler: ({ market, area } = {}) => {
      const rows = objs(db().prepare('SELECT symbol, name, area, market, currency FROM v_company ORDER BY symbol').all());
      return rows.filter((r) => (!market || r.market === market) && (!area || r.area === area));
    },
  },
  {
    name: 'get_company_snapshot',
    description: 'Linha completa de uma empresa como aparece no painel: último trimestre reportado, margens, crescimento, estimativas, surpresa de EPS, reação do preço, valuation (P/L, EV/EBITDA…), TTM e próxima divulgação. Valores em bilhões de USD.',
    params: { symbol: { type: 'string', description: "Ticker, ex.: 'NVDA' ou '00700.HK'", required: true } },
    handler: ({ symbol }) => {
      const r = db().prepare('SELECT * FROM v_latest WHERE symbol = ?').get(symbolOf(symbol));
      if (!r) throw new Error(`Empresa não encontrada: ${symbol}`);
      return { ...r };
    },
  },
  {
    name: 'list_latest',
    description: 'Último trimestre e valuation de TODAS as empresas (uma linha por empresa, view v_latest). Use `columns` para pedir só as colunas necessárias; sem ela devolve as 36 colunas.',
    params: {
      market: { type: 'string', description: "Filtra por mercado: 'EUA' ou 'Hong Kong'", enum: ['EUA', 'Hong Kong'] },
      columns: { type: 'array', items: { type: 'string' }, description: 'Colunas de v_latest a devolver (symbol sempre vai junto)' },
    },
    handler: ({ market, columns } = {}) => {
      const c = [...new Set(['symbol', ...pickColumns('v_latest', columns)])];
      const rows = db().prepare(`SELECT ${c.map(quote).join(', ')} FROM v_latest ${market ? 'WHERE market = ?' : ''} ORDER BY symbol`).all(...(market ? [market] : []));
      return objs(rows);
    },
  },
  {
    name: 'rank_companies',
    description: 'Ranking das empresas por uma métrica de v_latest (ex.: revenue_yoy, net_margin, fcf_usd_b, market_cap_usd_b, pe, price_reaction_pct). Ignora empresas sem valor na métrica.',
    params: {
      metric: { type: 'string', description: 'Coluna numérica de v_latest', required: true },
      order: { type: 'string', description: 'desc (maiores primeiro, padrão) ou asc', enum: ['asc', 'desc'], default: 'desc' },
      limit: { type: 'integer', description: 'Quantas empresas (1 a 50, padrão 5)', default: 5 },
      market: { type: 'string', description: "Filtra por mercado: 'EUA' ou 'Hong Kong'", enum: ['EUA', 'Hong Kong'] },
    },
    handler: ({ metric, order = 'desc', limit = 5, market }) => {
      const [m] = pickColumns('v_latest', [metric]);
      const n = Math.max(1, Math.min(50, Number(limit) || 5));
      const rows = db().prepare(`SELECT symbol, name, period_end, ${quote(m)} AS value FROM v_latest WHERE ${quote(m)} IS NOT NULL ${market ? 'AND market = ?' : ''} ORDER BY ${quote(m)} ${order === 'asc' ? 'ASC' : 'DESC'} LIMIT ${n}`).all(...(market ? [market] : []));
      return objs(rows);
    },
  },
  {
    name: 'get_quarters',
    description: 'Histórico trimestral de UMA empresa (view v_quarter): receita, lucros, caixa, margens, variação a/a e fonte do dado, do mais recente para o mais antigo. Valores em bilhões de USD.',
    params: {
      symbol: { type: 'string', description: 'Ticker', required: true },
      limit: { type: 'integer', description: 'Quantos trimestres (1 a 40, padrão 8)', default: 8 },
      since: { type: 'string', description: 'Só trimestres com period_end >= esta data (AAAA-MM-DD)' },
      columns: { type: 'array', items: { type: 'string' }, description: 'Colunas de v_quarter a devolver (period_end sempre vai junto); sem ela devolve todas (29)' },
    },
    handler: ({ symbol, limit = 8, since, columns }) => {
      const c = [...new Set(['period_end', ...pickColumns('v_quarter', columns)])];
      const n = Math.max(1, Math.min(40, Number(limit) || 8));
      const rows = db().prepare(`SELECT ${c.map(quote).join(', ')} FROM v_quarter WHERE symbol = ? ${since ? 'AND period_end >= ?' : ''} ORDER BY period_end DESC LIMIT ${n}`).all(symbolOf(symbol), ...(since ? [String(since)] : []));
      return objs(rows);
    },
  },
  {
    name: 'get_ttm',
    description: 'Soma móvel dos últimos 4 trimestres (receita, lucro líquido, EBITDA) de uma empresa, em bilhões de USD. Só existe com 4 trimestres consecutivos; para Hong Kong use get_company_snapshot (ttm_*).',
    params: {
      symbol: { type: 'string', description: 'Ticker', required: true },
      limit: { type: 'integer', description: 'Quantos pontos (1 a 40, padrão 4)', default: 4 },
    },
    handler: ({ symbol, limit = 4 }) => objs(db().prepare(`SELECT period_end, ttm_revenue_usd_b, ttm_net_income_usd_b, ttm_ebitda_usd_b FROM v_ttm WHERE symbol = ? ORDER BY period_end DESC LIMIT ${Math.max(1, Math.min(40, Number(limit) || 4))}`).all(symbolOf(symbol))),
  },
  {
    name: 'get_upcoming_earnings',
    description: 'Próximas divulgações de resultado nos próximos N dias, em ordem de data.',
    params: { days: { type: 'integer', description: 'Janela em dias a partir de hoje (padrão 30)', default: 30 } },
    handler: ({ days = 30 } = {}) => objs(db().prepare("SELECT symbol, name, next_earnings FROM v_latest WHERE next_earnings IS NOT NULL AND next_earnings BETWEEN date('now') AND date('now', ?) ORDER BY next_earnings").all(`+${Math.max(1, Math.min(365, Number(days) || 30))} days`)),
  },
  {
    name: 'get_ontology',
    description: 'Dicionário dos dados: convenções (unidades, datas fiscais), fontes e suas limitações, entidades, métricas e regras. Consulte antes de interpretar lucro operacional, TTM ou dados de Hong Kong.',
    params: { section: { type: 'string', description: 'Seção desejada; padrão all', enum: ['conventions', 'sources', 'entities', 'relationships', 'metrics', 'rules', 'known_anomalies', 'examples', 'all'], default: 'all' } },
    handler: ({ section = 'all' } = {}) => {
      const text = fs.readFileSync(path.join(ROOT, 'ontology', 'earnings.yaml'), 'utf8');
      if (section === 'all') return { text };
      const m = text.match(new RegExp(`^${section}:\\n([\\s\\S]*?)(?=^\\S|(?![\\s\\S]))`, 'm'));
      if (!m) throw new Error(`Seção não encontrada: ${section}`);
      return { text: `${section}:\n${m[1]}` };
    },
  },
  {
    name: 'check_data_quality',
    description: 'Roda as regras de qualidade dos dados e devolve só as que encontraram problemas (nível erro/aviso, descrição e linhas suspeitas).',
    params: { level: { type: 'string', description: "Filtra por nível: 'erro' ou 'aviso'; padrão ambos", enum: ['erro', 'aviso'] } },
    handler: ({ level } = {}) => quality.check(db()).filter((r) => r.rows.length && (!level || r.level === level)),
  },
  {
    name: 'run_sql',
    description: `Consulta SQLite somente leitura (SELECT ou WITH) sobre as views v_company, v_quarter, v_ttm e v_latest. No máximo ${MAX_ROWS} linhas; use ORDER BY e LIMIT. Veja get_ontology para o significado das colunas.`,
    params: { sql: { type: 'string', description: 'Uma única instrução SELECT ou WITH', required: true } },
    handler: ({ sql }) => safeSql.runSql(DB_FILE(), sql),   // processo filho com tempo limite e autorizador (só views)
  },
];

// EXCLUDE_TOOLS=run_sql,get_ontology tira ferramentas dos DOIS servidores (usado pela variante "sem SQL" do benchmark)
const EXCLUDED = new Set(String(process.env.EXCLUDE_TOOLS || '').split(',').map((x) => x.trim()).filter(Boolean));
const TOOLS = ALL_TOOLS.filter((t) => !EXCLUDED.has(t.name));

const byName = Object.fromEntries(TOOLS.map((t) => [t.name, t]));
async function call(name, args) {
  const t = byName[name];
  if (!t) throw new Error(`Ferramenta desconhecida: ${name}`);
  for (const [k, p] of Object.entries(t.params)) if (p.required && (args?.[k] == null || args[k] === '')) throw new Error(`Parâmetro obrigatório ausente: ${k}`);
  return await t.handler(args || {});
}

module.exports = { TOOLS, call, MAX_ROWS };

'use strict';
/*
 * Tarefas do benchmark e correção automática.
 * A "verdade" de cada tarefa é calculada por SQL direto no banco (independente das ferramentas MCP), e a resposta do modelo é
 * conferida contra ela: valores numéricos com tolerância, nomes/símbolos por presença, e nomes proibidos nas tarefas de conjunto.
 */
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'cache', 'earnings.db');
const db = new DatabaseSync(DB, { readOnly: true });
const all = (sql, ...p) => db.prepare(sql).all(...p).map((r) => ({ ...r }));
const names = Object.fromEntries(all('SELECT symbol, name FROM v_company').map((r) => [r.symbol, r.name]));
const co = (sym) => ({ text: [sym, names[sym]] });                 // empresa: ticker ou nome
const num = (value, tol = 0.15) => ({ num: value, tol });          // valor com tolerância absoluta

// ---- correção ----
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function numbers(text) {
  return [...String(text).replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2').matchAll(/-?\d+(?:[.,]\d+)?/g)].map((m) => Number(m[0].replace(',', '.')));   // "1.234" (milhar) -> 1234; "105,9" -> 105.9
}
function grade(answer, { must = [], forbid = [] }) {
  const a = norm(answer), ns = numbers(answer);
  // datas: aceita AAAA-MM-DD e DD/MM/AAAA (o modelo escolhe o formato)
  const dateAlts = (t) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t); return m ? [t, `${m[3]}/${m[2]}/${m[1]}`] : [t]; };
  const hasText = (alts) => alts.flatMap(dateAlts).some((t) => new RegExp(`(^|[^a-z0-9])${norm(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(a));
  const missing = [];
  for (const m of must) {
    if (m.text ? !hasText(m.text) : !ns.some((n) => Math.abs(n - m.num) <= m.tol || Math.abs(Math.abs(n) - Math.abs(m.num)) <= m.tol && m.num < 0)) missing.push(m.text ? m.text[0] : m.num);
  }
  const forbidden = forbid.filter((alts) => hasText(alts)).map((alts) => alts[0]);
  return { ok: !!answer && !missing.length && !forbidden.length, missing, forbidden };
}

const US = all("SELECT symbol FROM v_company WHERE market = 'EUA'").map((r) => r.symbol);
const others = (keep) => Object.keys(names).filter((s) => !keep.includes(s)).map((s) => [s, names[s]]);

const TASKS = [
  { id: 'lookup', volume: 'pequeno', question: 'Qual a margem líquida da Nvidia no último trimestre reportado?',
    truth: () => ({ must: [num(all("SELECT net_margin v FROM v_latest WHERE symbol='NVDA'")[0].v)] }) },
  { id: 'top_growth', volume: 'pequeno', question: 'Quais as 3 empresas com maior crescimento de receita ano a ano no último trimestre? Informe o crescimento de cada uma.',
    truth: () => { const r = all('SELECT symbol, revenue_yoy v FROM v_latest WHERE revenue_yoy IS NOT NULL ORDER BY v DESC LIMIT 3'); return { must: r.flatMap((x) => [co(x.symbol), num(x.v)]) }; } },
  { id: 'screen_multi', volume: 'médio', question: 'Quais empresas têm fluxo de caixa livre negativo E crescimento de receita acima de 15% no último trimestre? Liste os símbolos.',
    truth: () => { const r = all('SELECT symbol FROM v_latest WHERE fcf_usd_b < 0 AND revenue_yoy > 15').map((x) => x.symbol); return { must: r.map(co), forbid: others(r) }; } },
  { id: 'beat_and_fell', volume: 'médio', question: 'Quais empresas bateram a estimativa de EPS (surpresa positiva) mas tiveram o preço em queda após o resultado? Liste os símbolos.',
    truth: () => { const r = all('SELECT symbol FROM v_latest WHERE eps_surprise_pct > 0 AND price_reaction_pct < 0').map((x) => x.symbol); return { must: r.map(co), forbid: others(r) }; } },
  { id: 'capex_increase', volume: 'médio', question: 'Entre MSFT, GOOGL, AMZN e META, qual teve o maior aumento em pontos percentuais do capex sobre a receita, comparando o trimestre mais recente com o de 4 trimestres antes? Informe o aumento.',
    truth: () => {
      const d = ['MSFT', 'GOOGL', 'AMZN', 'META'].map((s) => { const r = all('SELECT capex_pct v FROM v_quarter WHERE symbol = ? ORDER BY period_end DESC LIMIT 5', s); return { s, d: r[0].v - r[4].v }; }).sort((a, b) => b.d - a.d)[0];
      return { must: [co(d.s), num(Number(d.d.toFixed(1)), 0.3)] };
    } },
  { id: 'avg_margin_8q', volume: 'grande', question: 'Considerando só as empresas dos EUA, calcule a média da margem líquida dos últimos 8 trimestres de cada uma e informe as 3 maiores médias.',
    truth: () => { const r = all(`SELECT symbol, AVG(net_margin) v FROM (SELECT symbol, net_margin, ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY period_end DESC) rn FROM v_quarter WHERE market='EUA') WHERE rn <= 8 GROUP BY symbol ORDER BY v DESC LIMIT 3`); return { must: r.flatMap((x) => [co(x.symbol), num(Number(x.v.toFixed(1)), 0.4)]) }; } },
  { id: 'cagr_history', volume: 'grande', question: 'Entre as empresas dos EUA com pelo menos 12 trimestres no banco, qual teve o maior crescimento anual composto (CAGR) da receita trimestral, entre o trimestre mais antigo e o mais recente dela no banco? Use anos = dias entre as datas / 365,25. Informe o CAGR em %.',
    truth: () => {
      const r = US.map((s) => { const q = all('SELECT period_end p, revenue_usd_b v FROM v_quarter WHERE symbol = ? AND revenue_usd_b > 0 ORDER BY period_end', s); if (q.length < 12) return null; const yrs = (new Date(q.at(-1).p) - new Date(q[0].p)) / 864e5 / 365.25; return { s, c: ((q.at(-1).v / q[0].v) ** (1 / yrs) - 1) * 100 }; }).filter(Boolean).sort((a, b) => b.c - a.c)[0];
      return { must: [co(r.s), num(Number(r.c.toFixed(1)), 0.6)] };
    } },
  { id: 'worst_qoq', volume: 'grande', question: 'Em todo o histórico do banco, para as empresas dos EUA, qual foi a maior queda de receita de um trimestre para o trimestre imediatamente anterior (em %)? Informe a empresa, o trimestre (period_end) e a queda.',
    truth: () => { const r = all(`SELECT symbol, period_end, (revenue_usd_b / prev - 1) * 100 v FROM (SELECT symbol, period_end, revenue_usd_b, LAG(revenue_usd_b) OVER (PARTITION BY symbol ORDER BY period_end) prev FROM v_quarter WHERE market='EUA') WHERE prev > 0 ORDER BY v LIMIT 1`)[0]; return { must: [co(r.symbol), { text: [r.period_end] }, num(Number(r.v.toFixed(1)), 0.3)] }; } },
  { id: 'source_counts', volume: 'pequeno', question: 'Quantos trimestres existem no banco para cada fonte de dados (campo source)? Informe a contagem de cada fonte.',
    truth: () => ({ must: all('SELECT source, COUNT(*) n FROM v_quarter GROUP BY source').flatMap((r) => [{ text: r.source === 'Yahoo + empresa' ? ['Yahoo + empresa', 'empresa'] : [r.source] }, num(r.n, 0)]) }) },
  { id: 'quality', volume: 'médio', question: 'Rode as verificações de qualidade dos dados. Há algum erro? Cite os ids das regras que encontraram avisos.',
    truth: () => { const q = require('../../pipeline/quality').check(db).filter((r) => r.rows.length); return { must: q.map((r) => ({ text: [r.id] })), forbid: q.length ? [] : [] }; } },
];

module.exports = { TASKS, grade, norm };

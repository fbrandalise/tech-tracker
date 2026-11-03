'use strict';
/*
 * Controle de qualidade dos dados: cada regra é uma consulta que devolve as linhas suspeitas (symbol, period_end, detalhe).
 * As regras vêm das convenções da ontologia (ontology/earnings.yaml): unidades, identidades contábeis e limitações das fontes.
 *
 * Uso:  node pipeline/quality.js [pasta_de_dados] [--json] [--strict]
 *   erro  = o dado está errado (identidade quebrada, duplicata, valor impossível): sai com código 1
 *   aviso = o dado é possível, mas merece conferência (variação extrema, lacuna): só sai com 1 se houver --strict
 * Abre o banco somente leitura; não altera nada.
 */
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('--'));

const RULES = [
  // ---- erros: o dado não pode estar assim ----
  { id: 'duplicate_quarter', level: 'erro', what: 'Dois trimestres da mesma empresa com fim a menos de 8 dias um do outro (fontes com datas diferentes que não foram unidas)',
    sql: `SELECT a.symbol, a.period_end, 'também ' || b.period_end || ' (' || b.source || ')' AS detail
          FROM quarters a JOIN quarters b ON a.symbol = b.symbol AND a.period_end < b.period_end
           AND julianday(b.period_end) - julianday(a.period_end) < 8` },
  { id: 'revenue_not_positive', level: 'erro', what: 'Receita zero ou negativa',
    sql: `SELECT symbol, period_end, 'receita ' || revenue_usd_b || ' bi' FROM v_quarter WHERE revenue_usd_b <= 0` },
  { id: 'future_period', level: 'erro', what: 'Trimestre terminando no futuro',
    sql: `SELECT symbol, period_end, 'hoje é ' || date('now') FROM v_quarter WHERE period_end > date('now')` },
  { id: 'gross_profit_above_revenue', level: 'erro', what: 'Lucro bruto maior que a receita',
    sql: `SELECT symbol, period_end, 'bruto ' || gross_profit_usd_b || ' > receita ' || revenue_usd_b FROM v_quarter WHERE gross_profit_usd_b > revenue_usd_b * 1.001` },
  { id: 'margin_impossible', level: 'erro', what: 'Margem líquida ou operacional acima de 100%, ou margem bruta fora de 0–100%',
    sql: `SELECT symbol, period_end, 'líquida ' || net_margin || '%, operacional ' || operating_margin || '%, bruta ' || gross_margin || '%' FROM v_quarter
          WHERE net_margin > 100 OR operating_margin > 100 OR gross_margin < 0 OR gross_margin > 100` },
  { id: 'capex_negative', level: 'erro', what: 'Capex negativo (a convenção é guardar como valor positivo)',
    sql: `SELECT symbol, period_end, 'capex ' || capex_usd_b FROM v_quarter WHERE capex_usd_b < 0` },
  { id: 'fcf_identity', level: 'erro', what: 'Fluxo de caixa livre diferente de caixa operacional menos capex',
    sql: `SELECT symbol, period_end, 'fcf ' || fcf_usd_b || ' vs ocf ' || ocf_usd_b || ' - capex ' || capex_usd_b FROM v_quarter
          WHERE ocf_usd_b IS NOT NULL AND capex_usd_b IS NOT NULL AND fcf_usd_b IS NOT NULL AND abs(fcf_usd_b - (ocf_usd_b - capex_usd_b)) > 0.011` },
  { id: 'net_cash_identity', level: 'erro', what: 'Caixa líquido diferente de caixa menos dívida',
    sql: `SELECT symbol, period_end, 'líquido ' || net_cash_usd_b || ' vs ' || cash_usd_b || ' - ' || debt_usd_b FROM v_quarter
          WHERE cash_usd_b IS NOT NULL AND debt_usd_b IS NOT NULL AND net_cash_usd_b IS NOT NULL AND abs(net_cash_usd_b - (cash_usd_b - debt_usd_b)) > 0.011` },
  { id: 'revenue_spike', level: 'erro', what: 'Receita mais de 3x a dos dois trimestres vizinhos (sintoma de ano inteiro gravado como trimestre)',
    sql: `SELECT symbol, period_end, 'receita ' || revenue_usd_b || ' bi entre ' || prev || ' e ' || next || ' (' || source || ')' FROM (
            SELECT symbol, period_end, source, revenue_usd_b,
                   LAG(revenue_usd_b) OVER w AS prev, LEAD(revenue_usd_b) OVER w AS next FROM v_quarter
            WINDOW w AS (PARTITION BY symbol ORDER BY period_end)
          ) WHERE prev > 0 AND next > 0 AND revenue_usd_b > 3 * prev AND revenue_usd_b > 3 * next` },
  { id: 'latest_not_newest', level: 'erro', what: 'O "último trimestre" do painel não é o mais recente do banco',
    sql: `SELECT l.symbol, l.period_end, 'o banco tem ' || m.p FROM v_latest l
          JOIN (SELECT symbol, MAX(period_end) p FROM v_quarter GROUP BY symbol) m ON m.symbol = l.symbol
          WHERE julianday(m.p) - julianday(l.period_end) > 7` },

  // ---- avisos: possível, mas confira ----
  { id: 'revenue_jump', level: 'aviso', what: 'Receita a/a acima de +150% ou abaixo de -50% (pode ser aquisição, desdobramento de unidade ou erro de fonte)',
    sql: `SELECT symbol, period_end, 'a/a ' || revenue_yoy || '% (' || source || ')' FROM v_quarter WHERE revenue_yoy > 150 OR revenue_yoy < -50` },
  { id: 'net_margin_extreme', level: 'aviso', what: 'Margem líquida abaixo de -100% (prejuízo maior que a receita)',
    sql: `SELECT symbol, period_end, 'líquida ' || net_margin || '% (' || source || ')' FROM v_quarter WHERE net_margin < -100` },
  { id: 'tax_rate_odd', level: 'aviso', what: 'Alíquota efetiva fora de 0–60%',
    sql: `SELECT symbol, period_end, 'alíquota ' || tax_rate || '%' FROM v_quarter WHERE tax_rate < 0 OR tax_rate > 60` },
  { id: 'quarter_gap', level: 'aviso', what: 'EUA: salto de mais de 120 dias entre trimestres consecutivos (falta um trimestre no histórico)',
    sql: `SELECT symbol, period_end, 'depois de ' || prev || ' (' || CAST(julianday(period_end) - julianday(prev) AS INT) || ' dias)' FROM (
            SELECT symbol, period_end, market, LAG(period_end) OVER (PARTITION BY symbol ORDER BY period_end) AS prev FROM v_quarter
          ) WHERE market = 'EUA' AND prev IS NOT NULL AND julianday(period_end) - julianday(prev) > 120` },
  { id: 'eps_surprise_extreme', level: 'aviso', what: 'Surpresa de EPS acima de ±100% (estimativa ou EPS real talvez em base diferente)',
    sql: `SELECT symbol, period_end, 'real ' || eps_native || ' vs estimado ' || eps_estimate_native || ' (' || eps_surprise_pct || '%)' FROM v_latest
          WHERE abs(eps_surprise_pct) > 100` },
  { id: 'price_reaction_extreme', level: 'aviso', what: 'Reação do preço acima de ±30% no dia do resultado',
    sql: `SELECT symbol, period_end, 'reação ' || price_reaction_pct || '%' FROM v_latest WHERE abs(price_reaction_pct) > 30` },
  { id: 'stale_report', level: 'aviso', what: 'A próxima divulgação já passou há mais de 7 dias e o banco ainda mostra o resultado antigo',
    sql: `SELECT symbol, period_end, 'próximo resultado previsto ' || next_earnings || ', último trimestre ' || period_end FROM v_latest
          WHERE next_earnings IS NOT NULL AND julianday('now') - julianday(next_earnings) > 7 AND julianday(next_earnings) > julianday(period_end)` },
  { id: 'missing_core', level: 'aviso', what: 'Trimestre dos EUA sem receita, lucro líquido ou caixa operacional',
    sql: `SELECT symbol, period_end, 'faltam: ' || trim((CASE WHEN revenue_usd_b IS NULL THEN 'receita ' ELSE '' END) || (CASE WHEN net_income_usd_b IS NULL THEN 'lucro ' ELSE '' END) || (CASE WHEN ocf_usd_b IS NULL THEN 'ocf' ELSE '' END)) FROM v_quarter
          WHERE market = 'EUA' AND (revenue_usd_b IS NULL OR net_income_usd_b IS NULL OR ocf_usd_b IS NULL)` },
  { id: 'multiples_unreliable', level: 'aviso', what: 'P/L abaixo de 3 ou acima de 500 (lucro TTM muito pequeno ou unidade errada)',
    sql: `SELECT symbol, period_end, 'P/L ' || pe FROM v_latest WHERE pe IS NOT NULL AND (pe < 3 OR pe > 500)` },
];

function check(db) {
  return RULES.map((r) => {
    const rows = db.prepare(r.sql).all().map((x) => {
      const v = Object.values(x);
      return { symbol: v[0], period_end: v[1], detail: v[2] };
    });
    return { id: r.id, level: r.level, what: r.what, rows };
  });
}

module.exports = { check, RULES };

if (require.main === module) {
  const dir = path.resolve(positional[0] || path.join(__dirname, '..', 'data', 'cache'));
  const db = new DatabaseSync(process.env.DB_PATH || path.join(dir, 'earnings.db'), { readOnly: true });
  const res = check(db);
  db.close();
  const errors = res.filter((r) => r.level === 'erro' && r.rows.length).length;
  const warns = res.filter((r) => r.level === 'aviso' && r.rows.length).length;

  if (args.includes('--json')) console.log(JSON.stringify(res, null, 2));
  else {
    for (const r of res) {
      console.log(`${r.rows.length ? (r.level === 'erro' ? 'ERRO ' : 'aviso') : 'ok   '} ${r.id}${r.rows.length ? ` (${r.rows.length})` : ''}`);
      if (r.rows.length) {
        console.log(`        ${r.what}`);
        for (const x of r.rows.slice(0, 8)) console.log(`        - ${x.symbol} ${x.period_end}: ${x.detail}`);
        if (r.rows.length > 8) console.log(`        … mais ${r.rows.length - 8}`);
      }
    }
    console.log(`\n${RULES.length} regras: ${errors} com erro, ${warns} com aviso`);
  }
  process.exit(errors || (warns && args.includes('--strict')) ? 1 : 0);
}

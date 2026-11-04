'use strict';
/*
 * Briefing pré-divulgação: "o que esperar de <empresa>" só com os números do banco (sem LLM).
 * Uso: npm run briefing -- NVDA [--json]
 * Cada afirmação sai de uma conta sobre os dados; nada é inferido por modelo.
 */
const path = require('path');
const store = require('./db');

const pct = (x, d = 1) => (x == null ? '—' : `${x >= 0 ? '+' : ''}${x.toFixed(d)}%`);
const num = (x, d = 1) => (x == null ? '—' : x.toFixed(d));
const days = (iso) => Math.round((new Date(iso) - new Date(new Date().toISOString().slice(0, 10))) / 864e5);

function briefing(db, symbol, lang = 'pt') {
  const en = lang === 'en';
  const sym = symbol.toUpperCase();
  const row = store.getLatest(db)?.rows.find((r) => r.symbol === sym);
  if (!row) throw new Error(`Empresa desconhecida: ${sym}`);
  const q = db.prepare('SELECT * FROM v_quarter WHERE symbol = ? ORDER BY period_end DESC LIMIT 8').all(sym);
  const last = q[0];

  // 1. o que o mercado espera, em relação ao que já foi reportado
  const exp = { date: row.nextEarnings, estimated: !!row.nextEstimated, eps: row.nextEps, revB: row.nextRevB };
  // o consenso vem na moeda da empresa: compara com a receita nessa mesma moeda (row.revenueB), nunca com a coluna em USD
  if (exp.revB != null && row.revenueB) exp.revSeqPct = (exp.revB / row.revenueB - 1) * 100;
  // o próximo trimestre é ~1 ano depois do que terminou ~273 dias antes do último reportado
  const yearAgo = last && q.find((x) => Math.abs((new Date(last.period_end) - new Date(x.period_end)) / 864e5 - 273) < 46);
  if (exp.revB != null && yearAgo?.revenue_usd_b && row.currency === 'USD') { exp.revYoyPct = (exp.revB / yearAgo.revenue_usd_b - 1) * 100; exp.yoyBase = yearAgo.period_end; }

  // 2. histórico de acerto do EPS
  const eps = (row.epsHist || []).map((h) => ({ date: h.d, actual: h.a, estimate: h.e, surprisePct: h.e ? (h.a / h.e - 1) * 100 : null }));
  const beats = eps.filter((e) => e.actual > e.estimate).length;

  // 3. reação do preço: só há a do último resultado (limitação conhecida, ver README)
  const reaction = row.reactPct == null ? null : { pct: row.reactPct, from: row.reactFrom, to: row.reactTo, report: row.reportDate };

  // 4. tendência dos últimos trimestres (do mais antigo ao mais novo)
  const trend = [...q].reverse().filter((x) => x.revenue_usd_b != null).map((x) => ({ period_end: x.period_end, source: x.source, revenue: x.revenue_usd_b, yoy: x.revenue_yoy, gross: x.gross_margin, op: x.operating_margin, net: x.net_margin, rd: x.rd_pct, capex: x.capex_pct, fcf: x.fcf_margin }));

  // 5. o que observar: regras determinísticas sobre a série (cada uma cita os números que usou)
  const watch = [];
  const t = trend.filter((x) => x.yoy != null);
  if (t.length >= 3) {
    const [a, b, c] = t.slice(-3);
    const seq = `${num(a.yoy)}% → ${num(b.yoy)}% → ${num(c.yoy)}%`;
    if (c.yoy < b.yoy && b.yoy < a.yoy) watch.push(en ? `YoY growth slowing for 2 straight quarters (${seq}).` : `Crescimento a/a desacelerando 2 trimestres seguidos (${seq}).`);
    else if (c.yoy > b.yoy && b.yoy > a.yoy) watch.push(en ? `YoY growth accelerating for 2 straight quarters (${seq}).` : `Crescimento a/a acelerando 2 trimestres seguidos (${seq}).`);
  }
  const m = trend.filter((x) => x.op != null).slice(-4);
  if (m.length === 4) {
    const d = m[3].op - m[0].op, rng = `${num(m[0].op)}% → ${num(m[3].op)}%`;
    if (Math.abs(d) >= 2) watch.push(en ? `Operating margin ${d > 0 ? 'up' : 'down'} ${num(Math.abs(d))} pp over 3 quarters (${rng}).` : `Margem operacional ${d > 0 ? 'subiu' : 'caiu'} ${num(Math.abs(d))} p.p. em 3 trimestres (${rng}).`);
  }
  const r = trend.filter((x) => x.rd != null).slice(-4);
  if (r.length === 4 && t.length >= 2 && Math.abs(r[3].rd - r[0].rd) >= 1) {
    const y = pct(t[t.length - 1].yoy);
    watch.push(en ? `R&D went from ${num(r[0].rd)}% to ${num(r[3].rd)}% of revenue over 3 quarters, with revenue ${y} YoY.` : `P&D passou de ${num(r[0].rd)}% para ${num(r[3].rd)}% da receita em 3 trimestres, com receita ${y} a/a.`);
  }
  if (exp.revSeqPct != null) {
    const yo = exp.revYoyPct != null ? (en ? ` and ${pct(exp.revYoyPct)} on ${exp.yoyBase}` : ` e ${pct(exp.revYoyPct)} sobre ${exp.yoyBase}`) : '';
    watch.push(en ? `Consensus expects revenue of ${num(exp.revB)} bn ${row.currency}: ${pct(exp.revSeqPct)} on the last quarter${yo}.` : `O consenso espera receita de ${num(exp.revB)} bi ${row.currency}: ${pct(exp.revSeqPct)} sobre o último trimestre${yo}.`);
  }
  if (eps.length >= 3) {
    const avg = pct(eps.reduce((s, e) => s + e.surprisePct, 0) / eps.length);
    watch.push(en ? `Beat the EPS estimate in ${beats} of ${eps.length} reports${eps.length === beats ? ' (all)' : ''}; average surprise ${avg}.` : `Bateu a estimativa de EPS em ${beats} de ${eps.length} divulgações${eps.length === beats ? ' (todas)' : ''}; surpresa média ${avg}.`);
  }
  if (row.revenueSurprisePct != null) watch.push(en ? `Last report revenue beat consensus by ${pct(row.revenueSurprisePct)}: the new consensus starts from a higher base.` : `Na última divulgação a receita superou o consenso em ${pct(row.revenueSurprisePct)}: o consenso novo já parte de uma base mais alta.`);

  // 6. segmentos do último trimestre (curadoria)
  const seg = row.seg?.g?.flatMap((g) => g.i.map((i) => ({ group: g.t, name: i.n, revenueB: i.v, prevB: i.p, yoy: i.y ?? (i.p ? (i.v / i.p - 1) * 100 : null) }))) || [];

  return { symbol: sym, name: row.name, currency: row.currency, expected: exp, last: { period_end: row.periodEnd, report_date: row.reportDate, source: last?.source }, eps, reaction, trend, watch, segments: seg, segmentsNote: row.seg?.note || null, segmentsSource: row.seg?.src?.label || null, valuation: { pe: row.pe, fwdPe: row.fwdPe, evRevenue: row.evRev, mcapUsdB: row.mcapUsdB } };
}

function render(b) {
  const L = [];
  const e = b.expected;
  L.push(`# ${b.name} (${b.symbol}): o que esperar`, '');
  L.push(`**Próxima divulgação:** ${e.date || 'sem data'}${e.date ? ` (em ${days(e.date)} dias, data ${e.estimated ? 'estimada' : 'confirmada ou da fonte'})` : ''}`);
  L.push(`**Consenso:** EPS ${num(e.eps, 2)} · receita ${e.revB != null ? `${num(e.revB)} bi` : '—'} (${b.currency})`, '');
  L.push('## O que observar', ...(b.watch.length ? b.watch.map((w) => `- ${w}`) : ['- Sem sinais calculáveis com os dados disponíveis.']), '');
  L.push('## Histórico de acerto do EPS', '| Data | Real | Estimado | Surpresa |', '|---|---:|---:|---:|', ...b.eps.map((x) => `| ${x.date} | ${num(x.actual, 2)} | ${num(x.estimate, 2)} | ${pct(x.surprisePct)} |`), '');
  L.push('## Reação do preço');
  L.push(b.reaction ? `Última divulgação (${b.reaction.report}): ${pct(b.reaction.pct)} entre ${b.reaction.from} e ${b.reaction.to}. **Só há a reação mais recente**: o histórico por divulgação ainda não é gravado.` : 'Sem dado.', '');
  L.push('## Tendência (US$ bi, % da receita)', '| Trimestre | Fonte | Receita | a/a | Margem bruta | Margem op. | P&D | Capex | FCF |', '|---|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const x of b.trend) L.push(`| ${x.period_end} | ${x.source} | ${num(x.revenue)} | ${pct(x.yoy)} | ${num(x.gross)}% | ${num(x.op)}% | ${num(x.rd)}% | ${num(x.capex)}% | ${num(x.fcf)}% |`);
  L.push('');
  if (b.segments.length) {
    L.push('## Segmentos (último trimestre, curadoria manual)', '| Segmento | Receita (US$ bi) | a/a |', '|---|---:|---:|');
    for (const s of b.segments) L.push(`| ${s.name} | ${num(s.revenueB)} | ${pct(s.yoy, 0)} |`);
    if (b.segmentsNote) L.push('', `_${b.segmentsNote}_`);
    L.push('');
  }
  L.push('## Valuation', `P/L ${num(b.valuation.pe)} · P/L projetado ${num(b.valuation.fwdPe)} · EV/receita ${num(b.valuation.evRevenue)} · valor de mercado US$ ${num(b.valuation.mcapUsdB, 0)} bi`, '');
  L.push(`_Último trimestre reportado: ${b.last.period_end} (divulgado em ${b.last.report_date}). Dados de FMP, Yahoo e SEC; ver ontologia para definições. Não é recomendação de investimento._`);
  return L.join('\n');
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const symbol = args.find((a) => !a.startsWith('--'));
  if (!symbol) { console.error('uso: npm run briefing -- SÍMBOLO [--json]'); process.exit(2); }
  const db = store.open(process.env.DB_PATH || path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data', 'cache'), 'earnings.db'));
  try {
    const b = briefing(db, symbol);
    console.log(args.includes('--json') ? JSON.stringify(b, null, 2) : render(b));
  } catch (e) { console.error(e.message); process.exit(1); }
}

module.exports = { briefing, render };

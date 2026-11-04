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

  // 3. reação do preço a cada divulgação (tabela reactions), cruzada com a surpresa de EPS da mesma data
  const surpByDate = new Map(eps.map((e) => [e.date, e.surprisePct]));
  const reactions = store.getReactions(db, sym).map((x) => ({ date: x.report_date, from: x.from_date, to: x.to_date, pct: x.pct, epsSurprisePct: surpByDate.get(x.report_date) ?? null }));
  const reaction = reactions[0] || null;

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
  if (row.revenueSurprisePct != null) {
    const v = row.revenueSurprisePct, up = v >= 0, a = pct(Math.abs(v));
    watch.push(en ? `Last report revenue ${up ? 'beat' : 'missed'} consensus by ${a}${up ? ': the new consensus starts from a higher base.' : '.'}` : `Na última divulgação a receita ficou ${a} ${up ? 'acima' : 'abaixo'} do consenso${up ? ': o consenso novo já parte de uma base mais alta.' : '.'}`);
  }

  if (reactions.length >= 3) {
    const avgAbs = reactions.reduce((s, x) => s + Math.abs(x.pct), 0) / reactions.length;
    watch.push(en ? `Average price move after the last ${reactions.length} reports: ${num(avgAbs)}% (absolute, 2-day window).` : `Movimento médio do preço nas últimas ${reactions.length} divulgações: ${num(avgAbs)}% (absoluto, janela de 2 dias).`);
    const beatFell = reactions.filter((x) => x.epsSurprisePct > 0 && x.pct < 0).length;
    const beats2 = reactions.filter((x) => x.epsSurprisePct > 0).length;
    if (beats2 >= 2 && beatFell >= 1) watch.push(en ? `Beating EPS did not guarantee a rise: the price fell after ${beatFell} of ${beats2} beats.` : `Bater o EPS não garantiu alta: o preço caiu em ${beatFell} de ${beats2} divulgações com EPS acima do esperado.`);
  }

  // 6. segmentos (SEC, histórico): eixo com mais membros de nível mais alto; só linhas sem pai, para não contar duas vezes
  const segRows = db.prepare("SELECT period_end, axis, segment, taxonomy, revenue_usd_b, revenue_yoy, share_of_revenue_pct, contribution_to_growth_pct FROM v_segment WHERE symbol = ? AND parent_segment IS NULL ORDER BY period_end").all(sym);
  // eixo: prefere produtos (o que interessa a quem faz produto) quando os de nível mais alto fecham ~100% da receita no último trimestre;
  // senão usa os segmentos reportáveis. Eixos que misturam cortes (ex.: Amazon por produto soma 145%) não são usados.
  const closes = (ax) => {
    const rows = segRows.filter((r) => r.axis === ax);
    if (new Set(rows.map((r) => r.segment)).size < 2) return false;
    const last = rows[rows.length - 1].period_end;
    const sum = rows.filter((r) => r.period_end === last).reduce((a, r) => a + (r.share_of_revenue_pct || 0), 0);
    return sum >= 95 && sum <= 105;
  };
  const axis = closes('product') ? 'product' : closes('segment') ? 'segment' : null;
  const seg = axis ? segRows.filter((r) => r.axis === axis) : [];
  const segPeriods = [...new Set(seg.map((r) => r.period_end))].slice(-6);
  const segLatest = seg.filter((r) => r.period_end === segPeriods[segPeriods.length - 1]).sort((a, b) => b.revenue_usd_b - a.revenue_usd_b);
  if (segLatest.length >= 2) {
    const top = [...segLatest].filter((x) => x.contribution_to_growth_pct != null).sort((a, b) => b.contribution_to_growth_pct - a.contribution_to_growth_pct)[0];
    if (top) watch.push(en ? `${top.segment} drove ${num(top.contribution_to_growth_pct, 0)}% of the YoY revenue growth in the last reported quarter (${num(top.share_of_revenue_pct, 0)}% of revenue).` : `${top.segment} respondeu por ${num(top.contribution_to_growth_pct, 0)}% do crescimento a/a da receita no último trimestre (${num(top.share_of_revenue_pct, 0)}% da receita).`);
    if (new Set(seg.filter((r) => segPeriods.includes(r.period_end)).map((r) => r.taxonomy)).size > 1) watch.push(en ? 'The company changed how it reports segments in the last 6 quarters: compare only the same segment definition across quarters.' : 'A empresa mudou a forma de reportar segmentos nos últimos 6 trimestres: compare só a mesma definição de segmento entre trimestres.');
  }
  const segments = { axis, periods: segPeriods, latest: segLatest.map((r) => ({ name: r.segment, revenueB: r.revenue_usd_b, yoy: r.revenue_yoy, sharePct: r.share_of_revenue_pct, contributionPct: r.contribution_to_growth_pct })),
    history: [...new Set(seg.filter((r) => segPeriods.includes(r.period_end)).map((r) => r.segment))].map((name) => ({ name, values: segPeriods.map((pe) => seg.find((r) => r.period_end === pe && r.segment === name)?.revenue_usd_b ?? null) })) };

  return { symbol: sym, name: row.name, currency: row.currency, expected: exp, last: { period_end: row.periodEnd, report_date: row.reportDate, source: last?.source }, eps, reaction, reactions, trend, watch, segments, segmentsNote: row.seg?.note || null, valuation: { pe: row.pe, fwdPe: row.fwdPe, evRevenue: row.evRev, mcapUsdB: row.mcapUsdB } };
}

function render(b) {
  const L = [];
  const e = b.expected;
  L.push(`# ${b.name} (${b.symbol}): o que esperar`, '');
  L.push(`**Próxima divulgação:** ${e.date || 'sem data'}${e.date ? ` (em ${days(e.date)} dias, data ${e.estimated ? 'estimada' : 'confirmada ou da fonte'})` : ''}`);
  L.push(`**Consenso:** EPS ${num(e.eps, 2)} · receita ${e.revB != null ? `${num(e.revB)} bi` : '—'} (${b.currency})`, '');
  L.push('## O que observar', ...(b.watch.length ? b.watch.map((w) => `- ${w}`) : ['- Sem sinais calculáveis com os dados disponíveis.']), '');
  L.push('## Histórico de acerto do EPS', '| Data | Real | Estimado | Surpresa |', '|---|---:|---:|---:|', ...b.eps.map((x) => `| ${x.date} | ${num(x.actual, 2)} | ${num(x.estimate, 2)} | ${pct(x.surprisePct)} |`), '');
  L.push('## Reação do preço', '| Divulgação | Surpresa EPS | Reação (2 dias) |', '|---|---:|---:|', ...b.reactions.map((x) => `| ${x.date} | ${pct(x.epsSurprisePct)} | ${pct(x.pct)} |`), '');
  L.push('## Tendência (US$ bi, % da receita)', '| Trimestre | Fonte | Receita | a/a | Margem bruta | Margem op. | P&D | Capex | FCF |', '|---|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const x of b.trend) L.push(`| ${x.period_end} | ${x.source} | ${num(x.revenue)} | ${pct(x.yoy)} | ${num(x.gross)}% | ${num(x.op)}% | ${num(x.rd)}% | ${num(x.capex)}% | ${num(x.fcf)}% |`);
  L.push('');
  if (b.segments.axis) {
    L.push(`## Segmentos (${b.segments.axis === 'segment' ? 'reportáveis' : 'produtos'}, SEC, US$ bi)`, `| Segmento | ${b.segments.periods.join(' | ')} | a/a | % da receita | Contribuição ao crescimento |`, `|---|${b.segments.periods.map(() => '---:').join('|')}|---:|---:|---:|`);
    for (const h of b.segments.history) { const l = b.segments.latest.find((x) => x.name === h.name); L.push(`| ${h.name} | ${h.values.map((v) => num(v)).join(' | ')} | ${pct(l?.yoy)} | ${l ? num(l.sharePct, 0) + '%' : '—'} | ${l ? num(l.contributionPct, 0) + '%' : '—'} |`); }
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

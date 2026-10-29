'use strict';
/*
 * Coleta e monta os dados do painel.
 *   - FMP (/stable) para as empresas dos EUA que o plano gratuito libera (chave em FMP_API_KEY)
 *   - Yahoo Finance para o resto e para histórico, valuation, preço e calendário
 *   - data/segments.json, data/overrides.json e data/news.json são curados à mão
 * Saída: <OUT_DIR>/earnings.json e meta.json
 * Uso:  node pipeline/refresh.js [pasta_de_saida]   (padrão: data/cache)
 */
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data');
const readJson = (f, fallback) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return fallback; } };
const loadEnvFile = () => {
  // .env local (opcional): procura na pasta do painel e na raiz do repositório
  for (const dir of [path.join(__dirname, '..'), path.join(__dirname, '..', '..')]) {
    const f = path.join(dir, '.env');
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
};
loadEnvFile();

const FMP_KEY = process.env.FMP_API_KEY || '';
let yf;
const yahoo = () => {
  if (!yf) { const YF = require('yahoo-finance2').default; yf = new YF({ suppressNotices: ['yahooSurvey'], validation: { logErrors: false } }); }
  return yf;
};

// ---------- utilidades
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const day = (d) => new Date(d).getTime() / 864e5;
const near = (list, t, tol = 7) => (t ? list.find((x) => Math.abs(day(x.date) - day(t)) <= tol) || null : null);
const shiftYear = (d, n) => { const t = new Date(d); t.setUTCFullYear(t.getUTCFullYear() + n); return t; };
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const pos = (v) => (num(v) != null && v > 0 ? v : null);
const abs = (v) => (num(v) == null ? null : Math.abs(v));
const sum = (...a) => (a.every((v) => v == null) ? null : a.reduce((s, v) => s + (v || 0), 0));
const pctChg = (a, b) => (a != null && b != null && b !== 0 ? +(((a - b) / Math.abs(b)) * 100).toFixed(1) : null);
const p1 = (v) => (v == null || !Number.isFinite(v) ? null : +v.toFixed(1));
const p2 = (v) => (v == null || !Number.isFinite(v) ? null : +v.toFixed(2));
const bil = (v) => (v == null ? null : +(v / 1e9).toFixed(3));
const ratio = (a, b) => (a != null && b ? p1((a / b) * 100) : null);
const log = (...a) => { if (!process.env.QUIET) console.log(...a); };

// guarda a última resposta boa do FMP; se ele falhar (limite diário, instabilidade) reaproveita a guardada
const fmpStore = { data: {}, dirty: false, stale: new Set() };
const loadFmpStore = (outDir) => { fmpStore.data = readJson(path.join(outDir, 'fmp-cache.json'), null) || readJson(path.join(DATA, 'fmp-cache.json'), {}); fmpStore.dirty = false; fmpStore.stale = new Set(); };
async function fmpLive(sym, kind, fetcher, maxAgeHours) {
  const slot = (fmpStore.data[sym] ||= {});
  if (maxAgeHours && slot[kind] && slot[kind + 'At'] && (Date.now() - new Date(slot[kind + 'At']).getTime()) < maxAgeHours * 36e5) return slot[kind];
  const live = await fetcher();
  if (Array.isArray(live) ? live.length > 0 : !!live) { slot[kind] = live; slot[kind + 'At'] = new Date().toISOString(); fmpStore.dirty = true; return live; }
  if (slot[kind]) { fmpStore.stale.add(sym); return slot[kind]; }
  return null;
}
async function fmp(endpoint, params) {
  if (!FMP_KEY) return null;
  try {
    const q = new URLSearchParams({ ...params, apikey: FMP_KEY });
    const r = await fetch(`https://financialmodelingprep.com/stable/${endpoint}?${q}`, { signal: AbortSignal.timeout(20000) });
    const j = await r.json();
    return Array.isArray(j) ? j : null;
  } catch (e) { return null; }
}

// ---------- trimestres normalizados
// campos: date, rev, ni, gp, oi, sm (vendas e marketing), sga, ga, rd, opex, ocf, capex, sbc, cash, debt, ebitda, tax, pretax, eps
async function fmpQuarters(sym) {
  const [cf, bs, is] = await Promise.all(['cash-flow-statement', 'balance-sheet-statement', 'income-statement'].map((e) => fmp(e, { symbol: sym, period: 'quarter', limit: 5 })));
  if (!is || !is.length) return [];
  const by = {};
  for (const x of is) by[x.date] = { ...(by[x.date] || {}), is: x };
  for (const x of cf || []) by[x.date] = { ...(by[x.date] || {}), cf: x };
  for (const x of bs || []) by[x.date] = { ...(by[x.date] || {}), bs: x };
  return Object.entries(by).filter(([, o]) => o.is).map(([date, o]) => ({
    date, src: 'FMP',
    rev: num(o.is.revenue), ni: num(o.is.netIncome), gp: num(o.is.grossProfit), oi: num(o.is.operatingIncome),
    sm: pos(o.is.sellingAndMarketingExpenses), sga: pos(o.is.sellingGeneralAndAdministrativeExpenses),
    ga: pos(o.is.generalAndAdministrativeExpenses), rd: pos(o.is.researchAndDevelopmentExpenses), opex: num(o.is.operatingExpenses),
    ebitda: num(o.is.ebitda), tax: num(o.is.incomeTaxExpense), pretax: num(o.is.incomeBeforeTax), eps: num(o.is.epsDiluted ?? o.is.eps),
    ocf: num(o.cf?.operatingCashFlow), capex: abs(o.cf?.capitalExpenditure), sbc: num(o.cf?.stockBasedCompensation),
    cash: num(o.bs?.cashAndShortTermInvestments), debt: sum(num(o.bs?.shortTermDebt), num(o.bs?.longTermDebt)),
  })).sort((a, b) => a.date.localeCompare(b.date));
}

async function yahooQuarters(ys) {
  const get = (m) => yahoo().fundamentalsTimeSeries(ys, { period1: '2024-01-01', module: m, type: 'quarterly' }, { validateResult: false }).catch(() => []);
  const [a, b, c] = await Promise.all([get('financials'), get('cash-flow'), get('balance-sheet')]);
  const m = {};
  for (const list of [a, b, c]) for (const x of list) {
    if (x.periodType !== '3M') continue;
    const k = iso(x.date);
    m[k] = { ...(m[k] || {}), ...x, date: k };
  }
  return Object.values(m).map((x) => ({
    date: x.date, src: 'Yahoo',
    rev: num(x.totalRevenue ?? x.operatingRevenue), ni: num(x.netIncomeCommonStockholders ?? x.netIncome), gp: num(x.grossProfit), oi: num(x.operatingIncome),
    sm: pos(x.sellingAndMarketingExpense), sga: pos(x.sellingGeneralAndAdministration), ga: pos(x.generalAndAdministrativeExpense), rd: pos(x.researchAndDevelopment),
    opex: num(x.operatingExpense), ebitda: num(x.EBITDA), tax: num(x.taxProvision), pretax: num(x.pretaxIncome), eps: num(x.dilutedEPS),
    ocf: num(x.operatingCashFlow), capex: abs(x.capitalExpenditure), sbc: num(x.stockBasedCompensation),
    cash: num(x.cashCashEquivalentsAndShortTermInvestments), debt: sum(num(x.currentDebt), num(x.longTermDebt)),
  })).sort((a, b2) => a.date.localeCompare(b2.date));
}

// FMP tem prioridade; Yahoo completa os trimestres que o FMP não traz
function mergeQuarters(primary, secondary) {
  const out = primary.map((q) => ({ ...q }));
  for (const q of secondary) {
    const hit = near(out, q.date);
    if (!hit) out.push({ ...q });
    else for (const k of Object.keys(q)) if (hit[k] == null && q[k] != null && k !== 'src') hit[k] = q[k];
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ---------- câmbio e preços
async function fxRates(currencies) {
  const rates = { USD: 1 };
  for (const c of currencies) {
    if (!c || rates[c] != null) continue;
    try { const q = await yahoo().quote(`${c}USD=X`, {}, { validateResult: false }); rates[c] = num(q.regularMarketPrice); } catch (e) { rates[c] = null; }
  }
  return rates;
}

async function priceReaction(ys, reportDate) {
  if (!reportDate) return null;
  try {
    const rd = new Date(reportDate + 'T12:00:00Z');
    const res = await yahoo().chart(ys, { period1: new Date(rd.getTime() - 12 * 864e5), period2: new Date(rd.getTime() + 12 * 864e5), interval: '1d' }, { validateResult: false });
    const bars = (res.quotes || []).filter((q) => num(q.close) != null).map((q) => ({ d: iso(q.date), c: q.close }));
    const before = [...bars].reverse().find((b) => b.d < reportDate);
    const after = bars.find((b) => b.d > reportDate);
    if (!before || !after) return null;
    return { pct: pctChg(after.c, before.c), from: before.d, to: after.d, c0: p2(before.c), c1: p2(after.c) };
  } catch (e) { return null; }
}

// ---------- coleta de uma empresa
async function collect(c, ov, state, today) {
  const ys = c.y;
  const useFmp = c.market === 'EUA' && c.fmp;   // sem chave ou com o FMP fora do ar, usa os dados guardados da última coleta boa
  const sum1 = await yahoo().quoteSummary(ys, { modules: ['earningsHistory', 'calendarEvents', 'financialData', 'summaryDetail', 'defaultKeyStatistics', 'price', 'assetProfile'] }, { validateResult: false }).catch(() => ({}));

  let fmpQ = [], fmpE = null;
  if (useFmp) {
    fmpQ = (await fmpLive(c.symbol, 'quarters', () => fmpQuarters(c.symbol))) || [];
    fmpE = await fmpLive(c.symbol, 'earnings', () => fmp('earnings', { symbol: c.symbol, limit: 5 }));
    if (!fmpQ.length || !fmpE) throw new Error('FMP indisponível e sem dados guardados');
  }
  const yQ = await yahooQuarters(ys);
  let quarters = mergeQuarters(fmpQ, yQ);

  // ajuste manual de trimestre (só vale se o trimestre coincidir)
  const ovOk = ov && ov.quarter && quarters.length && ov.periodEnd;
  let periodEnd = quarters.length ? quarters[quarters.length - 1].date : null;
  if (useFmp && fmpQ.length) periodEnd = fmpQ[fmpQ.length - 1].date;
  if (ovOk && near([{ date: periodEnd }], ov.periodEnd)) {
    for (const [slot, when] of [['cur', ov.periodEnd], ['prev', iso(shiftYear(ov.periodEnd, -1))]]) {
      let q = near(quarters, when);
      if (!q) { q = { date: when, src: 'Empresa' }; quarters.push(q); }
      for (const [k, v] of Object.entries(ov.quarter[slot])) if (q[k] == null) q[k] = v;
      q.src = q.src === 'Yahoo' ? 'Yahoo + empresa' : q.src;
    }
    quarters.sort((a, b) => a.date.localeCompare(b.date));
  }
  const cur = near(quarters, periodEnd) || {};
  const prev = near(quarters, shiftYear(periodEnd, -1)) || {};
  const ovActive = ov && ov.periodEnd && periodEnd && Math.abs(day(ov.periodEnd) - day(periodEnd)) <= 7;

  // EPS e datas
  const hist = (sum1.earningsHistory?.history || []).filter((x) => x.epsActual != null);
  const lastH = hist[hist.length - 1];
  let epsActual, epsEstimate, revEstimate = null, reportDate = null, nextEarnings = null, nextEps = null, nextRev = null, nextEstimated = null;
  let epsHist = [];
  if (useFmp && fmpE) {
    const last = fmpE.find((x) => x.epsActual != null);
    const next = fmpE.filter((x) => x.epsActual == null && x.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
    epsActual = last?.epsActual ?? null; epsEstimate = last?.epsEstimated ?? null; revEstimate = last?.revenueEstimated ?? null;
    reportDate = last?.date ?? null;
    if (next) { nextEarnings = next.date; nextEps = next.epsEstimated ?? null; nextRev = next.revenueEstimated ?? null; }
    epsHist = fmpE.filter((x) => x.epsActual != null).map((x) => ({ d: x.date, a: x.epsActual, e: x.epsEstimated ?? null })).reverse();
  } else {
    epsActual = lastH?.epsActual ?? null; epsEstimate = lastH?.epsEstimate ?? null;
    epsHist = hist.map((x) => ({ d: iso(x.quarter), a: x.epsActual, e: x.epsEstimate ?? null }));
  }
  const ce = sum1.calendarEvents?.earnings || {};
  const yNext = iso((ce.earningsDate || [])[0]);
  if (!nextEarnings && yNext) { nextEarnings = yNext; nextEstimated = ce.isEarningsDateEstimate ?? null; }
  if (nextEps == null) nextEps = num(ce.earningsAverage);
  if (nextRev == null) nextRev = num(ce.revenueAverage);

  if (ovActive && ov.reportDate) reportDate = reportDate || ov.reportDate;
  if (!reportDate && state[c.symbol]?.nextEarnings && periodEnd && state[c.symbol].nextEarnings > periodEnd && state[c.symbol].nextEarnings <= today) reportDate = state[c.symbol].nextEarnings;
  if (ovActive && 'nextEarnings' in ov) { nextEarnings = ov.nextEarnings; if (!nextEarnings) { nextEps = null; nextRev = null; nextEstimated = null; } }
  if (nextEarnings && (nextEarnings <= (reportDate || '0000') || nextEarnings < today)) { if (!(ovActive && ov.nextEarnings)) { nextEarnings = null; nextEps = null; nextRev = null; nextEstimated = null; } }

  const currency = useFmp ? 'USD' : (sum1.financialData?.financialCurrency || lastH?.currency || 'USD');

  // funcionários
  let emp = null;
  if (useFmp) {
    const h = await fmpLive(c.symbol, 'emp', () => fmp('historical-employee-count', { symbol: c.symbol }), 720);
    if (h && h.length) {
      const l = h.filter((x) => x.employeeCount > 0).sort((a, b) => b.periodOfReport.localeCompare(a.periodOfReport));
      const now = l[0]; const before = l.find((x) => Math.abs((new Date(now.periodOfReport) - new Date(x.periodOfReport)) / 864e5 - 365) <= 45);
      emp = { count: now.employeeCount, asOf: now.periodOfReport, prev: before?.employeeCount ?? null, source: 'FMP (10-K)' };
    }
  }
  if (!emp && sum1.assetProfile?.fullTimeEmployees) emp = { count: sum1.assetProfile.fullTimeEmployees, asOf: null, prev: null, source: 'Yahoo (perfil)' };

  // 12 meses (TTM) do Yahoo, usado quando faltam trimestres consecutivos
  let ttmY = null;
  const q4 = quarters.filter((q) => q.date <= periodEnd).slice(-4);
  if (!(q4.length === 4 && q4.every((q) => q.rev != null && q.ni != null))) {
    const t = await yahoo().fundamentalsTimeSeries(ys, { period1: '2025-06-01', module: 'financials', type: 'trailing' }, { validateResult: false }).catch(() => []);
    const l = t.filter((x) => x.periodType === 'TTM' && (x.totalRevenue != null || x.operatingRevenue != null)).pop();
    if (l) ttmY = { rev: num(l.totalRevenue ?? l.operatingRevenue), ni: num(l.netIncomeCommonStockholders ?? l.netIncome), ebitda: num(l.EBITDA) };
  }

  // reação do preço
  const react = await priceReaction(ys, reportDate);

  return { c, ov: ovActive ? ov : null, quarters, cur, prev, periodEnd, currency, epsActual, epsEstimate, revEstimate, reportDate, nextEarnings, nextEps, nextRev, nextEstimated, epsHist, emp, react, sum1, useFmp, ttmY };
}

// ---------- monta a linha
function buildRow(raw, fx, segs) {
  const { c, cur, prev, quarters } = raw;
  const rev = cur.rev, revP = prev.rev;
  const fxc = fx[raw.currency] ?? null;
  const toUsd = (v) => (v != null && fxc != null ? v * fxc : null);
  const fcf = cur.ocf != null && cur.capex != null ? cur.ocf - cur.capex : null;
  const fcfP = prev.ocf != null && prev.capex != null ? prev.ocf - prev.capex : null;
  const useSm = !!(cur.sm && prev.sm);
  const useSga = !useSm && !!(cur.sga && prev.sga);
  let smVal = null, smPrev = null, smBasis = null;
  if (useSm) { smVal = cur.sm; smPrev = prev.sm; smBasis = 'S&M'; }
  else if (useSga) { smVal = cur.sga; smPrev = prev.sga; smBasis = 'SG&A'; }
  else if (cur.sm) { smVal = cur.sm; smPrev = prev.sm ?? null; smBasis = 'S&M'; }
  else if (cur.sga) { smVal = cur.sga; smPrev = prev.sga ?? null; smBasis = 'SG&A'; }
  const smYoY = smVal != null && smPrev ? p1((smVal / smPrev - 1) * 100) : null;

  const epsSurp = pctChg(raw.epsActual, raw.epsEstimate);
  const revSurp = pctChg(rev, raw.revEstimate);
  const emp = raw.emp;
  const empYoY = emp && emp.prev ? p1((emp.count / emp.prev - 1) * 100) : null;

  // últimos 4 trimestres consecutivos (TTM)
  const upto = quarters.filter((q) => q.date <= raw.periodEnd).slice(-4);
  const full4 = upto.length === 4 && upto.every((q) => q.rev != null && q.ni != null) && (day(upto[3].date) - day(upto[0].date)) < 300;
  const ttm = (k) => (full4 && upto.every((q) => q[k] != null) ? upto.reduce((s, q) => s + q[k], 0) : null);
  const ttmRev = ttm('rev') ?? raw.ttmY?.rev ?? null, ttmNi = ttm('ni') ?? raw.ttmY?.ni ?? null, ttmEbitda = ttm('ebitda') ?? raw.ttmY?.ebitda ?? null;
  const ttmFromY = !full4 && !!raw.ttmY;

  // valuation (market cap em USD; demais métricas calculadas aqui para ficarem comparáveis)
  const pr = raw.sum1.price || {}, sd = raw.sum1.summaryDetail || {};
  const mcapNative = num(pr.marketCap ?? sd.marketCap);
  const priceCur = pr.currency || sd.currency || raw.currency;
  const mcapUsd = mcapNative != null && fx[priceCur] != null ? mcapNative * fx[priceCur] : null;
  const netDebtUsd = cur.debt != null && cur.cash != null && fxc != null ? (cur.debt - cur.cash) * fxc : null;
  const evUsd = mcapUsd != null && netDebtUsd != null ? mcapUsd + netDebtUsd : null;
  const ttmRevUsd = toUsd(ttmRev), ttmNiUsd = toUsd(ttmNi), ttmEbitdaUsd = toUsd(ttmEbitda);
  const val = {
    price: num(pr.regularMarketPrice), priceCurrency: priceCur, mcapUsdB: bil(mcapUsd), evUsdB: bil(evUsd),
    pe: ttmNiUsd > 0 && mcapUsd != null ? p1(mcapUsd / ttmNiUsd) : null,
    ps: ttmRevUsd > 0 && mcapUsd != null ? p1(mcapUsd / ttmRevUsd) : null,
    evRev: ttmRevUsd > 0 && evUsd != null ? p1(evUsd / ttmRevUsd) : null,
    evEbitda: ttmEbitdaUsd > 0 && evUsd != null ? p1(evUsd / ttmEbitdaUsd) : null,
    fwdPe: c.market === 'EUA' ? p1(num(sd.forwardPE)) : null,
    ttmRevB: bil(ttmRev), ttmNiB: bil(ttmNi), ttmEbitdaB: bil(ttmEbitda), ttmSrc: ttmRev == null ? null : (ttmFromY ? 'Yahoo (12 meses)' : '4 trimestres'),
  };

  // histórico: últimos 9 trimestres com receita
  const hist = quarters.filter((q) => q.rev != null).slice(-9).map((q) => ({ d: q.date, rev: bil(q.rev), ni: bil(q.ni), gp: bil(q.gp), oi: bil(q.oi), eps: p2(q.eps) }));

  const row = {
    symbol: c.symbol, name: c.name, area: c.area, market: c.market, currency: raw.currency,
    reportDate: raw.reportDate, periodEnd: raw.periodEnd,
    epsActual: raw.epsActual, epsEstimate: raw.epsEstimate, epsSurprisePct: epsSurp,
    revenuePrevB: bil(revP), netIncomePrevB: bil(prev.ni), fcfPrevB: bil(fcfP), salesMktPrevB: bil(smPrev), rdPrevB: bil(prev.rd),
    revenueB: bil(rev), revenueEstimateB: bil(raw.revEstimate), revenueSurprisePct: revSurp, revenueYoY: pctChg(rev, revP),
    netIncomeB: bil(cur.ni), netIncomeYoY: pctChg(cur.ni, prev.ni), netMargin: ratio(cur.ni, rev),
    operatingMargin: ratio(cur.oi, rev), grossMargin: ratio(cur.gp, rev),
    grossProfitB: bil(cur.gp), operatingIncomeB: bil(cur.oi),
    salesMktB: bil(smVal), salesMktBasis: smBasis, salesMktPct: ratio(smVal, rev), salesMktYoY: smYoY,
    rdB: bil(cur.rd), rdPct: ratio(cur.rd, rev), rdYoY: cur.rd && prev.rd ? p1((cur.rd / prev.rd - 1) * 100) : null,
    ocfB: bil(cur.ocf), capexB: bil(cur.capex), capexPct: ratio(cur.capex, rev),
    fcfB: bil(fcf), fcfMargin: ratio(fcf, rev), fcfYoY: fcf != null && fcfP > 0 && Math.abs(fcf / fcfP - 1) <= 3 ? p1((fcf / fcfP - 1) * 100) : null,
    sbcB: bil(cur.sbc), sbcPct: ratio(cur.sbc, rev),
    cashB: bil(cur.cash), debtB: bil(cur.debt), netCashB: cur.cash != null && cur.debt != null ? bil(cur.cash - cur.debt) : null,
    ebitdaB: bil(cur.ebitda), ebitdaMargin: ratio(cur.ebitda, rev),
    taxB: bil(cur.tax), pretaxB: bil(cur.pretax), taxRate: cur.tax != null && cur.pretax > 0 ? p1((cur.tax / cur.pretax) * 100) : null,
    opexB: bil(cur.opex), opexPct: ratio(cur.opex, rev), gaB: bil(cur.ga), gaPct: ratio(cur.ga, rev),
    employees: emp ? emp.count : null, employeesPrev: emp ? emp.prev : null, employeesAsOf: emp ? emp.asOf : null, employeesSource: emp ? emp.source : null, employeesYoY: empYoY,
    revPerEmployeeK: emp && rev ? Math.round((rev * 4) / emp.count / 1e3) : null,
    ...val,
    reactPct: raw.react ? raw.react.pct : null, reactFrom: raw.react ? raw.react.from : null, reactTo: raw.react ? raw.react.to : null, reactFromC: raw.react ? raw.react.c0 : null, reactToC: raw.react ? raw.react.c1 : null,
    nextEarnings: raw.nextEarnings, nextEstimated: raw.nextEstimated, nextEps: p2(raw.nextEps), nextRevB: bil(raw.nextRev),
    hist, epsHist: raw.epsHist.slice(-6),
    prov: { fin: [cur.src, prev.src].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' + ') || null, eps: raw.useFmp ? 'FMP' : 'Yahoo', val: 'Yahoo', emp: emp ? emp.source : null },
    seg: segs[c.symbol] || null,
  };

  // destaques estruturados (o texto é montado no navegador, no idioma escolhido)
  const hl = [];
  if (epsSurp == null) hl.push({ t: 'noEps' });
  else hl.push({ t: 'eps', v: epsSurp, k: epsSurp > 2 ? 'up' : epsSurp < -2 ? 'down' : 'flat' });
  if (revSurp != null && Math.abs(revSurp) >= 1) hl.push({ t: 'revSurp', v: revSurp });
  if (row.revenueYoY != null) hl.push({ t: 'revYoY', v: row.revenueYoY });
  if (row.netIncomeYoY != null && Math.abs(row.netIncomeYoY) >= 50) hl.push({ t: 'niYoY', v: row.netIncomeYoY });
  if (cur.ni != null && cur.oi > 0) { const r = cur.ni / cur.oi; if (r > 1.5) hl.push({ t: 'nonop', k: 'above' }); else if (r < 0.7) hl.push({ t: 'nonop', k: 'below' }); }
  if (smYoY != null && Math.abs(smYoY) >= 25) hl.push({ t: 'smYoY', v: smYoY, basis: smBasis });
  if (row.capexPct != null && row.capexPct >= 30) hl.push({ t: 'capex', v: row.capexPct, neg: fcf != null && fcf < 0 });
  if (raw.reactPct != null) { /* a reação aparece em coluna própria */ }
  for (const n of raw.ov?.notes || []) hl.push({ t: 'note', k: n });
  row.hl = hl;
  return row;
}

// ---------- segmentos (curados)
const segConv = (it) => ({ n: it.name, v: bil(it.rev), p: it.prev == null ? null : bil(it.prev), y: it.yoy ?? null, a: it.approx ? 1 : 0, c: it.children ? it.children.map(segConv) : undefined });
const loadSegments = () => {
  const raw = readJson(path.join(DATA, 'segments.json'), {});
  const out = {};
  for (const [sym, s] of Object.entries(raw)) out[sym] = { g: s.groups.map((g) => ({ t: g.title, i: g.items.map(segConv) })), note: s.note || null, src: s.source };
  return out;
};

// ---------- principal
async function refresh(outDir) {
  const t0 = Date.now();
  const companies = readJson(path.join(DATA, 'companies.json'), []);
  const overrides = readJson(path.join(DATA, 'overrides.json'), {});
  const segs = loadSegments();
  const prevRows = readJson(path.join(outDir, 'earnings.json'), null) || readJson(path.join(__dirname, '..', 'public', 'earnings.json'), []);
  const state = readJson(path.join(outDir, 'state.json'), null) || readJson(path.join(DATA, 'state.json'), {});
  const today = new Date().toISOString().slice(0, 10);
  loadFmpStore(outDir);

  const raws = [];
  for (const c of companies) {
    try {
      const raw = await collect(c, overrides[c.symbol], state, today);
      raws.push(raw);
      log('ok  ', c.symbol, raw.periodEnd);
    } catch (e) {
      log('FALHA', c.symbol, e.message);
      raws.push({ failed: true, c });
    }
  }
  const currencies = new Set(['USD']);
  raws.forEach((r) => { if (!r.failed) { currencies.add(r.currency); const pc = r.sum1?.price?.currency || r.sum1?.summaryDetail?.currency; if (pc) currencies.add(pc); } });
  const fx = await fxRates([...currencies]);

  const rows = [];
  const newState = { ...state };
  let failed = 0;
  for (const raw of raws) {
    if (raw.failed) { failed++; const old = prevRows.find((r) => r.symbol === raw.c.symbol); if (old) rows.push(old); continue; }
    try {
      const row = buildRow(raw, fx, segs);
      if (row.revenueB == null && row.epsActual == null) throw new Error('sem dados');
      const old = prevRows.find((r) => r.symbol === row.symbol);
      if (old && old.periodEnd && row.periodEnd && day(old.periodEnd) - day(row.periodEnd) > 30) {   // fonte atrasada: mantém o trimestre mais novo
        log('mantido (fonte atrasada)', row.symbol, row.periodEnd, '<', old.periodEnd);
        rows.push(old); continue;
      }
      rows.push(row);
      newState[raw.c.symbol] = { nextEarnings: row.nextEarnings || state[raw.c.symbol]?.nextEarnings || null, periodEnd: row.periodEnd };
    } catch (e) {
      failed++; log('FALHA montagem', raw.c.symbol, e.message);
      const old = prevRows.find((r) => r.symbol === raw.c.symbol); if (old) rows.push(old);
    }
  }
  if (rows.length < Math.ceil(companies.length / 2)) throw new Error('coleta incompleta: ' + rows.length + ' de ' + companies.length);

  const meta = { generatedAt: new Date().toISOString(), fx, fxNote: 'Câmbio do Yahoo Finance no momento da coleta.', companies: rows.length, failed, usedFmp: !!FMP_KEY, fmpStale: [...fmpStore.stale], seconds: Math.round((Date.now() - t0) / 1000) };
  fs.mkdirSync(outDir, { recursive: true });
  const write = (name, obj) => { const f = path.join(outDir, name); fs.writeFileSync(f + '.tmp', JSON.stringify(obj)); fs.renameSync(f + '.tmp', f); };
  write('earnings.json', rows);
  write('meta.json', meta);
  write('state.json', newState);
  if (fmpStore.dirty) write('fmp-cache.json', fmpStore.data);
  return { rows, meta };
}

module.exports = { refresh };

if (require.main === module) {
  const out = path.resolve(process.argv[2] || path.join(DATA, 'cache'));
  refresh(out).then(({ meta }) => { console.log('Concluído:', JSON.stringify(meta)); }).catch((e) => { console.error('Erro:', e.message); process.exit(1); });
}

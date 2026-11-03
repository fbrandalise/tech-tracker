'use strict';
/*
 * Carga histórica de trimestres a partir do SEC EDGAR (XBRL companyfacts, gratuito) para as empresas dos EUA.
 * Grava na tabela quarters sem sobrescrever nada: só cria trimestres novos e preenche campos vazios.
 *
 * Uso:  node pipeline/backfill-sec.js [pasta_de_dados] [--symbols NVDA,MSFT] [--years 6] [--dry-run]
 *   SEC_USER_AGENT  identificação enviada ao SEC (política deles pede nome e contato), ex.: "meu-app meu@email.com"
 *
 * Limites conhecidos:
 *   - EPS não é carregado: o valor do XBRL não é ajustado por desdobramentos posteriores (ex.: split da NVDA).
 *   - Q4 não é reportado à parte: é calculado como ano fechado menos o acumulado de 9 meses.
 *   - Empresas fora dos EUA (Hong Kong) e emissores 20-F/40-F não têm 10-Q, então ficam de fora.
 */
const path = require('path');
const store = require('./db');

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--symbols', '--years'].includes(args[i - 1])));

const UA = process.env.SEC_USER_AGENT || 'earnings-tracker/1.0 (personal research tool)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url) {   // SEC limita a 10 req/s; aqui vai bem abaixo disso
  await sleep(200);
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} em ${url}`);
  return r.json();
}

// campo -> conceitos us-gaap em ordem de preferência (empresas trocam de conceito ao longo dos anos; vale o primeiro com valor)
const FLOW = {
  rev: ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'SalesRevenueNet'],
  ni: ['NetIncomeLoss', 'ProfitLoss'],
  gp: ['GrossProfit'],
  oi: ['OperatingIncomeLoss'],
  sm: ['SellingAndMarketingExpense'],
  sga: ['SellingGeneralAndAdministrativeExpense'],
  ga: ['GeneralAndAdministrativeExpense'],
  rd: ['ResearchAndDevelopmentExpense'],
  opex: ['OperatingExpenses'],
  tax: ['IncomeTaxExpenseBenefit'],
  pretax: ['IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest', 'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments'],
  ocf: ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'],
  capex: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'],
  sbc: ['ShareBasedCompensation', 'AllocatedShareBasedCompensationExpense'],
  da: ['DepreciationDepletionAndAmortization', 'DepreciationAmortizationAndAccretionNet', 'DepreciationAndAmortization'],   // só para o EBITDA
};
const INSTANT = {
  cashSti: ['CashCashEquivalentsAndShortTermInvestments'],
  cash: ['CashAndCashEquivalentsAtCarryingValue'],
  sti: ['MarketableSecuritiesCurrent', 'ShortTermInvestments', 'AvailableForSaleSecuritiesDebtSecuritiesCurrent'],
  debtCur: ['LongTermDebtCurrent', 'DebtCurrent', 'ShortTermBorrowings'],
  debtLt: ['LongTermDebtNoncurrent'],
  debtTot: ['LongTermDebt'],
};

const dayN = (d) => new Date(d).getTime() / 864e5;
const dur = (f) => dayN(f.end) - dayN(f.start);
// índice do acumulado (1 = 3 meses ... 4 = ano) pela duração; tolera calendário 52/53 semanas
const cumIdx = (d) => (d >= 77 && d <= 105 ? 1 : d >= 168 && d <= 200 ? 2 : d >= 252 && d <= 290 ? 3 : d >= 350 && d <= 380 ? 4 : 0);

// uma versão por (start,end): a mais recente (reapresentações valem)
function latest(facts, key) {
  const m = new Map();
  for (const f of facts) { const k = key(f); const o = m.get(k); if (!o || f.filed > o.filed) m.set(k, f); }
  return [...m.values()];
}
const usable = (gaap, concept) => latest(((gaap[concept]?.units || {}).USD || []).filter((f) => /^10-[QK]/.test(f.form)), (f) => `${f.start || ''}|${f.end}`);

// fluxo (DRE e fluxo de caixa): fim do trimestre -> valor do trimestre
function quarterlyFlow(facts) {
  const out = new Map();
  // alguns 10-K marcam o valor do ano inteiro num contexto de 3 meses (ORCL 2021 e 2022); trimestre igual ao ano que fecha na mesma data é erro de marcação
  const annual = new Map(facts.filter((f) => f.start && cumIdx(dur(f)) === 4).map((f) => [f.end, f.val]));
  facts = facts.filter((f) => !(f.start && cumIdx(dur(f)) === 1 && f.val !== 0 && annual.get(f.end) === f.val));
  for (const f of facts) if (f.start && cumIdx(dur(f)) === 1) out.set(f.end, f.val);   // trimestre isolado reportado
  const byStart = new Map();
  for (const f of facts) if (f.start && cumIdx(dur(f))) (byStart.get(f.start) || byStart.set(f.start, {}).get(f.start))[cumIdx(dur(f))] = f;
  for (const cum of byStart.values()) {   // fluxo de caixa só vem acumulado no ano: trimestre = acumulado atual - anterior
    for (let i = 1; i <= 4; i++) {
      if (!cum[i] || (i > 1 && !cum[i - 1]) || out.has(cum[i].end)) continue;
      out.set(cum[i].end, cum[i].val - (i > 1 ? cum[i - 1].val : 0));
    }
  }
  return out;
}
const instant = (facts) => new Map(latest(facts.filter((f) => !f.start), (f) => f.end).map((f) => [f.end, f.val]));
const firstOf = (maps, end) => { for (const m of maps) if (m.has(end)) return m.get(end); return null; };

function buildQuarters(gaap, since) {
  const flow = {};
  for (const [field, concepts] of Object.entries(FLOW)) flow[field] = concepts.map((c) => quarterlyFlow(usable(gaap, c)));
  const inst = {};
  for (const [field, concepts] of Object.entries(INSTANT)) inst[field] = concepts.map((c) => instant(usable(gaap, c)));

  const ends = new Set();
  for (const m of flow.rev) for (const e of m.keys()) if (e >= since) ends.add(e);
  const pos = (v) => (v != null && v > 0 ? v : null);
  return [...ends].sort().map((end) => {
    const g = (f) => firstOf(flow[f], end);
    const i = (f) => firstOf(inst[f], end);
    const oi = g('oi'), da = g('da');
    const cashSti = i('cashSti') ?? (i('cash') != null ? i('cash') + (i('sti') || 0) : null);
    const debtLt = i('debtLt') ?? i('debtTot');
    const hasDebt = debtLt != null;
    return {
      date: end, src: 'SEC',
      rev: g('rev'), ni: g('ni'), gp: g('gp'), oi, sm: pos(g('sm')), sga: pos(g('sga')), ga: pos(g('ga')), rd: pos(g('rd')), opex: g('opex'),
      ebitda: oi != null && da != null ? oi + da : null, tax: g('tax'), pretax: g('pretax'), eps: null,
      ocf: g('ocf'), capex: g('capex') != null ? Math.abs(g('capex')) : null, sbc: g('sbc'),
      cash: cashSti, debt: hasDebt ? debtLt + (i('debtCur') || 0) : null,
    };
  });
}

// confere contra o que já veio do FMP/Yahoo: se a derivação do SEC estiver errada, aparece aqui
function validate(db, symbol, list) {
  const rows = db.prepare('SELECT * FROM quarters WHERE symbol = ?').all(symbol);
  const res = { n: 0, bad: [] };
  for (const q of list) {
    const hit = rows.find((r) => Math.abs(dayN(r.period_end) - dayN(q.date)) <= 7);
    if (!hit || hit.source === 'SEC') continue;
    for (const f of ['rev', 'ni', 'oi', 'gp', 'ocf']) {
      if (hit[f] == null || q[f] == null || hit[f] === 0) continue;
      res.n++;
      const d = Math.abs(q[f] - hit[f]) / Math.abs(hit[f]);
      if (d > 0.01) res.bad.push(`${q.date} ${f}: SEC ${(q[f] / 1e9).toFixed(2)}B vs ${hit.source} ${(hit[f] / 1e9).toFixed(2)}B`);
    }
  }
  return res;
}

async function main() {
  const dir = path.resolve(positional[0] || path.join(__dirname, '..', 'data', 'cache'));
  const db = store.open(process.env.DB_PATH || path.join(dir, 'earnings.db'));
  store.syncCuration(db);
  const only = opt('--symbols') ? new Set(opt('--symbols').split(',').map((s) => s.trim().toUpperCase())) : null;
  const years = Number(opt('--years', 6));
  const since = new Date(Date.now() - years * 365.25 * 864e5).toISOString().slice(0, 10);
  const companies = store.getCompanies(db).filter((c) => c.market === 'EUA' && (!only || only.has(c.symbol)));
  const tickers = await get('https://www.sec.gov/files/company_tickers.json');
  const cik = Object.fromEntries(Object.values(tickers).map((t) => [t.ticker, t.cik_str]));
  console.log(`${flag('--dry-run') ? '[simulação] ' : ''}${companies.length} empresas, trimestres desde ${since}`);

  for (const c of companies) {
    try {
      if (!cik[c.symbol]) { console.log(c.symbol.padEnd(7), 'sem CIK no SEC'); continue; }
      const facts = await get(`https://data.sec.gov/api/xbrl/companyfacts/CIK${String(cik[c.symbol]).padStart(10, '0')}.json`);
      const list = buildQuarters(facts.facts['us-gaap'] || {}, since).filter((q) => q.rev != null);
      const v = validate(db, c.symbol, list);
      const r = flag('--dry-run') ? { inserted: '-', filled: '-' } : store.backfillQuarters(db, c.symbol, list, 'SEC');
      console.log(c.symbol.padEnd(7), `${String(list.length).padStart(2)} tri do SEC | novos ${r.inserted}, campos preenchidos ${r.filled} | conferência: ${v.n - v.bad.length}/${v.n} valores dentro de 1%`);
      for (const b of v.bad.slice(0, 5)) console.log('         divergência', b);
    } catch (e) { console.log(c.symbol.padEnd(7), 'FALHA', e.message); }
  }
  db.close();
}
main().catch((e) => { console.error('Erro:', e.message); process.exit(1); });

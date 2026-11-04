'use strict';
/*
 * Carga histórica de receita por segmento/produto (empresas dos EUA) a partir dos 10-Q e 10-K do SEC EDGAR.
 * Lê o iXBRL de cada arquivamento (o companyfacts não traz dimensões) e grava em segment_quarters.
 *
 * Uso:  node pipeline/backfill-segments.js [--symbols NVDA,MSFT] [--years 5] [--dry-run]
 *   SEC_USER_AGENT  identificação enviada ao SEC (a política pede nome e contato)
 *
 * Regras:
 *   - Trimestres 1 a 3 vêm do 10-Q (3 meses). O 4º é calculado: ano do 10-K menos os 3 trimestres (marcado em is_derived_q4).
 *   - O valor do ano anterior é o que a empresa apresenta no mesmo arquivamento, então já reflete reapresentações.
 *   - Membros aninhados (ex.: Data Center = Hyperscale + Nuvens de IA) são detectados por soma e recebem parent_member.
 *   - taxonomy sobe quando o conjunto de membros do eixo muda entre trimestres consecutivos.
 */
const path = require('path');
const store = require('./db');
const { segmentRevenue, labelOf } = require('./segments-xbrl');

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const UA = process.env.SEC_USER_AGENT || 'earnings-tracker/1.0 (personal research tool)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, text) {   // SEC limita a 10 req/s; 429/5xx são temporários, então tenta de novo com espera crescente
  for (let tent = 1; ; tent++) {
    await sleep(250);
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) }).catch((e) => ({ ok: false, status: e.name }));
    if (r.ok) return text ? r.text() : r.json();
    if (tent >= 4 || !(r.status === 429 || r.status >= 500 || r.status === 'TimeoutError')) throw new Error(`HTTP ${r.status} em ${url}`);
    await sleep(2000 * tent);
  }
}
const dayMs = (s) => Date.parse(s + 'T00:00:00Z');
const daysBetween = (a, b) => Math.round((dayMs(b) - dayMs(a)) / 864e5);

async function listFilings(cik, since) {
  const pad = String(cik).padStart(10, '0');
  const sub = await get(`https://data.sec.gov/submissions/CIK${pad}.json`);
  const blocks = [sub.filings.recent];
  for (const f of sub.filings.files || []) blocks.push(await get(`https://data.sec.gov/submissions/${f.name}`));
  const out = [];
  for (const r of blocks) for (let i = 0; i < r.form.length; i++) {
    if (['10-Q', '10-K'].includes(r.form[i]) && r.reportDate[i] >= since) out.push({ accession: r.accessionNumber[i], form: r.form[i], reportDate: r.reportDate[i], doc: r.primaryDocument[i] });
  }
  return out.sort((a, b) => a.reportDate.localeCompare(b.reportDate));
}

// membros cuja receita é a soma de outros membros do mesmo período são "pais"; devolve member -> parent
function nesting(rows) {
  const parent = new Map();
  for (const a of rows) {
    const others = rows.filter((x) => x !== a && !parent.has(x.member) && x.revenue > 0 && x.revenue < a.revenue);
    if (others.length < 2 || others.length > 12) continue;
    let best = null;
    for (let mask = 3; mask < 1 << others.length; mask++) {
      let sum = 0, n = 0;
      for (let i = 0; i < others.length; i++) if (mask & (1 << i)) { sum += others[i].revenue; n++; }
      // tolerância pequena (arredondamento do XBRL): maior juntaria segmentos que só se parecem (Europa+Japão+Ásia ≈ Américas na Apple)
      if (n >= 2 && Math.abs(sum - a.revenue) <= Math.max(a.revenue * 0.001, 3e6) && (!best || n < best.n)) best = { mask, n };
    }
    if (best) others.forEach((o, i) => { if (best.mask & (1 << i)) parent.set(o.member, a.member); });
  }
  return parent;
}

function buildQuarters(filings) {
  // filings: [{ form, reportDate, accession, rows, total, totalPrev }] em ordem de data
  const quarters = [];   // { period_end, axis, member, revenue, prev, total, totalPrev, derived, form, accession }
  const q = filings.filter((f) => f.form === '10-Q');
  for (const f of q) for (const r of f.rows) quarters.push({ period_end: f.reportDate, ...r, total: f.total, totalPrev: f.totalPrev, derived: 0, form: f.form, accession: f.accession });
  for (const k of filings.filter((f) => f.form === '10-K')) {
    // trimestres 1 a 3 do mesmo ano fiscal: terminam entre ~90 e ~280 dias antes do fim do ano
    const inYear = (pe) => { const d = daysBetween(pe, k.reportDate); return d >= 60 && d <= 300; };
    const periods = [...new Set(quarters.filter((x) => !x.derived && inYear(x.period_end)).map((x) => x.period_end))];
    if (periods.length !== 3) continue;   // sem os 3 trimestres não dá para derivar o 4º
    const qt = (pe, axis, member) => quarters.find((x) => x.period_end === pe && x.axis === axis && x.member === member);
    const sum = (axis, member, key) => { let s = 0; for (const pe of periods) { const x = qt(pe, axis, member); if (!x || x[key] == null) return null; s += x[key]; } return s; };
    const totalOf = (key) => { let s = 0; for (const pe of periods) { const x = quarters.find((y) => y.period_end === pe); if (!x || x[key] == null) return null; s += x[key]; } return s; };
    const t = totalOf('total'), tp = totalOf('totalPrev');
    for (const r of k.rows) {
      const rev3 = sum(r.axis, r.member, 'revenue');
      if (rev3 == null) continue;
      const prev3 = sum(r.axis, r.member, 'prev');
      quarters.push({ period_end: k.reportDate, axis: r.axis, member: r.member, revenue: r.revenue - rev3, prev: r.prev != null && prev3 != null ? r.prev - prev3 : null,
        total: k.total != null && t != null ? k.total - t : null, totalPrev: k.totalPrev != null && tp != null ? k.totalPrev - tp : null, derived: 1, form: k.form, accession: k.accession });
    }
  }
  return quarters.filter((x) => x.revenue > 0 || x.revenue === 0).sort((a, b) => a.period_end.localeCompare(b.period_end));
}

function finalize(symbol, quarters) {
  const out = [];
  for (const axis of ['segment', 'product']) {
    const periods = [...new Set(quarters.filter((x) => x.axis === axis).map((x) => x.period_end))].sort();
    let taxonomy = 0, sig = null;
    for (const pe of periods) {
      const rows = quarters.filter((x) => x.axis === axis && x.period_end === pe);
      const s = rows.map((r) => r.member).sort().join('|');
      if (s !== sig) { taxonomy++; sig = s; }
      const par = nesting(rows);
      for (const r of rows) out.push({ symbol, period_end: pe, axis, member: r.member, label: labelOf(r.member), parent_member: par.get(r.member) ?? null, revenue: r.revenue, prev_revenue: r.prev, total_revenue: r.total, total_prev_revenue: r.totalPrev, taxonomy, derived: r.derived, form: r.form, accession: r.accession });
    }
  }
  return out;
}

// empresas cujo iXBRL não dá segmentos confiáveis; entram aqui em vez de publicar números trocados
const SKIP = { AMD: 'os nomes dos membros XBRL não correspondem aos valores (Data Center e Client trocados) e há trimestres sem segmentos' };

async function main() {
  const dir = path.resolve(path.join(__dirname, '..', 'data', 'cache'));
  const db = store.open(process.env.DB_PATH || path.join(process.env.DATA_DIR || dir, 'earnings.db'));
  const only = opt('--symbols') ? new Set(opt('--symbols').split(',').map((s) => s.trim().toUpperCase())) : null;
  const since = new Date(Date.now() - Number(opt('--years', 5)) * 365.25 * 864e5).toISOString().slice(0, 10);
  const companies = store.getCompanies(db).filter((c) => c.market === 'EUA' && (!only || only.has(c.symbol)));
  for (const c of companies) if (SKIP[c.symbol]) { console.log(c.symbol.padEnd(7), 'ignorada:', SKIP[c.symbol]); if (!flag('--dry-run')) db.prepare('DELETE FROM segment_quarters WHERE symbol = ?').run(c.symbol); }
  const tickers = await get('https://www.sec.gov/files/company_tickers.json');
  const cik = Object.fromEntries(Object.values(tickers).map((t) => [t.ticker, t.cik_str]));
  console.log(`${flag('--dry-run') ? '[simulação] ' : ''}${companies.length} empresas, arquivamentos desde ${since}`);

  const ins = db.prepare('INSERT OR REPLACE INTO segment_quarters (symbol, period_end, axis, member, label, parent_member, revenue, prev_revenue, total_revenue, total_prev_revenue, taxonomy, derived, form, accession) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (const c of companies.filter((x) => !SKIP[x.symbol])) {
    try {
      if (!cik[c.symbol]) { console.log(c.symbol.padEnd(7), 'sem CIK no SEC'); continue; }
      const filings = [];
      for (const f of await listFilings(cik[c.symbol], since)) {
        const html = await get(`https://www.sec.gov/Archives/edgar/data/${cik[c.symbol]}/${f.accession.replace(/-/g, '')}/${f.doc}`, true);
        const r = segmentRevenue(html, f);
        filings.push({ ...f, ...r });
      }
      const rows = finalize(c.symbol, buildQuarters(filings));
      if (!flag('--dry-run')) store.tx(db, () => { db.prepare('DELETE FROM segment_quarters WHERE symbol = ?').run(c.symbol); for (const r of rows) ins.run(r.symbol, r.period_end, r.axis, r.member, r.label, r.parent_member, r.revenue, r.prev_revenue, r.total_revenue, r.total_prev_revenue, r.taxonomy, r.derived, r.form, r.accession); });
      const per = new Set(rows.map((r) => r.period_end)).size;
      console.log(c.symbol.padEnd(7), `${filings.length} arquivamentos | ${per} trimestres | ${rows.length} linhas | ${new Set(rows.map((r) => r.member)).size} membros`);
    } catch (e) { console.log(c.symbol.padEnd(7), 'FALHA', e.message); }
  }
  db.close();
}
if (require.main === module) main().catch((e) => { console.error('Erro:', e.message); process.exit(1); });
module.exports = { buildQuarters, finalize, nesting };

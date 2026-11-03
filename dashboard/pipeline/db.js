'use strict';
/*
 * Camada de persistência (SQLite embutido no Node, sem dependências nativas).
 *   - dados coletados: refresh_runs, earnings_snapshots, quarters, state, fmp_cache
 *   - curadoria (fonte de verdade continua nos JSONs versionados em data/): companies, overrides, segments, news
 * Arquivo: <pasta_de_dados>/earnings.db  (DB_PATH sobrescreve)
 */
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DATA = path.join(__dirname, '..', 'data');
const readJson = (f, fallback) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return fallback; } };

// campos normalizados de um trimestre (mesmos nomes usados pelo pipeline)
const QUARTER_FIELDS = ['rev', 'ni', 'gp', 'oi', 'sm', 'sga', 'ga', 'rd', 'opex', 'ebitda', 'tax', 'pretax', 'eps', 'ocf', 'capex', 'sbc', 'cash', 'debt'];


// Camada semântica: views que escondem as armadilhas dos dados brutos (moeda, unidade, trimestres fora do calendário).
// Descritas em ontology/earnings.yaml. Para alterar uma view, crie uma nova migração que reutilize VIEWS_SQL.
const VIEWS_SQL = `
  DROP VIEW IF EXISTS v_latest; DROP VIEW IF EXISTS v_ttm; DROP VIEW IF EXISTS v_quarter; DROP VIEW IF EXISTS v_company;

  -- empresa + moeda de reporte + câmbio para USD (da última coleta)
  CREATE VIEW v_company AS
  SELECT c.symbol, c.name, c.area, c.market,
         json_extract(s.data, '$.currency') AS currency,
         json_extract(r.fx, '$.' || json_extract(s.data, '$.currency')) AS fx_to_usd,
         r.generated_at AS as_of
  FROM companies c
  LEFT JOIN earnings_snapshots s ON s.symbol = c.symbol AND s.run_id = (SELECT MAX(id) FROM refresh_runs)
  LEFT JOIN refresh_runs r ON r.id = s.run_id;

  -- um trimestre por linha, em bilhões de USD, com margens e variação a/a. source = de onde veio o dado.
  CREATE VIEW v_quarter AS
  SELECT q.symbol, c.name, c.market, c.currency, q.period_end, q.source,
         ROUND(q.rev * c.fx_to_usd / 1e9, 3)    AS revenue_usd_b,
         ROUND(q.gp * c.fx_to_usd / 1e9, 3)     AS gross_profit_usd_b,
         ROUND(q.oi * c.fx_to_usd / 1e9, 3)     AS operating_income_usd_b,
         ROUND(q.ni * c.fx_to_usd / 1e9, 3)     AS net_income_usd_b,
         ROUND(q.ocf * c.fx_to_usd / 1e9, 3)    AS ocf_usd_b,
         ROUND(q.capex * c.fx_to_usd / 1e9, 3)  AS capex_usd_b,
         ROUND((q.ocf - q.capex) * c.fx_to_usd / 1e9, 3) AS fcf_usd_b,
         ROUND(q.rd * c.fx_to_usd / 1e9, 3)     AS rd_usd_b,
         ROUND(q.sbc * c.fx_to_usd / 1e9, 3)    AS sbc_usd_b,
         ROUND(q.cash * c.fx_to_usd / 1e9, 3)   AS cash_usd_b,
         ROUND(q.debt * c.fx_to_usd / 1e9, 3)   AS debt_usd_b,
         ROUND((q.cash - q.debt) * c.fx_to_usd / 1e9, 3) AS net_cash_usd_b,
         q.eps AS eps_native,
         ROUND(q.gp * 100.0 / q.rev, 1)  AS gross_margin,
         ROUND(q.oi * 100.0 / q.rev, 1)  AS operating_margin,
         ROUND(q.ni * 100.0 / q.rev, 1)  AS net_margin,
         ROUND((q.ocf - q.capex) * 100.0 / q.rev, 1) AS fcf_margin,
         ROUND(q.capex * 100.0 / q.rev, 1) AS capex_pct,
         ROUND(q.rd * 100.0 / q.rev, 1)  AS rd_pct,
         ROUND(q.sbc * 100.0 / q.rev, 1) AS sbc_pct,
         CASE WHEN q.pretax > 0 THEN ROUND(q.tax * 100.0 / q.pretax, 1) END AS tax_rate,
         ROUND((q.rev - p.rev) * 100.0 / ABS(p.rev), 1) AS revenue_yoy,
         ROUND((q.ni - p.ni) * 100.0 / ABS(p.ni), 1)    AS net_income_yoy
  FROM quarters q
  JOIN v_company c ON c.symbol = q.symbol
  LEFT JOIN quarters p ON p.symbol = q.symbol
    AND p.period_end BETWEEN date(q.period_end, '-1 year', '-7 days') AND date(q.period_end, '-1 year', '+7 days');

  -- últimos 4 trimestres seguidos (intervalo < 300 dias), só quando receita e lucro existem nos 4
  CREATE VIEW v_ttm AS
  WITH w AS (
    SELECT symbol, period_end,
           COUNT(rev) OVER win AS n_rev, COUNT(ni) OVER win AS n_ni, COUNT(ebitda) OVER win AS n_ebitda,
           SUM(rev) OVER win AS rev4, SUM(ni) OVER win AS ni4, SUM(ebitda) OVER win AS ebitda4,
           julianday(period_end) - julianday(LAG(period_end, 3) OVER (PARTITION BY symbol ORDER BY period_end)) AS span
    FROM quarters
    WINDOW win AS (PARTITION BY symbol ORDER BY period_end ROWS BETWEEN 3 PRECEDING AND CURRENT ROW)
  )
  SELECT w.symbol, c.name, c.currency, w.period_end,
         ROUND(w.rev4 * c.fx_to_usd / 1e9, 3) AS ttm_revenue_usd_b,
         ROUND(w.ni4 * c.fx_to_usd / 1e9, 3)  AS ttm_net_income_usd_b,
         CASE WHEN w.n_ebitda = 4 THEN ROUND(w.ebitda4 * c.fx_to_usd / 1e9, 3) END AS ttm_ebitda_usd_b
  FROM w JOIN v_company c ON c.symbol = w.symbol
  WHERE w.n_rev = 4 AND w.n_ni = 4 AND w.span < 300;

  -- a linha de cada empresa como aparece no painel (última coleta). Valuation já em USD; *_native na moeda da empresa.
  CREATE VIEW v_latest AS
  SELECT s.symbol, c.name, c.area, c.market, c.currency, s.period_end, s.report_date,
         json_extract(s.data, '$.nextEarnings') AS next_earnings,
         json_extract(s.data, '$.prov.fin') AS financials_source,
         ROUND(s.revenue_b * c.fx_to_usd, 3) AS revenue_usd_b,
         ROUND(s.net_income_b * c.fx_to_usd, 3) AS net_income_usd_b,
         json_extract(s.data, '$.revenueYoY') AS revenue_yoy,
         json_extract(s.data, '$.netIncomeYoY') AS net_income_yoy,
         json_extract(s.data, '$.grossMargin') AS gross_margin,
         json_extract(s.data, '$.operatingMargin') AS operating_margin,
         json_extract(s.data, '$.netMargin') AS net_margin,
         json_extract(s.data, '$.fcfMargin') AS fcf_margin,
         ROUND(json_extract(s.data, '$.fcfB') * c.fx_to_usd, 3) AS fcf_usd_b,
         json_extract(s.data, '$.capexPct') AS capex_pct,
         s.eps_actual AS eps_native, s.eps_estimate AS eps_estimate_native,
         json_extract(s.data, '$.epsSurprisePct') AS eps_surprise_pct,
         json_extract(s.data, '$.revenueSurprisePct') AS revenue_surprise_pct,
         json_extract(s.data, '$.reactPct') AS price_reaction_pct,
         json_extract(s.data, '$.price') AS price_native,
         json_extract(s.data, '$.mcapUsdB') AS market_cap_usd_b,
         json_extract(s.data, '$.evUsdB') AS ev_usd_b,
         json_extract(s.data, '$.pe') AS pe, json_extract(s.data, '$.fwdPe') AS forward_pe,
         json_extract(s.data, '$.ps') AS ps, json_extract(s.data, '$.evRev') AS ev_revenue,
         json_extract(s.data, '$.evEbitda') AS ev_ebitda,
         json_extract(s.data, '$.employees') AS employees,
         ROUND(json_extract(s.data, '$.ttmRevB') * c.fx_to_usd, 3) AS ttm_revenue_usd_b,
         ROUND(json_extract(s.data, '$.ttmNiB') * c.fx_to_usd, 3)  AS ttm_net_income_usd_b,
         json_extract(s.data, '$.ttmSrc') AS ttm_source
  FROM earnings_snapshots s
  JOIN v_company c ON c.symbol = s.symbol
  WHERE s.run_id = (SELECT MAX(id) FROM refresh_runs);
`;

// cada migração roda uma vez; a versão fica em PRAGMA user_version
const MIGRATIONS = [`
  CREATE TABLE companies (
    symbol TEXT PRIMARY KEY, y TEXT NOT NULL, name TEXT NOT NULL, area TEXT, market TEXT,
    fmp INTEGER NOT NULL DEFAULT 0, position INTEGER NOT NULL
  );
  CREATE TABLE overrides (symbol TEXT PRIMARY KEY, data TEXT NOT NULL);
  CREATE TABLE segments  (symbol TEXT PRIMARY KEY, data TEXT NOT NULL);
  CREATE TABLE news      (symbol TEXT PRIMARY KEY, position INTEGER NOT NULL, data TEXT NOT NULL);

  CREATE TABLE refresh_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    generated_at TEXT NOT NULL, seconds INTEGER, companies INTEGER, failed INTEGER,
    used_fmp INTEGER, fx TEXT, fmp_stale TEXT
  );
  CREATE TABLE earnings_snapshots (
    run_id INTEGER NOT NULL REFERENCES refresh_runs(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    period_end TEXT, report_date TEXT, revenue_b REAL, net_income_b REAL, eps_actual REAL, eps_estimate REAL,
    data TEXT NOT NULL,
    PRIMARY KEY (run_id, symbol)
  );
  CREATE INDEX snapshots_symbol ON earnings_snapshots(symbol, run_id);

  CREATE TABLE quarters (
    symbol TEXT NOT NULL, period_end TEXT NOT NULL, source TEXT,
    ${QUARTER_FIELDS.map((f) => f + ' REAL').join(', ')},
    updated_at TEXT NOT NULL,
    PRIMARY KEY (symbol, period_end)
  );

  CREATE TABLE state (symbol TEXT PRIMARY KEY, next_earnings TEXT, period_end TEXT);
  CREATE TABLE fmp_cache (
    symbol TEXT NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL, fetched_at TEXT NOT NULL,
    PRIMARY KEY (symbol, kind)
  );
`, VIEWS_SQL];

function open(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;');
  const v = db.prepare('PRAGMA user_version').get().user_version;
  for (let i = v; i < MIGRATIONS.length; i++) {
    db.exec('BEGIN');
    try { db.exec(MIGRATIONS[i]); db.exec(`PRAGMA user_version = ${i + 1}`); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
  }
  return db;
}

function tx(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}

// ---------- curadoria: os JSONs de data/ continuam sendo editados à mão; aqui só espelhamos no banco
function syncCuration(db, dir = DATA) {
  const companies = readJson(path.join(dir, 'companies.json'), []);
  const overrides = readJson(path.join(dir, 'overrides.json'), {});
  const segments = readJson(path.join(dir, 'segments.json'), {});
  const news = readJson(path.join(dir, 'news.json'), []);
  if (!companies.length) return;   // sem arquivo de curadoria: mantém o que já está no banco
  tx(db, () => {
    for (const t of ['companies', 'overrides', 'segments', 'news']) db.exec(`DELETE FROM ${t}`);
    const co = db.prepare('INSERT INTO companies (symbol, y, name, area, market, fmp, position) VALUES (?, ?, ?, ?, ?, ?, ?)');
    companies.forEach((c, i) => co.run(c.symbol, c.y || c.symbol, c.name, c.area ?? null, c.market ?? null, c.fmp ? 1 : 0, i));
    const kv = (table, entries) => { const st = db.prepare(`INSERT INTO ${table} (symbol, data) VALUES (?, ?)`); for (const [s, d] of entries) st.run(s, JSON.stringify(d)); };
    kv('overrides', Object.entries(overrides).filter(([k]) => !k.startsWith('_')));
    kv('segments', Object.entries(segments));
    const nw = db.prepare('INSERT INTO news (symbol, position, data) VALUES (?, ?, ?)');
    news.forEach((n, i) => nw.run(n.symbol, i, JSON.stringify(n)));
  });
}

const parse = (rows) => rows.map((r) => JSON.parse(r.data));
const getCompanies = (db) => db.prepare('SELECT symbol, y, name, area, market, fmp FROM companies ORDER BY position').all().map((r) => ({ ...r, fmp: !!r.fmp }));
const getOverrides = (db) => Object.fromEntries(db.prepare('SELECT symbol, data FROM overrides').all().map((r) => [r.symbol, JSON.parse(r.data)]));
const getSegments = (db) => Object.fromEntries(db.prepare('SELECT symbol, data FROM segments').all().map((r) => [r.symbol, JSON.parse(r.data)]));
const getNews = (db) => parse(db.prepare('SELECT data FROM news ORDER BY position').all());

// ---------- estado e cache do FMP
const getState = (db) => Object.fromEntries(db.prepare('SELECT * FROM state').all().map((r) => [r.symbol, { nextEarnings: r.next_earnings, periodEnd: r.period_end }]));

// formato em memória igual ao do antigo fmp-cache.json: { SYM: { quarters, quartersAt, earnings, earningsAt, emp, empAt } }
function getFmpCache(db) {
  const out = {};
  for (const r of db.prepare('SELECT * FROM fmp_cache').all()) { const slot = (out[r.symbol] ||= {}); slot[r.kind] = JSON.parse(r.payload); slot[r.kind + 'At'] = r.fetched_at; }
  return out;
}
function saveFmpCache(db, data) {
  const st = db.prepare('INSERT INTO fmp_cache (symbol, kind, payload, fetched_at) VALUES (?, ?, ?, ?) ON CONFLICT (symbol, kind) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at');
  for (const [sym, slot] of Object.entries(data)) for (const [k, v] of Object.entries(slot)) if (!k.endsWith('At') && v != null) st.run(sym, k, JSON.stringify(v), slot[k + 'At'] || new Date().toISOString());
}

// As fontes divergem em alguns dias para o mesmo trimestre (FMP 28/06, Yahoo 30/06); a data guardada é a da primeira que o registrou.
const DAY = 864e5;
function matchPeriod(existing, date) {
  const t = new Date(date).getTime();
  let best = null, bestD = 7.0001 * DAY;
  for (const d of existing) { const diff = Math.abs(new Date(d).getTime() - t); if (diff < bestD) { best = d; bestD = diff; } }
  return best;
}

function upsertQuarters(db, symbol, list, now) {
  const existing = db.prepare('SELECT period_end FROM quarters WHERE symbol = ?').all(symbol).map((r) => r.period_end);
  const set = QUARTER_FIELDS.map((f) => `${f} = COALESCE(?, ${f})`).join(', ');
  const upd = db.prepare(`UPDATE quarters SET source = ?, ${set}, updated_at = ? WHERE symbol = ? AND period_end = ?`);
  const ins = db.prepare(`INSERT INTO quarters (symbol, period_end, source, ${QUARTER_FIELDS.join(', ')}, updated_at) VALUES (?, ?, ?, ${QUARTER_FIELDS.map(() => '?').join(', ')}, ?)`);
  for (const q of list) {
    const vals = QUARTER_FIELDS.map((f) => (typeof q[f] === 'number' ? q[f] : null));
    const hit = matchPeriod(existing, q.date);
    if (hit) upd.run(q.src ?? null, ...vals, now, symbol, hit);
    else { ins.run(symbol, q.date, q.src ?? null, ...vals, now); existing.push(q.date); }
  }
}

// ---------- resultado de uma coleta: tudo numa transação (ou grava tudo, ou nada)
function saveRun(db, { meta, rows, state, quarters, fmpCache }) {
  return tx(db, () => {
    const { lastInsertRowid: runId } = db.prepare('INSERT INTO refresh_runs (generated_at, seconds, companies, failed, used_fmp, fx, fmp_stale) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(meta.generatedAt, meta.seconds, meta.companies, meta.failed, meta.usedFmp ? 1 : 0, JSON.stringify(meta.fx), JSON.stringify(meta.fmpStale));
    const snap = db.prepare('INSERT INTO earnings_snapshots (run_id, symbol, period_end, report_date, revenue_b, net_income_b, eps_actual, eps_estimate, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const r of rows) snap.run(runId, r.symbol, r.periodEnd ?? null, r.reportDate ?? null, r.revenueB ?? null, r.netIncomeB ?? null, r.epsActual ?? null, r.epsEstimate ?? null, JSON.stringify(r));

    const st = db.prepare('INSERT INTO state (symbol, next_earnings, period_end) VALUES (?, ?, ?) ON CONFLICT (symbol) DO UPDATE SET next_earnings = excluded.next_earnings, period_end = excluded.period_end');
    for (const [sym, s] of Object.entries(state)) st.run(sym, s.nextEarnings ?? null, s.periodEnd ?? null);

    // nulos não apagam o que já foi guardado; valores novos substituem (reapresentações)
    for (const [sym, list] of Object.entries(quarters)) upsertQuarters(db, sym, list, meta.generatedAt);

    saveFmpCache(db, fmpCache);
    return Number(runId);
  });
}

// ---------- carga histórica: nunca sobrescreve o que já existe, só cria trimestres novos e preenche campos vazios.
// Um trimestre existente é reconhecido por data próxima (±7 dias), porque as fontes divergem em alguns dias (Yahoo usa fim de mês).
function backfillQuarters(db, symbol, list, source, now = new Date().toISOString()) {
  return tx(db, () => {
    const existing = db.prepare('SELECT period_end FROM quarters WHERE symbol = ?').all(symbol).map((r) => r.period_end);
    const cur = db.prepare('SELECT * FROM quarters WHERE symbol = ? AND period_end = ?');
    const fill = db.prepare(`UPDATE quarters SET ${QUARTER_FIELDS.map((f) => `${f} = COALESCE(${f}, ?)`).join(', ')} WHERE symbol = ? AND period_end = ?`);
    const ins = db.prepare(`INSERT INTO quarters (symbol, period_end, source, ${QUARTER_FIELDS.join(', ')}, updated_at) VALUES (?, ?, ?, ${QUARTER_FIELDS.map(() => '?').join(', ')}, ?)`);
    let inserted = 0, filled = 0;   // filled = campos vazios que ganharam valor
    for (const q of list) {
      const vals = QUARTER_FIELDS.map((f) => (typeof q[f] === 'number' ? q[f] : null));
      const hit = matchPeriod(existing, q.date);
      if (hit) {
        const row = cur.get(symbol, hit);
        const n = QUARTER_FIELDS.filter((f, i) => row[f] == null && vals[i] != null).length;
        if (n) { fill.run(...vals, symbol, hit); filled += n; }
      }
      else { ins.run(symbol, q.date, source, ...vals, now); existing.push(q.date); inserted++; }
    }
    return { inserted, filled };
  });
}

// ---------- leitura para o servidor e para o próximo refresh
function latestRunId(db) { return db.prepare('SELECT MAX(id) AS id FROM refresh_runs').get().id; }

function getLatest(db) {
  const id = latestRunId(db);
  if (!id) return null;
  const meta = db.prepare('SELECT * FROM refresh_runs WHERE id = ?').get(id);
  const rows = parse(db.prepare('SELECT s.data FROM earnings_snapshots s LEFT JOIN companies c USING (symbol) WHERE s.run_id = ? ORDER BY c.position, s.symbol').all(id));
  return {
    rows,
    meta: { generatedAt: meta.generated_at, fx: JSON.parse(meta.fx), fxNote: 'Câmbio do Yahoo Finance no momento da coleta.', companies: meta.companies, failed: meta.failed, usedFmp: !!meta.used_fmp, fmpStale: JSON.parse(meta.fmp_stale), seconds: meta.seconds },
  };
}

// todos os trimestres guardados, por empresa, no formato do pipeline (date/src + campos)
function getQuarterHistory(db) {
  const out = {};
  for (const r of db.prepare('SELECT * FROM quarters ORDER BY symbol, period_end').all()) {
    const { symbol, period_end, source, updated_at, ...fields } = r;
    (out[symbol] ||= []).push({ date: period_end, src: source, ...fields });
  }
  return out;
}

function getHistory(db, symbol) {
  const quarters = db.prepare('SELECT * FROM quarters WHERE symbol = ? ORDER BY period_end').all(symbol).map((r) => ({ ...r }));
  const snapshots = db.prepare(`SELECT r.generated_at, s.period_end, s.report_date, s.revenue_b, s.net_income_b, s.eps_actual, s.eps_estimate
    FROM earnings_snapshots s JOIN refresh_runs r ON r.id = s.run_id WHERE s.symbol = ? ORDER BY s.run_id`).all(symbol).map((r) => ({ ...r }));
  return { symbol, quarters, snapshots };
}

// ---------- primeira execução: aproveita o que já existia em JSON (cache do refresh e arquivos de data/)
function importLegacy(db, outDir) {
  if (latestRunId(db)) return false;
  const pick = (name) => readJson(path.join(outDir, name), null) || readJson(path.join(DATA, name), null);
  const rows = readJson(path.join(outDir, 'earnings.json'), null) || readJson(path.join(__dirname, '..', 'public', 'earnings.json'), []);
  const meta = readJson(path.join(outDir, 'meta.json'), null) || readJson(path.join(__dirname, '..', 'public', 'meta.json'), null);
  const state = pick('state.json') || {};
  const fmpCache = pick('fmp-cache.json') || {};
  if (!rows.length || !meta) { tx(db, () => { db.exec('DELETE FROM state'); saveState(db, state); saveFmpCache(db, fmpCache); }); return false; }
  const quarters = {};
  for (const [sym, slot] of Object.entries(fmpCache)) if (slot.quarters) quarters[sym] = slot.quarters;
  saveRun(db, { meta: { fmpStale: [], seconds: null, failed: 0, usedFmp: false, ...meta }, rows, state, quarters, fmpCache });
  return true;
}
function saveState(db, state) {
  const st = db.prepare('INSERT INTO state (symbol, next_earnings, period_end) VALUES (?, ?, ?)');
  for (const [sym, s] of Object.entries(state)) st.run(sym, s.nextEarnings ?? null, s.periodEnd ?? null);
}

module.exports = { open, tx, syncCuration, importLegacy, saveRun, backfillQuarters, getCompanies, getOverrides, getSegments, getNews, getState, getFmpCache, getLatest, getHistory, getQuarterHistory, QUARTER_FIELDS };

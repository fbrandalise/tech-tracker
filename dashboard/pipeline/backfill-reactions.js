'use strict';
/*
 * Grava a reação do preço a cada divulgação passada (hoje o coletor só guarda a do último resultado).
 * Datas de divulgação: as do histórico de EPS de cada empresa (FMP/Yahoo, ~4 a 5 por empresa).
 * Janela: fechamento do dia anterior à data até o fechamento do dia seguinte (mesma regra do painel).
 *
 * Uso:  node pipeline/backfill-reactions.js [--symbols NVDA,MSFT]
 */
const path = require('path');
const store = require('./db');
const { priceReaction } = require('./refresh');

const args = process.argv.slice(2);
const i = args.indexOf('--symbols');
const only = i >= 0 ? args[i + 1].split(',').map((s) => s.trim().toUpperCase()) : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const db = store.open(process.env.DB_PATH || path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data', 'cache'), 'earnings.db'));
  const rows = store.getLatest(db)?.rows || [];
  const yahoo = Object.fromEntries(store.getCompanies(db).map((c) => [c.symbol, c.y]));
  let saved = 0, missing = 0;
  for (const r of rows) {
    if (only && !only.includes(r.symbol)) continue;
    const dates = new Set([...(r.epsHist || []).map((h) => h.d), r.reportDate].filter(Boolean));
    for (const d of [...dates].sort()) {
      const react = await priceReaction(yahoo[r.symbol] || r.symbol, d);
      if (react) { store.saveReaction(db, r.symbol, d, react); saved++; } else missing++;
      await sleep(300);
    }
    console.log(`${r.symbol}: ${dates.size} divulgações`);
  }
  console.log(`Gravadas ${saved} reações; ${missing} sem preço na janela.`);
})().catch((e) => { console.error(e.message); process.exit(1); });

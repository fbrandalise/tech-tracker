'use strict';
// Processo filho de pipeline/safe-sql.js: abre o banco somente leitura, trava nas views e responde às consultas por IPC.
const { DatabaseSync } = require('node:sqlite');
const { checkSql, lockToViews, MAX_ROWS } = require('./safe-sql');

let db, openFile;
process.on('message', ({ id, file, sql }) => {
  try {
    if (openFile !== file) {
      db?.close();
      db = new DatabaseSync(file, { readOnly: true });
      lockToViews(db);
      openFile = file;
    }
    const rows = [];
    let truncated = false;
    for (const r of db.prepare(checkSql(sql)).iterate()) {   // lê no máximo MAX_ROWS+1 linhas, sem materializar tudo
      if (rows.length >= MAX_ROWS) { truncated = true; break; }
      rows.push({ ...r });
    }
    process.send({ id, result: { rowCount: rows.length, truncated, rows } });
  } catch (e) {
    process.send({ id, error: e.message });
  }
});

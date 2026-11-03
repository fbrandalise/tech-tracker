'use strict';
/*
 * Execução de SQL escrito por terceiros (o modelo de "Pergunte aos dados", os MCPs). Quatro barreiras:
 *   1. só SELECT/WITH, uma instrução                           (checkSql)
 *   2. banco aberto somente leitura                            (worker)
 *   3. autorizador do SQLite: só lê as views v_*, sem CTE recursiva, sem PRAGMA/ATTACH  (lockToViews)
 *   4. a consulta roda em um processo filho com tempo limite; estourou, o processo é morto (nenhuma API do SQLite
 *      interrompe uma consulta em andamento, e uma CTE infinita no processo principal travaria o servidor inteiro)
 * e no máximo MAX_ROWS linhas são lidas (iterando, sem materializar o resultado).
 *
 * Resíduo conhecido do autorizador: leituras sem nome de coluna (count(*), MAX(id)) de tabelas brutas são permitidas, porque
 * as próprias views as usam e o SQLite as reporta sem o contexto da view. Só vazam contagens e extremos de id.
 */
const path = require('path');
const { fork } = require('child_process');

const MAX_ROWS = 200, TIMEOUT_MS = 5000;
const A = { READ: 20, SELECT: 21, FUNCTION: 31 };   // códigos do autorizador (constants.SQLITE_*)

function checkSql(sql) {
  const s = String(sql || '').trim().replace(/;+\s*$/, '');
  if (!s) throw new Error('SQL vazio');
  if (!/^(select|with)\b/i.test(s)) throw new Error('Só são permitidas instruções SELECT ou WITH');
  if (s.includes(';')) throw new Error('Envie uma única instrução por chamada');
  return s;
}

// 0 = permitir, 1 = negar
function lockToViews(db) {
  db.setAuthorizer((action, a1, a2, _db, source) => {
    if (action === A.SELECT || action === A.FUNCTION) return 0;
    if (action === A.READ) return String(a1).startsWith('v_') || String(source || '').startsWith('v_') || a2 === '' ? 0 : 1;
    return 1;   // recursão, PRAGMA, ATTACH, escrita, transações…
  });
}

// ---- processo filho persistente ----
let child = null, queue = Promise.resolve(), seq = 0;
const pending = new Map();

function spawnWorker() {
  const c = fork(path.join(__dirname, 'sql-worker.js'), [], { execArgv: ['--max-old-space-size=256'], env: { NODE_NO_WARNINGS: '1' }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  c.unref(); c.channel.unref();   // não segura o processo vivo quando está ocioso
  c.on('message', (m) => {
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    m.error ? p.reject(new Error(m.error)) : p.resolve(m.result);
  });
  c.on('error', () => {});   // IPC fechado durante um kill: o 'exit' abaixo trata as pendências
  c.on('exit', () => {
    if (child === c) child = null;
    for (const [id, p] of pending) if (p.worker === c) { pending.delete(id); p.reject(new Error('Consulta interrompida (processo de SQL encerrou)')); }
  });
  return c;
}

function runOnce(file, sql, timeoutMs) {
  return new Promise((resolve, reject) => {
    child ||= spawnWorker();
    const c = child, id = ++seq;
    c.channel.ref();
    const timer = setTimeout(() => {
      pending.delete(id);
      if (child === c) child = null;   // a próxima consulta já cria um processo novo, sem esperar o 'exit' do antigo
      c.kill('SIGKILL');
      reject(new Error(`A consulta passou de ${timeoutMs / 1000}s e foi cancelada. Use filtros, LIMIT e evite produtos cartesianos`));
    }, timeoutMs);
    pending.set(id, { worker: c, resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
    c.send({ id, file, sql });
  }).finally(() => { try { child?.channel?.unref(); } catch { /* processo já saiu */ } });
}

// uma consulta por vez: se uma for morta por tempo, as seguintes não herdam o processo ocupado
function runSql(file, sql, { timeoutMs = TIMEOUT_MS } = {}) {
  const s = checkSql(sql);
  const p = queue.then(() => runOnce(file, s, timeoutMs));
  queue = p.catch(() => {});
  return p;
}

module.exports = { runSql, checkSql, lockToViews, MAX_ROWS, TIMEOUT_MS };

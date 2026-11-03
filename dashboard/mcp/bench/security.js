'use strict';
/*
 * Bateria de segurança e robustez. Ataca os dois servidores pelo protocolo MCP, como um agente (ou um prompt injection) faria.
 *   BLOQUEADO  a tentativa falhou como deveria
 *   MITIGADO   a tentativa funcionou, mas o servidor limitou ou sinalizou o dano
 *   ABERTO     a tentativa funcionou sem limite (falha de segurança)
 *
 * Uso:  node mcp/bench/security.js [--json]
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { connect } = require('./client');
const { spawn } = require('child_process');
const sandbox = require('../code-exec/sandbox');

const ROOT = path.join(__dirname, '..', '..');
const DB = path.join(ROOT, 'data', 'cache', 'earnings.db');
const ENVF = path.join(ROOT, '.env');
const WS = sandbox.DIRS.workspace;
const results = [];
const rec = (target, id, attack, verdict, detail) => { results.push({ target, id, attack, verdict, detail }); console.log(`${verdict.padEnd(9)} ${target.padEnd(11)} ${id.padEnd(22)} ${detail}`); };

// o código imprime LEAK se a ação deu certo, BLOCKED se foi negada
const probe = (imports, body) => `${imports}\ntry { ${body}\n} catch (e) { console.log('BLOCKED', e.code || e.name, String(e.message).slice(0, 60)); }`;

async function run() {
  // alvo de rede local: se o sandbox conseguir alcançá-lo, a rede não está isolada
  let hits = 0;
  const net = http.createServer((q, r) => { hits++; r.end('x'); });
  await new Promise((r) => net.listen(0, '127.0.0.1', r));
  const port = net.address().port;

  const ce = await connect('code-exec', { CANARY_SECRET: 'canario-123', ANTHROPIC_API_KEY: 'sk-ant-falsa-para-teste' });
  const exec = (code, timeout_ms) => ce.call('execute_code', { code, ...(timeout_ms ? { timeout_ms } : {}) });
  const must = async (id, attack, code, { timeout, okVerdict } = {}) => {
    const r = await exec(code, timeout);
    const leaked = /\bLEAK\b/.test(r.text), blocked = /\bBLOCKED\b|ERR_ACCESS_DENIED|bloqueado no sandbox/.test(r.text);   // import estático negado derruba o módulo antes do try/catch
    const verdict = okVerdict ? okVerdict(r) : leaked ? 'ABERTO' : blocked ? 'BLOQUEADO' : 'ABERTO';
    rec('code-exec', id, attack, verdict, r.text.replace(/\n/g, ' ').slice(0, 110));
  };

  // ---------- code-exec: acesso a arquivos ----------
  await must('read_etc_passwd', 'ler arquivo do sistema', probe("import fs from 'node:fs';", "fs.readFileSync('/etc/passwd','utf8'); console.log('LEAK');"));
  await must('read_database_file', 'abrir o arquivo do banco', probe("import fs from 'node:fs';", `fs.readFileSync(${JSON.stringify(DB)}); console.log('LEAK');`));
  await must('open_sqlite_direct', 'abrir o banco com node:sqlite', probe("import { DatabaseSync } from 'node:sqlite';", `new DatabaseSync(${JSON.stringify(DB)}, { readOnly: true }); console.log('LEAK');`));
  await must('read_dotenv', 'ler o .env do projeto', probe("import fs from 'node:fs';", `fs.readFileSync(${JSON.stringify(ENVF)}); console.log('LEAK');`));
  await must('read_proc_environ', 'ler /proc/<pai>/environ', probe("import fs from 'node:fs';", "fs.readFileSync('/proc/'+process.ppid+'/environ'); console.log('LEAK');"));
  await must('write_outside', 'gravar fora do workspace', probe("import fs from 'node:fs';", "fs.writeFileSync('/tmp/sandbox-escape.txt','x'); console.log('LEAK');"));
  await must('tamper_servers', 'sobrescrever os módulos de ferramentas', probe("import fs from 'node:fs';", "fs.writeFileSync('../servers/_client.js','// pwn'); console.log('LEAK');"));
  await must('symlink_escape', 'symlink no workspace apontando para fora', probe("import fs from 'node:fs';", `fs.rmSync(${JSON.stringify(path.join(WS, 'lnk'))},{force:true}); fs.symlinkSync('/etc/passwd', ${JSON.stringify(path.join(WS, 'lnk'))}); fs.readFileSync(${JSON.stringify(path.join(WS, 'lnk'))}, 'utf8'); console.log('LEAK');`));
  await must('sqlite_via_require', 'node:sqlite via createRequire', probe("import { createRequire } from 'node:module';", `createRequire(import.meta.url)('node:sqlite'); console.log('LEAK');`));
  await must('sqlite_via_builtin', 'node:sqlite via process.getBuiltinModule', probe('', "process.getBuiltinModule('node:sqlite'); console.log('LEAK');"));
  const decoy = spawn('sleep', ['300'], { stdio: 'ignore' });
  await must('kill_other_process', 'process.kill de um processo alheio (pid do usuário)', probe('', `process.kill(${decoy.pid}, 'SIGKILL'); console.log('LEAK');`), { okVerdict: (r) => { let alive = true; try { process.kill(decoy.pid, 0); } catch { alive = false; } return alive && !/LEAK/.test(r.text) ? 'BLOQUEADO' : 'ABERTO'; } });
  try { decoy.kill('SIGKILL'); } catch { /* já morto */ }
  // ---------- code-exec: processos, rede, ambiente ----------
  await must('spawn_process', 'executar comando (child_process)', probe("import cp from 'node:child_process';", "cp.execSync('id'); console.log('LEAK');"));
  await must('worker_thread', 'criar worker thread', probe("import { Worker } from 'node:worker_threads';", "new Worker('1', { eval: true }); console.log('LEAK');"));
  await must('native_addon', 'carregar addon nativo (dlopen)', probe('', "process.dlopen({ exports: {} }, '/tmp/x.node'); console.log('LEAK');"));
  hits = 0;
  await must('network_egress', 'requisição HTTP para fora do sandbox', probe('', `await fetch('http://127.0.0.1:${port}/'); console.log('LEAK');`), { okVerdict: (r) => (hits > 0 ? 'ABERTO' : 'BLOQUEADO') });
  await must('env_secrets', 'ler variáveis de ambiente (chave de API)', "const v = JSON.stringify(process.env); console.log(/canario|sk-ant/.test(v) ? 'LEAK '+v : 'BLOCKED ambiente limpo: '+Object.keys(process.env).join(','));");
  // ---------- code-exec: recursos ----------
  await must('infinite_loop', 'laço infinito', 'while (true) {}', { timeout: 2000, okVerdict: (r) => (/interrompido/.test(r.text) ? 'BLOQUEADO' : 'ABERTO') });
  await must('memory_bomb', 'estouro de memória', 'const a=[]; for(;;) a.push(new Array(1e6).fill(1));', { timeout: 20000, okVerdict: (r) => (r.isError ? 'BLOQUEADO' : 'ABERTO') });
  await must('output_flood', '10 MB de saída', "for (let i=0;i<10;i++) console.log('x'.repeat(1e6));", { okVerdict: (r) => (r.receivedBytes < 40000 && /truncada/.test(r.text) ? 'MITIGADO' : 'ABERTO') });
  await must('toolcall_flood', '1000 chamadas de ferramenta em laço', "import { listCompanies } from '../servers/earnings/index.js'; let ok=0; try { for(let i=0;i<1000;i++){ await listCompanies(); ok++; } console.log('LEAK '+ok); } catch(e){ console.log('BLOCKED depois de '+ok+': '+e.message.slice(0,50)); }", { okVerdict: (r) => (/BLOCKED/.test(r.text) ? 'MITIGADO' : 'ABERTO') });
  await must('disk_fill', 'gravar 80 MB no workspace', "import fs from 'node:fs'; fs.writeFileSync('big.bin', Buffer.alloc(80*1024*1024)); console.log('wrote');", { okVerdict: (r) => (/workspace acima/.test(r.text) ? 'MITIGADO' : 'ABERTO') });
  fs.rmSync(path.join(WS, 'big.bin'), { force: true });
  fs.rmSync(path.join(WS, 'lnk'), { force: true });
  await must('sql_write_from_sandbox', 'DROP TABLE via runSql dentro do sandbox', "import { runSql } from '../servers/earnings/index.js'; try { await runSql({ sql: 'DROP TABLE quarters' }); console.log('LEAK'); } catch(e) { console.log('BLOCKED', e.message.slice(0,50)); }");

  // ---------- servidores: SQL e entradas ----------
  const tr = await connect('traditional');
  for (const [kind, c] of [['traditional', tr], ['code-exec', ce]]) {
    const sql = async (id, attack, q, want) => {
      let r;
      if (kind === 'traditional') r = await c.call('run_sql', { sql: q });
      else r = await c.call('execute_code', { code: `import { runSql } from '../servers/earnings/index.js'; try { const r = await runSql({ sql: ${JSON.stringify(q)} }); console.log('LEAK', JSON.stringify(r).slice(0,80)); } catch (e) { console.log('BLOCKED', e.message.slice(0,60)); }` });
      rec(kind, id, attack, /LEAK/.test(r.text) || (!r.isError && kind === 'traditional') ? 'ABERTO' : 'BLOQUEADO', r.text.replace(/\n/g, ' ').slice(0, 110));
    };
    await sql('sql_drop', 'DROP TABLE', 'DROP TABLE quarters');
    await sql('sql_attach', 'ATTACH DATABASE (cria arquivo)', "ATTACH DATABASE '/tmp/pwn.db' AS p");
    await sql('sql_multi', 'duas instruções (SELECT; DROP)', 'SELECT 1; DROP TABLE quarters');
    await sql('sql_pragma', 'PRAGMA que escreve', 'PRAGMA user_version = 99');
    await sql('sql_raw_tables', 'ler tabela bruta', 'SELECT * FROM quarters LIMIT 1').catch(() => {});
  }
  // validação de parâmetros (só o tradicional valida por esquema zod no protocolo)
  const bad = await tr.call('rank_companies', { metric: 'revenue_yoy; DROP TABLE x', limit: 5 });
  rec('traditional', 'metric_injection', 'texto livre no nome da coluna', bad.isError ? 'BLOQUEADO' : 'ABERTO', bad.text.slice(0, 100));
  const typed = await tr.call('get_quarters', { symbol: 'NVDA', limit: 'abc' });
  rec('traditional', 'wrong_types', 'limit como texto', typed.isError ? 'BLOQUEADO' : 'ABERTO', typed.text.slice(0, 100));
  const big = await tr.call('get_quarters', { symbol: 'NVDA', limit: 1e9 });
  rec('traditional', 'huge_limit', 'limit = 1 bilhão', !big.isError && big.receivedBytes < 60000 ? 'MITIGADO' : 'ABERTO', `${big.receivedBytes} bytes devolvidos`);

  // ---------- servidores: consulta que nunca termina (DoS) ----------
  const dos = 'SELECT count(*) FROM v_quarter a, v_quarter b, v_quarter c, v_quarter d';
  const dosRec = "WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r) SELECT count(*) FROM r";
  const race = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r({ hung: true }), ms))]);
  const d1 = await race(tr.call('run_sql', { sql: dos }), 9000);
  rec('traditional', 'sql_cross_join', 'produto cartesiano de 4 views (bilhões de linhas)', d1.hung ? 'ABERTO' : 'BLOQUEADO', d1.hung ? 'servidor travado (sem resposta no prazo)' : String(d1.text).slice(0, 90));
  const d2 = await race(exec(`import { runSql } from '../servers/earnings/index.js'; try { await runSql({ sql: ${JSON.stringify(dos)} }); console.log('LEAK'); } catch(e) { console.log('BLOCKED', e.message.slice(0,60)); }`, 20000), 12000);
  rec('code-exec', 'sql_cross_join', 'produto cartesiano de 4 views (bilhões de linhas)', d2.hung ? 'ABERTO' : 'BLOQUEADO', d2.hung ? 'servidor travado (sem resposta no prazo)' : String(d2.text).replace(/\n/g, ' ').slice(0, 90));

  for (const [kind, c] of [['traditional', tr], ['code-exec', ce]]) {
    const q = kind === 'traditional'
      ? await c.call('run_sql', { sql: dosRec })
      : await c.call('execute_code', { code: `import { runSql } from '../servers/earnings/index.js'; try { await runSql({ sql: ${JSON.stringify(dosRec)} }); console.log('LEAK'); } catch(e) { console.log('BLOCKED', e.message.slice(0,60)); }` });
    rec(kind, 'sql_infinite_recursion', 'CTE recursiva sem fim', /LEAK/.test(q.text) || (kind === 'traditional' && !q.isError) ? 'ABERTO' : 'BLOQUEADO', q.text.replace(/\n/g, ' ').slice(0, 90));
  }

  // ---------- por último: o ataque que pode derrubar o pai ----------
  let ce2 = ce;
  if (d2.hung) { try { await ce.close(); } catch { /* travado */ } ce2 = await connect('code-exec'); }
  const kill = await race(ce2.call('execute_code', { code: "try { process.kill(process.ppid, 'SIGTERM'); await new Promise(r=>setTimeout(r,500)); console.log('LEAK enviou SIGTERM ao servidor'); } catch(e) { console.log('BLOCKED', e.code||e.message.slice(0,50)); }" }), 8000).catch((e) => ({ text: 'erro: ' + e.message, dead: true }));
  let alive = true;
  try { await race(ce2.call('search_tools', { detail: 'name' }), 4000).then((r) => { if (r.hung) alive = false; }); } catch { alive = false; }
  rec('code-exec', 'kill_parent', 'process.kill(ppid) no servidor MCP', alive && /BLOCKED/.test(kill.text || '') ? 'BLOQUEADO' : 'ABERTO', alive ? String(kill.text).replace(/\n/g, ' ').slice(0, 100) : 'o servidor MCP morreu');

  net.close();
  for (const c of [tr, ce2]) { try { await c.close(); } catch { /* já encerrado */ } }
  const out = path.join(__dirname, 'results');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'security.json'), JSON.stringify({ date: new Date().toISOString(), node: process.version, results }, null, 2));
  const count = (v) => results.filter((r) => r.verdict === v).length;
  console.log(`\n${results.length} ataques: ${count('BLOQUEADO')} bloqueados, ${count('MITIGADO')} mitigados, ${count('ABERTO')} abertos`);
  process.exit(count('ABERTO') ? 1 : 0);
}
run().catch((e) => { console.error(e); process.exit(2); });

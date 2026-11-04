// Servidor mínimo: arquivos estáticos + dados do banco SQLite (sem dependências além do d3 e do yahoo-finance2)
const http = require('http');
const fs = require('fs');
const path = require('path');
const store = require('./pipeline/db');
const { ask } = require('./pipeline/ask');
const { briefing } = require('./pipeline/briefing');   // também carrega o .env

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const CACHE = process.env.DATA_DIR || path.join(__dirname, 'data', 'cache');
const REFRESH_HOURS = Number(process.env.REFRESH_HOURS ?? 12);   // 0 desliga a atualização automática
const json = (res, code, body) => res.writeHead(code, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' }).end(JSON.stringify(body));

// POST /api/ask {question}: pergunta em linguagem natural (gasta créditos da chave da API). Desligado por padrão: ENABLE_ASK=1 + ANTHROPIC_API_KEY.
const ASK_ON = process.env.ENABLE_ASK === '1' && !!process.env.ANTHROPIC_API_KEY;
const ASK_PER_MIN = Number(process.env.ASK_PER_MIN ?? 10), ASK_MAX_PARALLEL = 2;
const askTimes = []; let askBusy = 0;
function handleAsk(req, res) {
  if (req.method === 'GET') return json(res, 200, { enabled: ASK_ON });   // a página usa isto para mostrar ou esconder a caixa de pergunta
  if (req.method !== 'POST') return json(res, 405, { error: 'use GET ou POST' });
  if (!ASK_ON) return json(res, 503, { error: 'desativado: defina ENABLE_ASK=1 e ANTHROPIC_API_KEY' });
  const now = Date.now();
  while (askTimes.length && now - askTimes[0] > 60000) askTimes.shift();
  if (askTimes.length >= ASK_PER_MIN || askBusy >= ASK_MAX_PARALLEL) return json(res, 429, { error: 'muitas perguntas, tente em instantes' });
  let body = '';
  req.on('data', (c) => { body += c; if (body.length > 2048) req.destroy(); });
  req.on('end', async () => {
    let question, lang;
    try { ({ question, lang } = JSON.parse(body)); } catch (e) { return json(res, 400, { error: 'JSON inválido' }); }
    if (typeof question !== 'string' || !question.trim() || question.length > 500) return json(res, 400, { error: 'question deve ter de 1 a 500 caracteres' });
    askTimes.push(now); askBusy++;
    try {
      const r = await ask(question, { dbFile: process.env.DB_PATH || path.join(CACHE, 'earnings.db'), lang: lang === 'en' ? 'en' : 'pt' });
      json(res, 200, { answer: r.answer, queries: r.queries, usage: r.usage, refused: !!r.refused });
    } catch (e) { console.error('ask:', e.message); json(res, 500, { error: 'não foi possível responder agora' }); }
    finally { askBusy--; }
  });
}

// banco: dados coletados + curadoria. Se não abrir, o painel continua servindo os JSONs estáticos de public/
let db = null;
try {
  db = store.open(process.env.DB_PATH || path.join(CACHE, 'earnings.db'));
  store.syncCuration(db);
  store.importLegacy(db, CACHE);
} catch (e) { console.error('Banco indisponível, usando arquivos estáticos:', e.message); db = null; }
const fromDb = {   // rotas JSON servidas do banco quando há dados
  '/earnings.json': () => store.getLatest(db)?.rows,
  '/meta.json': () => store.getLatest(db)?.meta,
  '/news.json': () => { const n = store.getNews(db); return n.length ? n : null; },
};
const D3 = path.join(__dirname, 'node_modules/d3/dist/d3.min.js');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let file;
  if (url.pathname === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, lastRefresh, refreshing, lastError })); return; }
  if (url.pathname === '/api/ask') return handleAsk(req, res);
  const hist = url.pathname.match(/^\/api\/history\/([A-Za-z0-9.\-]{1,12})$/);
  if (hist) { if (!db) return json(res, 503, { error: 'banco indisponível' }); return json(res, 200, store.getHistory(db, hist[1].toUpperCase())); }
  // curadorias lidas direto de data/ (promessas e estratégia): sem banco, a edição do arquivo vale na próxima abertura da página
  if (url.pathname === '/promises.json' || url.pathname === '/strategy.json') {
    return fs.readFile(path.join(__dirname, 'data', url.pathname.slice(1)), (err, data) => {
      if (err) return json(res, 200, []);
      res.writeHead(200, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' }).end(data);
    });
  }
  const brief = url.pathname.match(/^\/api\/briefing\/([A-Za-z0-9.\-]{1,12})$/);
  if (brief) {
    if (!db) return json(res, 503, { error: 'banco indisponível' });
    try { return json(res, 200, briefing(db, brief[1], url.searchParams.get('lang') === 'en' ? 'en' : 'pt')); }
    catch (e) { return json(res, 404, { error: 'empresa desconhecida' }); }
  }
  if (db && fromDb[url.pathname]) {
    let body; try { body = fromDb[url.pathname](); } catch (e) { console.error(e.message); }
    if (body) return json(res, 200, body);
  }
  if (url.pathname === '/vendor/d3.min.js') file = D3;
  else {
    let decoded;
    try { decoded = decodeURIComponent(url.pathname); } catch { res.writeHead(400).end('Bad request'); return; }   // %-sequência inválida não pode derrubar o processo
    if (decoded.includes('\0')) { res.writeHead(400).end('Bad request'); return; }
    file = path.join(PUBLIC, decoded === '/' ? 'index.html' : decoded);
    if (file !== PUBLIC && !file.startsWith(PUBLIC + path.sep)) { res.writeHead(403).end('Forbidden'); return; }
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Não encontrado'); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': file === D3 ? 'public, max-age=86400' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer'
    }).end(data);
  });
}).listen(PORT, '0.0.0.0', () => console.log(`Dashboard em http://0.0.0.0:${PORT}`));


// ---- atualização automática dos dados (FMP + Yahoo); falha não derruba o servidor
let lastRefresh = null, refreshing = false, lastError = null;
async function runRefresh() {
  if (refreshing) return;
  refreshing = true;
  try {
    const { refresh } = require('./pipeline/refresh');
    const { meta } = await refresh(CACHE, { db });
    lastRefresh = meta.generatedAt; lastError = null;
    console.log('Dados atualizados:', JSON.stringify(meta));
  } catch (e) { lastError = e.message; console.error('Falha ao atualizar os dados:', e.message); }
  refreshing = false;
}
if (REFRESH_HOURS > 0) {
  setTimeout(runRefresh, 5000);
  setInterval(runRefresh, REFRESH_HOURS * 3600 * 1000).unref();
}

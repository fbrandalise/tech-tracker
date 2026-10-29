// Servidor estático mínimo (sem dependências além do d3, servido localmente)
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const CACHE = process.env.DATA_DIR || path.join(__dirname, 'data', 'cache');
const REFRESH_HOURS = Number(process.env.REFRESH_HOURS ?? 12);   // 0 desliga a atualização automática
const LIVE = new Set(['/earnings.json', '/meta.json']);            // servidos da pasta de cache quando ela existe
const D3 = path.join(__dirname, 'node_modules/d3/dist/d3.min.js');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let file;
  if (url.pathname === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, lastRefresh, refreshing, lastError })); return; }
  if (url.pathname === '/vendor/d3.min.js') file = D3;
  else {
    const rel = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    file = path.join(PUBLIC, rel === '/' || rel === '\\' ? 'index.html' : rel);
    if (!file.startsWith(PUBLIC)) { res.writeHead(403).end('Forbidden'); return; }
    if (LIVE.has(url.pathname) && fs.existsSync(path.join(CACHE, path.basename(file)))) file = path.join(CACHE, path.basename(file));
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Não encontrado'); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': file === D3 ? 'public, max-age=86400' : 'no-cache',
      'X-Content-Type-Options': 'nosniff'
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
    const { meta } = await refresh(CACHE);
    lastRefresh = meta.generatedAt; lastError = null;
    console.log('Dados atualizados:', JSON.stringify(meta));
  } catch (e) { lastError = e.message; console.error('Falha ao atualizar os dados:', e.message); }
  refreshing = false;
}
if (REFRESH_HOURS > 0) {
  setTimeout(runRefresh, 5000);
  setInterval(runRefresh, REFRESH_HOURS * 3600 * 1000).unref();
}

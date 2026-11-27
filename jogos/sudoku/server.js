const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createRanking } = require('./ranking-server');
const root = path.resolve(__dirname, 'dist');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.wav': 'audio/wav' };
const maxBodyBytes = 16 * 1024;

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
    throw Object.assign(new Error(), { status: 415 });
  }
  if (Number(req.headers['content-length']) > maxBodyBytes) throw Object.assign(new Error(), { status: 413 });
  const chunks = [];
  let size = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > maxBodyBytes) { req.resume(); throw Object.assign(new Error(), { status: 413 }); }
    chunks.push(chunk);
  }
  const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid body');
  return data;
}

function createServer(ranking) {
  return http.createServer(async (req, res) => {
    let url, pathname;
    try {
      url = new URL(req.url, 'http://localhost');
      pathname = decodeURIComponent(url.pathname);
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (pathname === '/api/ranking' || pathname.startsWith('/api/ranking/')) {
      let body;
      try {
        if (req.method === 'POST') body = await readBody(req);
      } catch (error) {
        sendJson(res, error.status || 400, { error: 'Dados inválidos.' });
        return;
      }
      try {
        const { status, data } = ranking.handle(req.method, pathname, url.searchParams, body);
        sendJson(res, status, data);
      } catch {
        sendJson(res, 503, { error: 'Ranking indisponível agora. Tente novamente.' });
      }
      return;
    }
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep) || pathname.includes('\0')) { res.writeHead(403).end(); return; }
    fs.readFile(file, (error, data) => {
      if (error) { res.writeHead(404).end('Arquivo não encontrado'); return; }
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : data);
    });
  });
}

if (require.main === module) {
  const dataDirectory = process.env.SUDOKU_DATA_DIR || path.join(__dirname, '.dados');
  fs.mkdirSync(dataDirectory, { recursive: true });
  const port = Number(process.env.SUDOKU_PORT || 4173);
  const host = process.env.SUDOKU_HOST || '127.0.0.1';
  const ranking = createRanking(path.join(dataDirectory, 'ranking.sqlite'));
  createServer(ranking).listen(port, host, () => console.log(`Sudoku: http://${host}:${port}`));
}

module.exports = { createServer };

import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { extname } from 'node:path';
import { createCaveRooms } from './rooms.mjs';

const version = '1.17.0';
const players = new URL('../../../public/ocaso/', import.meta.url);
const release = new URL(`${version}/`, players);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

export async function createStandaloneGame() {
  const rooms = createCaveRooms();
  const assets = new Map([
    ['/', new URL('index.html', players)],
    ['/ocaso/index.html', new URL('index.html', players)],
    ['/ocaso/player.js', new URL('player.js', players)],
  ]);
  for (const file of await readdir(release, { withFileTypes: true })) {
    if (file.isFile() && /^[\w.-]+$/.test(file.name) && Object.hasOwn(mime, extname(file.name)))
      assets.set(`/ocaso/${version}/${file.name}`, new URL(file.name, release));
  }

  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'none'",
    );
    const path = req.url?.split('?', 1)[0];
    if (path === '/api/gruta-do-ocaso' && req.method === 'POST') {
      const origin = URL.parse(req.headers.origin || '');
      if (
        origin &&
        origin.host === req.headers.host &&
        (origin.protocol === 'https:' ||
          (origin.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(origin.hostname)))
      )
        return rooms.handle(req, res, origin.origin);
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: 'Origem inválida.' }));
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405);
      return res.end();
    }
    if (path === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ version }));
    }
    const file = assets.get(path);
    if (!file) {
      res.writeHead(404);
      return res.end();
    }
    try {
      const bytes = await readFile(file);
      const extension = extname(file.pathname);
      res.writeHead(200, {
        'Content-Type': mime[extension],
        'Content-Length': bytes.length,
        'Cache-Control': extension === '.html' ? 'no-store' : 'public, max-age=600',
        ...(extension === '.woff2' ? { 'Access-Control-Allow-Origin': '*' } : {}),
      });
      return res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch {
      res.writeHead(404);
      return res.end();
    }
  });
  server.on('close', () => rooms.close());
  return server;
}

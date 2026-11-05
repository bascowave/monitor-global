import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_FILE } from './ingest.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(here, '..', 'public');
const PORT = Number(process.env.PORT || 3000);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8' };

export function createServer({ dataFile = DATA_FILE, publicDir = PUBLIC } = {}) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    try {
      if (url.pathname === '/api/incidents') {
        const raw = await fs.readFile(dataFile, 'utf8').catch(() => '{"items":[],"errors":[{"source":"ingest","message":"sem dados ainda"}]}');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' });
        return res.end(raw);
      }
      const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      const file = path.resolve(publicDir, name);
      if (!file.startsWith(publicDir)) { res.writeHead(403); return res.end(); }
      const body = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('não encontrado');
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createServer().listen(PORT, () => console.log(`http://localhost:${PORT}`));
}

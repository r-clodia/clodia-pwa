import { createReadStream, statSync } from 'node:fs';
import { createServer, request as httpRequest } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || '0.0.0.0';
const API_TARGET = new URL(process.env.API_TARGET || 'http://127.0.0.1:7842');
const BUILD_DIR = resolve(process.env.BUILD_DIR || 'build');

const API_PREFIXES = ['/api', '/auth', '/clodia', '/daemons', '/files', '/health', '/topics'];
const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function isApiRequest(req) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (!API_PREFIXES.some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`))) {
    return false;
  }
  const accept = req.headers.accept || '';
  return !(req.method === 'GET' && accept.includes('text/html'));
}

function proxy(req, res) {
  const target = new URL(req.url || '/', API_TARGET);
  const headers = { ...req.headers, host: API_TARGET.host };
  const upstream = httpRequest(
    {
      protocol: API_TARGET.protocol,
      hostname: API_TARGET.hostname,
      port: API_TARGET.port,
      method: req.method,
      path: `${target.pathname}${target.search}`,
      headers,
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );

  upstream.on('error', (err) => {
    res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`API proxy error: ${err.message}`);
  });

  req.pipe(upstream);
}

function fileFor(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  const candidate = resolve(BUILD_DIR, clean === '/' ? 'index.html' : clean.slice(1));
  if (!candidate.startsWith(BUILD_DIR)) return join(BUILD_DIR, 'index.html');
  try {
    const st = statSync(candidate);
    if (st.isFile()) return candidate;
  } catch (_) {
    // fall through to SPA fallback
  }
  return join(BUILD_DIR, 'index.html');
}

function serveStatic(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const file = fileFor(url.pathname);
  const type = MIME[extname(file)] || 'application/octet-stream';
  res.writeHead(200, {
    'content-type': type,
    'cache-control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600',
  });
  createReadStream(file).pipe(res);
}

createServer((req, res) => {
  if (isApiRequest(req)) {
    proxy(req, res);
    return;
  }
  serveStatic(req, res);
}).listen(PORT, HOST, () => {
  console.log(`clodia-pwa listening on http://${HOST}:${PORT}`);
  console.log(`proxying API requests to ${API_TARGET.origin}`);
});

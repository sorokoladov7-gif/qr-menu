const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 3000);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
  const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
  const target = path.resolve(root, relative);

  if (!target.startsWith(root + path.sep) && target !== root) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(target, (error, stat) => {
    if (error || !stat.isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    res.writeHead(200, {
      'Content-Type': types[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(target).pipe(res);
  });
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Static server listening on http://127.0.0.1:${port}\n`);
});

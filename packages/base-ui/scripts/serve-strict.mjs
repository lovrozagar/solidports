// A static server for the fixed-port test apps (e2e, regressions): serves `<dir>/build` with the
// SPA fallback to index.html (what their serve.json configured), on 127.0.0.1 and ::1 at one port,
// and exits 1 naming the port when either address is taken. `serve` 14 moves to a random port when
// its port is taken, even with --no-port-switching, and a probe before it leaves a race; binding
// strictly here does not.
//   node scripts/serve-strict.mjs <dir> <port>
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const [dir, portArg] = process.argv.slice(2);
const port = Number(portArg);
if (!dir || !Number.isInteger(port) || port <= 0) {
  console.error('usage: node scripts/serve-strict.mjs <dir> <port>');
  process.exit(2);
}
const root = path.resolve(dir, 'build');
const index = path.join(root, 'index.html');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

function handler(req, res) {
  let file;
  try {
    file = path.resolve(root, `.${decodeURIComponent(new URL(req.url, 'http://x').pathname)}`);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) {
    res.writeHead(403).end();
    return;
  }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = index;
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

const servers = [];
function listen(host) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.once('error', reject);
    server.listen({ port, host, ipv6Only: host === '::1' }, () => {
      servers.push(server);
      resolve();
    });
  });
}

for (const host of ['127.0.0.1', '::1']) {
  try {
    // eslint-disable-next-line no-await-in-loop -- one address at a time, to name the taken one
    await listen(host);
  } catch (error) {
    if (host === '::1' && (error.code === 'EADDRNOTAVAIL' || error.code === 'EAFNOSUPPORT')) {
      continue;
    }
    for (const server of servers) server.close();
    console.error(
      error.code === 'EADDRINUSE'
        ? `serve-strict: port ${port} is taken on ${host}; stop that server or wait for it, then rerun`
        : `serve-strict: cannot listen on ${host}:${port}: ${error.message}`,
    );
    process.exit(1);
  }
}
console.log(`serve-strict: ${root} on http://localhost:${port}`);

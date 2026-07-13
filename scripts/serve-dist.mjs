import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve('dist');
const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 4184);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

const getFilePath = (url = '/') => {
  const pathname = decodeURIComponent(url.split('?')[0] || '/');
  const normalizedPath = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const requestedPath = join(root, normalizedPath);
  const filePath = existsSync(requestedPath) && statSync(requestedPath).isFile()
    ? requestedPath
    : join(root, 'index.html');
  return filePath.startsWith(root) ? filePath : join(root, 'index.html');
};

createServer((req, res) => {
  const filePath = getFilePath(req.url);
  const contentType = contentTypes[extname(filePath)] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  createReadStream(filePath).pipe(res);
}).listen(port, host, () => {
  console.log(`MES Demo is available on http://${host}:${port}`);
  console.log(`Use your LAN IP, for example: http://<your-ip>:${port}`);
  console.log(`APP path: http://<your-ip>:${port}/#/app`);
});

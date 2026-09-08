/**
 * VS Ads Intelligence - Zero-Dependency Local Static Server
 * Serves the dashboard on http://localhost:3000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3000;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.csv': 'text/csv; charset=utf-8'
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
  let reqPath = decodeURIComponent(parsedUrl.pathname);

  // If root or SPA route (no extension), serve index.html
  const ext = path.extname(reqPath).toLowerCase();
  let filePath;

  if (!ext || reqPath === '/' || reqPath === '') {
    filePath = path.join(__dirname, 'index.html');
  } else {
    filePath = path.join(__dirname, reqPath);
  }

  // If file doesn't exist directly, check if it's an asset requested under an SPA route prefix
  if (ext && (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile())) {
    const strippedPath = reqPath.replace(/^\/(overview|data-uploads|campaigns|reports|ai-insights|improve)/, '');
    const candidatePath = path.join(__dirname, strippedPath);
    if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
      filePath = candidatePath;
    }
  }

  fs.stat(filePath, (err, stats) => {
    // If specific file not found and has no extension, fallback to index.html
    if ((err || !stats.isFile()) && !ext) {
      filePath = path.join(__dirname, 'index.html');
    } else if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const fileExt = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[fileExt] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n======================================================`);
  console.log(`  VS Ads Intelligence Dashboard is LIVE!`);
  console.log(`  Access URL: ${url}`);
  console.log(`======================================================\n`);

  // Automatically launch default browser on local Windows development
  if (!process.env.PORT) {
    const startCmd = process.platform === 'win32' ? `start ${url}` : `open ${url}`;
    exec(startCmd, err => {
      if (err) console.log(`Please open ${url} in your browser.`);
    });
  }
});

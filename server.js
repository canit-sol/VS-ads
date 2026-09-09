/**
 * VS Ads Intelligence - Zero-Dependency Local Server & Global Publishing Engine
 * Serves the dashboard on http://localhost:3000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const REPORTS_JSON_PATH = path.join(DATA_DIR, 'reports.json');
const GIT_BIN = fs.existsSync('C:\\Program Files\\Git\\cmd\\git.exe') ? '"C:\\Program Files\\Git\\cmd\\git.exe"' : 'git';

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

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) { // 50MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        resolve(parsed);
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
  let reqPath = decodeURIComponent(parsedUrl.pathname);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // --- API ROUTE: GET /api/status ---
  if (req.method === 'GET' && reqPath === '/api/status') {
    let publishedAt = null;
    let reportCount = 0;
    if (fs.existsSync(REPORTS_JSON_PATH)) {
      try {
        const data = JSON.parse(fs.readFileSync(REPORTS_JSON_PATH, 'utf8'));
        publishedAt = data.publishedAt || null;
        reportCount = Array.isArray(data.reports) ? data.reports.length : (Array.isArray(data) ? data.length : 0);
      } catch (e) {}
    }
    return sendJson(res, 200, {
      isLocalServer: true,
      gitConfigured: true,
      lastPublishedAt: publishedAt,
      reportCount: reportCount
    });
  }

  // --- API ROUTE: POST /api/save-reports ---
  if (req.method === 'POST' && reqPath === '/api/save-reports') {
    try {
      const payload = await parseJsonBody(req);
      const reports = Array.isArray(payload.reports) ? payload.reports : (Array.isArray(payload) ? payload : null);

      if (!reports || reports.length === 0) {
        return sendJson(res, 400, { success: false, error: 'Reports payload must be a non-empty array.' });
      }

      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      const masterPayload = {
        version: '1.0.0',
        publishedAt: new Date().toISOString(),
        source: 'VS Hospitals Performance Analytics',
        reportCount: reports.length,
        reports: reports
      };

      fs.writeFileSync(REPORTS_JSON_PATH, JSON.stringify(masterPayload, null, 2), 'utf8');

      return sendJson(res, 200, {
        success: true,
        count: reports.length,
        savedAt: masterPayload.publishedAt
      });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message || 'Failed to save reports' });
    }
  }

  // --- API ROUTE: POST /api/publish-github ---
  if (req.method === 'POST' && reqPath === '/api/publish-github') {
    if (!fs.existsSync(REPORTS_JSON_PATH)) {
      return sendJson(res, 400, { success: false, error: 'data/reports.json not found on disk. Save reports before publishing.' });
    }

    // Step 1: git add data/reports.json
    exec(`${GIT_BIN} add data/reports.json`, { cwd: __dirname }, (addErr, addOut, addStderr) => {
      if (addErr) {
        console.error('git add error:', addStderr || addErr.message);
        return sendJson(res, 500, { success: false, error: `Git add failed: ${addStderr || addErr.message}` });
      }

      // Step 2: check if there are changes staged
      exec(`${GIT_BIN} status --porcelain data/reports.json`, { cwd: __dirname }, (statusErr, statusOut) => {
        if (statusErr) {
          console.error('git status error:', statusErr.message);
          return sendJson(res, 500, { success: false, error: `Git status check failed: ${statusErr.message}` });
        }

        const trimmedStatus = (statusOut || '').trim();
        if (!trimmedStatus) {
          // Check if unpushed commits exist
          exec(`${GIT_BIN} cherry -v`, { cwd: __dirname }, (cherryErr, cherryOut) => {
            if (!cherryErr && cherryOut && cherryOut.trim()) {
              exec(`${GIT_BIN} push origin main`, { cwd: __dirname }, (pushErr, pushOut, pushStderr) => {
                if (pushErr) {
                  return sendJson(res, 500, { success: false, error: `Git push failed: ${pushStderr || pushErr.message}` });
                }
                return sendJson(res, 200, {
                  success: true,
                  message: 'Published to GitHub. The live site may take a short time to update.'
                });
              });
            } else {
              return sendJson(res, 200, {
                success: true,
                unchanged: true,
                message: 'Published to GitHub. The live site may take a short time to update.'
              });
            }
          });
          return;
        }

        // Changes exist: commit and push
        const commitMsg = 'data: Update advertising dataset [published via admin]';
        exec(`${GIT_BIN} commit -m "${commitMsg}"`, { cwd: __dirname }, (commitErr, commitOut, commitStderr) => {
          if (commitErr) {
            console.error('git commit error:', commitStderr || commitErr.message);
            return sendJson(res, 500, { success: false, error: `Git commit failed: ${commitStderr || commitErr.message}` });
          }

          exec(`${GIT_BIN} push origin main`, { cwd: __dirname }, (pushErr, pushOut, pushStderr) => {
            if (pushErr) {
              console.error('git push error:', pushStderr || pushErr.message);
              return sendJson(res, 500, { success: false, error: `Git push failed: ${pushStderr || pushErr.message}` });
            }

            return sendJson(res, 200, {
              success: true,
              message: 'Published to GitHub. The live site may take a short time to update.'
            });
          });
        });
      });
    });
    return;
  }

  // --- STATIC FILE SERVING ---
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
      'Cache-Control': ext === '.json' ? 'no-cache, no-store, must-revalidate' : 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n======================================================`);
  console.log(`  VS Ads Intelligence Server & Publishing Engine LIVE!`);
  console.log(`  Access URL: ${url}`);
  console.log(`======================================================\n`);

  if (!process.env.PORT) {
    const startCmd = process.platform === 'win32' ? `start ${url}` : `open ${url}`;
    exec(startCmd, () => {});
  }
});

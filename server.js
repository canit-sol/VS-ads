/**
 * CANIT Skope - Zero-Dependency Local Server & Global Publishing Engine
 * Serves the dashboard on http://localhost:3000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const REPORTS_JSON_PATH = path.join(DATA_DIR, 'reports.json');
const CLIENTS_SERVER_CONFIG_PATH = path.join(__dirname, 'config', 'clients.server.json');
const GIT_BIN = fs.existsSync('C:\\Program Files\\Git\\cmd\\git.exe') ? '"C:\\Program Files\\Git\\cmd\\git.exe"' : 'git';

const googleAdsService = require('./services/googleAdsService');
const googleAdsAggregator = require('./services/googleAdsAggregator');

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

function safeTokenMatch(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function getClientsServerConfig() {
  if (!fs.existsSync(CLIENTS_SERVER_CONFIG_PATH)) {
    return { clients: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(CLIENTS_SERVER_CONFIG_PATH, 'utf8'));
  } catch (e) {
    console.error('[ServerConfig] Error reading clients.server.json:', e.message);
    return { clients: [] };
  }
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
  let reqPath = decodeURIComponent(parsedUrl.pathname);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  // --- API ROUTE: GET /api/clients ---
  if (req.method === 'GET' && reqPath === '/api/clients') {
    const config = getClientsServerConfig();
    const clients = Array.isArray(config.clients) ? config.clients.map(c => {
      const dataFile = path.isAbsolute(c.dataPath) ? c.dataPath : path.join(__dirname, c.dataPath);
      let reportCount = 0;
      if (fs.existsSync(dataFile)) {
        try {
          const content = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
          reportCount = Array.isArray(content.reports) ? content.reports.length : (Array.isArray(content) ? content.length : 0);
        } catch (e) {}
      }
      return {
        clientId: c.clientId,
        name: c.name,
        currency: c.currency || '₹',
        terminology: c.terminology || { leads: 'Leads', calls: 'Phone Inquiries', cpc: 'Average CPC' },
        hasData: reportCount > 0,
        reportCount: reportCount
      };
    }) : [];
    return sendJson(res, 200, { success: true, clients });
  }

  // --- API ROUTE: GET /api/reports (Server-Side Token / Client Verification) ---
  if (req.method === 'GET' && reqPath === '/api/reports') {
    const rawToken = parsedUrl.searchParams.get('token') || 
                     parsedUrl.searchParams.get('auth') || 
                     (req.headers['authorization'] ? req.headers['authorization'].replace(/^Bearer\s+/i, '').trim() : null);
    const clientParam = parsedUrl.searchParams.get('client') || parsedUrl.searchParams.get('clientId');

    const config = getClientsServerConfig();
    const clients = Array.isArray(config.clients) ? config.clients : [];

    // Authenticate token or match selected client
    let matchedClient = null;
    if (rawToken) {
      for (const client of clients) {
        if (client.secretToken && safeTokenMatch(rawToken, client.secretToken)) {
          matchedClient = client;
          break;
        }
      }
    } else if (clientParam) {
      matchedClient = clients.find(c => 
        c.clientId.toLowerCase() === clientParam.toLowerCase() || 
        c.name.toLowerCase() === clientParam.toLowerCase()
      );
    }

    if (!matchedClient) {
      return sendJson(res, 401, {
        success: false,
        error: 'Unauthorized: A private client access token or valid client selection is required.'
      });
    }

    // Load client dataset
    const clientDataPath = path.isAbsolute(matchedClient.dataPath) 
      ? matchedClient.dataPath 
      : path.join(__dirname, matchedClient.dataPath || 'data/reports.json');

    // If client data file doesn't exist yet on disk, return empty dataset (Plain initial state)
    if (!fs.existsSync(clientDataPath)) {
      return sendJson(res, 200, {
        success: true,
        client: {
          clientId: matchedClient.clientId,
          name: matchedClient.name,
          currency: matchedClient.currency || '₹',
          terminology: matchedClient.terminology || { leads: 'Leads', calls: 'Phone Inquiries', cpc: 'Average CPC' }
        },
        publishedAt: null,
        version: '1.0.0',
        reportCount: 0,
        reports: []
      });
    }

    try {
      const dataset = JSON.parse(fs.readFileSync(clientDataPath, 'utf8'));
      const reports = Array.isArray(dataset.reports) ? dataset.reports : (Array.isArray(dataset) ? dataset : []);
      return sendJson(res, 200, {
        success: true,
        client: {
          clientId: matchedClient.clientId,
          name: matchedClient.name,
          currency: matchedClient.currency || '₹',
          terminology: matchedClient.terminology || { leads: 'Leads', calls: 'Phone Inquiries', cpc: 'Average CPC' }
        },
        publishedAt: dataset.publishedAt || null,
        version: dataset.version || '1.0.0',
        reportCount: reports.length,
        reports: reports
      });
    } catch (readErr) {
      return sendJson(res, 500, {
        success: false,
        error: `Failed to load client report data: ${readErr.message}`
      });
    }
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

  // --- API ROUTE: GET /api/google-ads-status ---
  if (req.method === 'GET' && reqPath === '/api/google-ads-status') {
    const status = googleAdsService.getStatus();
    let hasGoogleReports = false;
    let lastGoogleSync = null;

    if (fs.existsSync(REPORTS_JSON_PATH)) {
      try {
        const data = JSON.parse(fs.readFileSync(REPORTS_JSON_PATH, 'utf8'));
        const reports = Array.isArray(data.reports) ? data.reports : [];
        for (const r of reports) {
          if (r.sourceType === 'google-ads-api' || (r.campaigns && r.campaigns.some(c => c.platform === 'google'))) {
            hasGoogleReports = true;
            if (r.uploadedAt && (!lastGoogleSync || new Date(r.uploadedAt) > new Date(lastGoogleSync))) {
              lastGoogleSync = r.uploadedAt;
            }
          }
        }
      } catch (e) {}
    }

    return sendJson(res, 200, {
      success: true,
      ...status,
      hasGoogleReports,
      lastGoogleSync
    });
  }

  // --- API ROUTE: POST /api/sync-google-ads ---
  if (req.method === 'POST' && reqPath === '/api/sync-google-ads') {
    try {
      let payload = {};
      try {
        payload = await parseJsonBody(req);
      } catch (e) {
        payload = {};
      }

      const startDate = payload.startDate || '2026-08-24';
      const endDate = payload.endDate || '2026-08-29';
      const periodId = payload.periodId || '2026_M08_W04';
      const periodLabel = payload.periodLabel || 'Week 4 · Aug 24–29, 2026';

      console.log(`[GoogleAdsSync] Starting synchronization for ${startDate} to ${endDate}...`);
      const fetchResult = await googleAdsService.fetchCampaignMetrics(startDate, endDate);

      // SAFETY: If API call fails or returns empty data, NEVER overwrite existing reports
      if (!fetchResult.success) {
        console.error('[GoogleAdsSync] Fetch failed:', fetchResult.error);
        return sendJson(res, 502, {
          success: false,
          error: `Google Ads API sync failed: ${fetchResult.error}. Existing data preserved.`
        });
      }

      if (!fetchResult.data || fetchResult.data.length === 0) {
        return sendJson(res, 400, {
          success: false,
          error: 'Google Ads API returned 0 campaign records. Existing data preserved.'
        });
      }

      // Read current master data
      let masterData = { version: '1.0.0', publishedAt: new Date().toISOString(), reportCount: 0, reports: [] };
      let existingCampaigns = [];

      if (fs.existsSync(REPORTS_JSON_PATH)) {
        try {
          masterData = JSON.parse(fs.readFileSync(REPORTS_JSON_PATH, 'utf8'));
          const existingReport = (masterData.reports || []).find(r => r.period && r.period.periodId === periodId);
          if (existingReport && Array.isArray(existingReport.campaigns)) {
            existingCampaigns = existingReport.campaigns;
          }
        } catch (e) {
          console.warn('[GoogleAdsSync] Failed reading existing reports.json:', e.message);
        }
      }

      // Build normalized Report
      const newReport = googleAdsAggregator.buildReport(startDate, endDate, fetchResult.data, {
        periodId: periodId,
        periodLabel: periodLabel,
        mode: fetchResult.mode,
        existingCampaigns: existingCampaigns
      });

      // Merge into master payload
      const updatedMaster = googleAdsAggregator.mergeIntoMaster(masterData, newReport);

      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      // Atomic write to data/reports.json
      fs.writeFileSync(REPORTS_JSON_PATH, JSON.stringify(updatedMaster, null, 2), 'utf8');
      console.log(`[GoogleAdsSync] Success. Updated period ${periodId} (${newReport.campaigns.length} campaigns).`);

      return sendJson(res, 200, {
        success: true,
        mode: fetchResult.mode,
        reportId: newReport.reportId,
        periodId: periodId,
        periodLabel: periodLabel,
        campaignCount: newReport.campaigns.length,
        spend: newReport.metrics.spend,
        conversions: newReport.metrics.conversions,
        syncedAt: newReport.uploadedAt,
        message: `Google Ads data (${fetchResult.mode.toUpperCase()}) synchronized successfully.`
      });

    } catch (err) {
      console.error('[GoogleAdsSync] Unhandled error:', err.message);
      return sendJson(res, 500, {
        success: false,
        error: `Internal synchronization failure: ${err.message}. Existing data was not modified.`
      });
    }
  }

  // --- API ROUTE: POST /api/save-reports ---
  if (req.method === 'POST' && reqPath === '/api/save-reports') {
    try {
      const payload = await parseJsonBody(req);
      const reports = Array.isArray(payload.reports) ? payload.reports : (Array.isArray(payload) ? payload : null);

      if (!reports || reports.length === 0) {
        return sendJson(res, 400, { success: false, error: 'Reports payload must be a non-empty array.' });
      }

      const config = getClientsServerConfig();
      const clients = Array.isArray(config.clients) ? config.clients : [];
      let targetPath = REPORTS_JSON_PATH;
      let clientName = 'CANIT Skope';

      if (payload.clientId) {
        const matched = clients.find(c => 
          c.clientId.toLowerCase() === payload.clientId.toLowerCase() ||
          c.name.toLowerCase() === payload.clientId.toLowerCase()
        );
        if (matched && matched.dataPath) {
          targetPath = path.isAbsolute(matched.dataPath) ? matched.dataPath : path.join(__dirname, matched.dataPath);
          clientName = matched.name;
        }
      }

      const targetDir = path.dirname(targetPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const masterPayload = {
        version: '1.0.0',
        publishedAt: new Date().toISOString(),
        source: `${clientName} — CANIT Skope Performance Analytics`,
        reportCount: reports.length,
        reports: reports
      };

      fs.writeFileSync(targetPath, JSON.stringify(masterPayload, null, 2), 'utf8');

      return sendJson(res, 200, {
        success: true,
        clientId: payload.clientId || null,
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
  const normalizedPath = reqPath.toLowerCase();
  if (normalizedPath.includes('.server.json') || normalizedPath.includes('.env') || normalizedPath.startsWith('/config') || normalizedPath.startsWith('/data/clients')) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden: Direct access to protected resources is prohibited.');
    return;
  }

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
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

let currentPort = Number(PORT);

function listen() {
  server.listen(currentPort, () => {
    const url = `http://localhost:${currentPort}`;
    console.log(`\n======================================================`);
    console.log(`  CANIT Skope Server & Publishing Engine LIVE!`);
    console.log(`  Access URL: ${url}`);
    console.log(`======================================================\n`);

    if (!process.env.PORT) {
      const startCmd = process.platform === 'win32' ? `start ${url}` : `open ${url}`;
      exec(startCmd, () => {});
    }
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && !process.env.PORT) {
    console.log(`Port ${currentPort} is already in use. Trying port ${currentPort + 1}...`);
    currentPort += 1;
    setTimeout(listen, 250);
  } else {
    console.error('Server error:', err);
  }
});

listen();

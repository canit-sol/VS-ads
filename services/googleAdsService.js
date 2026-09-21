/**
 * VS Ads Intelligence - Google Ads API Service
 * Phase 1: Google Ads Direct Ingestion & Token Management
 * 
 * Supports both Live GAQL Query Execution and Realistic Mock Fixture Mode.
 * Zero external dependencies: uses Node's built-in https and crypto modules.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Safe .env loader without external dependency
function loadEnvFile(force = false) {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.substring(0, eqIdx).trim();
          const val = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
          if (force || process.env[key] === undefined) {
            process.env[key] = val;
          }
        }
      }
    } catch (e) {
      console.warn('[GoogleAdsService] Could not read .env file:', e.message);
    }
  }
}

loadEnvFile();

class GoogleAdsService {
  constructor() {
    this.initFromEnv();
  }

  initFromEnv() {
    loadEnvFile(true);
    this.apiVersion = process.env.GOOGLE_ADS_API_VERSION || 'v17';
    this.developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';
    this.clientId = process.env.GOOGLE_ADS_CLIENT_ID || '';
    this.clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET || '';
    this.refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN || '';
    this.customerId = (process.env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/-/g, '');
    this.loginCustomerId = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '').replace(/-/g, '');
    this.mockMode = process.env.AD_SYNC_MOCK_MODE === 'true' || !this.developerToken || !this.refreshToken;
  }

  /**
   * Check connection and credential readiness
   */
  getStatus() {
    this.initFromEnv();
    const hasCreds = Boolean(
      process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
      process.env.GOOGLE_ADS_CLIENT_ID &&
      process.env.GOOGLE_ADS_CLIENT_SECRET &&
      process.env.GOOGLE_ADS_REFRESH_TOKEN &&
      process.env.GOOGLE_ADS_CUSTOMER_ID
    );

    const isMock = process.env.AD_SYNC_MOCK_MODE === 'true' || !hasCreds;

    return {
      service: 'Google Ads API',
      apiVersion: process.env.GOOGLE_ADS_API_VERSION || 'v17',
      isConfigured: hasCreds,
      mode: isMock ? 'mock' : 'live',
      customerId: process.env.GOOGLE_ADS_CUSTOMER_ID ? `${process.env.GOOGLE_ADS_CUSTOMER_ID.slice(0, 3)}-***-****` : null,
      statusMessage: isMock
        ? 'Mock Provider Active (Ready for local verification)'
        : 'Live Credentials Configured'
    };
  }

  /**
   * Refresh OAuth 2.0 access token
   * @returns {Promise<string>}
   */
  async refreshAccessToken() {
    this.initFromEnv();
    return new Promise((resolve, reject) => {
      const postData = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token'
      }).toString();

      const options = {
        hostname: 'oauth2.googleapis.com',
        port: 443,
        path: '/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300 && parsed.access_token) {
              resolve(parsed.access_token);
            } else {
              reject(new Error(`OAuth Token Refresh failed (${res.statusCode}): ${parsed.error_description || parsed.error || data}`));
            }
          } catch (e) {
            reject(new Error(`Invalid OAuth response: ${e.message}`));
          }
        });
      });

      req.on('error', (err) => reject(new Error(`Network error during token refresh: ${err.message}`)));
      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error('Token refresh request timed out'));
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Query campaign metrics via Google Ads API (or mock mode)
   * @param {string} startDate - 'YYYY-MM-DD'
   * @param {string} endDate - 'YYYY-MM-DD'
   * @returns {Promise<{ success: boolean, data?: Array, error?: string }>}
   */
  async fetchCampaignMetrics(startDate, endDate) {
    this.initFromEnv();
    if (this.mockMode) {
      return {
        success: true,
        mode: 'mock',
        data: this.getMockCampaignData(startDate, endDate)
      };
    }

    try {
      const accessToken = await this.refreshAccessToken();

      const gaqlQuery = `
        SELECT
          campaign.id,
          campaign.name,
          campaign.advertising_channel_type,
          metrics.cost_micros,
          metrics.impressions,
          metrics.clicks,
          metrics.conversions,
          metrics.all_conversions,
          segments.date
        FROM campaign
        WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
          AND campaign.status != 'REMOVED'
        ORDER BY segments.date ASC
      `.trim();

      const postBody = JSON.stringify({ query: gaqlQuery });

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': this.developerToken
      };

      if (this.loginCustomerId) {
        headers['login-customer-id'] = this.loginCustomerId;
      }

      const response = await new Promise((resolve, reject) => {
        const options = {
          hostname: 'googleads.googleapis.com',
          port: 443,
          path: `/${this.apiVersion}/customers/${this.customerId}/googleAds:search`,
          method: 'POST',
          headers: headers
        };

        const req = https.request(options, (res) => {
          let body = '';
          res.on('data', (chunk) => { body += chunk; });
          res.on('end', () => {
            try {
              const json = JSON.parse(body);
              if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve({ statusCode: res.statusCode, json });
              } else {
                const detailedMsg = json.error?.details?.[0]?.errors?.[0]?.message;
                const errMsg = detailedMsg || (json.error ? json.error.message : `API returned HTTP ${res.statusCode}`);
                reject(new Error(`Google Ads API error (${res.statusCode}): ${errMsg}`));
              }
            } catch (err) {
              reject(new Error(`Failed to parse Google Ads API response: ${err.message}`));
            }
          });
        });

        req.on('error', (err) => reject(new Error(`Connection failure to Google Ads API: ${err.message}`)));
        req.setTimeout(30000, () => {
          req.destroy();
          reject(new Error('Google Ads API request timed out (30s limit)'));
        });

        req.write(postBody);
        req.end();
      });

      const rows = response.json.results || [];
      return {
        success: true,
        mode: 'live',
        data: rows
      };

    } catch (err) {
      console.error('[GoogleAdsService] Fetch error:', err.message);
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Generates realistic mock Google Ads rows for testing without live credentials
   * Matches the exact schema returned by Google Ads Search REST API
   * @param {string} startDate 
   * @param {string} endDate 
   * @returns {Array}
   */
  getMockCampaignData(startDate, endDate) {
    const mockCampaignTemplates = [
      {
        id: '1001',
        name: 'Kilpauk (Multispeciality)',
        channel: 'SEARCH',
        dailyCostMicros: 6215500000, // ₹6,215.50 per day
        dailyImpressions: 2620,
        dailyClicks: 275,
        dailyConversions: 4.5,
        dailyAllConversions: 4.5
      },
      {
        id: '1002',
        name: 'Chetpet (General & Emergency)',
        channel: 'SEARCH',
        dailyCostMicros: 2980000000, // ₹2,980.00 per day
        dailyImpressions: 1150,
        dailyClicks: 140,
        dailyConversions: 2.0,
        dailyAllConversions: 2.0
      },
      {
        id: '1003',
        name: 'Tirunelveli Oncology',
        channel: 'SEARCH',
        dailyCostMicros: 2150000000, // ₹2,150.00 per day
        dailyImpressions: 620,
        dailyClicks: 42,
        dailyConversions: 0.5,
        dailyAllConversions: 0.5
      },
      {
        id: '1004',
        name: 'Knee Ready (Orthopaedics)',
        channel: 'SEARCH',
        dailyCostMicros: 1890000000, // ₹1,890.00 per day
        dailyImpressions: 480,
        dailyClicks: 25,
        dailyConversions: 0.0,
        dailyAllConversions: 0.0
      },
      {
        id: '1005',
        name: 'Kilpauk PMax',
        channel: 'PERFORMANCE_MAX',
        dailyCostMicros: 4920000000, // ₹4,920.00 per day
        dailyImpressions: 3400,
        dailyClicks: 557,
        dailyConversions: 14.0,
        dailyAllConversions: 14.0
      },
      {
        id: '1006',
        name: 'Knee Ready PMax',
        channel: 'PERFORMANCE_MAX',
        dailyCostMicros: 1320000000, // ₹1,320.00 per day
        dailyImpressions: 1420,
        dailyClicks: 698,
        dailyConversions: 5.0,
        dailyAllConversions: 5.0
      },
      {
        id: '1007',
        name: 'Packages PMax',
        channel: 'PERFORMANCE_MAX',
        dailyCostMicros: 850000000, // ₹850.00 per day
        dailyImpressions: 980,
        dailyClicks: 110,
        dailyConversions: 2.0,
        dailyAllConversions: 2.0
      },
      {
        id: '1008',
        name: 'Kilpauk Awareness Video',
        channel: 'VIDEO',
        dailyCostMicros: 950000000, // ₹950.00 per day
        dailyImpressions: 4200,
        dailyClicks: 85,
        dailyConversions: 0.5,
        dailyAllConversions: 0.5
      }
    ];

    // Compute dates between startDate and endDate
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = [];

    const cur = new Date(start);
    while (cur <= end) {
      days.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }

    if (days.length === 0) {
      days.push(startDate);
    }

    const rows = [];
    for (const dateStr of days) {
      for (const tpl of mockCampaignTemplates) {
        rows.push({
          campaign: {
            resourceName: `customers/${this.customerId || '1234567890'}/campaigns/${tpl.id}`,
            id: tpl.id,
            name: tpl.name,
            advertisingChannelType: tpl.channel
          },
          metrics: {
            costMicros: String(tpl.dailyCostMicros),
            impressions: String(tpl.dailyImpressions),
            clicks: String(tpl.dailyClicks),
            conversions: tpl.dailyConversions,
            allConversions: tpl.dailyAllConversions
          },
          segments: {
            date: dateStr
          }
        });
      }
    }

    return rows;
  }
}

module.exports = new GoogleAdsService();

/**
 * VS Ads Intelligence - Live Google Ads API Credentials Verification Tool
 * 
 * Usage: node scripts/verify-google-creds.mjs
 * 
 * Tests OAuth 2.0 token exchange and Google Ads API connectivity without modifying data.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const googleAdsService = require('../services/googleAdsService.js');

console.log('\n======================================================');
console.log('  VS Ads Intelligence - Google Ads Credentials Checker');
console.log('======================================================\n');

const status = googleAdsService.getStatus();
console.log('Configured API Version :', status.apiVersion);
console.log('Execution Mode         :', status.mode.toUpperCase());
console.log('Status Message         :', status.statusMessage);
console.log('Target Customer ID     :', status.customerId || '(Not Set)');

if (status.mode === 'mock') {
  console.log('\n[INFO] Currently operating in MOCK MODE.');
  console.log('To connect to live Google Ads servers:');
  console.log('  1. Open or create .env in the project root');
  console.log('  2. Set AD_SYNC_MOCK_MODE=false');
  console.log('  3. Provide GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID,');
  console.log('     GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN, and GOOGLE_ADS_CUSTOMER_ID');
  console.log('\nMock mode is active and fully functional for local validation.\n');
  process.exit(0);
}

console.log('\nAttempting OAuth 2.0 token refresh...');
try {
  const token = await googleAdsService.refreshAccessToken();
  console.log('✓ OAuth 2.0 Token Refresh SUCCESSFUL (Received temporary Bearer token).');

  console.log('\nAttempting live connection to Google Ads Search API...');
  const today = new Date().toISOString().split('T')[0];
  const result = await googleAdsService.fetchCampaignMetrics(today, today);

  if (result.success) {
    console.log('✓ Google Ads API Connection SUCCESSFUL!');
    console.log(`  Received ${result.data ? result.data.length : 0} campaign rows for ${today}.`);
    console.log('\n>>> All live Google Ads credentials are VALID and operational! <<<\n');
  } else {
    console.error('✗ Google Ads API Query Failed:');
    console.error(' ', result.error);
    process.exit(1);
  }
} catch (err) {
  console.error('✗ Authentication / Connection Error:');
  console.error(' ', err.message);
  process.exit(1);
}

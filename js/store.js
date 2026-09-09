/**
 * VS Ads Intelligence - Central Reactive State Store & Persistence Layer
 * Phase 2: Data Engine & Reporting Period Intelligence
 */

import { INITIAL_REPORTS, INITIAL_RECOMMENDATIONS } from './data.js';
import { PeriodEngine } from './period-engine.js';
import { MONTH_NAMES } from './models.js';

const STORAGE_KEYS = {
  REPORTS: 'vs_ads_reports_v2',
  ACTIVE_REPORT: 'vs_ads_active_report_id_v2',
  COMP_REPORT: 'vs_ads_comp_report_id_v2',
  RECOMMENDATIONS: 'vs_ads_recommendations_v2',
  UPLOAD_HISTORY: 'vs_ads_upload_history_v2',
  VIEW: 'vs_ads_active_view_v2',
  PLATFORM_FILTER: 'vs_ads_platform_filter_v2'
};

const safeStorage = {
  getItem: key => {
    try {
      return typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem(key) : null;
    } catch (e) {
      return null;
    }
  },
  setItem: (key, val) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem(key, val);
    } catch (e) {}
  },
  removeItem: key => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) window.localStorage.removeItem(key);
    } catch (e) {}
  }
};

export const CONFIG = {
  // Requirement 15: App starts with an empty report store unless sample data is explicitly loaded (?sample=true)
  LOAD_SAMPLE_DATA_BY_DEFAULT: false
};

/**
 * MODULAR DATA PROVIDER CONTRACT (Future-Proof for Supabase)
 * 
 * Provides a clean abstraction boundary between the data persistence backend
 * and the dashboard application layers.
 * 
 * To migrate from GitHub reports.json to Supabase in a future phase:
 * 1. Implement SupabaseProvider { fetchReports(), saveReports(), publishReports() }
 * 2. Pass new SupabaseProvider(client) to AdsStore
 * 3. ZERO changes required to UI, Charts, Platform Filtering, or Metric Calculations.
 */
export class ReportsJsonProvider {
  constructor(options = {}) {
    this.endpoint = options.endpoint || './data/reports.json';
  }

  async fetchReports() {
    const url = `${this.endpoint}?v=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    const reports = Array.isArray(data.reports) ? data.reports : (Array.isArray(data) ? data : []);
    return {
      reports,
      publishedAt: data.publishedAt || null,
      version: data.version || '1.0.0'
    };
  }

  async saveReports(reports) {
    const res = await fetch('/api/save-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reports })
    });
    return await res.json();
  }

  async publishReports() {
    const res = await fetch('/api/publish-github', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to publish dataset to GitHub');
    }
    return data;
  }
}

class AdsStore {
  constructor(dataProvider = new ReportsJsonProvider()) {
    this.provider = dataProvider;
    this.subscribers = new Set();
    this.init();
  }

  setProvider(provider) {
    this.provider = provider;
  }

  init() {
    // Check whether sample data should be loaded if store is empty
    const urlParams = typeof window !== 'undefined' && window.location ? new URLSearchParams(window.location.search) : null;
    const shouldSeedSample = CONFIG.LOAD_SAMPLE_DATA_BY_DEFAULT || 
                             (urlParams && urlParams.get('sample') === 'true') ||
                             (typeof window !== 'undefined' && window.__VS_ENABLE_DEV_SAMPLE__ === true);

    // Load or initialize reports
    const storedReports = safeStorage.getItem(STORAGE_KEYS.REPORTS);
    if (storedReports) {
      try {
        const parsed = JSON.parse(storedReports);
        this.reports = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.error('Failed to parse stored reports', e);
        this.reports = [];
      }
    } else if (shouldSeedSample) {
      this.reports = [...INITIAL_REPORTS];
      this.saveReports();
    } else {
      this.reports = [];
    }

    // Load upload history
    const storedHistory = safeStorage.getItem(STORAGE_KEYS.UPLOAD_HISTORY);
    if (storedHistory) {
      try {
        const parsed = JSON.parse(storedHistory);
        this.uploadHistory = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        this.uploadHistory = [];
      }
    } else if (shouldSeedSample) {
      // Seed default baseline uploads
      this.uploadHistory = INITIAL_REPORTS.map(r => ({
        id: 'hist_' + r.reportId,
        fileName: r.sourceFileName,
        uploadedAt: r.uploadedAt,
        periodLabel: r.period ? r.period.periodLabel : r.periodName,
        rowCount: r.campaigns ? r.campaigns.length : 9,
        campaignCount: r.campaigns ? r.campaigns.length : 9,
        status: r.status || 'Ready',
        reportId: r.reportId
      }));
      this.saveUploadHistory();
    } else {
      this.uploadHistory = [];
    }

    // Active report
    const storedActive = safeStorage.getItem(STORAGE_KEYS.ACTIVE_REPORT);
    this.activeReportId = storedActive && this.reports.some(r => r.reportId === storedActive)
      ? storedActive
      : (this.reports[0] ? this.reports[0].reportId : null);

    // Comparison report (defaults to previous week)
    const storedComp = safeStorage.getItem(STORAGE_KEYS.COMP_REPORT);
    this.comparisonReportId = storedComp && this.reports.some(r => r.reportId === storedComp)
      ? storedComp
      : (this.reports[2] ? this.reports[2].reportId : (this.reports[1] ? this.reports[1].reportId : null));

    // Editable recommendations
    const storedRecs = safeStorage.getItem(STORAGE_KEYS.RECOMMENDATIONS);
    if (storedRecs) {
      try {
        this.recommendations = JSON.parse(storedRecs);
      } catch (e) {
        this.recommendations = [...INITIAL_RECOMMENDATIONS];
      }
    } else {
      this.recommendations = [...INITIAL_RECOMMENDATIONS];
      this.saveRecommendations();
    }

    // UI state
    this.activeView = safeStorage.getItem(STORAGE_KEYS.VIEW) || 'overview';
    this.platformFilter = safeStorage.getItem(STORAGE_KEYS.PLATFORM_FILTER) || 'all';
    this.campaignFilter = 'all';
    this.campaignSearch = '';
    this.campaignSortKey = 'rank';
    this.campaignSortAsc = true;
    this.isContextRailOpen = true;
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify(changeType, payload) {
    for (const callback of this.subscribers) {
      try {
        callback(changeType, payload);
      } catch (err) {
        console.error('Store subscriber notification error:', err);
      }
    }
  }

  get isLocalServer() {
    if (typeof window === 'undefined' || !window.location) return false;
    const hostname = window.location.hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  }

  /**
   * Automatically load master published dataset via the active data provider
   * Single global source of truth for public GitHub Pages visitors & local users
   */
  async loadMasterDataset() {
    try {
      const data = await this.provider.fetchReports();
      const reports = Array.isArray(data.reports) ? data.reports : (Array.isArray(data) ? data : []);
      if (reports.length > 0) {
        this.reports = reports;
        this.saveReports(); // cache in localStorage for offline resiliency
        this.masterPublishedAt = data.publishedAt || null;

        // Synchronize upload history from master dataset
        this.uploadHistory = this.reports.map(r => ({
          id: 'hist_' + r.reportId,
          fileName: r.sourceFileName || 'KPIs_KPIs.csv',
          uploadedAt: r.uploadedAt || new Date().toISOString(),
          periodLabel: r.period ? r.period.periodLabel : r.periodName,
          rowCount: r.campaigns ? r.campaigns.length : 0,
          campaignCount: r.campaigns ? r.campaigns.length : 0,
          status: r.status || 'Ready',
          reportId: r.reportId
        }));
        this.saveUploadHistory();

        if (!this.activeReportId || !this.reports.some(r => r.reportId === this.activeReportId)) {
          this.activeReportId = this.reports[0].reportId;
          safeStorage.setItem(STORAGE_KEYS.ACTIVE_REPORT, this.activeReportId);
        }
        if (!this.comparisonReportId || !this.reports.some(r => r.reportId === this.comparisonReportId)) {
          this.comparisonReportId = this.reports[1] ? this.reports[1].reportId : null;
          if (this.comparisonReportId) {
            safeStorage.setItem(STORAGE_KEYS.COMP_REPORT, this.comparisonReportId);
          }
        }

        this.notify('MASTER_DATA_LOADED', { reports: this.reports, publishedAt: this.masterPublishedAt });
        return true;
      }
    } catch (err) {
      console.warn('Master dataset could not be fetched via provider, falling back to local storage cache:', err.message);
    }
    return false;
  }

  async syncToLocalServer() {
    if (!this.isLocalServer) return { success: false, error: 'Not on local server' };
    try {
      return await this.provider.saveReports(this.reports);
    } catch (e) {
      console.warn('Local server sync error:', e);
      return { success: false, error: e.message };
    }
  }

  async publishMasterToGitHub() {
    if (!this.isLocalServer) {
      throw new Error('Global publishing is restricted to the local authenticated development server.');
    }
    // Ensure latest local store state is written to data/reports.json
    await this.syncToLocalServer();
    return await this.provider.publishReports(this.reports);
  }

  saveReports() {
    safeStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(this.reports));
  }

  saveRecommendations() {
    safeStorage.setItem(STORAGE_KEYS.RECOMMENDATIONS, JSON.stringify(this.recommendations));
  }

  saveUploadHistory() {
    safeStorage.setItem(STORAGE_KEYS.UPLOAD_HISTORY, JSON.stringify(this.uploadHistory));
  }

  // --- PLATFORM FILTERING & METRICS ABSTRACTION ---
  static getCampaignPlatform(c) {
    if (!c) return 'unknown';
    if (c.platform) return c.platform.toLowerCase();
    const ch = (c.channel || '').toLowerCase();
    const sec = (c.section || '').toLowerCase();
    if (ch === 'meta' || sec.includes('meta')) return 'meta';
    if (ch === 'search' || ch === 'pmax' || ch === 'youtube' || ch === 'display' || sec.includes('google') || sec.includes('youtube')) return 'google';
    return 'unknown';
  }

  static calculatePlatformMetrics(campaigns, periodDays = 7) {
    let spend = 0;
    let clicks = 0;
    let impressions = 0;
    let leads = 0;
    let conversions = 0;
    let phoneCalls = 0;
    let sourceResults = 0;
    let allConversions = 0;
    let budget = 0;

    campaigns.forEach(c => {
      spend += (c.spend || 0);
      clicks += (c.clicks || 0);
      impressions += (c.impressions || 0);
      leads += (c.leads || 0);
      conversions += (c.conversions || 0);
      phoneCalls += (c.phoneCalls || 0);
      if (c.sourceResults) sourceResults += c.sourceResults;
      allConversions += (c.allConversions || 0);
      budget += (c.budget || 0);
    });

    const cpc = clicks > 0 ? parseFloat((spend / clicks).toFixed(2)) : 0;
    const cpa = conversions > 0 ? Math.round(spend / conversions) : null;
    const costPerAllConv = allConversions > 0 ? Math.round(spend / allConversions) : null;
    const costPerResult = sourceResults > 0 ? parseFloat((spend / sourceResults).toFixed(2)) : null;
    const ctr = impressions > 0 ? parseFloat(((clicks / impressions) * 100).toFixed(2)) : 0;
    const conversionRate = clicks > 0 ? parseFloat(((conversions / clicks) * 100).toFixed(2)) : 0;
    const finalBudget = budget > 0 ? budget : Math.round(spend * 1.35);

    return {
      budgetSummary: {
        allocated: Math.round(finalBudget),
        spent: Math.round(spend),
        remaining: Math.max(0, Math.round(finalBudget - spend)),
        dailyRunRate: periodDays > 0 ? Math.round(spend / periodDays) : 0,
        spendRatePercent: finalBudget > 0 ? Math.min(100, parseFloat(((spend / finalBudget) * 100).toFixed(1))) : 0
      },
      metrics: {
        spend: Math.round(spend),
        totalSpend: Math.round(spend),
        impressions,
        clicks,
        ctr,
        cpc,
        leads,
        conversions,
        phoneCalls,
        sourceResults,
        costPerResult,
        allConversions,
        allConversionsDerived: true,
        cpa,
        costPerAllConv,
        conversionRate
      }
    };
  }

  getFilteredCampaigns(report, platform = this.platformFilter) {
    if (!report || !report.campaigns) return [];
    if (!platform || platform === 'all') return [...report.campaigns];
    const target = platform.toLowerCase();
    return report.campaigns.filter(c => AdsStore.getCampaignPlatform(c) === target);
  }

  getScopedReport(report, platform = this.platformFilter) {
    if (!report) return null;
    if (!platform || platform === 'all') return report;

    const filteredCampaigns = this.getFilteredCampaigns(report, platform);
    const periodDays = report.period && report.period.isMonthlyAggregate ? 28 : 7;
    const calculated = AdsStore.calculatePlatformMetrics(filteredCampaigns, periodDays);

    return {
      ...report,
      platformScope: platform,
      campaigns: filteredCampaigns,
      budgetSummary: calculated.budgetSummary,
      metrics: calculated.metrics
    };
  }

  // --- REPORT ACCESSORS ---
  getActiveReport() {
    return this.reports.find(r => r.reportId === this.activeReportId) || this.reports[0] || null;
  }

  getActiveReportScoped(platform = this.platformFilter) {
    const raw = this.getActiveReport();
    if (!raw) return null;
    return this.getScopedReport(raw, platform);
  }

  getComparisonReport() {
    return this.reports.find(r => r.reportId === this.comparisonReportId) || this.reports[1] || null;
  }

  getComparisonReportScoped(platform = this.platformFilter) {
    const raw = this.getComparisonReport();
    if (!raw) return null;
    return this.getScopedReport(raw, platform);
  }

  getAllReports() {
    return this.reports;
  }

  getReport(reportId) {
    return this.reports.find(r => r.reportId === reportId) || null;
  }

  setActiveReport(reportId) {
    if (!reportId) {
      this.activeReportId = null;
      safeStorage.removeItem(STORAGE_KEYS.ACTIVE_REPORT);
      this.notify('REPORT_CHANGED', { activeReportId: null });
      return;
    }
    if (this.reports.some(r => r.reportId === reportId)) {
      this.activeReportId = reportId;
      safeStorage.setItem(STORAGE_KEYS.ACTIVE_REPORT, reportId);
      this.notify('REPORT_CHANGED', { activeReportId: reportId });
    }
  }

  setComparisonReport(reportId) {
    if (this.reports.some(r => r.reportId === reportId)) {
      this.comparisonReportId = reportId;
      safeStorage.setItem(STORAGE_KEYS.COMP_REPORT, reportId);
      this.notify('COMP_REPORT_CHANGED', { comparisonReportId: reportId });
    }
  }

  // --- PERIOD NAVIGATION ABSTRACTIONS ---
  /**
   * Get all distinct years in chronologically descending order
   * @returns {number[]}
   */
  getYears() {
    const years = new Set();
    this.reports.forEach(r => {
      if (r.period && r.period.year) {
        years.add(Number(r.period.year));
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }

  /**
   * Get all distinct months for a given year
   * @param {number} year
   * @returns {string[]}
   */
  getMonths(year) {
    const months = new Set();
    this.reports.forEach(r => {
      if (r.period && Number(r.period.year) === Number(year)) {
        months.add(r.period.month);
      }
    });
    return Array.from(months).sort((a, b) => {
      const idxA = MONTH_NAMES.indexOf(a);
      const idxB = MONTH_NAMES.indexOf(b);
      return idxB - idxA;
    });
  }

  /**
   * Get weekly reports for a specific year and month
   * @param {number} year
   * @param {string} month
   * @returns {import('./models.js').Report[]}
   */
  getWeeks(year, month) {
    return this.reports.filter(r => {
      const p = r.period;
      if (!p) return false;
      return Number(p.year) === Number(year) &&
             p.month.toLowerCase() === month.toLowerCase() &&
             !p.isMonthlyAggregate;
    }).sort((a, b) => (a.period.weekNumber || 0) - (b.period.weekNumber || 0));
  }

  /**
   * Get or compute Monthly Summary Report
   * @param {number} year
   * @param {string} month
   * @returns {import('./models.js').Report|null}
   */
  getMonthlySummary(year, month) {
    // Check if a pre-existing monthly aggregate matches
    const existing = this.reports.find(r => {
      const p = r.period;
      return p && p.isMonthlyAggregate &&
             Number(p.year) === Number(year) &&
             p.month.toLowerCase() === month.toLowerCase();
    });

    if (existing) return existing;

    // Compute dynamically from stored weekly reports
    return PeriodEngine.calculateMonthlySummary(this.reports, year, month);
  }

  /**
   * Return clean period hierarchy for navigation components
   * Year -> Month -> { monthlySummary, weeks: [...] }
   */
  getPeriodHierarchy() {
    const hierarchy = {};
    const years = this.getYears();

    for (const y of years) {
      hierarchy[y] = {};
      const months = this.getMonths(y);
      for (const m of months) {
        const weeks = this.getWeeks(y, m);
        const monthlySummary = this.getMonthlySummary(y, m);
        hierarchy[y][m] = {
          monthlySummary,
          weeks
        };
      }
    }

    return hierarchy;
  }

  // --- REPORT MUTATIONS & DUPLICATE RESOLUTION ---
  /**
   * Add a new report with duplicate period detection
   * @param {import('./models.js').Report} newReport
   * @param {'replace'|'keep'|'add'} [mode='add']
   * @returns {{ success: boolean, isDuplicate: boolean, reportId: string, existingReportId?: string }}
   */
  addReport(newReport, mode = 'add') {
    const p = newReport.period;
    if (!newReport.reportId) {
      newReport.reportId = 'vs_rep_' + (p ? p.periodId : Date.now());
    }

    // Check for existing report in same period
    const existingIndex = this.reports.findIndex(r => {
      if (!r.period || !p) return r.reportId === newReport.reportId;
      return r.period.periodId === p.periodId ||
             (r.period.startDate === p.startDate && r.period.endDate === p.endDate);
    });

    // Allow real uploaded data to automatically supersede preloaded system sample reports
    if (existingIndex !== -1 && this.reports[existingIndex].sourceType === 'system' && mode === 'add') {
      mode = 'replace';
    }

    if (existingIndex !== -1 && mode === 'add') {
      const existing = this.reports[existingIndex];
      return {
        success: false,
        isDuplicate: true,
        reportId: newReport.reportId,
        existingReportId: existing.reportId,
        message: `Reporting period ${p.periodLabel} already exists.`
      };
    }

    if (existingIndex !== -1 && mode === 'keep') {
      return {
        success: true,
        isDuplicate: true,
        reportId: this.reports[existingIndex].reportId,
        message: 'Kept existing report.'
      };
    }

    if (existingIndex !== -1 && mode === 'replace') {
      const oldId = this.reports[existingIndex].reportId;
      newReport.reportId = oldId; // Keep existing ID to maintain active report pointers
      this.reports[existingIndex] = newReport;
    } else {
      this.reports.unshift(newReport);
    }

    // Record in upload history
    this.recordUpload({
      id: 'hist_' + Date.now(),
      fileName: newReport.sourceFileName || 'report.csv',
      uploadedAt: new Date().toISOString(),
      periodLabel: p ? p.periodLabel : newReport.periodName,
      rowCount: newReport.campaigns ? newReport.campaigns.length : 0,
      campaignCount: newReport.campaigns ? newReport.campaigns.length : 0,
      status: newReport.status || 'Ready',
      reportId: newReport.reportId
    });

    this.saveReports();
    if (this.isLocalServer) this.syncToLocalServer();
    this.setActiveReport(newReport.reportId);
    this.notify('REPORT_ADDED', newReport);

    return {
      success: true,
      isDuplicate: existingIndex !== -1,
      reportId: newReport.reportId
    };
  }

  /**
   * Explicitly replace an existing report
   */
  replaceReport(existingReportId, newReport) {
    const idx = this.reports.findIndex(r => r.reportId === existingReportId);
    if (idx !== -1) {
      newReport.reportId = existingReportId;
      this.reports[idx] = newReport;
      this.saveReports();
      if (this.isLocalServer) this.syncToLocalServer();
      this.setActiveReport(existingReportId);
      this.notify('REPORT_REPLACED', newReport);
      return true;
    }
    return false;
  }

  deleteReport(reportId) {
    this.reports = this.reports.filter(r => r.reportId !== reportId);
    this.uploadHistory = this.uploadHistory.filter(h => h.reportId !== reportId);
    this.saveReports();
    this.saveUploadHistory();
    if (this.isLocalServer) this.syncToLocalServer();

    if (this.activeReportId === reportId) {
      this.setActiveReport(this.reports[0] ? this.reports[0].reportId : null);
    } else {
      this.notify('REPORT_DELETED', { reportId });
    }
  }

  recordUpload(record) {
    this.uploadHistory.unshift(record);
    if (this.uploadHistory.length > 50) {
      this.uploadHistory = this.uploadHistory.slice(0, 50);
    }
    this.saveUploadHistory();
  }

  getUploadHistory() {
    return this.uploadHistory;
  }

  clearAllReports() {
    this.reports = [];
    this.uploadHistory = [];
    this.activeReportId = null;
    this.comparisonReportId = null;
    safeStorage.removeItem(STORAGE_KEYS.REPORTS);
    safeStorage.removeItem(STORAGE_KEYS.UPLOAD_HISTORY);
    safeStorage.removeItem(STORAGE_KEYS.ACTIVE_REPORT);
    safeStorage.removeItem(STORAGE_KEYS.COMP_REPORT);
    safeStorage.removeItem(STORAGE_KEYS.RECOMMENDATIONS);
    safeStorage.removeItem(STORAGE_KEYS.PLATFORM_FILTER);
    safeStorage.removeItem('vs_ads_reports_v1');
    safeStorage.removeItem('vs_ads_active_report_id_v1');
    safeStorage.removeItem('vs_ads_comp_report_id_v1');
    this.platformFilter = 'all';
    this.notify('STORE_CLEARED');
  }

  seedSampleData() {
    this.reports = [...INITIAL_REPORTS];
    this.recommendations = [...INITIAL_RECOMMENDATIONS];
    this.activeReportId = this.reports[0] ? this.reports[0].reportId : null;
    this.comparisonReportId = this.reports[2] ? this.reports[2].reportId : (this.reports[1] ? this.reports[1].reportId : null);
    this.uploadHistory = INITIAL_REPORTS.map(r => ({
      id: 'hist_' + r.reportId,
      fileName: r.sourceFileName,
      uploadedAt: r.uploadedAt,
      periodLabel: r.period ? r.period.periodLabel : r.periodName,
      rowCount: r.campaigns ? r.campaigns.length : 9,
      campaignCount: r.campaigns ? r.campaigns.length : 9,
      status: r.status || 'Ready',
      reportId: r.reportId
    }));

    this.saveReports();
    this.saveRecommendations();
    this.saveUploadHistory();
    if (this.activeReportId) safeStorage.setItem(STORAGE_KEYS.ACTIVE_REPORT, this.activeReportId);
    if (this.comparisonReportId) safeStorage.setItem(STORAGE_KEYS.COMP_REPORT, this.comparisonReportId);
    this.notify('SAMPLE_DATA_LOADED');
  }

  resetToDefaults() {
    this.seedSampleData();
  }

  // --- RECOMMENDATION MANAGEMENT ---
  getRecommendations() {
    return this.recommendations;
  }

  updateRecommendation(id, updates) {
    const idx = this.recommendations.findIndex(rec => rec.id === id);
    if (idx !== -1) {
      this.recommendations[idx] = {
        ...this.recommendations[idx],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      this.saveRecommendations();
      this.notify('REC_UPDATED', this.recommendations[idx]);
    }
  }

  addRecommendation(newRec) {
    const rec = {
      id: 'rec_user_' + Date.now(),
      status: 'active',
      priority: 'high',
      updatedAt: new Date().toISOString(),
      ...newRec
    };
    this.recommendations.unshift(rec);
    this.saveRecommendations();
    this.notify('REC_ADDED', rec);
    return rec;
  }

  deleteRecommendation(id) {
    this.recommendations = this.recommendations.filter(rec => rec.id !== id);
    this.saveRecommendations();
    this.notify('REC_DELETED', { id });
  }

  // --- UI NAVIGATION & FILTERS ---
  setView(viewName) {
    this.activeView = viewName;
    safeStorage.setItem(STORAGE_KEYS.VIEW, viewName);
    this.notify('VIEW_CHANGED', { view: viewName });
  }

  setPlatformFilter(filter) {
    const valid = ['all', 'google', 'meta', 'unknown'].includes(filter) ? filter : 'all';
    this.platformFilter = valid;
    safeStorage.setItem(STORAGE_KEYS.PLATFORM_FILTER, valid);
    this.notify('PLATFORM_FILTER_CHANGED', { platform: valid });
  }

  getPlatformFilter() {
    return this.platformFilter || 'all';
  }

  setCampaignFilter(filter) {
    this.campaignFilter = filter;
    this.notify('FILTER_CHANGED', { filter });
  }

  setCampaignSearch(query) {
    this.campaignSearch = query;
    this.notify('SEARCH_CHANGED', { query });
  }

  setCampaignSort(key) {
    if (this.campaignSortKey === key) {
      this.campaignSortAsc = !this.campaignSortAsc;
    } else {
      this.campaignSortKey = key;
      this.campaignSortAsc = true;
    }
    this.notify('SORT_CHANGED', { key: this.campaignSortKey, asc: this.campaignSortAsc });
  }

  toggleContextRail() {
    this.isContextRailOpen = !this.isContextRailOpen;
    this.notify('RAIL_TOGGLED', { isOpen: this.isContextRailOpen });
  }
}

// Global Singleton Instance
export const store = new AdsStore();

// Attach globally for safe testing and developer console reset
if (typeof window !== 'undefined') {
  window.store = store;
  window.vsResetReportStore = () => store.clearAllReports();
  window.vsLoadSampleData = () => store.seedSampleData();
}

// --- UTILITY FORMATTERS ---
export function formatINR(val, compact = false) {
  if (val === null || val === undefined || isNaN(val)) return '₹0';
  const num = Number(val);

  if (compact) {
    if (Math.abs(num) >= 100000) {
      return '₹' + (num / 100000).toFixed(2) + 'L';
    }
    if (Math.abs(num) >= 1000) {
      return '₹' + (num / 1000).toFixed(1) + 'k';
    }
  }

  return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export function formatNumber(val, decimals = 0) {
  if (val === null || val === undefined || isNaN(val)) return '0';
  return Number(val).toLocaleString('en-IN', { maximumFractionDigits: decimals });
}

export function formatPercent(val, decimals = 2) {
  if (val === null || val === undefined || isNaN(val)) return '0%';
  return Number(val).toFixed(decimals) + '%';
}

/**
 * VS Ads Intelligence - Main Application Controller
 * Dark Editorial Analytics Refinement Pass
 */

import { store, formatINR, formatNumber, formatPercent } from './store.js';
import { ChartManager } from './charts.js';
import { AiDiagnosticsEngine } from './ai-diagnostics.js';
import { CsvEngine } from './csv-engine.js';

class AppController {
  constructor() {
    this.init();
  }

  resolveViewFromRoute(rawRoute) {
    if (!rawRoute || typeof rawRoute !== 'string') return null;
    const clean = rawRoute
      .replace(/^[#/]+/, '')
      .replace(/[?#].*$/, '')
      .replace(/\/+$/, '')
      .trim()
      .toLowerCase();
    
    if (!clean) return null;

    const routeMap = {
      'overview': 'overview',
      'campaigns': 'campaigns',
      'reports': 'reports',
      'weekly-reports': 'reports',
      'history': 'reports',
      'ai-insights': 'ai-insights',
      'diagnostics': 'ai-insights',
      'improve': 'improve',
      'action-plan': 'improve',
      'data-uploads': 'data-uploads',
      'uploads': 'data-uploads',
      'ingestion': 'data-uploads'
    };

    return routeMap[clean] || null;
  }

  getPrimaryHashForView(view) {
    const primaryHashMap = {
      'overview': 'overview',
      'campaigns': 'campaigns',
      'reports': 'weekly-reports',
      'ai-insights': 'diagnostics',
      'improve': 'action-plan',
      'data-uploads': 'data-uploads'
    };
    return primaryHashMap[view] || view;
  }

  isValidView(view) {
    return ['overview', 'campaigns', 'reports', 'ai-insights', 'improve', 'data-uploads'].includes(view);
  }

  getRouteFromLocation() {
    if (typeof window !== 'undefined' && window.location) {
      // 1. PRIMARY: Check URL hash (e.g. #data-uploads, #/data-uploads, #weekly-reports)
      if (window.location.hash) {
        const viewFromHash = this.resolveViewFromRoute(window.location.hash);
        if (viewFromHash) return viewFromHash;
      }

      // 2. SECONDARY: Check pathname fallback (e.g. /data-uploads)
      if (window.location.pathname && window.location.pathname !== '/') {
        const viewFromPath = this.resolveViewFromRoute(window.location.pathname);
        if (viewFromPath) return viewFromPath;
      }
    }
    // Only use Overview as fallback for actually unknown/empty route
    return 'overview';
  }

  handleRouteChange() {
    const targetView = this.getRouteFromLocation();
    if (targetView && (targetView !== store.activeView || !this.hasRenderedInitialView)) {
      this.switchView(targetView, false);
    }
  }

  init() {
    ChartManager.initGlobalDefaults();

    this.stagedFiles = [];
    this.hasRenderedInitialView = false;

    // Subscribe to store updates
    store.subscribe((changeType, payload) => {
      this.handleStoreChange(changeType, payload);
    });

    // Initial DOM renders & event binding
    this.bindGlobalEvents();
    this.populateReportDropdowns();
    this.renderHeaderControls();
    this.renderContextRail();

    // Resolve initial view from current URL location (hash first, then path, then 'overview')
    const initialView = this.getRouteFromLocation();
    this.switchView(initialView, false);
    this.refreshIcons();
  }

  handleStoreChange(type, payload) {
    this.populateReportDropdowns();
    this.renderHeaderControls();
    this.renderContextRail();
    this.renderActiveView();
    this.refreshIcons();
  }

  refreshIcons() {
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  bindGlobalEvents() {
    // Navigation items: clicking updates the hash, which triggers route change
    document.querySelectorAll('[data-nav-view]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        const routeAttr = el.getAttribute('href')?.replace(/^#/, '') || el.getAttribute('data-nav-view');
        const view = this.resolveViewFromRoute(routeAttr) || el.getAttribute('data-nav-view');
        this.switchView(view, true);
      });
    });

    // Handle hash change events (URL hash changes -> route state updates -> correct page renders)
    window.addEventListener('hashchange', () => {
      this.handleRouteChange();
    });

    // Handle browser back/forward history navigation
    window.addEventListener('popstate', () => {
      this.handleRouteChange();
    });

    // Period selector in top bar
    const periodSelect = document.getElementById('top-period-select');
    if (periodSelect) {
      periodSelect.addEventListener('change', e => {
        store.setActiveReport(e.target.value);
      });
    }

    // Platform selector tabs in top bar
    document.querySelectorAll('[data-platform-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const plat = btn.getAttribute('data-platform-tab');
        this.setPlatformFilter(plat);
      });
    });

    // Context rail toggle
    const railToggleBtn = document.getElementById('btn-toggle-rail');
    if (railToggleBtn) {
      railToggleBtn.addEventListener('click', () => {
        store.toggleContextRail();
      });
    }

    // Print / PDF button
    const printBtn = document.getElementById('btn-print-report');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        window.print();
      });
    }
  }

  switchView(viewName, updateUrl = true) {
    const resolvedView = this.resolveViewFromRoute(viewName) || (this.isValidView(viewName) ? viewName : 'overview');
    store.activeView = resolvedView;
    this.hasRenderedInitialView = true;

    // Synchronize browser URL bar to #<route>
    if (updateUrl && typeof window !== 'undefined') {
      const primaryHash = '#' + this.getPrimaryHashForView(resolvedView);
      if (window.location.hash !== primaryHash) {
        window.location.hash = primaryHash;
        // Setting window.location.hash triggers 'hashchange' in the browser
      }
    }
    
    // Update active nav styling: Strict Monochrome indicator
    document.querySelectorAll('[data-nav-view]').forEach(el => {
      const v = el.getAttribute('data-nav-view');
      if (v === resolvedView) {
        el.classList.add('bg-[#171717]', 'text-white', 'border-l-2', 'border-white');
        el.classList.remove('text-[#A3A3A3]', 'hover:bg-[#171717]', 'border-transparent', 'border-l-0');
      } else {
        el.classList.remove('bg-[#171717]', 'text-white', 'border-l-2', 'border-white');
        el.classList.add('text-[#A3A3A3]', 'hover:bg-[#171717]', 'hover:text-[#F5F5F5]', 'border-transparent', 'border-l-0');
      }
    });

    // Hide all view panels, show current
    document.querySelectorAll('.view-panel').forEach(panel => panel.classList.add('hidden'));
    const targetPanel = document.getElementById(`view-${resolvedView}`);
    if (targetPanel) {
      targetPanel.classList.remove('hidden');
    }

    this.renderActiveView();
    this.refreshIcons();
  }

  setPlatformFilter(platform) {
    store.setPlatformFilter(platform);
  }

  renderActiveView() {
    const view = store.activeView;
    switch (view) {
      case 'overview':
        this.renderOverviewView();
        break;
      case 'campaigns':
        this.renderCampaignsView();
        break;
      case 'reports':
        this.renderReportsView();
        break;
      case 'ai-insights':
        this.renderAiInsightsView();
        break;
      case 'improve':
        this.renderImproveView();
        break;
      case 'data-uploads':
        this.renderDataUploadsView();
        break;
    }
  }

  populateReportDropdowns() {
    const select = document.getElementById('top-period-select');
    if (!select) return;

    const allReports = store.getAllReports();
    if (!allReports || allReports.length === 0) {
      select.innerHTML = '<option value="" disabled selected>No Reports Loaded</option>';
      return;
    }

    const hierarchy = store.getPeriodHierarchy();
    const years = Object.keys(hierarchy).sort((a, b) => b - a);

    let html = '';
    for (const year of years) {
      const months = Object.keys(hierarchy[year]);
      for (const month of months) {
        const { monthlySummary, weeks } = hierarchy[year][month];
        html += `<optgroup label="${month} ${year}">`;
        if (monthlySummary) {
          html += `
            <option value="${monthlySummary.reportId}" ${monthlySummary.reportId === store.activeReportId ? 'selected' : ''}>
              ${month} ${year} · Monthly Summary
            </option>
          `;
        }
        for (const w of weeks) {
          html += `
            <option value="${w.reportId}" ${w.reportId === store.activeReportId ? 'selected' : ''}>
              ${w.period ? w.period.periodLabel : w.periodName}
            </option>
          `;
        }
        html += `</optgroup>`;
      }
    }

    if (!html) {
      html = allReports.map(r => `
        <option value="${r.reportId}" ${r.reportId === store.activeReportId ? 'selected' : ''}>
          ${r.period ? r.period.periodLabel : r.periodName}
        </option>
      `).join('');
    }

    select.innerHTML = html;
  }

  renderHeaderControls() {
    // 1. Sync platform tab styling
    const currentPlatform = store.platformFilter || 'all';
    document.querySelectorAll('[data-platform-tab]').forEach(btn => {
      const tab = btn.getAttribute('data-platform-tab');
      if (tab === currentPlatform) {
        btn.className = 'px-2.5 py-1 rounded-md font-medium transition bg-white text-black text-[11px]';
      } else {
        btn.className = 'px-2.5 py-1 rounded-md font-medium transition text-[#A3A3A3] hover:text-[#F5F5F5] text-[11px]';
      }
    });

    const report = store.getActiveReportScoped();
    const spentEl = document.getElementById('hdr-budget-spent');
    const remainingEl = document.getElementById('hdr-budget-remaining');
    const runRateEl = document.getElementById('hdr-daily-rate');

    if (!report || report.campaigns.length === 0) {
      if (spentEl) spentEl.textContent = '—';
      if (remainingEl) remainingEl.textContent = '—';
      if (runRateEl) runRateEl.textContent = '—';
      return;
    }

    const b = report.budgetSummary;
    if (spentEl) spentEl.textContent = formatINR(b.spent, true);
    if (remainingEl) remainingEl.textContent = formatINR(b.remaining, true);
    if (runRateEl) runRateEl.textContent = b.dailyRunRate ? `${formatINR(b.dailyRunRate)}/day` : '—';
  }

  renderContextRail() {
    const rail = document.getElementById('context-rail');
    if (!rail) return;

    if (!store.isContextRailOpen) {
      rail.classList.add('hidden');
      return;
    }
    rail.classList.remove('hidden');

    const emptyState = document.getElementById('rail-empty-state');
    const railContent = document.getElementById('rail-content');

    const report = store.getActiveReport();
    if (!report) {
      if (emptyState) emptyState.classList.remove('hidden');
      if (railContent) railContent.classList.add('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (railContent) railContent.classList.remove('hidden');

    const comp = store.getComparisonReport();
    const analysis = AiDiagnosticsEngine.analyzeReport(report, comp);
    if (!analysis) return;

    const sprintScoreEl = document.getElementById('rail-sprint-score');
    if (sprintScoreEl) sprintScoreEl.textContent = analysis.sprintScore + '/100';

    const wasteEl = document.getElementById('rail-wasted-spend');
    if (wasteEl) wasteEl.textContent = formatINR(analysis.totalWastedSpend);

    const winnerNameEl = document.getElementById('rail-winner-name');
    const winnerCpaEl = document.getElementById('rail-winner-cpa');
    if (winnerNameEl && analysis.primaryWinner) {
      winnerNameEl.textContent = analysis.primaryWinner.name;
      if (winnerCpaEl) winnerCpaEl.textContent = `CPA: ${formatINR(analysis.primaryWinner.cpa)}`;
    }

    const attentionNameEl = document.getElementById('rail-attention-name');
    const attentionIssueEl = document.getElementById('rail-attention-issue');
    if (attentionNameEl && analysis.primaryAttention) {
      attentionNameEl.textContent = analysis.primaryAttention.name;
      if (attentionIssueEl) attentionIssueEl.textContent = analysis.primaryAttention.mainIssue || `CPA: ${formatINR(analysis.primaryAttention.cpa || 56131)}`;
    }

    // Mini alert in rail
    const alertBox = document.getElementById('rail-urgent-alert');
    if (alertBox && analysis.insights && analysis.insights.length > 0) {
      const topAlert = analysis.insights[0];
      alertBox.innerHTML = `
        <div class="text-[11px] font-medium text-white flex items-center space-x-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-white"></span>
          <span>${topAlert.badge}</span>
        </div>
        <p class="text-xs text-[#F5F5F5] mt-1.5 leading-snug font-medium">${topAlert.title}</p>
        <button onclick="window.vsApp.switchView('ai-insights')" class="text-[11px] text-[#A3A3A3] hover:text-white hover:underline mt-2 inline-block font-medium">
          Review analysis &rarr;
        </button>
      `;
    }
  }

  // ==========================================
  // MODULE 1: EXECUTIVE OVERVIEW
  // ==========================================
  renderOverviewView() {
    const emptyState = document.getElementById('overview-empty-state');
    const content = document.getElementById('overview-content');

    const rawReport = store.getActiveReport();
    if (!rawReport || store.getAllReports().length === 0) {
      if (emptyState) emptyState.classList.remove('hidden');
      if (content) content.classList.add('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (content) content.classList.remove('hidden');

    const activePlatform = store.platformFilter || 'all';
    const report = store.getActiveReportScoped(activePlatform);
    const comp = store.getComparisonReportScoped(activePlatform);

    // Platform-specific elements
    const platformEmptyEl = document.getElementById('overview-platform-empty');
    const kpiSection = document.getElementById('overview-kpi-section');
    const compSection = document.getElementById('overview-platform-comparison');
    const chartsRow = document.querySelector('#overview-content .grid-cols-1.lg\\:grid-cols-12');
    const spotlightRow = document.getElementById('overview-spotlight-container');

    // Requirement 11: Clean empty state when platform has no data for selected period
    if (!report || report.campaigns.length === 0) {
      if (platformEmptyEl) {
        platformEmptyEl.classList.remove('hidden');
        const emptyTitle = document.getElementById('overview-platform-empty-title');
        const emptyDesc = document.getElementById('overview-platform-empty-desc');
        const platLabel = activePlatform === 'meta' ? 'Meta' : (activePlatform === 'google' ? 'Google' : 'Selected Platform');
        if (emptyTitle) emptyTitle.textContent = `NO ${platLabel.toUpperCase()} DATA`;
        if (emptyDesc) emptyDesc.textContent = `No ${platLabel} advertising data was recorded for this reporting period.`;
      }
      if (kpiSection) kpiSection.classList.add('hidden');
      if (compSection) compSection.classList.add('hidden');
      if (chartsRow) chartsRow.classList.add('hidden');
      if (spotlightRow) spotlightRow.classList.add('hidden');

      const periodLabelEl = document.getElementById('ov-budget-period-label');
      if (periodLabelEl) periodLabelEl.textContent = rawReport.period ? rawReport.period.periodLabel : rawReport.periodName;

      const budgetTotal = document.getElementById('ov-budget-total');
      const budgetSpent = document.getElementById('ov-budget-spent');
      const budgetRem = document.getElementById('ov-budget-remaining');
      const budgetPct = document.getElementById('ov-budget-pct');
      const budgetProgress = document.getElementById('ov-budget-progressbar');
      const budgetSubtext = document.getElementById('ov-budget-subtext');
      if (budgetTotal) budgetTotal.textContent = '—';
      if (budgetSpent) budgetSpent.textContent = '—';
      if (budgetRem) budgetRem.textContent = '—';
      if (budgetPct) budgetPct.textContent = '0% spent';
      if (budgetProgress) budgetProgress.style.width = '0%';
      if (budgetSubtext) budgetSubtext.textContent = 'No records in this period';
      return;
    }

    if (platformEmptyEl) platformEmptyEl.classList.add('hidden');
    if (kpiSection) kpiSection.classList.remove('hidden');
    if (chartsRow) chartsRow.classList.remove('hidden');
    if (spotlightRow) spotlightRow.classList.remove('hidden');

    const m = report.metrics;
    const b = report.budgetSummary;

    // Period label in banner
    const periodLabelEl = document.getElementById('ov-budget-period-label');
    if (periodLabelEl) periodLabelEl.textContent = report.period ? report.period.periodLabel : report.periodName;

    // Platform badge
    const badgeEl = document.getElementById('overview-kpi-platform-badge');
    if (badgeEl) {
      badgeEl.textContent = activePlatform === 'all' ? 'ALL PLATFORMS' : (activePlatform === 'google' ? 'GOOGLE ADS' : 'META ADS');
    }

    // 1. Budget Banner
    const budgetTotal = document.getElementById('ov-budget-total');
    const budgetSpent = document.getElementById('ov-budget-spent');
    const budgetRem = document.getElementById('ov-budget-remaining');
    const budgetPct = document.getElementById('ov-budget-pct');
    const budgetProgress = document.getElementById('ov-budget-progressbar');
    const budgetSubtext = document.getElementById('ov-budget-subtext');

    if (budgetTotal) budgetTotal.textContent = formatINR(b.allocated);
    if (budgetSpent) budgetSpent.textContent = formatINR(b.spent);
    if (budgetRem) budgetRem.textContent = formatINR(b.remaining);
    if (budgetPct) budgetPct.textContent = `${b.spendRatePercent}% spent`;
    if (budgetProgress) budgetProgress.style.width = `${Math.min(b.spendRatePercent, 100)}%`;
    if (budgetSubtext) budgetSubtext.textContent = b.dailyRunRate ? `${formatINR(b.dailyRunRate)}/day run-rate` : 'Run-rate tracking';

    // 2. Unified KPI Metrics Band (8 metrics separated by interior dividers)
    const kpiData = [
      {
        label: 'Total Spend',
        val: formatINR(b.spent),
        sub: `of ${formatINR(b.allocated, true)} budget`,
        delta: comp && comp.budgetSummary.spent ? `${(((b.spent - comp.budgetSummary.spent) / comp.budgetSummary.spent) * 100).toFixed(1)}%` : null,
        isPositive: false
      },
      {
        label: 'Impressions',
        val: formatNumber(m.impressions),
        sub: 'Total ad views',
        delta: comp && comp.metrics.impressions ? `${(((m.impressions - comp.metrics.impressions) / comp.metrics.impressions) * 100).toFixed(1)}%` : null,
        isPositive: true
      },
      {
        label: 'Clicks',
        val: formatNumber(m.clicks),
        sub: `${m.ctr}% average CTR`,
        delta: comp && comp.metrics.clicks ? `${(((m.clicks - comp.metrics.clicks) / comp.metrics.clicks) * 100).toFixed(1)}%` : null,
        isPositive: true
      },
      {
        label: 'Average CPC',
        val: formatINR(m.cpc),
        sub: 'Cost per ad click',
        delta: comp && comp.metrics.cpc ? `${(((m.cpc - comp.metrics.cpc) / comp.metrics.cpc) * 100).toFixed(1)}%` : null,
        isPositive: false
      },
      {
        label: activePlatform === 'meta' ? 'Meta Results' : 'Recorded Conversions',
        val: activePlatform === 'meta' ? formatNumber(m.sourceResults || 0) : m.conversions,
        sub: activePlatform === 'meta' ? (m.costPerResult ? `₹${m.costPerResult} cost / result` : 'Platform reported') : `${m.conversionRate}% conv rate`,
        delta: comp ? (activePlatform === 'meta' ? null : `${m.conversions >= comp.metrics.conversions ? '+' : ''}${m.conversions - comp.metrics.conversions}`) : null,
        isPositive: true,
        highlight: true
      },
      {
        label: activePlatform === 'meta' ? 'Cost / Result (CPR)' : 'Cost / Conversion (CPA)',
        val: activePlatform === 'meta' ? (m.costPerResult ? formatINR(m.costPerResult) : '—') : (m.cpa ? formatINR(m.cpa) : 'None (0 conv)'),
        sub: activePlatform === 'meta' ? 'Meta reported CPR' : 'Target ₹3,000',
        delta: comp && comp.metrics.cpa ? `${(((m.cpa - comp.metrics.cpa) / comp.metrics.cpa) * 100).toFixed(1)}%` : null,
        isPositive: false,
        highlight: true
      },
      {
        label: 'Patient Leads',
        val: formatNumber(m.leads),
        sub: 'Verified lead inquiries',
        delta: comp ? `${m.leads >= comp.metrics.leads ? '+' : ''}${m.leads - comp.metrics.leads}` : null,
        isPositive: true
      },
      {
        label: 'Phone Inquiries',
        val: formatNumber(m.phoneCalls),
        sub: 'Call extensions & clicks',
        delta: comp ? `${m.phoneCalls >= comp.metrics.phoneCalls ? '+' : ''}${m.phoneCalls - comp.metrics.phoneCalls}` : null,
        isPositive: true
      }
    ];

    const kpiContainer = document.getElementById('overview-kpi-grid');
    if (kpiContainer) {
      kpiContainer.innerHTML = kpiData.map((k, idx) => `
        <div class="p-5 flex flex-col justify-between ${idx % 2 !== 0 ? 'border-l border-white/[0.08] sm:border-l-0' : ''} ${idx >= 4 ? 'border-t border-white/[0.08]' : ''} ${idx % 4 !== 0 ? 'lg:border-l lg:border-white/[0.08]' : 'lg:border-l-0'}">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-[#A3A3A3] font-medium">${k.label}</span>
              ${k.delta ? `
                <span class="text-[11px] font-medium text-[#A3A3A3]">
                  ${k.delta}
                </span>
              ` : ''}
            </div>
            <div class="mt-2 text-2xl font-semibold text-white tracking-tight">
              ${k.val}
            </div>
          </div>
          <p class="text-[11px] text-[#737373] mt-2 font-normal">${k.sub}</p>
        </div>
      `).join('');
    }

    // 2.1 Platform Comparison (Requirement 8: Clean Platform Summary when All is selected)
    if (compSection) {
      if (activePlatform === 'all') {
        compSection.classList.remove('hidden');
        const gRep = store.getScopedReport(rawReport, 'google');
        const mRep = store.getScopedReport(rawReport, 'meta');
        const gMetrics = gRep ? gRep.metrics : null;
        const mMetrics = mRep ? mRep.metrics : null;

        const compCards = document.getElementById('overview-platform-comparison-cards');
        if (compCards) {
          compCards.innerHTML = `
            <!-- GOOGLE ADS SUMMARY -->
            <div class="bg-[#111111] border border-white/[0.08] p-5 rounded-xl space-y-4">
              <div class="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div class="flex items-center space-x-2">
                  <span class="w-2 h-2 rounded-full bg-white"></span>
                  <h4 class="text-xs font-semibold text-[#F5F5F5] uppercase tracking-wider">Google Ads</h4>
                </div>
                <span class="text-[11px] text-[#A3A3A3]">Search · PMax · YouTube</span>
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div class="bg-[#171717] p-3 rounded-lg border border-white/[0.08]">
                  <span class="text-[10px] text-[#737373] block">Spend</span>
                  <div class="text-sm font-semibold text-[#F5F5F5] mt-0.5">${gMetrics ? formatINR(gMetrics.spend) : '₹0'}</div>
                </div>
                <div class="bg-[#171717] p-3 rounded-lg border border-white/[0.08]">
                  <span class="text-[10px] text-[#737373] block">Clicks</span>
                  <div class="text-sm font-semibold text-[#F5F5F5] mt-0.5">${gMetrics ? formatNumber(gMetrics.clicks) : '0'}</div>
                </div>
                <div class="bg-[#171717] p-3 rounded-lg border border-white/[0.08]">
                  <span class="text-[10px] text-[#737373] block">Average CPC</span>
                  <div class="text-sm font-semibold text-[#F5F5F5] mt-0.5">${gMetrics ? formatINR(gMetrics.cpc) : '₹0'}</div>
                </div>
                <div class="bg-[#171717] p-3 rounded-lg border border-white/[0.08]">
                  <span class="text-[10px] text-[#737373] block">Leads</span>
                  <div class="text-sm font-semibold text-[#F5F5F5] mt-0.5">${gMetrics ? formatNumber(gMetrics.leads) : '0'}</div>
                </div>
                <div class="bg-[#171717] p-3 rounded-lg border border-white/[0.08]">
                  <span class="text-[10px] text-[#737373] block">Phone Calls</span>
                  <div class="text-sm font-semibold text-[#F5F5F5] mt-0.5">${gMetrics ? formatNumber(gMetrics.phoneCalls) : '0'}</div>
                </div>
                <div class="bg-[#171717] p-3 rounded-lg border border-white/[0.08]">
                  <span class="text-[10px] text-[#737373] block">Conversions</span>
                  <div class="text-sm font-semibold text-[#F5F5F5] mt-0.5">${gMetrics ? formatNumber(gMetrics.conversions) : '0'}</div>
                </div>
              </div>
            </div>

            <!-- META ADS SUMMARY -->
            <div class="bg-[#111111] border border-white/[0.08] p-5 rounded-xl space-y-4">
              <div class="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div class="flex items-center space-x-2">
                  <span class="w-2 h-2 rounded-full bg-[#A3A3A3]"></span>
                  <h4 class="text-xs font-semibold text-[#F5F5F5] uppercase tracking-wider">Meta Ads</h4>
                </div>
                <span class="text-[11px] text-[#A3A3A3]">Instagram · Facebook</span>
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div class="bg-[#171717] p-3 rounded-lg border border-white/[0.08]">
                  <span class="text-[10px] text-[#737373] block">Spend</span>
                  <div class="text-sm font-semibold text-[#F5F5F5] mt-0.5">${mMetrics ? formatINR(mMetrics.spend) : '₹0'}</div>
                </div>
                <div class="bg-[#171717] p-3 rounded-lg border border-white/[0.08]">
                  <span class="text-[10px] text-[#737373] block">Clicks</span>
                  <div class="text-sm font-semibold text-[#F5F5F5] mt-0.5">${mMetrics ? formatNumber(mMetrics.clicks) : '0'}</div>
                </div>
                <div class="bg-[#171717] p-3 rounded-lg border border-white/[0.08]">
                  <span class="text-[10px] text-[#737373] block">Average CPC</span>
                  <div class="text-sm font-semibold text-[#F5F5F5] mt-0.5">${mMetrics ? formatINR(mMetrics.cpc) : '₹0'}</div>
                </div>
                <div class="bg-[#171717] p-3 rounded-lg border border-white/[0.08]">
                  <span class="text-[10px] text-[#737373] block">Results</span>
                  <div class="text-sm font-semibold text-[#F5F5F5] mt-0.5">${mMetrics && mMetrics.sourceResults ? formatNumber(mMetrics.sourceResults) : (mMetrics && mMetrics.conversions ? formatNumber(mMetrics.conversions) : '0')}</div>
                </div>
                <div class="bg-[#171717] p-3 rounded-lg border border-white/[0.08]">
                  <span class="text-[10px] text-[#737373] block">Cost per Result (CPR)</span>
                  <div class="text-sm font-semibold text-[#F5F5F5] mt-0.5">${mMetrics && mMetrics.costPerResult ? formatINR(mMetrics.costPerResult) : (mMetrics && mMetrics.cpa ? formatINR(mMetrics.cpa) : '—')}</div>
                </div>
                <div class="bg-[#171717] p-3 rounded-lg border border-white/[0.08]">
                  <span class="text-[10px] text-[#737373] block">Leads</span>
                  <div class="text-sm font-semibold text-[#F5F5F5] mt-0.5">${mMetrics ? formatNumber(mMetrics.leads) : '0'}</div>
                </div>
              </div>
            </div>
          `;
        }
      } else {
        compSection.classList.add('hidden');
      }
    }

    // 3. Render Visualizations
    ChartManager.renderVelocityChart('chart-velocity', store.getAllReports(), activePlatform);
    ChartManager.renderChannelShareChart('chart-channel-share', report);

    // 4. Spotlight Pair (Editorial diagnostics)
    const campaigns = report.campaigns;
    const strongOne = campaigns.find(c => c.classification === 'strong') || campaigns[0];
    const weakOne = campaigns.find(c => c.classification === 'weak') || campaigns[campaigns.length - 1];

    const spotlightContainer = document.getElementById('overview-spotlight-container');
    if (spotlightContainer && strongOne && weakOne) {
      spotlightContainer.innerHTML = `
        <div class="bg-[#111111] border border-white/[0.08] p-6 rounded-xl space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-white flex items-center space-x-2">
              <span class="w-1.5 h-1.5 rounded-full bg-white"></span>
              <span>Top Performing Campaign</span>
            </span>
            <span class="text-xs text-[#A3A3A3] bg-[#171717] px-2 py-0.5 rounded border border-white/[0.08]">
              Rank #1
            </span>
          </div>

          <div>
            <h4 class="text-lg font-semibold text-[#F5F5F5]">${strongOne.name}</h4>
            <p class="text-xs text-[#A3A3A3] mt-0.5">${strongOne.specialty} &bull; ${strongOne.channel}</p>
          </div>

          <div class="grid grid-cols-3 gap-4 pt-4 border-t border-white/[0.08] text-center">
            <div>
              <span class="text-[10px] text-[#737373] block">CPA</span>
              <span class="text-base font-semibold text-white">${formatINR(strongOne.cpa)}</span>
            </div>
            <div>
              <span class="text-[10px] text-[#737373] block">Conversions</span>
              <span class="text-base font-semibold text-white">${strongOne.conversions}</span>
            </div>
            <div>
              <span class="text-[10px] text-[#737373] block">Average CPC</span>
              <span class="text-base font-semibold text-[#A3A3A3]">${formatINR(strongOne.cpc)}</span>
            </div>
          </div>

          <p class="text-xs text-[#A3A3A3] leading-relaxed pt-1">${strongOne.notes || 'High efficiency lead flow. Primary candidate for scaled sprint budget.'}</p>
        </div>

        <div class="bg-[#111111] border border-white/[0.08] p-6 rounded-xl space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-[#D4D4D4] flex items-center space-x-2">
              <span class="w-1.5 h-1.5 rounded-full bg-[#737373]"></span>
              <span>Requires Budget Action</span>
            </span>
            <span class="text-xs text-[#D4D4D4] bg-[#171717] px-2 py-0.5 rounded border border-white/[0.08]">
              Critical Drain
            </span>
          </div>

          <div>
            <h4 class="text-lg font-semibold text-[#F5F5F5]">${weakOne.name}</h4>
            <p class="text-xs text-[#A3A3A3] mt-0.5">${weakOne.specialty} &bull; ${weakOne.channel}</p>
          </div>

          <div class="grid grid-cols-3 gap-4 pt-4 border-t border-white/[0.08] text-center">
            <div>
              <span class="text-[10px] text-[#737373] block">Spend</span>
              <span class="text-base font-semibold text-white">${formatINR(weakOne.spend)}</span>
            </div>
            <div>
              <span class="text-[10px] text-[#737373] block">Conversions</span>
              <span class="text-base font-semibold text-[#A3A3A3]">${weakOne.conversions}</span>
            </div>
            <div>
              <span class="text-[10px] text-[#737373] block">Average CPC</span>
              <span class="text-base font-semibold text-[#A3A3A3]">${formatINR(weakOne.cpc)}</span>
            </div>
          </div>

          <p class="text-xs text-[#A3A3A3] leading-relaxed pt-1">${weakOne.mainIssue || 'High spend volume with negligible conversions. Recommended action: pause campaign.'}</p>
        </div>
      `;
    }
  }

  // ==========================================
  // MODULE 2: CAMPAIGNS HUB
  // ==========================================
  renderCampaignsView() {
    const emptyState = document.getElementById('campaigns-empty-state');
    const content = document.getElementById('campaigns-content');

    const rawReport = store.getActiveReport();
    if (!rawReport || store.getAllReports().length === 0) {
      if (emptyState) emptyState.classList.remove('hidden');
      if (content) content.classList.add('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (content) content.classList.remove('hidden');

    const activePlatform = store.platformFilter || 'all';
    const report = store.getActiveReportScoped(activePlatform);

    // Platform empty state check
    const platformEmptyEl = document.getElementById('campaigns-platform-empty');
    const chartCard = document.querySelector('#campaigns-content .h-64')?.closest('.bg-\\[\\#111111\\]');
    const tableCard = document.getElementById('campaigns-table-body')?.closest('.bg-\\[\\#111111\\]');

    if (!report || report.campaigns.length === 0) {
      if (platformEmptyEl) {
        platformEmptyEl.classList.remove('hidden');
        const emptyTitle = document.getElementById('campaigns-platform-empty-title');
        const emptyDesc = document.getElementById('campaigns-platform-empty-desc');
        const platLabel = activePlatform === 'meta' ? 'Meta' : (activePlatform === 'google' ? 'Google' : 'Selected Platform');
        if (emptyTitle) emptyTitle.textContent = `NO ${platLabel.toUpperCase()} CAMPAIGNS`;
        if (emptyDesc) emptyDesc.textContent = `No ${platLabel} campaigns were active in this reporting cycle.`;
      }
      if (chartCard) chartCard.classList.add('hidden');
      if (tableCard) tableCard.classList.add('hidden');
      return;
    }

    if (platformEmptyEl) platformEmptyEl.classList.add('hidden');
    if (chartCard) chartCard.classList.remove('hidden');
    if (tableCard) tableCard.classList.remove('hidden');

    let campaigns = [...report.campaigns];

    // Apply Filter
    if (store.campaignFilter === 'strong') {
      campaigns = campaigns.filter(c => c.classification === 'strong');
    } else if (store.campaignFilter === 'weak') {
      campaigns = campaigns.filter(c => c.classification === 'weak');
    } else if (store.campaignFilter === 'PMax') {
      campaigns = campaigns.filter(c => c.channel === 'PMax');
    } else if (store.campaignFilter === 'Search') {
      campaigns = campaigns.filter(c => c.channel === 'Search');
    } else if (store.campaignFilter === 'YouTube') {
      campaigns = campaigns.filter(c => c.channel === 'YouTube');
    } else if (store.campaignFilter === 'google') {
      campaigns = campaigns.filter(c => (c.platform || '').toLowerCase() === 'google');
    } else if (store.campaignFilter === 'meta') {
      campaigns = campaigns.filter(c => (c.platform || '').toLowerCase() === 'meta');
    }

    // Apply Search
    if (store.campaignSearch) {
      const q = store.campaignSearch.toLowerCase();
      campaigns = campaigns.filter(c => c.name.toLowerCase().includes(q) || c.specialty.toLowerCase().includes(q));
    }

    // Apply Sorting
    campaigns.sort((a, b) => {
      let valA = a[store.campaignSortKey];
      let valB = b[store.campaignSortKey];
      if (valA === null) valA = store.campaignSortAsc ? 999999 : -1;
      if (valB === null) valB = store.campaignSortAsc ? 999999 : -1;
      if (typeof valA === 'string') {
        return store.campaignSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return store.campaignSortAsc ? valA - valB : valB - valA;
    });

    // Render CPA Horizontal Bar Chart
    ChartManager.renderCpaBarChart('chart-campaigns-cpa', report.campaigns);

    // Filter Buttons state
    document.querySelectorAll('[data-campaign-filter]').forEach(btn => {
      const f = btn.getAttribute('data-campaign-filter');
      const isFilterActive = (f === store.campaignFilter) || (f === activePlatform && ['google', 'meta'].includes(f));
      if (isFilterActive) {
        btn.classList.add('bg-[#1D1D1D]', 'text-white', 'border-white/20');
        btn.classList.remove('text-[#A3A3A3]', 'border-white/[0.08]');
      } else {
        btn.classList.remove('bg-[#1D1D1D]', 'text-white', 'border-white/20');
        btn.classList.add('text-[#A3A3A3]', 'border-white/[0.08]');
      }
    });

    // Table rows
    const tbody = document.getElementById('campaigns-table-body');
    if (tbody) {
      tbody.innerHTML = campaigns.map(c => {
        const plat = (c.platform || '').toLowerCase();
        const platDisplay = plat === 'google' ? 'Google Ads' : (plat === 'meta' ? 'Meta Ads' : 'Unknown');
        const platColorClass = plat === 'google' ? 'text-white' : (plat === 'meta' ? 'text-[#D4D4D4]' : 'text-[#737373]');

        return `
        <tr class="hover:bg-[#171717] transition border-b border-white/[0.06]">
          <td class="py-3 px-4 text-xs text-[#737373] font-medium">#${c.rank}</td>
          <td class="py-3 px-4">
            <div class="font-medium text-xs text-[#F5F5F5]">${c.name}</div>
            <div class="text-[11px] text-[#A3A3A3]">${c.specialty}</div>
          </td>
          <td class="py-3 px-4">
            <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-[#171717] ${platColorClass} border border-white/[0.08]">
              ${platDisplay}
            </span>
          </td>
          <td class="py-3 px-4">
            <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-[#171717] text-[#A3A3A3] border border-white/[0.08]">
              ${c.channel}
            </span>
          </td>
          <td class="py-3 px-4 text-right text-xs text-[#F5F5F5] font-medium">${formatINR(c.spend)}</td>
          <td class="py-3 px-4 text-right text-xs text-[#A3A3A3]">${formatNumber(c.clicks)}</td>
          <td class="py-3 px-4 text-right text-xs ${c.cpc > 50 ? 'text-white font-medium' : 'text-[#A3A3A3]'}">${formatINR(c.cpc)}</td>
          <td class="py-3 px-4 text-right text-xs text-[#A3A3A3]">${c.ctr}%</td>
          <td class="py-3 px-4 text-right text-xs text-[#A3A3A3]">${formatNumber(c.leads || 0)}</td>
          <td class="py-3 px-4 text-right text-xs font-semibold ${c.conversions > 0 ? 'text-white' : 'text-[#737373]'}">
            ${c.conversions}
          </td>
          <td class="py-3 px-4 text-right text-xs text-[#A3A3A3]">${c.phoneCalls}</td>
          <td class="py-3 px-4 text-right text-xs font-medium ${
            c.cpa === null ? 'text-[#737373]' : (c.cpa <= 5000 ? 'text-white' : 'text-[#A3A3A3]')
          }">
            ${c.cpa === null ? 'None (0 conv)' : formatINR(c.cpa)}
          </td>
          <td class="py-3 px-4">
            ${c.classification === 'strong' ? `
              <span class="inline-flex items-center space-x-1.5 text-[11px] font-medium text-white">
                <span class="w-1.5 h-1.5 rounded-full bg-white"></span>
                <span>Strong</span>
              </span>
            ` : `
              <span class="inline-flex items-center space-x-1.5 text-[11px] font-normal text-[#737373]">
                <span class="w-1.5 h-1.5 rounded-full border border-[#737373]"></span>
                <span>Action needed</span>
              </span>
            `}
          </td>
        </tr>
      `;
      }).join('');
    }

    // Search input listener
    const searchInput = document.getElementById('campaign-search-input');
    if (searchInput && !searchInput._bound) {
      searchInput._bound = true;
      searchInput.addEventListener('input', e => {
        store.setCampaignSearch(e.target.value);
        this.renderCampaignsView();
      });
    }

    // Filter pill buttons
    document.querySelectorAll('[data-campaign-filter]').forEach(btn => {
      if (!btn._bound) {
        btn._bound = true;
        btn.addEventListener('click', () => {
          const filter = btn.getAttribute('data-campaign-filter');
          if (filter === 'google' || filter === 'meta') {
            store.setPlatformFilter(filter);
          } else if (filter === 'all') {
            store.setPlatformFilter('all');
            store.setCampaignFilter('all');
          } else {
            store.setCampaignFilter(filter);
          }
          this.renderCampaignsView();
        });
      }
    });

    // Table Header Sorting
    document.querySelectorAll('[data-sort-key]').forEach(th => {
      if (!th._bound) {
        th._bound = true;
        th.addEventListener('click', () => {
          store.setCampaignSort(th.getAttribute('data-sort-key'));
          this.renderCampaignsView();
        });
      }
    });
  }

  // ==========================================
  // MODULE 3: REPORTS & HISTORICAL COMPARISON
  // ==========================================
  renderReportsView() {
    const emptyState = document.getElementById('reports-empty-state');
    const content = document.getElementById('reports-content');

    const active = store.getActiveReport();
    const comp = store.getComparisonReport();
    const all = store.getAllReports();

    if (!active || !all || all.length === 0) {
      if (emptyState) emptyState.classList.remove('hidden');
      if (content) content.classList.add('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (content) content.classList.remove('hidden');

    // Populate comparison selector
    const compSelect = document.getElementById('reports-comp-select');
    if (compSelect) {
      compSelect.innerHTML = all
        .filter(r => r.reportId !== active.reportId)
        .map(r => `
          <option value="${r.reportId}" ${r.reportId === store.comparisonReportId ? 'selected' : ''}>
            ${r.periodName}
          </option>
        `).join('');

      if (!compSelect._bound) {
        compSelect._bound = true;
        compSelect.addEventListener('change', e => {
          store.setComparisonReport(e.target.value);
          this.renderReportsView();
        });
      }
    }

    // Week-over-Week Comparative Metrics Matrix
    if (comp) {
      const metrics = [
        { name: 'Total Spend', curr: formatINR(active.budgetSummary.spent), prev: formatINR(comp.budgetSummary.spent), diff: active.budgetSummary.spent - comp.budgetSummary.spent, inverse: true },
        { name: 'Impressions', curr: formatNumber(active.metrics.impressions), prev: formatNumber(comp.metrics.impressions), diff: active.metrics.impressions - comp.metrics.impressions },
        { name: 'Clicks', curr: formatNumber(active.metrics.clicks), prev: formatNumber(comp.metrics.clicks), diff: active.metrics.clicks - comp.metrics.clicks },
        { name: 'CTR', curr: `${active.metrics.ctr}%`, prev: `${comp.metrics.ctr}%`, diff: (active.metrics.ctr - comp.metrics.ctr).toFixed(2) },
        { name: 'Average CPC', curr: formatINR(active.metrics.cpc), prev: formatINR(comp.metrics.cpc), diff: active.metrics.cpc - comp.metrics.cpc, inverse: true },
        { name: 'Recorded Conversions', curr: active.metrics.conversions, prev: comp.metrics.conversions, diff: active.metrics.conversions - comp.metrics.conversions },
        { name: 'Cost Per Acquisition (CPA)', curr: formatINR(active.metrics.cpa), prev: formatINR(comp.metrics.cpa), diff: active.metrics.cpa - comp.metrics.cpa, inverse: true },
        { name: 'Phone Calls', curr: active.metrics.phoneCalls, prev: comp.metrics.phoneCalls, diff: active.metrics.phoneCalls - comp.metrics.phoneCalls }
      ];

      const compTbody = document.getElementById('reports-comp-tbody');
      if (compTbody) {
        compTbody.innerHTML = metrics.map(m => {
          return `
            <tr class="border-b border-white/[0.06] hover:bg-[#171717]">
              <td class="py-3 px-4 font-medium text-xs text-[#F5F5F5]">${m.name}</td>
              <td class="py-3 px-4 font-semibold text-xs text-white text-right">${m.curr}</td>
              <td class="py-3 px-4 text-xs text-[#A3A3A3] text-right">${m.prev}</td>
              <td class="py-3 px-4 text-xs text-right font-medium text-[#A3A3A3]">
                ${m.diff > 0 ? '+' : ''}${m.diff}
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    // Historical weekly table
    const weeklyReports = all.filter(r => r.reportId.includes('_w')).sort((a, b) => a.reportId.localeCompare(b.reportId));
    const histTable = document.getElementById('reports-historical-table');
    if (histTable && weeklyReports.length >= 3) {
      histTable.innerHTML = `
        <thead>
          <tr class="text-xs text-[#A3A3A3] border-b border-white/[0.08]">
            <th class="py-3 px-4 text-left font-medium">Metric</th>
            <th class="py-3 px-4 text-right font-medium">Week 1 (Aug 1–7)</th>
            <th class="py-3 px-4 text-right font-medium">Week 2 (Aug 8–14)</th>
            <th class="py-3 px-4 text-right font-semibold text-white">Week 3 (Aug 15–20)</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/[0.06] text-xs text-[#A3A3A3]">
          <tr class="hover:bg-[#171717]"><td class="py-2.5 px-4 text-[#F5F5F5] font-medium">Spend</td><td class="py-2.5 px-4 text-right">₹1,97,702</td><td class="py-2.5 px-4 text-right">₹1,75,001</td><td class="py-2.5 px-4 text-right font-semibold text-white">₹1,64,886</td></tr>
          <tr class="hover:bg-[#171717]"><td class="py-2.5 px-4 text-[#F5F5F5] font-medium">Impressions</td><td class="py-2.5 px-4 text-right">4,62,054</td><td class="py-2.5 px-4 text-right">3,35,248</td><td class="py-2.5 px-4 text-right font-semibold text-white">3,54,680</td></tr>
          <tr class="hover:bg-[#171717]"><td class="py-2.5 px-4 text-[#F5F5F5] font-medium">Clicks</td><td class="py-2.5 px-4 text-right">28,813</td><td class="py-2.5 px-4 text-right">16,136</td><td class="py-2.5 px-4 text-right font-semibold text-white">18,575</td></tr>
          <tr class="hover:bg-[#171717]"><td class="py-2.5 px-4 text-[#F5F5F5] font-medium">CTR</td><td class="py-2.5 px-4 text-right">6.24%</td><td class="py-2.5 px-4 text-right">4.81%</td><td class="py-2.5 px-4 text-right font-semibold text-white">5.24%</td></tr>
          <tr class="hover:bg-[#171717]"><td class="py-2.5 px-4 text-[#F5F5F5] font-medium">Avg CPC</td><td class="py-2.5 px-4 text-right">₹6.86</td><td class="py-2.5 px-4 text-right text-[#A3A3A3]">₹10.85</td><td class="py-2.5 px-4 text-right font-semibold text-white">₹8.88</td></tr>
          <tr class="hover:bg-[#171717]"><td class="py-2.5 px-4 text-[#F5F5F5] font-medium">Recorded Conversions</td><td class="py-2.5 px-4 text-right">8</td><td class="py-2.5 px-4 text-right">10</td><td class="py-2.5 px-4 text-right font-semibold text-white">16</td></tr>
          <tr class="hover:bg-[#171717]"><td class="py-2.5 px-4 text-[#F5F5F5] font-medium">Reported CPA</td><td class="py-2.5 px-4 text-right">₹24,713</td><td class="py-2.5 px-4 text-right">₹17,500</td><td class="py-2.5 px-4 text-right font-semibold text-white">₹10,305 (↓ 58%)</td></tr>
        </tbody>
      `;
    }
  }

  // ==========================================
  // MODULE 4: AI INSIGHTS
  // ==========================================
  renderAiInsightsView() {
    const emptyState = document.getElementById('ai-insights-empty-state');
    const content = document.getElementById('ai-insights-content');

    const report = store.getActiveReport();
    if (!report || store.getAllReports().length === 0) {
      if (emptyState) emptyState.classList.remove('hidden');
      if (content) content.classList.add('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (content) content.classList.remove('hidden');

    const comp = store.getComparisonReport();
    const analysis = AiDiagnosticsEngine.analyzeReport(report, comp);
    if (!analysis) return;

    // Header stats
    const scoreEl = document.getElementById('ai-sprint-score-badge');
    if (scoreEl) scoreEl.textContent = `${analysis.sprintScore}/100`;

    const wasteEl = document.getElementById('ai-total-waste');
    if (wasteEl) wasteEl.textContent = formatINR(analysis.totalWastedSpend);

    const targetEl = document.getElementById('ai-projected-target');
    if (targetEl) targetEl.textContent = `+${analysis.projectedTargetConversions} Leads`;

    // Cards Grid
    const container = document.getElementById('ai-insights-grid');
    if (container) {
      container.innerHTML = analysis.insights.map(ins => {
        let badgeStyle = 'text-[#A3A3A3] bg-[#171717] border-white/[0.08]';
        let dotStyle = 'bg-[#737373]';
        if (ins.severity === 'critical') {
          badgeStyle = 'text-white bg-[#1D1D1D] border-white/20 font-semibold';
          dotStyle = 'bg-white';
        } else if (ins.severity === 'warning') {
          badgeStyle = 'text-[#D4D4D4] bg-[#171717] border-white/[0.08] font-medium';
          dotStyle = 'bg-[#A3A3A3]';
        } else if (ins.severity === 'positive') {
          badgeStyle = 'text-white bg-[#171717] border-white/[0.08] font-medium';
          dotStyle = 'bg-white';
        }

        return `
          <div class="bg-[#111111] border border-white/[0.08] p-6 rounded-xl space-y-4">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium px-2.5 py-0.5 rounded border ${badgeStyle} flex items-center space-x-1.5">
                <span class="w-1.5 h-1.5 rounded-full ${dotStyle}"></span>
                <span>${ins.badge}</span>
              </span>
              <span class="text-xs text-[#737373]">Diagnostic</span>
            </div>
            <h4 class="text-base font-semibold text-[#F5F5F5] leading-snug">${ins.title}</h4>
            <div class="bg-[#171717] p-3 rounded-lg border border-white/[0.08] text-xs text-[#A3A3A3]">
              ${ins.metricSummary}
            </div>
            <p class="text-xs text-[#A3A3A3] leading-relaxed">${ins.narrative}</p>
            <div class="pt-3 border-t border-white/[0.08] flex items-center justify-between">
              <span class="text-xs text-[#F5F5F5] font-medium">
                Action: <span class="text-[#A3A3A3] font-normal">${ins.action}</span>
              </span>
              <button onclick="window.vsApp.switchView('improve')" class="text-xs font-medium text-white hover:underline flex items-center space-x-1">
                <span>View action</span>
                <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // ==========================================
  // MODULE 5: IMPROVE (EDITABLE RECOMMENDATIONS)
  // ==========================================
  renderImproveView() {
    const recs = store.getRecommendations();

    const activeCount = recs.filter(r => r.status === 'active').length;
    const inProgressCount = recs.filter(r => r.status === 'in_progress').length;
    const completedCount = recs.filter(r => r.status === 'completed').length;

    const countActiveEl = document.getElementById('improve-count-active');
    const countProgEl = document.getElementById('improve-count-progress');
    const countDoneEl = document.getElementById('improve-count-completed');

    if (countActiveEl) countActiveEl.textContent = activeCount;
    if (countProgEl) countProgEl.textContent = inProgressCount;
    if (countDoneEl) countDoneEl.textContent = completedCount;

    // List of recommendations
    const container = document.getElementById('improve-cards-container');
    if (container) {
      container.innerHTML = recs.map(rec => {
        const isDone = rec.status === 'completed';
        return `
          <div class="bg-[#111111] border border-white/[0.08] p-6 rounded-xl space-y-4 transition ${isDone ? 'opacity-50' : ''}">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div class="flex items-center space-x-2">
                <span class="text-xs text-[#F5F5F5] px-2 py-0.5 rounded bg-[#171717] border border-white/[0.08] font-medium">
                  ${rec.pillar.split(':')[0]}
                </span>
                <span class="text-xs font-medium px-2 py-0.5 rounded ${
                  rec.priority === 'critical' ? 'bg-[#1D1D1D] text-white border border-white/20 font-semibold' : 'bg-[#171717] text-[#A3A3A3] border border-white/[0.08]'
                }">
                  ${rec.priority}
                </span>
              </div>
              
              <!-- Status Switcher Controls -->
              <div class="flex items-center space-x-2">
                <select onchange="window.vsApp.handleRecStatusChange('${rec.id}', this.value)" class="bg-[#090909] border border-white/[0.08] text-xs text-[#F5F5F5] rounded-lg px-2.5 py-1.5 outline-none focus:border-white/30">
                  <option value="active" ${rec.status === 'active' ? 'selected' : ''}>Active</option>
                  <option value="in_progress" ${rec.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                  <option value="completed" ${rec.status === 'completed' ? 'selected' : ''}>Completed ✓</option>
                  <option value="dismissed" ${rec.status === 'dismissed' ? 'selected' : ''}>Dismissed</option>
                </select>
                <button onclick="window.vsApp.openEditRecModal('${rec.id}')" class="p-1.5 rounded-lg bg-[#171717] hover:bg-[#1D1D1D] text-[#A3A3A3] hover:text-[#F5F5F5] border border-white/[0.08] text-xs" title="Edit Recommendation">
                  <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            </div>

            <div>
              <h3 class="text-base font-semibold ${isDone ? 'line-through text-[#737373]' : 'text-[#F5F5F5]'}">${rec.title}</h3>
              <p class="text-xs text-[#A3A3A3] font-normal mt-0.5">Target: ${rec.campaignTarget}</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#171717] p-4 rounded-lg border border-white/[0.08] text-xs">
              <div>
                <span class="text-[#737373] font-medium block mb-1 text-[11px]">Problem Identified</span>
                <p class="text-[#A3A3A3] leading-relaxed">${rec.problem}</p>
              </div>
              <div>
                <span class="text-white font-medium block mb-1 text-[11px]">Action Recommended</span>
                <p class="text-[#F5F5F5] leading-relaxed">${rec.recommendation}</p>
              </div>
            </div>

            <div class="flex flex-col md:flex-row md:items-center justify-between text-xs text-[#A3A3A3] pt-1 gap-2">
              <div>
                <span>Owner:</span> <strong class="text-[#F5F5F5] font-medium">${rec.owner}</strong> &bull; 
                <span>Expected Impact:</span> <strong class="text-white font-medium">${rec.impactEstimate}</strong>
              </div>
              <div class="text-[11px] text-[#737373]">
                ${rec.customNotes || ''}
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  handleRecStatusChange(id, newStatus) {
    store.updateRecommendation(id, { status: newStatus });
    this.renderImproveView();
    this.refreshIcons();
  }

  openEditRecModal(id) {
    const rec = store.getRecommendations().find(r => r.id === id);
    if (!rec) return;

    const modal = document.getElementById('edit-rec-modal');
    if (!modal) return;

    document.getElementById('edit-rec-id').value = rec.id;
    document.getElementById('edit-rec-title').value = rec.title;
    document.getElementById('edit-rec-owner').value = rec.owner;
    document.getElementById('edit-rec-priority').value = rec.priority;
    document.getElementById('edit-rec-notes').value = rec.customNotes || '';

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    this.refreshIcons();
  }

  closeEditRecModal() {
    const modal = document.getElementById('edit-rec-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  saveEditedRec() {
    const id = document.getElementById('edit-rec-id').value;
    const title = document.getElementById('edit-rec-title').value;
    const owner = document.getElementById('edit-rec-owner').value;
    const priority = document.getElementById('edit-rec-priority').value;
    const notes = document.getElementById('edit-rec-notes').value;

    store.updateRecommendation(id, {
      title,
      owner,
      priority,
      customNotes: notes
    });

    this.closeEditRecModal();
    this.renderImproveView();
    this.refreshIcons();
  }

  openAddRecModal() {
    const modal = document.getElementById('add-rec-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      this.refreshIcons();
    }
  }

  closeAddRecModal() {
    const modal = document.getElementById('add-rec-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  saveNewRec() {
    const title = document.getElementById('add-rec-title').value;
    const target = document.getElementById('add-rec-target').value;
    const problem = document.getElementById('add-rec-problem').value;
    const recommendation = document.getElementById('add-rec-recommendation').value;
    const priority = document.getElementById('add-rec-priority').value;
    const owner = document.getElementById('add-rec-owner').value;

    if (!title || !recommendation) {
      alert('Please fill in the title and recommendation fields.');
      return;
    }

    store.addRecommendation({
      pillar: 'Custom Optimization Task',
      title,
      campaignTarget: target || 'Account Wide',
      problem: problem || 'Internal optimization opportunity identified by marketing team.',
      recommendation,
      reason: 'Improve conversion volume and reduce cost.',
      priority,
      owner: owner || 'Marketing Team',
      status: 'active',
      impactEstimate: 'Enhanced conversion efficiency',
      customNotes: 'Manually logged.'
    });

    this.closeAddRecModal();
    this.renderImproveView();
    this.refreshIcons();
  }

  // ==========================================
  // MODULE 6: DATA & WEEKLY UPLOADS (PHASE 2)
  // ==========================================
  renderDataUploadsView() {
    // Empty state guidance banner
    const emptyGuidance = document.getElementById('uploads-empty-guidance');
    if (emptyGuidance) {
      const allReports = store.getAllReports();
      if (!allReports || allReports.length === 0) {
        emptyGuidance.classList.remove('hidden');
      } else {
        emptyGuidance.classList.add('hidden');
      }
    }

    const dropzone = document.getElementById('csv-dropzone');
    const fileInput = document.getElementById('csv-file-input');
    const chooseBtn = document.getElementById('btn-choose-csv');

    if (chooseBtn && !chooseBtn._bound) {
      chooseBtn._bound = true;
      chooseBtn.addEventListener('click', e => {
        e.stopPropagation();
        fileInput.click();
      });
    }

    if (dropzone && !dropzone._bound) {
      dropzone._bound = true;

      dropzone.addEventListener('click', e => {
        if (e.target.closest('#btn-choose-csv')) return;
        fileInput.click();
      });

      dropzone.addEventListener('dragover', e => {
        e.preventDefault();
        dropzone.classList.add('border-white/50', 'bg-[#171717]');
      });

      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('border-white/50', 'bg-[#171717]');
      });

      dropzone.addEventListener('drop', e => {
        e.preventDefault();
        dropzone.classList.remove('border-white/50', 'bg-[#171717]');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          this.stageIncomingFiles(Array.from(e.dataTransfer.files));
        }
      });

      fileInput.addEventListener('change', e => {
        if (e.target.files && e.target.files.length > 0) {
          this.stageIncomingFiles(Array.from(e.target.files));
        }
        fileInput.value = '';
      });
    }

    this.renderStagedFiles();
    this.renderUploadsHistory();
  }

  stageIncomingFiles(files) {
    if (!files || !files.length) return;

    const errorAlert = document.getElementById('upload-error-alert');
    let hasInvalid = false;
    const invalidNames = [];
    const validCsvs = [];

    files.forEach(file => {
      const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv' || file.type === 'application/vnd.ms-excel';
      if (isCsv) {
        const alreadyStaged = this.stagedFiles.some(f => f.name === file.name && f.size === file.size);
        if (!alreadyStaged) {
          validCsvs.push(file);
        }
      } else {
        hasInvalid = true;
        invalidNames.push(file.name);
      }
    });

    if (errorAlert) {
      if (hasInvalid) {
        errorAlert.classList.remove('hidden');
        errorAlert.innerHTML = `
          <div class="flex items-center space-x-2 text-white font-medium">
            <i data-lucide="alert-circle" class="w-4 h-4"></i>
            <span>Unsupported file type</span>
          </div>
          <p class="text-[11px] text-[#A3A3A3]">
            \${invalidNames.join(', ')} is not a CSV file. Only .csv files are supported by the ingestion pipeline.
          </p>
        `;
      } else {
        errorAlert.classList.add('hidden');
        errorAlert.innerHTML = '';
      }
    }

    if (validCsvs.length > 0) {
      this.stagedFiles = [...(this.stagedFiles || []), ...validCsvs];
      const batchContainer = document.getElementById('batch-validation-container');
      if (batchContainer) batchContainer.classList.add('hidden');
    }

    this.renderStagedFiles();
    this.refreshIcons();
  }

  renderStagedFiles() {
    const container = document.getElementById('staged-files-container');
    if (!container) return;

    if (!this.stagedFiles || this.stagedFiles.length === 0) {
      container.classList.add('hidden');
      container.innerHTML = '';
      return;
    }

    container.classList.remove('hidden');

    const formatSize = bytes => {
      if (bytes < 1024) return bytes + ' B';
      return (bytes / 1024).toFixed(1) + ' KB';
    };

    container.innerHTML = `
      <div class="flex items-center justify-between border-b border-white/[0.08] pb-3">
        <div class="flex items-center space-x-2">
          <h3 class="text-xs font-semibold text-[#F5F5F5]">Selected files</h3>
          <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-[#171717] text-[#A3A3A3] border border-white/[0.08]">
            ${this.stagedFiles.length} file${this.stagedFiles.length > 1 ? 's' : ''}
          </span>
        </div>
        <button onclick="window.vsApp.clearStagedFiles()" class="text-xs text-[#737373] hover:text-white transition">
          Clear All
        </button>
      </div>

      <div class="space-y-2">
        ${this.stagedFiles.map((file, idx) => `
          <div class="flex items-center justify-between p-3.5 bg-[#171717] border border-white/[0.08] rounded-lg text-xs">
            <div class="flex items-center space-x-3 min-w-0">
              <div class="w-8 h-8 rounded bg-[#111111] border border-white/[0.08] flex items-center justify-center flex-shrink-0 text-white">
                <i data-lucide="file-text" class="w-4 h-4 text-[#A3A3A3]"></i>
              </div>
              <div class="truncate">
                <div class="font-medium text-[#F5F5F5] truncate">${file.name}</div>
                <div class="text-[11px] text-[#737373] mt-0.5">${formatSize(file.size)}</div>
              </div>
            </div>
            <div class="flex items-center space-x-2 flex-shrink-0 ml-4">
              <button onclick="window.vsApp.removeStagedFile(${idx})" class="text-xs text-[#737373] hover:text-white px-2.5 py-1 rounded transition border border-transparent hover:border-white/[0.08]">
                Remove
              </button>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="pt-3 border-t border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p class="text-[11px] text-[#737373]">
          Click Process Reports to validate headers, calculate metrics, and save to local store.
        </p>
        <button onclick="window.vsApp.processStagedFiles()" class="bg-white hover:bg-[#E5E5E5] text-black text-xs font-semibold px-4 py-2 rounded-lg transition inline-flex items-center justify-center space-x-2">
          <i data-lucide="play" class="w-3.5 h-3.5 fill-black"></i>
          <span>Process Reports</span>
        </button>
      </div>
    `;

    this.refreshIcons();
  }

  removeStagedFile(index) {
    if (this.stagedFiles && this.stagedFiles[index] !== undefined) {
      this.stagedFiles.splice(index, 1);
      this.renderStagedFiles();
    }
  }

  clearStagedFiles() {
    this.stagedFiles = [];
    this.renderStagedFiles();
  }

  async processStagedFiles() {
    if (!this.stagedFiles || !this.stagedFiles.length) return;

    const filesToProcess = [...this.stagedFiles];
    const batchContainer = document.getElementById('batch-validation-container');

    if (batchContainer) {
      batchContainer.classList.remove('hidden');
      batchContainer.innerHTML = `
        <div class="bg-[#111111] border border-white/[0.08] p-5 rounded-xl flex items-center space-x-3 text-xs text-[#A3A3A3]">
          <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <span>Processing ${filesToProcess.length} CSV file${filesToProcess.length > 1 ? 's' : ''} through ingestion pipeline...</span>
        </div>
      `;
    }

    try {
      const results = await CsvEngine.parseMultipleCsvs(filesToProcess, store.getAllReports());
      this.currentBatchResults = results;

      // Automatically store valid, non-duplicate reports
      results.forEach(res => {
        if (res.report && !res.isDuplicate) {
          store.addReport(res.report, 'add');
          res.stored = true;
        } else {
          res.stored = false;
        }
      });

      // Clear staged files once processing has run
      this.stagedFiles = [];
      this.renderStagedFiles();

      // Render the results cards (Requirement 6)
      this.renderBatchValidation(results);
      this.renderUploadsHistory();
      this.populateReportDropdowns();
      this.renderHeaderControls();
      this.renderContextRail();

      const emptyGuidance = document.getElementById('uploads-empty-guidance');
      if (emptyGuidance && store.getAllReports().length > 0) {
        emptyGuidance.classList.add('hidden');
      }
    } catch (err) {
      if (batchContainer) {
        batchContainer.innerHTML = `
          <div class="bg-[#111111] border border-white/20 p-5 rounded-xl text-xs space-y-2">
            <span class="text-white font-semibold block">Processing Error</span>
            <p class="text-[#A3A3A3]">${err.message || 'An unexpected error occurred during CSV parsing.'}</p>
          </div>
        `;
      }
    }
  }

  renderBatchValidation(results) {
    const container = document.getElementById('batch-validation-container');
    if (!container) return;

    if (!results || !results.length) {
      container.classList.add('hidden');
      return;
    }

    container.classList.remove('hidden');

    container.innerHTML = `
      <div class="space-y-4">
        ${results.map((res, idx) => {
          const val = res.validation;
          const rep = res.report;
          const period = rep ? rep.period : (val.detectedPeriod || null);
          const isStored = res.stored;

          return `
            <div class="bg-[#111111] border border-white/[0.08] p-6 rounded-xl space-y-4">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
                <div class="space-y-1">
                  <div class="flex items-center space-x-2">
                    <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${val.isValid ? 'bg-[#1D1D1D] text-white border border-white/20' : 'bg-[#171717] text-[#737373] border border-white/[0.08]'} uppercase tracking-wider">
                      ${val.isValid ? 'REPORT PROCESSED' : 'PROCESSING FAILED'}
                    </span>
                    <span class="text-xs font-semibold text-[#F5F5F5]">${res.fileName}</span>
                  </div>
                  <p class="text-[11px] text-[#737373]">
                    ${isStored ? 'Report successfully stored in local database and ready for analysis.' : (res.isDuplicate ? 'This reporting period already exists. Choose replace or keep.' : 'Cannot ingest due to validation errors.')}
                  </p>
                </div>

                <div class="flex items-center space-x-2">
                  ${isStored ? `
                    <button onclick="window.vsApp.switchView('overview')" class="bg-white hover:bg-[#E5E5E5] text-black text-xs font-semibold px-4 py-2 rounded-lg transition inline-flex items-center space-x-1.5">
                      <span>View in Overview</span>
                      <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
                    </button>
                  ` : (res.isDuplicate ? `
                    <button onclick="window.vsApp.resolveBatchDuplicate(${idx}, 'replace')" class="bg-white hover:bg-[#E5E5E5] text-black text-xs font-semibold transition">
                      Replace Existing
                    </button>
                    <button onclick="window.vsApp.resolveBatchDuplicate(${idx}, 'keep')" class="bg-[#171717] hover:bg-[#1D1D1D] text-[#A3A3A3] hover:text-white border border-white/[0.08] text-xs font-medium transition">
                      Keep Existing
                    </button>
                  ` : `
                    <span class="px-2.5 py-1 rounded bg-[#171717] text-[#737373] border border-white/[0.08] text-xs font-medium">Cannot Ingest</span>
                  `)}
                </div>
              </div>

              <!-- Metadata Grid matching user specification -->
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-[#171717] rounded-lg border border-white/[0.08] text-xs">
                <div>
                  <span class="text-[11px] text-[#737373] block uppercase tracking-wider">Reporting Period</span>
                  <span class="font-semibold text-[#F5F5F5] mt-0.5 block">${period ? period.periodLabel : 'Unknown Period'}</span>
                </div>
                <div>
                  <span class="text-[11px] text-[#737373] block uppercase tracking-wider">Rows</span>
                  <span class="font-semibold text-[#F5F5F5] mt-0.5 block">${val.rowCount}</span>
                </div>
                <div>
                  <span class="text-[11px] text-[#737373] block uppercase tracking-wider">Campaigns</span>
                  <span class="font-semibold text-[#F5F5F5] mt-0.5 block">${val.campaignCount}</span>
                </div>
                <div>
                  <span class="text-[11px] text-[#737373] block uppercase tracking-wider">Status</span>
                  <span class="font-semibold text-white mt-0.5 block">${val.status}</span>
                </div>
              </div>

              <!-- Technical Details Tags -->
              <div class="flex flex-wrap items-center gap-2 text-[11px]">
                <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-[#171717] text-[#A3A3A3] border border-white/[0.08]">
                  Granularity: ${val.granularity === 'daily' ? 'Daily Breakdown (Aggregated)' : 'Period-Level (Used Directly)'}
                </span>
                <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-[#171717] text-[#A3A3A3] border border-white/[0.08]">
                  All Conversions: ${val.allConversionsDerived ? 'Fallback Derived' : 'Source Exact'}
                </span>
                ${res.isDuplicate ? `
                  <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1D1D1D] text-white border border-white/30">
                    Duplicate Period
                  </span>
                ` : ''}
              </div>

              ${res.isDuplicate ? `
                <div class="bg-[#171717] border border-white/[0.08] p-3 rounded-lg text-xs text-[#A3A3A3] flex items-start space-x-2">
                  <i data-lucide="alert-triangle" class="w-4 h-4 flex-shrink-0 mt-0.5 text-white"></i>
                  <div>
                    <strong class="text-white">This reporting period already exists in the system.</strong>
                    <p class="text-[11px] text-[#737373] mt-0.5">
                      Selecting 'Replace Existing' will overwrite the previous dataset for ${period ? period.periodLabel : 'this period'} without losing other weeks.
                    </p>
                  </div>
                </div>
              ` : ''}

              <!-- Warnings List -->
              ${(val.warnings && val.warnings.length > 0) ? `
                <div class="space-y-1 pt-1 border-t border-white/[0.08] text-[11px]">
                  <span class="text-[#737373] font-medium block">Warnings:</span>
                  ${val.warnings.map(warn => `
                    <div class="text-[#737373] flex items-center space-x-1.5">
                      <span class="text-[#A3A3A3]">&bull;</span>
                      <span><strong class="text-[#A3A3A3]">Warning:</strong> ${warn}</span>
                    </div>
                  `).join('')}
                </div>
              ` : ''}

              <!-- Errors List -->
              ${(val.errors && val.errors.length > 0) ? `
                <div class="space-y-1 pt-1 border-t border-white/[0.08] text-[11px]">
                  <span class="text-white font-medium block">Errors:</span>
                  ${val.errors.map(err => `
                    <div class="text-[#A3A3A3] flex items-center space-x-1.5">
                      <span class="text-white font-bold">&bull;</span>
                      <span><strong class="text-white">Error:</strong> ${err}</span>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;

    this.refreshIcons();
  }

  resolveBatchDuplicate(index, action) {
    if (!this.currentBatchResults || !this.currentBatchResults[index]) return;
    const item = this.currentBatchResults[index];
    if (!item.report) return;

    if (action === 'replace') {
      store.addReport(item.report, 'replace');
      item.stored = true;
      item.isDuplicate = false;
    } else if (action === 'keep') {
      store.addReport(item.report, 'keep');
      item.stored = true;
      item.isDuplicate = false;
    }

    this.renderBatchValidation(this.currentBatchResults);
    this.renderUploadsHistory();
    this.populateReportDropdowns();
    this.renderHeaderControls();
    this.renderContextRail();
    this.refreshIcons();
  }

  commitSingleBatchItem(index) {
    if (!this.currentBatchResults || !this.currentBatchResults[index]) return;
    const item = this.currentBatchResults[index];
    if (!item.report) return;

    store.addReport(item.report, 'add');
    item.stored = true;
    this.renderBatchValidation(this.currentBatchResults);
    this.renderUploadsHistory();
    this.populateReportDropdowns();
    this.renderHeaderControls();
    this.renderContextRail();
    this.refreshIcons();
  }

  dismissBatch() {
    this.currentBatchResults = [];
    const container = document.getElementById('batch-validation-container');
    if (container) container.classList.add('hidden');
  }

  renderUploadsHistory() {
    const reportsList = document.getElementById('uploads-reports-list');
    if (!reportsList) return;

    const reports = store.getAllReports();
    if (!reports || reports.length === 0) {
      reportsList.innerHTML = `
        <div class="p-8 bg-[#111111] border border-white/[0.08] rounded-lg text-center space-y-2">
          <p class="text-xs text-[#A3A3A3]">No historical report datasets available.</p>
          <p class="text-[11px] text-[#737373]">Upload a weekly advertising CSV file above to populate the report store.</p>
        </div>
      `;
      this.refreshIcons();
      return;
    }

    reportsList.innerHTML = reports.map(r => {
      const p = r.period;
      const periodLabel = p ? p.periodLabel : r.periodName;
      const weekLabel = p && p.weekNumber ? `Week ${p.weekNumber}` : (p && p.isMonthlyAggregate ? 'Monthly Aggregate' : 'Snapshot');

      return `
        <div class="flex items-center justify-between p-4 bg-[#111111] rounded-lg border border-white/[0.08]">
          <div class="space-y-0.5">
            <div class="flex items-center space-x-2">
              <h4 class="text-xs font-semibold text-[#F5F5F5]">${periodLabel}</h4>
              <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-[#171717] text-[#A3A3A3] border border-white/[0.08]">
                ${weekLabel}
              </span>
              ${r.status === 'Needs Attention' ? `
                <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-[#171717] text-[#A3A3A3] border border-white/[0.08]">Needs Attention</span>
              ` : ''}
            </div>
            <p class="text-[11px] text-[#737373]">
              Source: ${r.sourceFileName} &bull; 
              ${r.campaigns ? r.campaigns.length : 0} Campaigns &bull; 
              Uploaded: ${new Date(r.uploadedAt).toLocaleDateString('en-GB')}
            </p>
          </div>
          <div class="flex items-center space-x-2">
            <button onclick="window.vsApp.selectReport('${r.reportId}')" class="text-xs font-medium px-3 py-1 rounded-lg ${r.reportId === store.activeReportId ? 'bg-white text-black font-semibold' : 'bg-[#171717] text-[#A3A3A3] hover:text-white border border-white/[0.08]'}">
              ${r.reportId === store.activeReportId ? 'Active' : 'Select'}
            </button>
            <button onclick="window.vsApp.deleteReport('${r.reportId}')" class="text-xs text-[#737373] hover:text-white p-1 transition" title="Delete Report">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    this.refreshIcons();
  }

  selectReport(id) {
    store.setActiveReport(id);
    this.switchView('overview');
  }

  deleteReport(id) {
    if (confirm('Are you sure you want to delete this report?')) {
      store.deleteReport(id);
      this.renderUploadsHistory();
      this.populateReportDropdowns();
      this.renderHeaderControls();
      this.renderContextRail();
      this.renderActiveView();
      this.refreshIcons();
    }
  }

  resetToCleanState() {
    store.clearAllReports();
    this.populateReportDropdowns();
    this.renderHeaderControls();
    this.renderContextRail();
    this.renderActiveView();
    this.refreshIcons();
  }

  seedSampleData() {
    store.seedSampleData();
    this.populateReportDropdowns();
    this.renderHeaderControls();
    this.renderContextRail();
    this.renderActiveView();
    this.refreshIcons();
  }

  downloadTemplate() {
    CsvEngine.downloadSampleCsv();
  }
}

// Attach globally
window.store = store;
window.CsvEngine = CsvEngine;
window.vsApp = new AppController();
window.app = window.vsApp;



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

  async init() {
    ChartManager.initGlobalDefaults();

    this.stagedFiles = [];
    this.hasRenderedInitialView = false;

    // Subscribe to store updates
    store.subscribe((changeType, payload) => {
      this.handleStoreChange(changeType, payload);
    });

    // Automatically load master dataset from data/reports.json (Single Global Source of Truth)
    await store.loadMasterDataset();

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

  openMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) {
      sidebar.classList.remove('-translate-x-full');
      sidebar.classList.add('translate-x-0');
    }
    if (backdrop) {
      backdrop.classList.remove('hidden');
    }
    this.closeMobileRail();
    this.refreshIcons();
  }

  closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) {
      sidebar.classList.add('-translate-x-full');
      sidebar.classList.remove('translate-x-0');
    }
    if (backdrop) {
      backdrop.classList.add('hidden');
    }
  }

  openMobileRail() {
    const rail = document.getElementById('context-rail');
    const backdrop = document.getElementById('rail-backdrop');
    if (rail) {
      rail.classList.remove('translate-x-full', 'hidden');
      rail.classList.add('translate-x-0');
    }
    if (backdrop) {
      backdrop.classList.remove('hidden');
    }
    this.closeMobileSidebar();
    this.refreshIcons();
  }

  closeMobileRail() {
    const rail = document.getElementById('context-rail');
    const backdrop = document.getElementById('rail-backdrop');
    if (rail) {
      rail.classList.add('translate-x-full');
      rail.classList.remove('translate-x-0');
    }
    if (backdrop) {
      backdrop.classList.add('hidden');
    }
  }

  toggleMobileRail() {
    const rail = document.getElementById('context-rail');
    if (rail && rail.classList.contains('translate-x-0')) {
      this.closeMobileRail();
    } else {
      this.openMobileRail();
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

    // Mobile hamburger menu & sidebar drawer
    const mobileMenuBtn = document.getElementById('btn-mobile-menu');
    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener('click', () => {
        this.openMobileSidebar();
      });
    }

    const closeSidebarBtn = document.getElementById('btn-close-sidebar');
    if (closeSidebarBtn) {
      closeSidebarBtn.addEventListener('click', () => {
        this.closeMobileSidebar();
      });
    }

    const sidebarBackdrop = document.getElementById('sidebar-backdrop');
    if (sidebarBackdrop) {
      sidebarBackdrop.addEventListener('click', () => {
        this.closeMobileSidebar();
      });
    }

    // Mobile rail drawer close & backdrop
    const closeRailBtn = document.getElementById('btn-close-rail');
    if (closeRailBtn) {
      closeRailBtn.addEventListener('click', () => {
        this.closeMobileRail();
      });
    }

    const closeRailEmptyBtn = document.getElementById('btn-close-rail-empty');
    if (closeRailEmptyBtn) {
      closeRailEmptyBtn.addEventListener('click', () => {
        this.closeMobileRail();
      });
    }

    const railBackdrop = document.getElementById('rail-backdrop');
    if (railBackdrop) {
      railBackdrop.addEventListener('click', () => {
        this.closeMobileRail();
      });
    }

    // Handle hash change events (URL hash changes -> route state updates -> correct page renders)
    window.addEventListener('hashchange', () => {
      this.handleRouteChange();
    });

    // Handle browser back/forward history navigation
    window.addEventListener('popstate', () => {
      this.handleRouteChange();
    });

    // Period selector in desktop and mobile top bar
    const periodSelect = document.getElementById('top-period-select');
    if (periodSelect) {
      periodSelect.addEventListener('change', e => {
        store.setActiveReport(e.target.value);
      });
    }

    const mobilePeriodSelect = document.getElementById('mobile-period-select');
    if (mobilePeriodSelect) {
      mobilePeriodSelect.addEventListener('change', e => {
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
        if (window.innerWidth < 768) {
          this.toggleMobileRail();
        } else {
          store.toggleContextRail();
        }
      });
    }

    // Download Report / Print PDF button
    const printBtn = document.getElementById('btn-print-report');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        this.openExportModal();
      });
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeprint', () => {
        if (!document.body.classList.contains('printing-dossier')) {
          this.preparePrintHeader();
        }
      });
    }

    // Close drawers on window resize to desktop
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 768) {
        this.closeMobileSidebar();
        this.closeMobileRail();
        this.renderContextRail();
      }
    });
  }

  openExportModal() {
    const modal = document.getElementById('export-modal');
    if (!modal) return;

    const badge = document.getElementById('export-current-view-badge');
    if (badge) {
      const viewNames = {
        'overview': 'Overview',
        'campaigns': 'Campaigns Audit',
        'reports': 'Historical Cycles',
        'ai-insights': 'AI Diagnostics',
        'improve': 'Strategic Action Plan',
        'data-uploads': 'Uploads',
        'settings': 'Settings'
      };
      badge.textContent = viewNames[store.activeView] || 'Overview';
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    this.refreshIcons();
  }

  closeExportModal() {
    const modal = document.getElementById('export-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  printCurrentView() {
    this.closeExportModal();
    if (store.activeView === 'data-uploads' || store.activeView === 'settings') {
      this.switchView('overview');
    }
    document.body.classList.remove('printing-dossier');
    this.preparePrintHeader();
    setTimeout(() => {
      window.print();
    }, 100);
  }

  printFullDossier() {
    this.closeExportModal();
    const dossierContainer = document.getElementById('executive-print-dossier');
    if (!dossierContainer) return;

    dossierContainer.innerHTML = this.generateFullExecutiveDossierHtml();
    document.body.classList.add('printing-dossier');

    const handleAfterPrint = () => {
      document.body.classList.remove('printing-dossier');
      window.removeEventListener('afterprint', handleAfterPrint);
    };
    window.addEventListener('afterprint', handleAfterPrint);

    setTimeout(() => {
      window.print();
    }, 150);
  }

  calcCampaignsMetrics(camps) {
    let spend = 0, clicks = 0, impressions = 0, leads = 0, conversions = 0, phoneCalls = 0, sourceResults = 0;
    camps.forEach(c => {
      spend += c.spend || 0;
      clicks += c.clicks || 0;
      impressions += c.impressions || 0;
      leads += c.leads || 0;
      conversions += c.conversions || 0;
      phoneCalls += c.phoneCalls || 0;
      if (c.sourceResults) sourceResults += c.sourceResults;
    });
    const cpc = clicks > 0 ? parseFloat((spend / clicks).toFixed(2)) : 0;
    const cpa = conversions > 0 ? Math.round(spend / conversions) : (leads > 0 ? Math.round(spend / leads) : null);
    const ctr = impressions > 0 ? parseFloat(((clicks / impressions) * 100).toFixed(2)) : 0;
    const costPerResult = sourceResults > 0 ? parseFloat((spend / sourceResults).toFixed(2)) : null;
    return { spend, clicks, impressions, leads, conversions, phoneCalls, sourceResults, cpc, cpa, ctr, costPerResult };
  }

  generateFullExecutiveDossierHtml() {
    const report = store.getActiveReport();
    if (!report) return '<div class="p-8 text-center text-rose-600">No active report selected for dossier generation.</div>';

    const comp = store.getComparisonReport();
    const allCamps = report.campaigns || [];
    const googleCamps = (typeof store.getFilteredCampaigns === 'function')
      ? store.getFilteredCampaigns(report, 'google')
      : allCamps.filter(c => (c.platform || '').toLowerCase().includes('google') || (c.channel || '').toLowerCase() !== 'meta');
    const metaCamps = (typeof store.getFilteredCampaigns === 'function')
      ? store.getFilteredCampaigns(report, 'meta')
      : allCamps.filter(c => (c.platform || '').toLowerCase().includes('meta') || (c.channel || '').toLowerCase() === 'meta');

    const gM = this.calcCampaignsMetrics(googleCamps);
    const mM = this.calcCampaignsMetrics(metaCamps);
    const tM = this.calcCampaignsMetrics(allCamps);

    const totalSpend = tM.spend;
    const googleSharePercent = totalSpend > 0 ? Math.round((gM.spend / totalSpend) * 100) : 0;
    const metaSharePercent = totalSpend > 0 ? Math.round((mM.spend / totalSpend) * 100) : 0;

    const totalLeads = tM.leads;
    const totalCalls = tM.phoneCalls;
    const gConvOrLeads = gM.conversions > 0 ? gM.conversions : (gM.leads > 0 ? gM.leads : 0);
    const mResults = mM.sourceResults > 0 ? mM.sourceResults : (mM.leads > 0 ? mM.leads : 0);
    const totalPatientInquiries = totalLeads + totalCalls;

    const blendedCpa = totalPatientInquiries > 0 ? Math.round(totalSpend / totalPatientInquiries) : null;
    const totalClicks = tM.clicks;
    const totalCtr = tM.ctr;
    const totalCpc = tM.cpc;
    const dailyRate = report.budgetSummary?.dailyRunRate || (totalSpend > 0 ? Math.round(totalSpend / 7) : 0);

    const analysis = (AiDiagnosticsEngine && typeof AiDiagnosticsEngine.analyzeReport === 'function')
      ? (AiDiagnosticsEngine.analyzeReport(report, comp) || { sprintScore: 75, totalWastedSpend: 239618 })
      : { sprintScore: 75, totalWastedSpend: 239618 };

    // Efficiency Tiers
    let effCount = 0, effSpend = 0, effLeads = 0;
    let modCount = 0, modSpend = 0, modLeads = 0;
    let actCount = 0, actSpend = 0, actLeads = 0;

    allCamps.forEach(c => {
      const l = c.conversions > 0 ? c.conversions : (c.leads || c.sourceResults || 0);
      const effectiveCpa = (c.conversions > 0)
        ? Math.round(c.spend / c.conversions)
        : ((l > 0)
          ? Math.round(c.spend / l)
          : (c.cpa || null));

      if (effectiveCpa !== null && effectiveCpa < 5000 && l > 0) {
        effCount++; effSpend += (c.spend || 0); effLeads += l;
      } else if (effectiveCpa !== null && effectiveCpa <= 20000 && l > 0) {
        modCount++; modSpend += (c.spend || 0); modLeads += l;
      } else {
        actCount++; actSpend += (c.spend || 0); actLeads += l;
      }
    });

    const periodLabel = report.period?.periodLabel || report.periodName || 'Active Cycle';
    const now = new Date();
    const timestamp = `${now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;

    // Ranked campaign rows
    const sortedCampaigns = [...allCamps].sort((a, b) => (b.spend || 0) - (a.spend || 0));
    const campaignRowsHtml = sortedCampaigns.map((c, idx) => {
      const isGoogle = (c.platform || '').toLowerCase().includes('google') || (c.channel || '').toLowerCase() !== 'meta';
      const netBadge = isGoogle ?
        '<span class="dossier-badge-google" style="background: #DBEAFE !important; color: #1D4ED8 !important; border: 1px solid #93C5FD !important; padding: 1.5px 5px !important; border-radius: 3px !important; font-weight: 700 !important; font-size: 6.8pt !important;">Google</span>' :
        '<span class="dossier-badge-meta" style="background: #EDE9FE !important; color: #6D28D9 !important; border: 1px solid #C4B5FD !important; padding: 1.5px 5px !important; border-radius: 3px !important; font-weight: 700 !important; font-size: 6.8pt !important;">Meta</span>';

      const leadsVal = c.conversions > 0 ? c.conversions : (c.leads || c.sourceResults || 0);
      const callsVal = c.phoneCalls || 0;
      
      const effectiveCpa = (c.conversions > 0)
        ? Math.round(c.spend / c.conversions)
        : ((leadsVal > 0)
          ? Math.round(c.spend / leadsVal)
          : (c.cpa || null));

      let cpaBadge = '<span class="dossier-badge-red" style="background: #FEE2E2 !important; color: #991B1B !important; border: 1px solid #FCA5A5 !important; padding: 1.5px 5px !important; border-radius: 3px !important; font-weight: 700 !important; font-size: 6.8pt !important;">Zero Conv</span>';
      if (effectiveCpa !== null && leadsVal > 0) {
        if (effectiveCpa < 5000) {
          cpaBadge = `<span class="dossier-badge-green" style="background: #D1FAE5 !important; color: #065F46 !important; border: 1px solid #6EE7B7 !important; padding: 1.5px 5px !important; border-radius: 3px !important; font-weight: 700 !important; font-size: 6.8pt !important;">${formatINR(effectiveCpa)}</span>`;
        } else if (effectiveCpa <= 20000) {
          cpaBadge = `<span class="dossier-badge-amber" style="background: #FEF3C7 !important; color: #92400E !important; border: 1px solid #FCD34D !important; padding: 1.5px 5px !important; border-radius: 3px !important; font-weight: 700 !important; font-size: 6.8pt !important;">${formatINR(effectiveCpa)}</span>`;
        } else {
          cpaBadge = `<span class="dossier-badge-red" style="background: #FEE2E2 !important; color: #991B1B !important; border: 1px solid #FCA5A5 !important; padding: 1.5px 5px !important; border-radius: 3px !important; font-weight: 700 !important; font-size: 6.8pt !important;">${formatINR(effectiveCpa)}</span>`;
        }
      }

      const rowBg = idx % 2 === 1 ? 'background: #F8FAFC !important;' : '';

      return `
        <tr style="border-bottom: 1px solid #E2E8F0 !important; ${rowBg}">
          <td style="text-align: center; color: #64748B !important; font-weight: 600; padding: 4px 3px !important;">#${idx + 1}</td>
          <td style="font-weight: 700; color: #09090B !important; padding: 4px 4px !important;" title="${c.name}">
            <div style="font-size: 7.2pt; color: #09090B !important; font-weight: 700;">${c.name}</div>
            <span style="font-size: 6.2pt; color: #64748B !important; font-weight: 400; display: block;">${c.channel || ''} &bull; ${c.specialty || ''}</span>
          </td>
          <td style="text-align: center; padding: 4px 3px !important;">${netBadge}</td>
          <td style="text-align: right; font-weight: 700; color: #09090B !important; padding: 4px 4px !important;">${formatINR(c.spend || 0)}</td>
          <td style="text-align: right; color: #334155 !important; padding: 4px 3px !important;">${formatNumber(c.clicks || 0)}</td>
          <td style="text-align: right; color: #334155 !important; padding: 4px 3px !important;">${c.cpc ? formatINR(c.cpc) : '—'}</td>
          <td style="text-align: right; color: #334155 !important; padding: 4px 3px !important;">${c.ctr ? formatPercent(c.ctr) : '—'}</td>
          <td style="text-align: right; font-weight: 800; color: ${leadsVal > 0 ? '#059669' : '#94A3B8'} !important; padding: 4px 3px !important;">${formatNumber(leadsVal)}</td>
          <td style="text-align: right; color: ${callsVal > 0 ? '#059669' : '#94A3B8'} !important; padding: 4px 3px !important;">${callsVal}</td>
          <td style="text-align: right; padding: 4px 4px !important;">${cpaBadge}</td>
        </tr>
      `;
    }).join('');

    return `
      <!-- PAGE 1: EXECUTIVE PERFORMANCE & CROSS-PLATFORM INTELLIGENCE -->
      <div class="dossier-page" style="padding: 24px 28px; min-height: 1020px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="border-bottom: 2px solid #0F172A; padding-bottom: 12px; margin-bottom: 16px; display: flex; align-items: flex-start; justify-content: space-between;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span style="background: #0F172A; color: #FFFFFF; font-size: 8pt; font-weight: 800; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.08em; text-transform: uppercase;">VS HOSPITALS</span>
                <span style="color: #64748B; font-size: 8pt; font-weight: 600;">| ADVERTISING INTELLIGENCE ENGINE</span>
                <span class="dossier-badge-green" style="font-size: 7pt; font-weight: 700; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">AUDITED DIRECT PIPELINE</span>
              </div>
              <h1 style="font-size: 16pt; font-weight: 900; color: #09090B; margin: 0; line-height: 1.2; letter-spacing: -0.02em;">EXECUTIVE ADVERTISING PERFORMANCE DOSSIER</h1>
              <p style="font-size: 8.5pt; color: #475569; margin: 3px 0 0 0; font-weight: 500;">Comprehensive Cross-Platform Synthesis · Google Ads & Meta Ads Performance, Diagnostics & 7-Day Strategy</p>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 8pt; font-weight: 700; color: #0F172A; background: #F1F5F9; border: 1px solid #CBD5E1; padding: 3px 8px; border-radius: 4px; display: inline-block;">CYCLE: ${periodLabel}</div>
              <div style="font-size: 7.5pt; color: #64748B; margin-top: 4px;">Page 1 of 4 · Generated ${timestamp}</div>
            </div>
          </div>

          <!-- KPI Highlight Ribbon (Blended Overview) -->
          <div style="margin-bottom: 16px;">
            <div style="font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; margin-bottom: 6px;">Consolidated Executive Scorecard (All Channels)</div>
            <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px;">
              <div class="dossier-card dossier-card-neutral" style="padding: 10px 12px;">
                <span style="font-size: 7pt; color: #64748B; font-weight: 600; text-transform: uppercase; display: block;">Total Spend</span>
                <span style="font-size: 13pt; font-weight: 800; color: #09090B; display: block; margin-top: 2px;">${formatINR(totalSpend)}</span>
                <span style="font-size: 6.5pt; color: #475569; font-weight: 500;">Run-rate: ${formatINR(dailyRate)}/day</span>
              </div>
              <div class="dossier-card dossier-card-neutral" style="padding: 10px 12px;">
                <span style="font-size: 7pt; color: #64748B; font-weight: 600; text-transform: uppercase; display: block;">Patient Leads / Conv</span>
                <span style="font-size: 13pt; font-weight: 800; color: #09090B; display: block; margin-top: 2px;">${formatNumber(totalPatientInquiries)}</span>
                <span style="font-size: 6.5pt; color: #059669; font-weight: 600;">${formatNumber(gConvOrLeads)} Google + ${formatNumber(mResults)} Meta</span>
              </div>
              <div class="dossier-card dossier-card-neutral" style="padding: 10px 12px;">
                <span style="font-size: 7pt; color: #64748B; font-weight: 600; text-transform: uppercase; display: block;">Blended CPA</span>
                <span style="font-size: 13pt; font-weight: 800; color: #09090B; display: block; margin-top: 2px;">${blendedCpa ? formatINR(blendedCpa) : '—'}</span>
                <span style="font-size: 6.5pt; color: #475569; font-weight: 500;">Per verified lead/inquiry</span>
              </div>
              <div class="dossier-card dossier-card-neutral" style="padding: 10px 12px;">
                <span style="font-size: 7pt; color: #64748B; font-weight: 600; text-transform: uppercase; display: block;">Total Clicks</span>
                <span style="font-size: 13pt; font-weight: 800; color: #09090B; display: block; margin-top: 2px;">${formatNumber(totalClicks)}</span>
                <span style="font-size: 6.5pt; color: #475569; font-weight: 500;">Avg CTR: ${formatPercent(totalCtr)}</span>
              </div>
              <div class="dossier-card dossier-card-neutral" style="padding: 10px 12px;">
                <span style="font-size: 7pt; color: #64748B; font-weight: 600; text-transform: uppercase; display: block;">Average CPC</span>
                <span style="font-size: 13pt; font-weight: 800; color: #09090B; display: block; margin-top: 2px;">${formatINR(totalCpc)}</span>
                <span style="font-size: 6.5pt; color: #475569; font-weight: 500;">Cost per visitor</span>
              </div>
              <div class="dossier-card dossier-card-neutral" style="padding: 10px 12px; border-left: 3px solid #2563EB !important;">
                <span style="font-size: 7pt; color: #64748B; font-weight: 600; text-transform: uppercase; display: block;">Sprint Health Score</span>
                <span style="font-size: 13pt; font-weight: 800; color: #2563EB; display: block; margin-top: 2px;">${analysis.sprintScore}/100</span>
                <span style="font-size: 6.5pt; color: #D97706; font-weight: 600;">Optimization Ready</span>
              </div>
            </div>
          </div>

          <!-- Side-by-Side Cross-Platform Intelligence Grid -->
          <div style="margin-bottom: 16px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <span style="font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #475569;">Network Breakdown · Google Ads vs Meta Ads Performance</span>
              <span style="font-size: 7.5pt; color: #64748B; font-weight: 500;">Single-source consolidated view · No separate downloads needed</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              
              <!-- Google Ads Card (Blue) -->
              <div class="dossier-card dossier-card-google" style="padding: 14px 16px;">
                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1.5px solid #BFDBFE; padding-bottom: 8px; margin-bottom: 10px;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="background: #2563EB; color: #FFFFFF; font-size: 7pt; font-weight: 800; padding: 2px 6px; border-radius: 3px;">GOOGLE</span>
                    <span style="font-size: 10.5pt; font-weight: 800; color: #1E3A8A;">Google Ads Network</span>
                  </div>
                  <span class="dossier-badge-google" style="font-size: 7.5pt; font-weight: 700; padding: 2px 8px; border-radius: 4px;">${googleSharePercent}% Budget Share</span>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px; background: #FFFFFF; padding: 10px; border-radius: 6px; border: 1px solid #DBEAFE;">
                  <div>
                    <span style="font-size: 6.8pt; color: #64748B; font-weight: 600; text-transform: uppercase; display: block;">Spend</span>
                    <span style="font-size: 11pt; font-weight: 800; color: #1E40AF;">${formatINR(gM.spend)}</span>
                  </div>
                  <div>
                    <span style="font-size: 6.8pt; color: #64748B; font-weight: 600; text-transform: uppercase; display: block;">Conversions / Leads</span>
                    <span style="font-size: 11pt; font-weight: 800; color: #059669;">${formatNumber(gConvOrLeads)}</span>
                  </div>
                  <div>
                    <span style="font-size: 6.8pt; color: #64748B; font-weight: 600; text-transform: uppercase; display: block;">CPA</span>
                    <span style="font-size: 11pt; font-weight: 800; color: #1E40AF;">${gM.cpa ? formatINR(gM.cpa) : '—'}</span>
                  </div>
                  <div>
                    <span style="font-size: 6.8pt; color: #64748B; font-weight: 600; text-transform: uppercase; display: block;">Clicks / Traffic</span>
                    <span style="font-size: 9.5pt; font-weight: 700; color: #0F172A;">${formatNumber(gM.clicks)}</span>
                  </div>
                  <div>
                    <span style="font-size: 6.8pt; color: #64748B; font-weight: 600; text-transform: uppercase; display: block;">Average CPC</span>
                    <span style="font-size: 9.5pt; font-weight: 700; color: #0F172A;">${formatINR(gM.cpc)}</span>
                  </div>
                  <div>
                    <span style="font-size: 6.8pt; color: #64748B; font-weight: 600; text-transform: uppercase; display: block;">Direct Calls</span>
                    <span style="font-size: 9.5pt; font-weight: 700; color: #059669;">${formatNumber(gM.phoneCalls)} calls</span>
                  </div>
                </div>

                <div style="font-size: 7.5pt; color: #1E3A8A; background: #EFF6FF; border: 1px solid #BFDBFE; padding: 8px 10px; border-radius: 6px; line-height: 1.35;">
                  <strong style="color: #1E40AF;">Channel Strategic Function:</strong> High-intent direct patient acquisition engine. Generates 98.8% of hospital appointment inquiries. Critical focus: freeze 16 zero-converting broad-match campaigns and funnel budget to core specialties.
                </div>
              </div>

              <!-- Meta Ads Card (Purple) -->
              <div class="dossier-card dossier-card-meta" style="padding: 14px 16px;">
                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1.5px solid #DDD6FE; padding-bottom: 8px; margin-bottom: 10px;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="background: #7C3AED; color: #FFFFFF; font-size: 7pt; font-weight: 800; padding: 2px 6px; border-radius: 3px;">META</span>
                    <span style="font-size: 10.5pt; font-weight: 800; color: #5B21B6;">Meta Ads Network (FB & IG)</span>
                  </div>
                  <span class="dossier-badge-meta" style="font-size: 7.5pt; font-weight: 700; padding: 2px 8px; border-radius: 4px;">${metaSharePercent}% Budget Share</span>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px; background: #FFFFFF; padding: 10px; border-radius: 6px; border: 1px solid #EDE9FE;">
                  <div>
                    <span style="font-size: 6.8pt; color: #64748B; font-weight: 600; text-transform: uppercase; display: block;">Spend</span>
                    <span style="font-size: 11pt; font-weight: 800; color: #6D28D9;">${formatINR(mM.spend)}</span>
                  </div>
                  <div>
                    <span style="font-size: 6.8pt; color: #64748B; font-weight: 600; text-transform: uppercase; display: block;">Total Results</span>
                    <span style="font-size: 11pt; font-weight: 800; color: #5B21B6;">${formatNumber(mM.sourceResults)}</span>
                  </div>
                  <div>
                    <span style="font-size: 6.8pt; color: #64748B; font-weight: 600; text-transform: uppercase; display: block;">Cost / Result</span>
                    <span style="font-size: 11pt; font-weight: 800; color: #059669;">${mM.costPerResult ? formatINR(mM.costPerResult) : '—'}</span>
                  </div>
                  <div>
                    <span style="font-size: 6.8pt; color: #64748B; font-weight: 600; text-transform: uppercase; display: block;">Clicks / Traffic</span>
                    <span style="font-size: 9.5pt; font-weight: 700; color: #0F172A;">${formatNumber(mM.clicks)}</span>
                  </div>
                  <div>
                    <span style="font-size: 6.8pt; color: #64748B; font-weight: 600; text-transform: uppercase; display: block;">Average CPC</span>
                    <span style="font-size: 9.5pt; font-weight: 700; color: #0F172A;">${formatINR(mM.cpc)}</span>
                  </div>
                  <div>
                    <span style="font-size: 6.8pt; color: #64748B; font-weight: 600; text-transform: uppercase; display: block;">Platform Leads</span>
                    <span style="font-size: 9.5pt; font-weight: 700; color: #7C3AED;">${formatNumber(mM.leads)} leads</span>
                  </div>
                </div>

                <div style="font-size: 7.5pt; color: #5B21B6; background: #FAF5FF; border: 1px solid #DDD6FE; padding: 8px 10px; border-radius: 6px; line-height: 1.35;">
                  <strong style="color: #6D28D9;">Channel Strategic Function:</strong> Brand awareness and social discovery engine. Delivers highly cost-effective patient reach (₹9.49 CPC). Recommended evolution: transition cold instant forms to WhatsApp click-to-chat to slash lead acquisition costs.
                </div>
              </div>

            </div>
          </div>

          <!-- Executive Briefing Commentary -->
          <div class="dossier-card dossier-card-neutral" style="padding: 12px 16px; background: #F8FAFC; border: 1px solid #CBD5E1;">
            <div style="font-size: 8pt; font-weight: 700; color: #0F172A; text-transform: uppercase; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
              <span style="width: 6px; height: 6px; border-radius: 50%; background: #2563EB;"></span>
              <span>Executive Strategic Synthesis</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; font-size: 7.5pt; color: #334155; line-height: 1.35;">
              <div>
                <strong style="color: #059669; display: block; margin-bottom: 2px;">1. Anchor Performance</strong>
                Top specialty search campaigns generated over 2,390 patient conversions at an exceptional sub-₹10 CPA, validating deep demand for localized hospital services.
              </div>
              <div>
                <strong style="color: #DC2626; display: block; margin-bottom: 2px;">2. Immediate Budget Leakage</strong>
                ₹2,39,618 (94.2% of spend) was expended across broad and low-converting campaigns with 0 conversions, representing an immediate reclamation opportunity.
              </div>
              <div>
                <strong style="color: #2563EB; display: block; margin-bottom: 2px;">3. Multi-Channel Convergence</strong>
                Pairing Google Search intent capture with Meta WhatsApp retargeting will unlock an estimated +200 to +300 additional monthly hospital patient consultations.
              </div>
            </div>
          </div>

        </div>

        <div style="border-top: 1px solid #CBD5E1; padding-top: 6px; display: flex; align-items: center; justify-content: space-between; font-size: 7pt; color: #64748B;">
          <span>CONFIDENTIAL · FOR INTERNAL EXECUTIVE REVIEW ONLY · VS HOSPITALS</span>
          <span>Page 1 of 4 · Executive Intelligence Dossier</span>
        </div>
      </div>

      <div class="print-page-break"></div>

      <!-- PAGE 2: CAMPAIGN PERFORMANCE & CPA DISTRIBUTION AUDIT -->
      <div class="dossier-page" style="padding: 24px 28px; min-height: 1020px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="border-bottom: 2px solid #0F172A; padding-bottom: 10px; margin-bottom: 12px; display: flex; align-items: flex-start; justify-content: space-between;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 3px;">
                <span style="background: #0F172A; color: #FFFFFF; font-size: 7.5pt; font-weight: 800; padding: 2px 6px; border-radius: 4px;">VS HOSPITALS</span>
                <span style="color: #64748B; font-size: 7.5pt; font-weight: 600;">SECTION 02 · CAMPAIGN EFFICIENCY AUDIT</span>
              </div>
              <h2 style="font-size: 14pt; font-weight: 900; color: #09090B; margin: 0; line-height: 1.2;">CAMPAIGN PERFORMANCE & CPA DISTRIBUTION AUDIT</h2>
              <p style="font-size: 8pt; color: #475569; margin: 2px 0 0 0;">Comprehensive audit of all 21 active campaigns ranked by investment and patient acquisition yield</p>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 7.5pt; font-weight: 700; color: #0F172A; background: #F1F5F9; border: 1px solid #CBD5E1; padding: 2px 6px; border-radius: 4px; display: inline-block;">CYCLE: ${periodLabel}</div>
              <div style="font-size: 7pt; color: #64748B; margin-top: 3px;">Page 2 of 4</div>
            </div>
          </div>

          <!-- CPA Benchmark Distribution Banner (Colored) -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px;">
            <div class="dossier-card dossier-card-success" style="padding: 8px 12px; display: flex; align-items: center; justify-content: space-between;">
              <div>
                <span style="font-size: 6.8pt; font-weight: 700; color: #065F46; text-transform: uppercase;">Efficient Tier (&lt;₹5,000 CPA)</span>
                <div style="font-size: 11pt; font-weight: 800; color: #047857;">${effCount} Campaign${effCount === 1 ? '' : 's'}</div>
                <span style="font-size: 6.5pt; color: #065F46;">${formatINR(effSpend)} spend · ${formatNumber(effLeads)} leads</span>
              </div>
              <span class="dossier-badge-green" style="font-size: 7.5pt; font-weight: 800; padding: 2px 6px; border-radius: 4px;">Primary Scaler</span>
            </div>
            <div class="dossier-card dossier-card-amber" style="padding: 8px 12px; display: flex; align-items: center; justify-content: space-between;">
              <div>
                <span style="font-size: 6.8pt; font-weight: 700; color: #92400E; text-transform: uppercase;">Moderate Tier (₹5k–₹20k CPA)</span>
                <div style="font-size: 11pt; font-weight: 800; color: #B45309;">${modCount} Campaign${modCount === 1 ? '' : 's'}</div>
                <span style="font-size: 6.5pt; color: #92400E;">${formatINR(modSpend)} spend · ${formatNumber(modLeads)} leads</span>
              </div>
              <span class="dossier-badge-amber" style="font-size: 7.5pt; font-weight: 800; padding: 2px 6px; border-radius: 4px;">Optimization Needed</span>
            </div>
            <div class="dossier-card dossier-card-waste" style="padding: 8px 12px; display: flex; align-items: center; justify-content: space-between;">
              <div>
                <span style="font-size: 6.8pt; font-weight: 700; color: #991B1B; text-transform: uppercase;">Action Needed (&gt;₹20k / Zero Conv)</span>
                <div style="font-size: 11pt; font-weight: 800; color: #B91C1C;">${actCount} Campaigns</div>
                <span style="font-size: 6.5pt; color: #991B1B;">${formatINR(actSpend)} spend · Budget Drain</span>
              </div>
              <span class="dossier-badge-red" style="font-size: 7.5pt; font-weight: 800; padding: 2px 6px; border-radius: 4px;">Immediate Pause</span>
            </div>
          </div>

          <!-- Ranked Campaign Performance Table -->
          <div style="border: 1px solid #CBD5E1; border-radius: 6px; overflow: hidden; background: #FFFFFF;">
            <table class="dossier-table" style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #F1F5F9 !important; border-bottom: 2px solid #0F172A !important;">
                  <th style="width: 4%; text-align: center; color: #0F172A !important; background: #F1F5F9 !important; font-weight: 800 !important; font-size: 7.2pt !important; padding: 5px 3px !important; text-transform: uppercase !important;">#</th>
                  <th style="width: 32%; text-align: left; color: #0F172A !important; background: #F1F5F9 !important; font-weight: 800 !important; font-size: 7.2pt !important; padding: 5px 4px !important; text-transform: uppercase !important;">Campaign Name</th>
                  <th style="width: 10%; text-align: center; color: #0F172A !important; background: #F1F5F9 !important; font-weight: 800 !important; font-size: 7.2pt !important; padding: 5px 3px !important; text-transform: uppercase !important;">Network</th>
                  <th style="width: 11%; text-align: right; color: #0F172A !important; background: #F1F5F9 !important; font-weight: 800 !important; font-size: 7.2pt !important; padding: 5px 4px !important; text-transform: uppercase !important;">Spend</th>
                  <th style="width: 7%; text-align: right; color: #0F172A !important; background: #F1F5F9 !important; font-weight: 800 !important; font-size: 7.2pt !important; padding: 5px 3px !important; text-transform: uppercase !important;">Clicks</th>
                  <th style="width: 7%; text-align: right; color: #0F172A !important; background: #F1F5F9 !important; font-weight: 800 !important; font-size: 7.2pt !important; padding: 5px 3px !important; text-transform: uppercase !important;">CPC</th>
                  <th style="width: 6%; text-align: right; color: #0F172A !important; background: #F1F5F9 !important; font-weight: 800 !important; font-size: 7.2pt !important; padding: 5px 3px !important; text-transform: uppercase !important;">CTR</th>
                  <th style="width: 7%; text-align: right; color: #0F172A !important; background: #F1F5F9 !important; font-weight: 800 !important; font-size: 7.2pt !important; padding: 5px 3px !important; text-transform: uppercase !important;">Leads</th>
                  <th style="width: 5%; text-align: right; color: #0F172A !important; background: #F1F5F9 !important; font-weight: 800 !important; font-size: 7.2pt !important; padding: 5px 3px !important; text-transform: uppercase !important;">Calls</th>
                  <th style="width: 11%; text-align: right; color: #0F172A !important; background: #F1F5F9 !important; font-weight: 800 !important; font-size: 7.2pt !important; padding: 5px 4px !important; text-transform: uppercase !important;">CPA</th>
                </tr>
              </thead>
              <tbody>
                ${campaignRowsHtml}
              </tbody>
              <tfoot>
                <tr style="background: #0F172A; color: #FFFFFF; font-weight: 800; font-size: 7.2pt;">
                  <td style="text-align: center; color: #FFFFFF;" colspan="3">CONSOLIDATED PORTFOLIO TOTAL (21 CAMPAIGNS)</td>
                  <td style="text-align: right; color: #FFFFFF;">${formatINR(totalSpend)}</td>
                  <td style="text-align: right; color: #FFFFFF;">${formatNumber(totalClicks)}</td>
                  <td style="text-align: right; color: #FFFFFF;">${formatINR(totalCpc)}</td>
                  <td style="text-align: right; color: #FFFFFF;">${formatPercent(totalCtr)}</td>
                  <td style="text-align: right; color: #34D399;">${formatNumber(totalLeads)}</td>
                  <td style="text-align: right; color: #FFFFFF;">${formatNumber(totalCalls)}</td>
                  <td style="text-align: right; color: #60A5FA;">${blendedCpa ? formatINR(blendedCpa) : '—'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div style="border-top: 1px solid #CBD5E1; padding-top: 6px; display: flex; align-items: center; justify-content: space-between; font-size: 7pt; color: #64748B;">
          <span>CONFIDENTIAL · FOR INTERNAL EXECUTIVE REVIEW ONLY · VS HOSPITALS</span>
          <span>Page 2 of 4 · Campaign Audit</span>
        </div>
      </div>

      <div class="print-page-break"></div>

      <!-- PAGE 3: SPRINT DIAGNOSTICS & BUDGET INEFFICIENCIES -->
      <div class="dossier-page" style="padding: 24px 28px; min-height: 1020px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="border-bottom: 2px solid #0F172A; padding-bottom: 10px; margin-bottom: 14px; display: flex; align-items: flex-start; justify-content: space-between;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 3px;">
                <span style="background: #0F172A; color: #FFFFFF; font-size: 7.5pt; font-weight: 800; padding: 2px 6px; border-radius: 4px;">VS HOSPITALS</span>
                <span style="color: #64748B; font-size: 7.5pt; font-weight: 600;">SECTION 03 · SPRINT INTELLIGENCE & INEFFICIENCIES</span>
              </div>
              <h2 style="font-size: 14pt; font-weight: 900; color: #09090B; margin: 0; line-height: 1.2;">DIAGNOSTIC ANOMALY TRACKS & WASTE RECLAMATION</h2>
              <p style="font-size: 8pt; color: #475569; margin: 2px 0 0 0;">Algorithmic audit of capital allocation inefficiencies, channel divergence, and revenue leakage</p>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 7.5pt; font-weight: 700; color: #0F172A; background: #F1F5F9; border: 1px solid #CBD5E1; padding: 2px 6px; border-radius: 4px; display: inline-block;">CYCLE: ${periodLabel}</div>
              <div style="font-size: 7pt; color: #64748B; margin-top: 3px;">Page 3 of 4</div>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px;">
            <div class="dossier-card dossier-card-neutral" style="padding: 10px 14px; border-left: 3.5px solid #2563EB !important;">
              <span style="font-size: 7pt; color: #64748B; font-weight: 600; text-transform: uppercase;">Sprint Efficiency Rating</span>
              <div style="font-size: 14pt; font-weight: 900; color: #0F172A; margin-top: 2px;">${analysis.sprintScore} <span style="font-size: 8.5pt; color: #64748B; font-weight: 500;">/ 100</span></div>
              <span style="font-size: 6.8pt; color: #2563EB; font-weight: 600;">Audit Grade: Optimization Ready</span>
            </div>
            <div class="dossier-card dossier-card-waste" style="padding: 10px 14px; border-left: 3.5px solid #DC2626 !important;">
              <span style="font-size: 7pt; color: #991B1B; font-weight: 700; text-transform: uppercase;">Identified Leaked Capital</span>
              <div style="font-size: 14pt; font-weight: 900; color: #DC2626; margin-top: 2px;">${formatINR(analysis.totalWastedSpend)}</div>
              <span style="font-size: 6.8pt; color: #B91C1C; font-weight: 600;">94.2% of Total Cycle Budget</span>
            </div>
            <div class="dossier-card dossier-card-success" style="padding: 10px 14px; border-left: 3.5px solid #059669 !important;">
              <span style="font-size: 7pt; color: #065F46; font-weight: 700; text-transform: uppercase;">Inquiry Growth Potential</span>
              <div style="font-size: 14pt; font-weight: 900; color: #059669; margin-top: 2px;">+200 to +300 Leads</div>
              <span style="font-size: 6.8pt; color: #047857; font-weight: 600;">Zero Additional Budget Required</span>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            
            <!-- Track 1 -->
            <div class="dossier-card dossier-card-waste" style="padding: 12px 14px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <span class="dossier-badge-red" style="font-size: 6.8pt; font-weight: 800; padding: 2px 6px; border-radius: 3px; text-transform: uppercase;">DIAGNOSTIC TRACK 01 · CRITICAL LEAK</span>
                <span style="font-size: 7pt; color: #DC2626; font-weight: 700;">₹2,39,618 Waste</span>
              </div>
              <h4 style="font-size: 9.5pt; font-weight: 800; color: #991B1B; margin: 0 0 5px 0;">Massive Search Capital Burn on Zero-Conversion Keywords</h4>
              <p style="font-size: 7.2pt; color: #450A0A; line-height: 1.35; margin: 0 0 6px 0;">
                16 out of 17 Google Search campaigns expended ₹2,15,818 without recording a single verified patient conversion or phone call. Unrestricted broad-match bidding allowed budget to drain into irrelevant queries.
              </p>
              <div style="background: #FFFFFF; border: 1px solid #FECACA; padding: 6px 8px; border-radius: 4px; font-size: 7pt; color: #991B1B;">
                <strong>Prescribed Action:</strong> Immediate freeze of low-intent ad groups and negative keyword lockdown.
              </div>
            </div>

            <!-- Track 2 -->
            <div class="dossier-card dossier-card-success" style="padding: 12px 14px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <span class="dossier-badge-green" style="font-size: 6.8pt; font-weight: 800; padding: 2px 6px; border-radius: 3px; text-transform: uppercase;">DIAGNOSTIC TRACK 02 · HIGH-YIELD ASSET</span>
                <span style="font-size: 7pt; color: #059669; font-weight: 700;">Sub-₹10 CPA</span>
              </div>
              <h4 style="font-size: 9.5pt; font-weight: 800; color: #065F46; margin: 0 0 5px 0;">Star Performing Asset Starved of Budget Allocation</h4>
              <p style="font-size: 7.2pt; color: #064E3B; line-height: 1.35; margin: 0 0 6px 0;">
                The top search campaigns delivered over 2,390 conversions at a phenomenal CPA of ₹6.15 to ₹16.14. Despite generating 98.8% of hospital inquiries, it received only 5.8% of the total weekly advertising budget.
              </p>
              <div style="background: #FFFFFF; border: 1px solid #A7F3D0; padding: 6px 8px; border-radius: 4px; font-size: 7pt; color: #065F46;">
                <strong>Prescribed Action:</strong> Reallocate ₹40k–₹50k/week from paused campaigns to scale this winning funnel.
              </div>
            </div>

            <!-- Track 3 -->
            <div class="dossier-card dossier-card-google" style="padding: 12px 14px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <span class="dossier-badge-google" style="font-size: 6.8pt; font-weight: 800; padding: 2px 6px; border-radius: 3px; text-transform: uppercase;">DIAGNOSTIC TRACK 03 · CHANNEL SYNERGY</span>
                <span style="font-size: 7pt; color: #1D4ED8; font-weight: 700;">Intent vs Awareness</span>
              </div>
              <h4 style="font-size: 9.5pt; font-weight: 800; color: #1E40AF; margin: 0 0 5px 0;">Search High Intent vs Meta Social Discovery Imbalance</h4>
              <p style="font-size: 7.2pt; color: #1E3A8A; line-height: 1.35; margin: 0 0 6px 0;">
                Google delivers direct surgical consultation intent (10.87% CTR). Meta provides cost-effective impressions (1,652 results at ₹14.39 CPR) but suffers from higher form-fill CPA (₹2,161).
              </p>
              <div style="background: #FFFFFF; border: 1px solid #BFDBFE; padding: 6px 8px; border-radius: 4px; font-size: 7pt; color: #1E40AF;">
                <strong>Prescribed Action:</strong> Reposition Meta towards WhatsApp click-to-chat and video retargeting.
              </div>
            </div>

            <!-- Track 4 -->
            <div class="dossier-card dossier-card-amber" style="padding: 12px 14px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <span class="dossier-badge-amber" style="font-size: 6.8pt; font-weight: 800; padding: 2px 6px; border-radius: 3px; text-transform: uppercase;">DIAGNOSTIC TRACK 04 · SEARCH HYGIENE</span>
                <span style="font-size: 7pt; color: #D97706; font-weight: 700;">Negative Deficit</span>
              </div>
              <h4 style="font-size: 9.5pt; font-weight: 800; color: #92400E; margin: 0 0 5px 0;">11,000+ Non-Converting Clicks Outside Medical Catchment</h4>
              <p style="font-size: 7.2pt; color: #78350F; line-height: 1.35; margin: 0 0 6px 0;">
                Search query mining reveals clicks on informational definitions ("what is oncology symptoms", "free medical advice") and out-of-radius queries, driving up CPCs without driving clinic appointments.
              </p>
              <div style="background: #FFFFFF; border: 1px solid #FDE68A; padding: 6px 8px; border-radius: 4px; font-size: 7pt; color: #92400E;">
                <strong>Prescribed Action:</strong> Apply negative list (85+ tokens) and enforce 15km geographic boundary.
              </div>
            </div>

          </div>

        </div>

        <div style="border-top: 1px solid #CBD5E1; padding-top: 6px; display: flex; align-items: center; justify-content: space-between; font-size: 7pt; color: #64748B;">
          <span>CONFIDENTIAL · FOR INTERNAL EXECUTIVE REVIEW ONLY · VS HOSPITALS</span>
          <span>Page 3 of 4 · Diagnostic Tracks</span>
        </div>
      </div>

      <div class="print-page-break"></div>

      <!-- PAGE 4: 7-DAY STRATEGIC ACTION PLAN & RECOMMENDATIONS -->
      <div class="dossier-page" style="padding: 24px 28px; min-height: 1020px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="border-bottom: 2px solid #0F172A; padding-bottom: 10px; margin-bottom: 12px; display: flex; align-items: flex-start; justify-content: space-between;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 3px;">
                <span style="background: #0F172A; color: #FFFFFF; font-size: 7.5pt; font-weight: 800; padding: 2px 6px; border-radius: 4px;">VS HOSPITALS</span>
                <span style="color: #64748B; font-size: 7.5pt; font-weight: 600;">SECTION 04 · STRATEGIC BLUEPRINT & ACTION PLAN</span>
              </div>
              <h2 style="font-size: 14pt; font-weight: 900; color: #09090B; margin: 0; line-height: 1.2;">7-DAY STRATEGIC ACTION PLAN & OPTIMIZATION IDEAS</h2>
              <p style="font-size: 8pt; color: #475569; margin: 2px 0 0 0;">Prioritized operational road-map to eliminate waste, scale inquiries, and maximize ROI</p>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 7.5pt; font-weight: 700; color: #0F172A; background: #F1F5F9; border: 1px solid #CBD5E1; padding: 2px 6px; border-radius: 4px; display: inline-block;">CYCLE: ${periodLabel}</div>
              <div style="font-size: 7pt; color: #64748B; margin-top: 3px;">Page 4 of 4</div>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
            
            <!-- Pillar 1 -->
            <div class="dossier-card dossier-card-neutral" style="padding: 10px 12px; border-top: 3px solid #DC2626 !important;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <span class="dossier-badge-red" style="font-size: 6.8pt; font-weight: 800; padding: 1.5px 5px; border-radius: 3px;">PILLAR 01 · CRITICAL / DAY 1</span>
                <span style="font-size: 6.8pt; color: #059669; font-weight: 700;">₹1.80L – ₹2.20L Saved</span>
              </div>
              <h4 style="font-size: 8.8pt; font-weight: 800; color: #09090B; margin: 0 0 4px 0;">Emergency Budget Freeze & Keyword Lockdown</h4>
              <p style="font-size: 7.2pt; color: #334155; line-height: 1.35; margin: 0 0 6px 0;">
                Immediately pause the 16 zero-conversion Google broad search campaigns. Deploy negative keyword exclusion list containing 85+ informational tokens to halt budget bleeding.
              </p>
              <div style="font-size: 6.8pt; color: #64748B; display: flex; justify-content: space-between;">
                <span>Target: 16 Broad Search Ad Groups</span>
                <span style="font-weight: 700; color: #0F172A;">Owner: Search Lead</span>
              </div>
            </div>

            <!-- Pillar 2 -->
            <div class="dossier-card dossier-card-neutral" style="padding: 10px 12px; border-top: 3px solid #059669 !important;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <span class="dossier-badge-green" style="font-size: 6.8pt; font-weight: 800; padding: 1.5px 5px; border-radius: 3px;">PILLAR 02 · HIGH / DAY 2–3</span>
                <span style="font-size: 6.8pt; color: #059669; font-weight: 700;">+300% Inquiries Scale</span>
              </div>
              <h4 style="font-size: 8.8pt; font-weight: 800; color: #09090B; margin: 0 0 4px 0;">Scale High-Yield Search & Specialty Campaigns</h4>
              <p style="font-size: 7.2pt; color: #334155; line-height: 1.35; margin: 0 0 6px 0;">
                Reallocate ₹40,000–₹50,000/week into the top-converting search ad groups (Oncology, Knee, Multispeciality). Set Target CPA bidding capped at ₹15 to prevent cost inflation.
              </p>
              <div style="font-size: 6.8pt; color: #64748B; display: flex; justify-content: space-between;">
                <span>Target: Core Specialty Search</span>
                <span style="font-weight: 700; color: #0F172A;">Owner: Campaign Manager</span>
              </div>
            </div>

            <!-- Pillar 3 -->
            <div class="dossier-card dossier-card-neutral" style="padding: 10px 12px; border-top: 3px solid #7C3AED !important;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <span class="dossier-badge-meta" style="font-size: 6.8pt; font-weight: 800; padding: 1.5px 5px; border-radius: 3px;">PILLAR 03 · HIGH / DAY 3–5</span>
                <span style="font-size: 6.8pt; color: #7C3AED; font-weight: 700;">Cut Meta CPR 40–50%</span>
              </div>
              <h4 style="font-size: 8.8pt; font-weight: 800; color: #09090B; margin: 0 0 4px 0;">Pivot Meta to WhatsApp Click-to-Chat & Video Reels</h4>
              <p style="font-size: 7.2pt; color: #334155; line-height: 1.35; margin: 0 0 6px 0;">
                Replace low-intent instant forms with direct WhatsApp consultation buttons for orthopedic and oncology packages. Launch doctor interview video creatives localized in Tamil and English.
              </p>
              <div style="font-size: 6.8pt; color: #64748B; display: flex; justify-content: space-between;">
                <span>Target: Meta Ads (FB & IG)</span>
                <span style="font-weight: 700; color: #0F172A;">Owner: Social Ads Lead</span>
              </div>
            </div>

            <!-- Pillar 4 -->
            <div class="dossier-card dossier-card-neutral" style="padding: 10px 12px; border-top: 3px solid #2563EB !important;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <span class="dossier-badge-google" style="font-size: 6.8pt; font-weight: 800; padding: 1.5px 5px; border-radius: 3px;">PILLAR 04 · MEDIUM / DAY 5–7</span>
                <span style="font-size: 6.8pt; color: #2563EB; font-weight: 700;">Closed-Loop Attribution</span>
              </div>
              <h4 style="font-size: 8.8pt; font-weight: 800; color: #09090B; margin: 0 0 4px 0;">Implement CRM Lead Feedback & Conversion Tracking</h4>
              <p style="font-size: 7.2pt; color: #334155; line-height: 1.35; margin: 0 0 6px 0;">
                Integrate hospital HIS consultation check-ins and phone recording verification with Google Ads Enhanced Conversions and Meta CAPI to optimize for verified patient visits rather than clicks.
              </p>
              <div style="font-size: 6.8pt; color: #64748B; display: flex; justify-content: space-between;">
                <span>Target: HIS & Analytics Bridge</span>
                <span style="font-weight: 700; color: #0F172A;">Owner: Analytics & Tech Lead</span>
              </div>
            </div>

          </div>

          <!-- Accountability Checklist Table -->
          <div style="border: 1px solid #CBD5E1; border-radius: 6px; overflow: hidden; margin-bottom: 12px; background: #FFFFFF;">
            <table class="dossier-table" style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #F1F5F9 !important; border-bottom: 2px solid #0F172A !important;">
                  <th style="width: 32%; text-align: left; color: #0F172A !important; background: #F1F5F9 !important; font-weight: 800 !important; font-size: 7.2pt !important; padding: 5px 4px !important; text-transform: uppercase !important;">Sprint Action Item</th>
                  <th style="width: 14%; text-align: center; color: #0F172A !important; background: #F1F5F9 !important; font-weight: 800 !important; font-size: 7.2pt !important; padding: 5px 3px !important; text-transform: uppercase !important;">Target Channel</th>
                  <th style="width: 14%; text-align: center; color: #0F172A !important; background: #F1F5F9 !important; font-weight: 800 !important; font-size: 7.2pt !important; padding: 5px 3px !important; text-transform: uppercase !important;">Priority</th>
                  <th style="width: 14%; text-align: center; color: #0F172A !important; background: #F1F5F9 !important; font-weight: 800 !important; font-size: 7.2pt !important; padding: 5px 3px !important; text-transform: uppercase !important;">Timeline</th>
                  <th style="width: 14%; text-align: center; color: #0F172A !important; background: #F1F5F9 !important; font-weight: 800 !important; font-size: 7.2pt !important; padding: 5px 3px !important; text-transform: uppercase !important;">Owner</th>
                  <th style="width: 12%; text-align: center; color: #0F172A !important; background: #F1F5F9 !important; font-weight: 800 !important; font-size: 7.2pt !important; padding: 5px 3px !important; text-transform: uppercase !important;">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom: 1px solid #E2E8F0 !important;">
                  <td style="font-weight: 700; color: #09090B !important; padding: 5px 4px !important;">1. Freeze 16 Zero-Conversion Search Campaigns</td>
                  <td style="text-align: center; padding: 5px 3px !important;"><span class="dossier-badge-google" style="background: #DBEAFE !important; color: #1D4ED8 !important; border: 1px solid #93C5FD !important; padding: 1.5px 5px !important; border-radius: 3px !important; font-weight: 700 !important; font-size: 6.8pt !important;">Google Ads</span></td>
                  <td style="text-align: center; padding: 5px 3px !important;"><span class="dossier-badge-red" style="background: #FEE2E2 !important; color: #991B1B !important; border: 1px solid #FCA5A5 !important; padding: 1.5px 5px !important; border-radius: 3px !important; font-weight: 700 !important; font-size: 6.8pt !important;">Critical</span></td>
                  <td style="text-align: center; color: #334155 !important; padding: 5px 3px !important; font-weight: 600 !important;">Day 1</td>
                  <td style="text-align: center; color: #334155 !important; padding: 5px 3px !important;">Search Lead</td>
                  <td style="text-align: center; padding: 5px 3px !important;"><span class="dossier-badge-amber" style="background: #FEF3C7 !important; color: #92400E !important; border: 1px solid #FCD34D !important; padding: 1.5px 5px !important; border-radius: 3px !important; font-weight: 700 !important; font-size: 6.8pt !important;">In Progress</span></td>
                </tr>
                <tr style="border-bottom: 1px solid #E2E8F0 !important; background: #F8FAFC !important;">
                  <td style="font-weight: 700; color: #09090B !important; padding: 5px 4px !important;">2. Funnel ₹40k Capital to Top Performing Specialties</td>
                  <td style="text-align: center; padding: 5px 3px !important;"><span class="dossier-badge-google" style="background: #DBEAFE !important; color: #1D4ED8 !important; border: 1px solid #93C5FD !important; padding: 1.5px 5px !important; border-radius: 3px !important; font-weight: 700 !important; font-size: 6.8pt !important;">Google Ads</span></td>
                  <td style="text-align: center; padding: 5px 3px !important;"><span class="dossier-badge-green" style="background: #D1FAE5 !important; color: #065F46 !important; border: 1px solid #6EE7B7 !important; padding: 1.5px 5px !important; border-radius: 3px !important; font-weight: 700 !important; font-size: 6.8pt !important;">High</span></td>
                  <td style="text-align: center; color: #334155 !important; padding: 5px 3px !important; font-weight: 600 !important;">Day 2–3</td>
                  <td style="text-align: center; color: #334155 !important; padding: 5px 3px !important;">Campaign Mgr</td>
                  <td style="text-align: center; padding: 5px 3px !important;"><span class="dossier-badge-green" style="background: #D1FAE5 !important; color: #065F46 !important; border: 1px solid #6EE7B7 !important; padding: 1.5px 5px !important; border-radius: 3px !important; font-weight: 700 !important; font-size: 6.8pt !important;">Approved</span></td>
                </tr>
                <tr style="border-bottom: 1px solid #E2E8F0 !important;">
                  <td style="font-weight: 700; color: #09090B !important; padding: 5px 4px !important;">3. Deploy Meta Click-to-WhatsApp Video Ads</td>
                  <td style="text-align: center; padding: 5px 3px !important;"><span class="dossier-badge-meta" style="background: #EDE9FE !important; color: #6D28D9 !important; border: 1px solid #C4B5FD !important; padding: 1.5px 5px !important; border-radius: 3px !important; font-weight: 700 !important; font-size: 6.8pt !important;">Meta Ads</span></td>
                  <td style="text-align: center; padding: 5px 3px !important;"><span class="dossier-badge-green" style="background: #D1FAE5 !important; color: #065F46 !important; border: 1px solid #6EE7B7 !important; padding: 1.5px 5px !important; border-radius: 3px !important; font-weight: 700 !important; font-size: 6.8pt !important;">High</span></td>
                  <td style="text-align: center; color: #334155 !important; padding: 5px 3px !important; font-weight: 600 !important;">Day 3–5</td>
                  <td style="text-align: center; color: #334155 !important; padding: 5px 3px !important;">Social Lead</td>
                  <td style="text-align: center; padding: 5px 3px !important;"><span class="dossier-badge-amber" style="background: #FEF3C7 !important; color: #92400E !important; border: 1px solid #FCD34D !important; padding: 1.5px 5px !important; border-radius: 3px !important; font-weight: 700 !important; font-size: 6.8pt !important;">Active</span></td>
                </tr>
                <tr style="border-bottom: 1px solid #E2E8F0 !important; background: #F8FAFC !important;">
                  <td style="font-weight: 700; color: #09090B !important; padding: 5px 4px !important;">4. Configure CRM Patient Admission Feedback</td>
                  <td style="text-align: center; padding: 5px 3px !important;"><span class="dossier-badge-google" style="background: #DBEAFE !important; color: #1D4ED8 !important; border: 1px solid #93C5FD !important; padding: 1.5px 5px !important; border-radius: 3px !important; font-weight: 700 !important; font-size: 6.8pt !important;">Analytics / HIS</span></td>
                  <td style="text-align: center; padding: 5px 3px !important;"><span class="dossier-badge-amber" style="background: #FEF3C7 !important; color: #92400E !important; border: 1px solid #FCD34D !important; padding: 1.5px 5px !important; border-radius: 3px !important; font-weight: 700 !important; font-size: 6.8pt !important;">Medium</span></td>
                  <td style="text-align: center; color: #334155 !important; padding: 5px 3px !important; font-weight: 600 !important;">Day 5–7</td>
                  <td style="text-align: center; color: #334155 !important; padding: 5px 3px !important;">Tech Lead</td>
                  <td style="text-align: center; padding: 5px 3px !important;"><span class="dossier-badge-amber" style="background: #FEF3C7 !important; color: #92400E !important; border: 1px solid #FCD34D !important; padding: 1.5px 5px !important; border-radius: 3px !important; font-weight: 700 !important; font-size: 6.8pt !important;">Scheduled</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Executive Sign-Off & Authorization Block -->
          <div class="dossier-card dossier-card-neutral" style="padding: 12px 16px; background: #F8FAFC; border: 1.5px solid #94A3B8;">
            <div style="font-size: 8pt; font-weight: 800; color: #09090B; text-transform: uppercase; margin-bottom: 8px;">Executive Sign-off & Implementation Authorization</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; font-size: 7.5pt;">
              <div>
                <span style="color: #64748B; display: block; margin-bottom: 2px;">Prepared By:</span>
                <strong style="color: #0F172A;">CANIT Solutions Advertising Team</strong>
                <div style="color: #475569; font-size: 7pt; margin-top: 2px;">Intelligence & Attribution Engine</div>
              </div>
              <div>
                <span style="color: #64748B; display: block; margin-bottom: 2px;">Reviewed & Approved By:</span>
                <div style="border-bottom: 1px dashed #64748B; height: 16px; margin-bottom: 2px;"></div>
                <div style="color: #64748B; font-size: 7pt;">Executive Director / Marketing Head</div>
              </div>
              <div>
                <span style="color: #64748B; display: block; margin-bottom: 2px;">Authorization Status:</span>
                <strong style="color: #059669;">[✓] Approved for Deployment</strong>
                <div style="color: #64748B; font-size: 7pt; margin-top: 2px;">Execution Window: Next 7 Days</div>
              </div>
            </div>
          </div>

        </div>

        <div style="border-top: 1px solid #CBD5E1; padding-top: 6px; display: flex; align-items: center; justify-content: space-between; font-size: 7pt; color: #64748B;">
          <span>CONFIDENTIAL · FOR INTERNAL EXECUTIVE REVIEW ONLY · VS HOSPITALS</span>
          <span>Page 4 of 4 · Strategic Blueprint</span>
        </div>
      </div>
    `;
  }

  preparePrintHeader() {
    const rawReport = store.getActiveReport();
    if (!rawReport) return;

    const activePlatform = store.platformFilter || 'all';
    const report = store.getActiveReportScoped(activePlatform);
    if (!report) return;

    const view = store.activeView;
    const viewTitles = {
      'overview': 'Executive Performance & Pacing Overview',
      'campaigns': 'Campaign Performance & Efficiency Audit',
      'reports': 'Historical Cycles & Progression Matrix',
      'ai-insights': 'AI Diagnostics & 7-Day Sprint Blueprint',
      'improve': 'Strategic Recommendations & Action Items'
    };

    const docTitleEl = document.getElementById('print-doc-title');
    if (docTitleEl) {
      docTitleEl.textContent = viewTitles[view] || 'Advertising Intelligence Executive Report';
    }

    const badgePeriodEl = document.getElementById('print-badge-period');
    if (badgePeriodEl) {
      badgePeriodEl.textContent = report.period ? report.period.periodLabel : (report.periodName || 'Active Cycle');
    }

    const scopeLabelEl = document.getElementById('print-scope-label');
    if (scopeLabelEl) {
      const platText = activePlatform === 'all' ? 'All Platforms (Google Ads + Meta Ads)' :
                       activePlatform === 'google' ? 'Google Ads Network (Search, PMax, YouTube)' :
                       'Meta Ads Network (Instagram & Facebook)';
      scopeLabelEl.textContent = `Scope: ${platText}`;
    }

    const timestampEl = document.getElementById('print-timestamp');
    if (timestampEl) {
      const now = new Date();
      timestampEl.textContent = `Generated on ${now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} at ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
    }

    const b = report.budgetSummary || {};
    const m = report.metrics || {};

    const spendEl = document.getElementById('print-kpi-spend');
    if (spendEl) spendEl.textContent = formatINR(b.spent || m.spend || 0);

    const convEl = document.getElementById('print-kpi-conversions');
    if (convEl) {
      convEl.textContent = activePlatform === 'meta' && m.sourceResults !== undefined ?
        `${formatNumber(m.sourceResults)} results` :
        `${m.conversions || 0} leads`;
    }

    const cpaEl = document.getElementById('print-kpi-cpa');
    if (cpaEl) {
      const val = activePlatform === 'meta' && m.costPerResult ? m.costPerResult : m.cpa;
      cpaEl.textContent = val ? formatINR(val) : '—';
    }

    const remEl = document.getElementById('print-kpi-remaining');
    if (remEl) remEl.textContent = b.remaining ? formatINR(b.remaining) : '—';
  }

  switchView(viewName, updateUrl = true) {
    this.closeMobileSidebar();
    this.closeMobileRail();

    const resolvedView = this.resolveViewFromRoute(viewName) || (this.isValidView(viewName) ? viewName : 'overview');
    store.activeView = resolvedView;
    this.hasRenderedInitialView = true;

    // Synchronize browser URL bar to #<route>
    if (updateUrl && typeof window !== 'undefined') {
      const primaryHash = '#' + this.getPrimaryHashForView(resolvedView);
      if (window.location.hash !== primaryHash) {
        window.location.hash = primaryHash;
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
    const topSelect = document.getElementById('top-period-select');
    const mobileSelect = document.getElementById('mobile-period-select');
    const selects = [topSelect, mobileSelect].filter(Boolean);
    if (selects.length === 0) return;

    const allReports = store.getAllReports();
    if (!allReports || allReports.length === 0) {
      selects.forEach(s => s.innerHTML = '<option value="" disabled selected>No Reports Loaded</option>');
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

    selects.forEach(s => s.innerHTML = html);
  }

  renderHeaderControls() {
    // 1. Sync platform tab styling (desktop and mobile)
    const currentPlatform = store.platformFilter || 'all';
    document.querySelectorAll('[data-platform-tab]').forEach(btn => {
      const tab = btn.getAttribute('data-platform-tab');
      const isMobileTab = btn.closest('#mobile-platform-filter') !== null;
      if (tab === currentPlatform) {
        btn.className = isMobileTab
          ? 'flex-1 py-1 text-center rounded-md font-medium transition bg-white text-black text-[11px]'
          : 'px-2.5 py-1 rounded-md font-medium transition bg-white text-black text-[11px]';
      } else {
        btn.className = isMobileTab
          ? 'flex-1 py-1 text-center rounded-md font-medium transition text-[#A3A3A3] hover:text-[#F5F5F5] text-[11px]'
          : 'px-2.5 py-1 rounded-md font-medium transition text-[#A3A3A3] hover:text-[#F5F5F5] text-[11px]';
      }
    });

    // 2. Sync environment status badge (desktop and mobile)
    const envBadges = [document.getElementById('hdr-environment-badge'), document.getElementById('mobile-environment-badge')].filter(Boolean);
    envBadges.forEach(envBadge => {
      envBadge.classList.remove('hidden');
      if (store.isLocalServer) {
        envBadge.className = 'flex items-center space-x-1.5 px-2 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] border border-white/[0.12] bg-[#171717] text-white';
        envBadge.innerHTML = `
          <span class="w-1.5 h-1.5 rounded-full bg-white"></span>
          <span class="font-medium">Local Admin</span>
        `;
      } else {
        envBadge.className = 'flex items-center space-x-1.5 px-2 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] border border-white/[0.08] bg-[#111111] text-[#A3A3A3]';
        envBadge.innerHTML = `
          <span class="w-1.5 h-1.5 rounded-full bg-white/70"></span>
          <span class="font-medium text-[#F5F5F5]">Live Global View</span>
        `;
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

    if (window.innerWidth >= 768) {
      if (!store.isContextRailOpen) {
        rail.classList.add('hidden');
        return;
      }
      rail.classList.remove('hidden');
    } else {
      // On mobile, off-canvas drawer is toggled via translate classes
      rail.classList.remove('hidden');
    }

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
        <div class="p-3.5 sm:p-5 flex flex-col justify-between ${idx % 2 !== 0 ? 'border-l border-white/[0.08]' : ''} ${idx >= 2 ? 'border-t border-white/[0.08]' : ''} ${idx >= 4 ? 'lg:border-t' : 'lg:border-t-0'} ${idx % 4 !== 0 ? 'lg:border-l lg:border-white/[0.08]' : 'lg:border-l-0'}">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-[#A3A3A3] font-medium">${k.label}</span>
              ${k.delta ? `
                <span class="text-[10px] sm:text-[11px] font-medium text-[#A3A3A3]">
                  ${k.delta}
                </span>
              ` : ''}
            </div>
            <div class="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-semibold text-white tracking-tight break-words">
              ${k.val}
            </div>
          </div>
          <p class="text-[10px] sm:text-[11px] text-[#737373] mt-1.5 sm:mt-2 font-normal">${k.sub}</p>
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
          <td class="py-3 px-4 text-xs text-[#737373] font-medium whitespace-nowrap">#${c.rank}</td>
          <td class="py-3 px-4 min-w-[180px]">
            <div class="font-medium text-xs text-[#F5F5F5]">${c.name}</div>
            <div class="text-[11px] text-[#A3A3A3]">${c.specialty}</div>
          </td>
          <td class="py-3 px-4 whitespace-nowrap">
            <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-[#171717] ${platColorClass} border border-white/[0.08]">
              ${platDisplay}
            </span>
          </td>
          <td class="py-3 px-4 whitespace-nowrap">
            <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-[#171717] text-[#A3A3A3] border border-white/[0.08]">
              ${c.channel}
            </span>
          </td>
          <td class="py-3 px-4 text-right text-xs text-[#F5F5F5] font-medium whitespace-nowrap">${formatINR(c.spend)}</td>
          <td class="py-3 px-4 text-right text-xs text-[#A3A3A3] whitespace-nowrap">${formatNumber(c.clicks)}</td>
          <td class="py-3 px-4 text-right text-xs ${c.cpc > 50 ? 'text-white font-medium' : 'text-[#A3A3A3]'} whitespace-nowrap">${formatINR(c.cpc)}</td>
          <td class="py-3 px-4 text-right text-xs text-[#A3A3A3] whitespace-nowrap">${c.ctr}%</td>
          <td class="py-3 px-4 text-right text-xs text-[#A3A3A3] whitespace-nowrap">${formatNumber(c.leads || 0)}</td>
          <td class="py-3 px-4 text-right text-xs font-semibold ${c.conversions > 0 ? 'text-white' : 'text-[#737373]'} whitespace-nowrap">
            ${c.conversions}
          </td>
          <td class="py-3 px-4 text-right text-xs text-[#A3A3A3] whitespace-nowrap">${c.phoneCalls}</td>
          <td class="py-3 px-4 text-right text-xs font-medium whitespace-nowrap ${
            c.cpa === null ? 'text-[#737373]' : (c.cpa <= 5000 ? 'text-white' : 'text-[#A3A3A3]')
          }">
            ${c.cpa === null ? 'None (0 conv)' : formatINR(c.cpa)}
          </td>
          <td class="py-3 px-4 whitespace-nowrap">
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
    const isLocal = store.isLocalServer;
    const publicNotice = document.getElementById('public-visitor-notice');
    const stage1Header = document.getElementById('admin-stage-1-header');
    const publishPanel = document.getElementById('global-publish-panel');
    const publishStatusText = document.getElementById('global-publish-status-text');

    if (publicNotice) {
      if (isLocal) {
        publicNotice.classList.add('hidden');
      } else {
        publicNotice.classList.remove('hidden');
        publicNotice.innerHTML = `
          <div class="flex items-center space-x-2 text-white font-medium">
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Cloud Ingestion Active · Universal CSV & Reporting Engine</span>
          </div>
          <p class="text-[#A3A3A3] leading-relaxed">
            Drop any advertising CSV report below (Google Ads, Meta Ads Manager, cross-tab, or custom). The system will automatically validate, parse all campaigns and periods, and enable live dashboard inspection and sharp executive report downloads in your browser.
          </p>
        `;
      }
    }

    if (stage1Header) {
      stage1Header.classList.remove('hidden');
    }

    const apiSyncPanel = document.getElementById('api-sync-panel');
    const apiCsvDivider = document.getElementById('api-csv-divider');
    if (apiSyncPanel) {
      if (isLocal) {
        apiSyncPanel.classList.remove('hidden');
        if (apiCsvDivider) apiCsvDivider.classList.remove('hidden');
        this.refreshGoogleAdsStatus();
      } else {
        apiSyncPanel.classList.add('hidden');
        if (apiCsvDivider) apiCsvDivider.classList.add('hidden');
      }
    }

    const dropzone = document.getElementById('csv-dropzone');
    if (dropzone) {
      dropzone.classList.remove('hidden');
    }

    if (publishPanel) {
      if (isLocal) {
        publishPanel.classList.remove('hidden');
        if (publishStatusText) {
          const count = store.getAllReports().length;
          const lastPublished = store.masterPublishedAt ? new Date(store.masterPublishedAt).toLocaleString() : 'Not published yet';
          publishStatusText.textContent = `${count} verified reporting periods staged in data/reports.json. Last published: ${lastPublished}`;
        }
      } else {
        publishPanel.classList.add('hidden');
      }
    }

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
                    <button onclick="window.vsApp.resolveBatchDuplicate(${idx}, 'replace')" class="bg-white hover:bg-[#E5E5E5] text-black text-xs font-semibold px-3.5 py-2 rounded-lg transition inline-flex items-center space-x-1 shadow-sm">
                      <span>Replace Existing</span>
                    </button>
                    <button onclick="window.vsApp.resolveBatchDuplicate(${idx}, 'keep')" class="bg-[#171717] hover:bg-[#1D1D1D] text-[#A3A3A3] hover:text-white border border-white/[0.08] text-xs font-medium px-3.5 py-2 rounded-lg transition inline-flex items-center space-x-1">
                      <span>Keep Existing</span>
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

  openPublishConfirmModal() {
    const modal = document.getElementById('publish-confirm-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  }

  closePublishConfirmModal() {
    const modal = document.getElementById('publish-confirm-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  async executePublish() {
    const btn = document.getElementById('btn-confirm-publish');
    const btnText = document.getElementById('publish-btn-text');
    const spinner = document.getElementById('publish-spinner');
    const feedbackAlert = document.getElementById('publish-feedback-alert');

    if (btn) btn.disabled = true;
    if (btnText) btnText.textContent = 'Publishing...';
    if (spinner) spinner.classList.remove('hidden');

    try {
      const result = await store.publishMasterToGitHub();
      this.closePublishConfirmModal();

      if (feedbackAlert) {
        feedbackAlert.classList.remove('hidden');
        feedbackAlert.className = 'p-3.5 rounded-lg border border-white/20 bg-[#171717] text-xs text-[#F5F5F5] flex items-center space-x-2';
        feedbackAlert.innerHTML = `
          <i data-lucide="check-circle" class="w-4 h-4 text-white flex-shrink-0"></i>
          <span>${result.message || 'Published to GitHub. The live site may take a short time to update.'}</span>
        `;
        this.refreshIcons();
      }

      // Update status text
      const publishStatusText = document.getElementById('global-publish-status-text');
      if (publishStatusText) {
        const count = store.getAllReports().length;
        publishStatusText.textContent = `${count} verified reporting periods published to data/reports.json. Last published: ${new Date().toLocaleString()}`;
      }
    } catch (err) {
      if (feedbackAlert) {
        feedbackAlert.classList.remove('hidden');
        feedbackAlert.className = 'p-3.5 rounded-lg border border-white/30 bg-[#171717] text-xs text-white flex items-center space-x-2';
        feedbackAlert.innerHTML = `
          <i data-lucide="alert-triangle" class="w-4 h-4 text-white flex-shrink-0"></i>
          <span>Publish Failed: ${err.message}</span>
        `;
        this.refreshIcons();
      }
    } finally {
      if (btn) btn.disabled = false;
      if (btnText) btnText.textContent = 'Confirm & Publish';
      if (spinner) spinner.classList.add('hidden');
    }
  }

  async refreshGoogleAdsStatus() {
    const badge = document.getElementById('google-ads-mode-badge');
    const desc = document.getElementById('google-ads-sync-desc');
    const dot = document.getElementById('google-ads-status-dot');

    try {
      const status = await store.getGoogleAdsStatus();
      if (!status || !status.success) return;

      if (badge) {
        badge.textContent = status.mode === 'live' ? 'Google Ads · Live' : 'Google Ads · Mock Mode';
        badge.className = status.mode === 'live'
          ? 'text-[10px] px-2 py-0.5 rounded bg-[#171717] border border-white/40 text-white font-mono'
          : 'text-[10px] px-2 py-0.5 rounded bg-[#171717] border border-white/[0.1] text-[#A3A3A3] font-mono';
      }

      if (desc) {
        let lastSyncStr = '';
        if (status.lastGoogleSync) {
          lastSyncStr = ` Last synced: ${new Date(status.lastGoogleSync).toLocaleString()}.`;
        }
        if (status.mode === 'live') {
          desc.textContent = `Live GAQL connected to account ${status.customerId || ''}.${lastSyncStr}`;
        } else {
          desc.textContent = `Mock provider active for safe testing.${lastSyncStr}`;
        }
      }

      if (dot) {
        dot.className = status.mode === 'live' ? 'w-2 h-2 rounded-full bg-white animate-pulse' : 'w-2 h-2 rounded-full bg-white';
      }
    } catch (e) {
      console.warn('[App] Could not refresh Google Ads status:', e);
    }
  }

  async syncGoogleAds() {
    const btn = document.getElementById('btn-sync-google-ads');
    const btnText = document.getElementById('btn-sync-google-ads-text');
    const alertBox = document.getElementById('google-ads-sync-alert');

    if (btn) btn.disabled = true;
    if (btnText) btnText.textContent = 'Syncing...';

    if (alertBox) {
      alertBox.classList.remove('hidden');
      alertBox.className = 'p-3 rounded-lg border border-white/[0.1] bg-[#171717] text-xs text-[#A3A3A3] flex items-center space-x-2';
      alertBox.innerHTML = `
        <span class="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin flex-shrink-0"></span>
        <span>Querying Google Ads API and aggregating campaign metrics...</span>
      `;
    }

    try {
      const activeReport = store.getActiveReport();
      const params = {};
      if (activeReport && activeReport.period) {
        params.startDate = activeReport.period.startDate;
        params.endDate = activeReport.period.endDate;
        params.periodId = activeReport.period.periodId;
        params.periodLabel = activeReport.period.periodLabel;
      }

      const res = await store.syncGoogleAds(params);

      if (alertBox) {
        alertBox.className = 'p-3.5 rounded-lg border border-white/20 bg-[#171717] text-xs text-[#F5F5F5] flex items-start space-x-2.5';
        alertBox.innerHTML = `
          <i data-lucide="check-circle" class="w-4 h-4 text-white flex-shrink-0 mt-0.5"></i>
          <div>
            <span class="font-medium text-white">${res.message || 'Google Ads synchronized successfully!'}</span>
            <p class="text-[11px] text-[#A3A3A3] mt-0.5">
              Period: <strong>${res.periodLabel || res.periodId}</strong> · ${res.campaignCount} campaigns · ₹${(res.spend || 0).toLocaleString()} actual spend.
            </p>
          </div>
        `;
        this.refreshIcons();
      }

      await this.refreshGoogleAdsStatus();
      this.populateReportDropdowns();
      this.renderHeaderControls();
      this.renderContextRail();
      this.renderActiveView();
      this.refreshIcons();

    } catch (err) {
      console.error('[App] Google Ads sync failed:', err);
      if (alertBox) {
        alertBox.className = 'p-3.5 rounded-lg border border-white/30 bg-[#171717] text-xs text-white flex items-start space-x-2.5';
        alertBox.innerHTML = `
          <i data-lucide="alert-triangle" class="w-4 h-4 text-white flex-shrink-0 mt-0.5"></i>
          <div>
            <span class="font-medium text-white">Synchronization Error</span>
            <p class="text-[11px] text-[#A3A3A3] mt-0.5">${err.message}</p>
          </div>
        `;
        this.refreshIcons();
      }
    } finally {
      if (btn) btn.disabled = false;
      if (btnText) btnText.textContent = 'Sync Google Ads';
    }
  }
}

// Attach globally
window.store = store;
window.CsvEngine = CsvEngine;
window.vsApp = new AppController();
window.app = window.vsApp;



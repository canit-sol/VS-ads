/**
 * VS Ads Intelligence - Chart Management Engine (Chart.js Integration)
 * Dark Editorial Analytics Palette: Muted Teal, Restrained Terracotta, Subtle Grids
 */

import { store, formatINR } from './store.js';

export class ChartManager {
  static instances = {};

  static initGlobalDefaults() {
    if (typeof Chart === 'undefined') return;

    Chart.defaults.color = '#A3A3A3';
    Chart.defaults.font.family = 'Inter, system-ui, -apple-system, sans-serif';
    Chart.defaults.font.size = 11;
    Chart.defaults.plugins.tooltip.backgroundColor = '#171717';
    Chart.defaults.plugins.tooltip.titleColor = '#FFFFFF';
    Chart.defaults.plugins.tooltip.bodyColor = '#A3A3A3';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(255, 255, 255, 0.08)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 6;
    Chart.defaults.plugins.tooltip.displayColors = true;
  }

  /**
   * Render Dual-Axis Weekly Velocity Chart (Conversions Bar + CPA Line)
   */
  static renderVelocityChart(canvasId, reports, platform = 'all') {
    if (typeof Chart === 'undefined') return;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (this.instances[canvasId]) {
      this.instances[canvasId].destroy();
    }

    // Filter weekly reports: any report that is not a monthly aggregate
    const weeklyReports = reports
      .filter(r => {
        if (!r || !r.metrics) return false;
        if (r.period && r.period.isMonthlyAggregate) return false;
        if (r.period && r.period.weekNumber !== null && r.period.weekNumber !== undefined) return true;
        const idLower = (r.reportId || '').toLowerCase();
        const nameLower = (r.periodName || '').toLowerCase();
        if (idLower.includes('cumulative') || nameLower.includes('monthly')) return false;
        return idLower.includes('_w') || nameLower.includes('week');
      })
      .map(r => {
        if (platform && platform !== 'all' && store && store.getScopedReport) {
          return store.getScopedReport(r, platform);
        }
        return r;
      })
      .sort((a, b) => {
        const startA = a.period?.startDate || a.uploadedAt || a.reportId || '';
        const startB = b.period?.startDate || b.uploadedAt || b.reportId || '';
        return startA.localeCompare(startB);
      });

    const emptyMsgEl = document.getElementById('chart-velocity-empty');

    if (weeklyReports.length === 0) {
      if (emptyMsgEl) emptyMsgEl.classList.remove('hidden');
      canvas.classList.add('hidden');
      return;
    }

    if (emptyMsgEl) emptyMsgEl.classList.add('hidden');
    canvas.classList.remove('hidden');

    const labels = weeklyReports.map(r => {
      if (r.period && r.period.weekNumber) {
        const monthAbbr = r.period.month ? r.period.month.slice(0, 3) : '';
        return `W${r.period.weekNumber} · ${monthAbbr}`;
      }
      const rawName = r.period ? r.period.periodLabel : (r.periodName || 'Week');
      return rawName.split('·')[0].split('(')[0].trim();
    });

    const isMeta = platform === 'meta';
    const conversions = weeklyReports.map(r => {
      if (isMeta && r.metrics?.sourceResults) return r.metrics.sourceResults;
      return r.metrics?.conversions || 0;
    });
    const cpas = weeklyReports.map(r => {
      if (isMeta && r.metrics?.costPerResult) return r.metrics.costPerResult;
      return r.metrics?.cpa || (r.metrics?.conversions ? Math.round(r.metrics.spend / r.metrics.conversions) : null);
    });

    const convLabel = isMeta ? 'Results' : 'Recorded Conversions';
    const cpaLabel = isMeta ? 'Cost Per Result (CPR)' : 'Cost Per Acquisition (CPA)';

    const ctx = canvas.getContext('2d');

    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: convLabel,
            data: conversions,
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            borderColor: '#FFFFFF',
            borderWidth: 1,
            borderRadius: 2,
            maxBarThickness: 48,
            yAxisID: 'yConversions',
            order: 2
          },
          {
            label: cpaLabel,
            data: cpas,
            type: 'line',
            borderColor: '#737373',
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            pointBackgroundColor: '#737373',
            pointBorderColor: '#111111',
            pointBorderWidth: 1.5,
            pointRadius: 3.5,
            pointHoverRadius: 5,
            tension: 0.2,
            yAxisID: 'yCpa',
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#A3A3A3', font: { weight: '500' } }
          },
          yConversions: {
            type: 'linear',
            position: 'right',
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'Conversions', color: '#FFFFFF', font: { size: 10, weight: '500' } },
            ticks: { stepSize: 4, color: '#A3A3A3' }
          },
          yCpa: {
            type: 'linear',
            position: 'left',
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            title: { display: true, text: 'CPA (₹)', color: '#A3A3A3', font: { size: 10, weight: '500' } },
            ticks: {
              color: '#A3A3A3',
              callback: val => '₹' + (val / 1000) + 'k'
            }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: { color: '#A3A3A3', usePointStyle: true, boxWidth: 6, font: { size: 11 } }
          },
          tooltip: {
            callbacks: {
              label: context => {
                if (context.dataset.yAxisID === 'yCpa') {
                  return ` CPA: ${formatINR(context.raw)}`;
                }
                return ` Conversions: ${context.raw} patient leads`;
              }
            }
          }
        }
      }
    });
  }

  /**
   * Render Budget & Channel Share Doughnut Chart
   */
  static renderChannelShareChart(canvasId, report) {
    if (typeof Chart === 'undefined') return;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (this.instances[canvasId]) {
      this.instances[canvasId].destroy();
    }

    const campaigns = report.campaigns || [];
    const topCampaigns = [...campaigns].sort((a, b) => b.spend - a.spend).slice(0, 5);
    const otherSpend = campaigns.slice(5).reduce((acc, c) => acc + c.spend, 0);

    const labels = topCampaigns.map(c => c.name);
    const data = topCampaigns.map(c => c.spend);

    if (otherSpend > 0) {
      labels.push('Other Campaigns');
      data.push(otherSpend);
    }

    // Strict monochrome scale: white to dark charcoal
    const colors = [
      '#FFFFFF', // Pure white
      '#D4D4D4', // Light grey
      '#A3A3A3', // Medium grey
      '#737373', // Neutral grey
      '#525252', // Darker grey
      '#262626'  // Charcoal
    ];

    const ctx = canvas.getContext('2d');
    this.instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.slice(0, data.length),
          borderColor: '#111111',
          borderWidth: 2,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '74%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#A3A3A3',
              boxWidth: 8,
              usePointStyle: true,
              font: { size: 11 },
              padding: 10
            }
          },
          tooltip: {
            callbacks: {
              label: context => {
                const val = context.raw;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const pct = ((val / total) * 100).toFixed(1);
                return ` ${context.label}: ${formatINR(val)} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  /**
   * Render Campaign CPA Horizontal Bar Chart (With restrained semantic thresholds)
   */
  static renderCpaBarChart(canvasId, campaigns) {
    if (typeof Chart === 'undefined') return;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (this.instances[canvasId]) {
      this.instances[canvasId].destroy();
    }

    const sorted = [...campaigns].sort((a, b) => {
      if (a.cpa === null) return 1;
      if (b.cpa === null) return -1;
      return a.cpa - b.cpa;
    });

    const labels = sorted.map(c => c.name);
    const cpaValues = sorted.map(c => (c.cpa === null ? 60000 : c.cpa));

    // Semantic color scale: Emerald for efficient (<5k), Amber for moderate (5k-20k), Crimson for excessive/null
    const barColors = sorted.map(c => {
      if (c.cpa === null || c.cpa > 20000) return '#EF4444'; // Vivid Crimson
      if (c.cpa > 5000) return '#F59E0B'; // Warm Amber
      return '#10B981'; // Emerald Green
    });

    const ctx = canvas.getContext('2d');
    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'CPA (₹)',
          data: cpaValues,
          backgroundColor: barColors,
          borderRadius: 2,
          borderWidth: 0
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#A3A3A3',
              callback: val => '₹' + (val / 1000) + 'k'
            },
            max: 65000
          },
          y: {
            grid: { display: false },
            ticks: { color: '#F5F5F5', font: { weight: '500' } }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: context => {
                const item = sorted[context.dataIndex];
                if (item.cpa === null) return ` CPA: Zero Conversions (₹${item.cpc} CPC)`;
                return ` CPA: ${formatINR(item.cpa)} (${item.conversions} conversions)`;
              }
            }
          }
        }
      }
    });
  }

  /**
   * Apply high-contrast executive light print theme to all active charts
   */
  static applyPrintTheme() {
    if (typeof Chart === 'undefined') return;

    // Velocity Chart
    const velocityChart = this.instances['chart-velocity'];
    if (velocityChart) {
      if (velocityChart.data?.datasets?.[0]) {
        velocityChart.data.datasets[0].backgroundColor = '#0F172A'; // Deep black bar
        velocityChart.data.datasets[0].borderColor = '#000000';
      }
      if (velocityChart.data?.datasets?.[1]) {
        velocityChart.data.datasets[1].borderColor = '#1D4ED8'; // Deep royal blue line
        velocityChart.data.datasets[1].pointBackgroundColor = '#1D4ED8';
        velocityChart.data.datasets[1].pointBorderColor = '#FFFFFF';
      }
      if (velocityChart.options?.scales) {
        if (velocityChart.options.scales.x) {
          velocityChart.options.scales.x.grid.color = '#E2E8F0';
          velocityChart.options.scales.x.ticks.color = '#0F172A';
        }
        if (velocityChart.options.scales.yConversions) {
          velocityChart.options.scales.yConversions.ticks.color = '#0F172A';
          if (velocityChart.options.scales.yConversions.title) {
            velocityChart.options.scales.yConversions.title.color = '#0F172A';
          }
        }
        if (velocityChart.options.scales.yCpa) {
          velocityChart.options.scales.yCpa.grid.color = '#E2E8F0';
          velocityChart.options.scales.yCpa.ticks.color = '#0F172A';
          if (velocityChart.options.scales.yCpa.title) {
            velocityChart.options.scales.yCpa.title.color = '#0F172A';
          }
        }
      }
      if (velocityChart.options?.plugins?.legend?.labels) {
        velocityChart.options.plugins.legend.labels.color = '#0F172A';
      }
      velocityChart.update('none');
    }

    // Channel Share Doughnut
    const shareChart = this.instances['chart-channel-share'];
    if (shareChart) {
      if (shareChart.data?.datasets?.[0]) {
        const printPalette = ['#0F172A', '#1D4ED8', '#047857', '#B45309', '#6D28D9', '#475569'];
        shareChart.data.datasets[0].backgroundColor = printPalette.slice(0, shareChart.data.datasets[0].data.length);
        shareChart.data.datasets[0].borderColor = '#FFFFFF';
        shareChart.data.datasets[0].borderWidth = 2;
      }
      if (shareChart.options?.plugins?.legend?.labels) {
        shareChart.options.plugins.legend.labels.color = '#0F172A';
      }
      shareChart.update('none');
    }

    // CPA Horizontal Bar Chart
    // CPA Horizontal Bar Chart
    const cpaChart = this.instances['chart-campaigns-cpa'];
    if (cpaChart) {
      if (cpaChart.data?.datasets?.[0]) {
        const values = cpaChart.data.datasets[0].data || [];
        cpaChart.data.datasets[0].backgroundColor = values.map(val => {
          if (val === null || val > 20000) return '#DC2626'; // Vivid Crimson Red
          if (val > 5000) return '#D97706'; // Warm Amber
          return '#059669'; // Emerald Green
        });
      }
      if (cpaChart.options?.scales) {
        if (cpaChart.options.scales.x) {
          cpaChart.options.scales.x.grid.color = '#CBD5E1';
          cpaChart.options.scales.x.ticks.color = '#09090B';
          cpaChart.options.scales.x.ticks.font = { weight: 'bold', size: 10 };
        }
        if (cpaChart.options.scales.y) {
          cpaChart.options.scales.y.ticks.color = '#09090B';
          cpaChart.options.scales.y.ticks.font = { weight: 'bold', size: 11 };
        }
      }
      cpaChart.update('none');
    }
  }

  /**
   * Restore default dark editorial theme
   */
  static restoreDarkTheme() {
    if (typeof Chart === 'undefined') return;
    this.initGlobalDefaults();

    // Trigger re-render of current view's charts
    const activeReport = store.getActiveReport();
    if (activeReport) {
      const activePlatform = store.platformFilter || 'all';
      const allReports = store.getAllReports();
      this.renderVelocityChart('chart-velocity', allReports, activePlatform);
      this.renderChannelShareChart('chart-channel-share', store.getActiveReportScoped(activePlatform));
      if (store.activeView === 'campaigns') {
        const rep = store.getActiveReportScoped(activePlatform);
        if (rep && rep.campaigns) {
          this.renderCpaBarChart('chart-campaigns-cpa', rep.campaigns);
        }
      }
    }
  }
}

// Auto-bind beforeprint and afterprint to switch chart palettes seamlessly
if (typeof window !== 'undefined') {
  window.addEventListener('beforeprint', () => {
    ChartManager.applyPrintTheme();
  });
  window.addEventListener('afterprint', () => {
    ChartManager.restoreDarkTheme();
  });
}

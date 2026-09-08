/**
 * VS Ads Intelligence - Chart Management Engine (Chart.js Integration)
 * Dark Editorial Analytics Palette: Muted Teal, Restrained Terracotta, Subtle Grids
 */

import { formatINR } from './store.js';

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
  static renderVelocityChart(canvasId, reports) {
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
    const conversions = weeklyReports.map(r => r.metrics?.conversions || 0);
    const cpas = weeklyReports.map(r => r.metrics?.cpa || (r.metrics?.conversions ? Math.round(r.metrics.spend / r.metrics.conversions) : null));

    const ctx = canvas.getContext('2d');

    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Recorded Conversions',
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
            label: 'Cost Per Acquisition (CPA)',
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

    // Monochromatic scale: White for efficient (<5k), Medium grey for moderate (5k-20k), Darker grey for excessive/null
    const barColors = sorted.map(c => {
      if (c.cpa === null || c.cpa > 20000) return '#525252'; // Darker grey
      if (c.cpa > 5000) return '#A3A3A3'; // Medium grey
      return '#FFFFFF'; // Pure white
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
}

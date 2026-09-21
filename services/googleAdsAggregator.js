/**
 * VS Ads Intelligence - Google Ads Data Aggregator & Normalizer
 * Phase 1: Normalization into Unified CampaignMetric & Report Interfaces
 */

const fs = require('fs');
const path = require('path');

const BUDGET_CONFIG_PATH = path.join(__dirname, '..', 'config', 'budget-targets.json');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function loadBudgetTargets() {
  if (fs.existsSync(BUDGET_CONFIG_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(BUDGET_CONFIG_PATH, 'utf8'));
    } catch (e) {
      console.warn('[GoogleAdsAggregator] Could not read budget-targets.json:', e.message);
    }
  }
  return { defaultMonthlyBudget: 1128000, defaultWeeklyBudget: 250000, periodTargets: {} };
}

class GoogleAdsAggregator {
  /**
   * Maps Google Ads advertising_channel_type to standard channel & section
   * @param {string} channelType 
   * @returns {{ channel: string, section: string }}
   */
  mapChannel(channelType) {
    const norm = (channelType || '').toUpperCase();
    if (norm === 'SEARCH') {
      return { channel: 'Search', section: 'Google Search' };
    }
    if (norm === 'PERFORMANCE_MAX') {
      return { channel: 'PMax', section: 'Google PMAX' };
    }
    if (norm === 'VIDEO') {
      return { channel: 'YouTube', section: 'YouTube' };
    }
    if (norm === 'DISPLAY') {
      return { channel: 'Display', section: 'Google Display' };
    }
    return { channel: 'Other', section: 'Google Ads' };
  }

  /**
   * Determine specialty from campaign name
   * @param {string} name 
   * @returns {string}
   */
  inferSpecialty(name) {
    const lower = (name || '').toLowerCase();
    if (lower.includes('kilpauk')) return 'Kilpauk Multispeciality';
    if (lower.includes('chetpet')) return 'Chetpet Emergency';
    if (lower.includes('tirunelveli') || lower.includes('oncology') || lower.includes('cancer')) return 'Oncology';
    if (lower.includes('knee') || lower.includes('ortho')) return 'Orthopaedics';
    if (lower.includes('package')) return 'Specialty Packages';
    return 'General Healthcare';
  }

  /**
   * Aggregate daily API rows into CampaignMetric records for a single period
   * @param {Array} apiRows 
   * @returns {Array<import('../js/models').CampaignMetric>}
   */
  aggregateRowsToCampaigns(apiRows) {
    const map = new Map();

    for (const row of apiRows) {
      const camp = row.campaign || {};
      const metrics = row.metrics || {};
      const id = String(camp.id || camp.name || 'unknown');
      const name = String(camp.name || 'Unnamed Campaign').trim();
      const channelInfo = this.mapChannel(camp.advertisingChannelType || camp.advertising_channel_type);

      const costMicros = Number(metrics.costMicros || metrics.cost_micros || 0);
      const impressions = Number(metrics.impressions || 0);
      const clicks = Number(metrics.clicks || 0);
      const conversions = Number(metrics.conversions || 0);
      const allConversions = Number(metrics.allConversions || metrics.all_conversions || conversions);

      if (!map.has(id)) {
        map.set(id, {
          id: `camp_${id}_${channelInfo.channel}_${name}`,
          name: name,
          platform: 'google',
          channel: channelInfo.channel,
          section: channelInfo.section,
          specialty: this.inferSpecialty(name),
          costMicros: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          allConversions: 0
        });
      }

      const rec = map.get(id);
      rec.costMicros += costMicros;
      rec.impressions += impressions;
      rec.clicks += clicks;
      rec.conversions += conversions;
      rec.allConversions += allConversions;
    }

    // Convert accumulated numbers into normalized CampaignMetrics
    const campaigns = Array.from(map.values()).map(c => {
      const spend = Number((c.costMicros / 1000000).toFixed(2));
      const ctr = c.impressions > 0 ? Number(((c.clicks / c.impressions) * 100).toFixed(2)) : 0;
      const cpc = c.clicks > 0 ? Number((spend / c.clicks).toFixed(2)) : 0;
      const cpa = c.conversions > 0 ? Number((spend / c.conversions).toFixed(2)) : null;
      const costPerAllConv = c.allConversions > 0 ? Number((spend / c.allConversions).toFixed(2)) : null;
      const conversionRate = c.clicks > 0 ? Number(((c.conversions / c.clicks) * 100).toFixed(2)) : 0;

      let classification = 'moderate';
      let mainIssue = 'Stable performance';
      let notes = '';

      if (c.conversions >= 5 && cpa !== null && cpa <= 4000) {
        classification = 'strong';
        mainIssue = 'High-efficiency scaling asset';
        notes = 'Candidate for daily budget expansion.';
      } else if (spend > 10000 && (c.conversions === 0 || (cpa !== null && cpa > 15000))) {
        classification = 'weak';
        mainIssue = c.conversions === 0 ? 'Zero conversions recorded' : 'High acquisition cost';
        notes = 'Trim bid or pause search keywords.';
      } else if (cpc > 50) {
        classification = 'weak';
        mainIssue = 'Search keyword bidding spike';
        notes = 'Excessive CPC eroding budget run-rate.';
      }

      return {
        id: c.id,
        name: c.name,
        platform: 'google',
        channel: c.channel,
        section: c.section,
        specialty: c.specialty,
        spend: spend,
        impressions: c.impressions,
        clicks: c.clicks,
        ctr: ctr,
        cpc: cpc,
        leads: 0, // Google Ads reports explicit conversions
        conversions: Math.round(c.conversions),
        sourceResults: 0,
        phoneCalls: 0,
        allConversions: Math.round(c.allConversions),
        allConversionsDerived: false,
        cpa: cpa,
        costPerAllConv: costPerAllConv,
        conversionRate: conversionRate,
        classification: classification,
        rank: 0,
        mainIssue: mainIssue,
        notes: notes
      };
    });

    // Sort by spend descending and assign rank
    campaigns.sort((a, b) => b.spend - a.spend);
    campaigns.forEach((c, idx) => { c.rank = idx + 1; });

    return campaigns;
  }

  /**
   * Build a complete Report object for a designated date range
   * @param {string} startDate - 'YYYY-MM-DD'
   * @param {string} endDate - 'YYYY-MM-DD'
   * @param {Array} apiRows 
   * @param {Object} [options]
   * @returns {Object} Report
   */
  buildReport(startDate, endDate, apiRows, options = {}) {
    const sDate = new Date(startDate);
    const eDate = new Date(endDate);

    const year = sDate.getFullYear();
    const monthNumber = sDate.getMonth() + 1;
    const month = MONTH_NAMES[sDate.getMonth()];

    // Determine week number within month based on start day
    const day = sDate.getDate();
    let weekNumber = Math.ceil(day / 7);
    if (weekNumber > 5) weekNumber = 5;

    const padMonth = String(monthNumber).padStart(2, '0');
    const padWeek = String(weekNumber).padStart(2, '0');
    const periodId = options.periodId || `${year}_M${padMonth}_W${padWeek}`;
    const reportId = `vs_rep_${periodId}`;

    const startStr = `${sDate.toLocaleString('default', { month: 'short' })} ${sDate.getDate()}`;
    const endStr = `${eDate.toLocaleString('default', { month: 'short' })} ${eDate.getDate()}, ${year}`;
    const periodLabel = options.periodLabel || `Week ${weekNumber} · ${startStr}–${eDate.getDate()}, ${year}`;

    const period = {
      periodId: periodId,
      year: year,
      month: month,
      monthNumber: monthNumber,
      weekNumber: weekNumber,
      startDate: startDate,
      endDate: endDate,
      periodLabel: periodLabel,
      isMonthlyAggregate: Boolean(options.isMonthlyAggregate)
    };

    const googleCampaigns = this.aggregateRowsToCampaigns(apiRows);

    // Merge with any existing non-Google campaigns if merging into an existing report
    let combinedCampaigns = [...googleCampaigns];
    if (options.existingCampaigns && Array.isArray(options.existingCampaigns)) {
      const nonGoogle = options.existingCampaigns.filter(c => c.platform !== 'google');
      combinedCampaigns = [...combinedCampaigns, ...nonGoogle];
    }

    // Re-rank combined campaigns
    combinedCampaigns.sort((a, b) => b.spend - a.spend);
    combinedCampaigns.forEach((c, idx) => { c.rank = idx + 1; });

    // Aggregate overall metrics
    let totalSpend = 0;
    let impressions = 0;
    let clicks = 0;
    let conversions = 0;
    let allConversions = 0;
    let leads = 0;
    let phoneCalls = 0;
    let sourceResults = 0;

    for (const c of combinedCampaigns) {
      totalSpend += c.spend || 0;
      impressions += c.impressions || 0;
      clicks += c.clicks || 0;
      conversions += c.conversions || 0;
      allConversions += c.allConversions || 0;
      leads += c.leads || 0;
      phoneCalls += c.phoneCalls || 0;
      sourceResults += c.sourceResults || 0;
    }

    totalSpend = Number(totalSpend.toFixed(2));
    const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0;
    const cpc = clicks > 0 ? Number((totalSpend / clicks).toFixed(2)) : 0;
    const cpa = conversions > 0 ? Number((totalSpend / conversions).toFixed(2)) : null;
    const costPerAllConv = allConversions > 0 ? Number((totalSpend / allConversions).toFixed(2)) : null;
    const conversionRate = clicks > 0 ? Number(((conversions / clicks) * 100).toFixed(2)) : 0;

    // Budget Target Integration (Decoupled from actual spend)
    const budgetConfig = loadBudgetTargets();
    const allocatedBudget = budgetConfig.periodTargets[periodId]
      || options.allocatedBudget
      || (period.isMonthlyAggregate ? budgetConfig.defaultMonthlyBudget : budgetConfig.defaultWeeklyBudget)
      || totalSpend;

    const remainingBudget = Math.max(0, allocatedBudget - totalSpend);
    const dayCount = Math.max(1, Math.round((eDate - sDate) / (1000 * 60 * 60 * 24)) + 1);
    const dailyRunRate = Number((totalSpend / dayCount).toFixed(0));
    const spendRatePercent = allocatedBudget > 0 ? Math.round((totalSpend / allocatedBudget) * 100) : 100;

    return {
      reportId: reportId,
      periodName: periodLabel,
      period: period,
      granularity: 'period',
      granularityDescription: `Google Ads Direct API ${options.mode === 'mock' ? '(Mock Fixture)' : '(Live GAQL)'}`,
      uploadedAt: new Date().toISOString(),
      sourceType: 'google-ads-api',
      sourceFileName: options.mode === 'mock' ? 'Google Ads API (Mock Provider)' : 'Google Ads API (Direct Ingestion)',
      status: 'Ready',
      budgetSummary: {
        allocated: allocatedBudget,
        spent: totalSpend,
        remaining: remainingBudget,
        dailyRunRate: dailyRunRate,
        spendRatePercent: spendRatePercent
      },
      metrics: {
        spend: totalSpend,
        totalSpend: totalSpend,
        impressions: impressions,
        clicks: clicks,
        ctr: ctr,
        cpc: cpc,
        leads: leads,
        conversions: conversions,
        sourceResults: sourceResults,
        phoneCalls: phoneCalls,
        allConversions: allConversions,
        allConversionsDerived: false,
        cpa: cpa,
        costPerAllConv: costPerAllConv,
        conversionRate: conversionRate
      },
      campaigns: combinedCampaigns
    };
  }

  /**
   * Safely merge a newly generated Google Ads report into the existing master dataset
   * Preserves all other historical periods and non-Google campaign data
   * @param {Object} currentMaster - Current content of data/reports.json
   * @param {Object} newReport - Generated Report from buildReport
   * @returns {Object} Updated master payload
   */
  mergeIntoMaster(currentMaster, newReport) {
    if (!currentMaster || !Array.isArray(currentMaster.reports)) {
      return {
        version: '1.0.0',
        publishedAt: new Date().toISOString(),
        source: 'VS Hospitals Performance Analytics',
        reportCount: 1,
        reports: [newReport]
      };
    }

    const existingReports = [...currentMaster.reports];
    const existingIdx = existingReports.findIndex(
      r => r.period && r.period.periodId === newReport.period.periodId
    );

    if (existingIdx !== -1) {
      // Update existing period report
      existingReports[existingIdx] = newReport;
    } else {
      // Append new period report
      existingReports.push(newReport);
    }

    return {
      version: currentMaster.version || '1.0.0',
      publishedAt: new Date().toISOString(),
      source: currentMaster.source || 'VS Hospitals Performance Analytics',
      reportCount: existingReports.length,
      reports: existingReports
    };
  }
}

module.exports = new GoogleAdsAggregator();

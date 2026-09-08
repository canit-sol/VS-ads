/**
 * VS Ads Intelligence - Industrial-Grade CSV Ingestion & Normalization Engine
 * Phase 2: Data Engine & Reporting Period Intelligence
 */

import { PeriodEngine } from './period-engine.js';

export class CsvEngine {
  static COLUMN_SYNONYMS = {
    name: ['campaign', 'campaign name', 'campaign_name', 'campaignname', 'ad group', 'adgroup'],
    spend: ['spend', 'cost', 'total cost', 'amount', 'amount spent', 'inr', 'cost (inr)', 'spent'],
    impressions: ['impressions', 'impr', 'impr.', 'views'],
    clicks: ['clicks', 'click count', 'interactions'],
    cpc: ['cpc', 'avg cpc', 'cost / click', 'avg. cpc', 'cost per click', 'avg cpc (inr)'],
    ctr: ['ctr', 'click through rate', 'click-through rate', 'ctr %'],
    leads: ['leads', 'form leads', 'patient leads', 'inquiries', 'web leads', 'lead'],
    conversions: ['conversions', 'conv', 'recorded conversions', 'results', 'primary conversions', 'conv.'],
    phoneCalls: ['phone calls', 'calls', 'call count', 'phone inquiries', 'phone leads', 'call interactions', 'phone call'],
    allConversions: ['all conv', 'all conv.', 'all conversions', 'total conv', 'total conversions', 'all_conversions', 'all conv (recorded)'],
    cpa: ['cpa', 'cost / conv', 'cost per conversion', 'cost per acquisition', 'cost / conv.'],
    costPerAllConv: ['cost / all conv', 'cost / all conv.', 'cost per all conv', 'cost per all conversion'],
    specialty: ['specialty', 'location', 'specialty / loc', 'service', 'department', 'centre'],
    channel: ['channel', 'type', 'campaign type', 'network', 'strategy'],
    date: PeriodEngine.DATE_SYNONYMS
  };

  /**
   * Clean string numbers into clean floats (handles ₹, $, commas, %, etc.)
   */
  static sanitizeNumber(val, defaultValue = 0) {
    if (val === null || val === undefined || val === '') return defaultValue;
    if (typeof val === 'number') return isNaN(val) ? defaultValue : val;

    let clean = String(val).trim();
    // Check for N/A or empty
    if (/^(n\/a|na|none|-|--)$/i.test(clean)) return null;

    // Remove currency symbols, commas, percent, whitespace
    clean = clean.replace(/[₹$,%\s]/g, '');
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Map raw CSV headers to normalized field keys
   */
  static detectColumnMapping(headers) {
    const mapping = {};
    const lowerHeaders = headers.map(h => (h || '').trim().toLowerCase());

    for (const [targetKey, synonyms] of Object.entries(this.COLUMN_SYNONYMS)) {
      let foundIndex = -1;

      // Exact match first
      for (const syn of synonyms) {
        foundIndex = lowerHeaders.findIndex(h => h === syn);
        if (foundIndex !== -1) break;
      }

      // Partial match if exact failed
      if (foundIndex === -1) {
        for (const syn of synonyms) {
          foundIndex = lowerHeaders.findIndex(h => h.includes(syn));
          if (foundIndex !== -1) break;
        }
      }

      if (foundIndex !== -1) {
        mapping[targetKey] = headers[foundIndex];
      }
    }

    return mapping;
  }

  /**
   * Parse raw CSV file content or string with PapaParse
   */
  static parseRawCsv(fileOrString) {
    return new Promise((resolve, reject) => {
      if (typeof Papa === 'undefined') {
        reject(new Error('PapaParse library not loaded.'));
        return;
      }

      Papa.parse(fileOrString, {
        header: true,
        skipEmptyLines: 'greedy',
        dynamicTyping: false,
        transformHeader: h => (h || '').trim(),
        complete: results => {
          if (results.errors && results.errors.length > 0 && (!results.data || results.data.length === 0)) {
            reject(new Error(results.errors[0].message || 'Malformed CSV format.'));
          } else {
            resolve(results);
          }
        },
        error: err => reject(err)
      });
    });
  }

  /**
   * Validate CSV content against structural rules and existing reports
   * @param {Object[]} rawRows
   * @param {string[]} headers
   * @param {import('./models.js').Report[]} [existingReports]
   * @param {string} [fileName]
   * @returns {import('./models.js').ValidationResult}
   */
  static validateCsv(rawRows, headers, existingReports = [], fileName = '') {
    const errors = [];
    const warnings = [];
    const infos = [];

    if (!rawRows || rawRows.length === 0) {
      errors.push('CSV file is empty or contains no data rows.');
      return {
        isValid: false,
        status: 'Failed',
        rowCount: 0,
        campaignCount: 0,
        errors,
        warnings,
        infos,
        isDuplicate: false
      };
    }

    const mapping = this.detectColumnMapping(headers);

    if (!mapping.name) {
      errors.push('Required column missing: Campaign Name.');
    }
    if (!mapping.spend) {
      errors.push('Required column missing: Spend / Cost.');
    }

    if (errors.length > 0) {
      return {
        isValid: false,
        status: 'Failed',
        rowCount: rawRows.length,
        campaignCount: 0,
        errors,
        warnings,
        infos,
        isDuplicate: false
      };
    }

    // Explicitly detect data granularity:
    // A. Daily-level records (multiple dated rows for the same campaign)
    // B. Already-aggregated period-level records (1 record per campaign for the period)
    const granularity = PeriodEngine.detectDataGranularity(rawRows, mapping);
    infos.push(granularity.description);

    // Check optional columns
    if (!mapping.impressions) {
      warnings.push("Missing 'Impressions' column; impression counts will be estimated from clicks.");
    }
    if (!mapping.clicks) {
      warnings.push("Missing 'Clicks' column; interaction counts default to 0.");
    }

    // Check distinct conversions integrity (DATA INTEGRITY CORRECTION)
    let allConversionsDerived = false;
    if (!mapping.allConversions) {
      allConversionsDerived = true;
      warnings.push("Source CSV does not contain an 'All Conversions' column. 'allConversions' was derived using documented fallback (defaulted to recorded conversions; not combined with phone calls).");
    }

    // Check date column
    const detectedPeriod = PeriodEngine.determineReportingPeriod(rawRows, mapping.date, fileName);
    if (!mapping.date) {
      warnings.push(`No explicit date column found in CSV rows. Inferred period as ${detectedPeriod.periodLabel} from file context.`);
    } else {
      infos.push(`Detected reporting period: ${detectedPeriod.periodLabel}`);
    }

    // Check duplicate period in existing reports
    let isDuplicate = false;
    let existingReportId = null;
    const dupMatch = existingReports.find(r => {
      if (!r.period) return false;
      return r.period.periodId === detectedPeriod.periodId ||
             (r.period.startDate === detectedPeriod.startDate && r.period.endDate === detectedPeriod.endDate);
    });

    if (dupMatch) {
      isDuplicate = true;
      existingReportId = dupMatch.reportId;
      warnings.push(`This reporting period already exists (${detectedPeriod.periodLabel}). Choose to replace or keep existing.`);
    }

    const distinctCampaigns = new Set(rawRows.map(r => (r[mapping.name] || '').trim().toLowerCase()).filter(Boolean));
    infos.push(`Parsed ${rawRows.length} rows across ${distinctCampaigns.size} distinct campaigns.`);

    const status = errors.length > 0 ? 'Failed' : (warnings.length > 0 ? 'Needs Attention' : 'Ready');

    return {
      isValid: errors.length === 0,
      status,
      rowCount: rawRows.length,
      campaignCount: distinctCampaigns.size,
      granularity: granularity.type,
      granularityDescription: granularity.description,
      allConversionsDerived,
      errors,
      warnings,
      infos,
      detectedPeriod,
      isDuplicate,
      existingReportId
    };
  }

  /**
   * Normalize parsed rows into a structured Report object
   * @param {Object} parsedData - PapaParse results
   * @param {Object} metadata - { fileName, existingReports, allocatedBudget }
   * @returns {import('./models.js').Report}
   */
  static normalizeReportData(parsedData, metadata = {}) {
    const rawRows = parsedData.data;
    if (!rawRows || rawRows.length === 0) {
      throw new Error('CSV file contains no data rows.');
    }

    const headers = Object.keys(rawRows[0]);
    const mapping = this.detectColumnMapping(headers);

    if (!mapping.name || !mapping.spend) {
      throw new Error('Could not identify required columns (Campaign Name and Spend). Please check column headers.');
    }

    const fileName = metadata.fileName || 'weekly_ad_report.csv';
    const validation = this.validateCsv(rawRows, headers, metadata.existingReports || [], fileName);

    // Period classification
    const period = validation.detectedPeriod || PeriodEngine.determineReportingPeriod(rawRows, mapping.date, fileName);

    // Explicitly detect data granularity:
    // A. Daily-level records -> aggregate them by campaign and reporting period
    // B. Already-aggregated period-level records -> use supplied campaign metrics directly, DO NOT aggregate again
    const granularity = PeriodEngine.detectDataGranularity(rawRows, mapping);
    let rowsToProcess = [];

    if (granularity.type === 'daily') {
      // Case A: Daily-level records detected -> aggregate rows by campaign and reporting period
      const aggregatedDaily = PeriodEngine.aggregateDailyRowsByCampaign(rawRows, mapping, this.sanitizeNumber.bind(this));
      rowsToProcess = aggregatedDaily.map(c => ({
        [mapping.name]: c.name,
        [mapping.channel]: c.channel,
        [mapping.specialty]: c.specialty,
        [mapping.spend]: c.spend,
        [mapping.impressions]: c.impressions,
        [mapping.clicks]: c.clicks,
        [mapping.leads]: c.leads,
        [mapping.conversions]: c.conversions,
        [mapping.phoneCalls]: c.phoneCalls,
        [mapping.allConversions]: c.hasSourceAllConv ? c.allConversions : null,
        _hasSourceAllConv: c.hasSourceAllConv
      }));
      validation.infos.push(`Daily row aggregation: Consolidated ${rawRows.length} daily rows into ${aggregatedDaily.length} weekly campaign summaries.`);
    } else {
      // Case B: Already-aggregated period-level records -> use supplied campaign metrics directly and DO NOT aggregate again
      rowsToProcess = rawRows;
      validation.infos.push(`Period-level data preserved: Used ${rawRows.length} pre-aggregated campaign records directly without re-aggregation.`);
    }

    const campaigns = [];
    let aggSpend = 0;
    let aggImpressions = 0;
    let aggClicks = 0;
    let aggLeads = 0;
    let aggConversions = 0;
    let aggPhoneCalls = 0;
    let aggAllConversions = 0;
    let hasExplicitAllConvAny = false;

    rowsToProcess.forEach((row, idx) => {
      const name = (row[mapping.name] || `Campaign ${idx + 1}`).trim();
      if (!name) return; // skip empty

      const spend = this.sanitizeNumber(row[mapping.spend]) || 0;
      const clicks = this.sanitizeNumber(row[mapping.clicks]) || 0;
      let impressions = this.sanitizeNumber(row[mapping.impressions]) || 0;
      let cpc = mapping.cpc && row[mapping.cpc] !== undefined ? this.sanitizeNumber(row[mapping.cpc], null) : null;
      const leads = this.sanitizeNumber(row[mapping.leads]) || 0;
      const conversions = this.sanitizeNumber(row[mapping.conversions]) || 0;
      const phoneCalls = this.sanitizeNumber(row[mapping.phoneCalls]) || 0;
      let cpa = mapping.cpa && row[mapping.cpa] !== undefined ? this.sanitizeNumber(row[mapping.cpa], null) : null;
      let costPerAllConv = mapping.costPerAllConv && row[mapping.costPerAllConv] !== undefined ? this.sanitizeNumber(row[mapping.costPerAllConv], null) : null;

      // CRITICAL DATA INTEGRITY (USER REQUIREMENT):
      // 1. Never assume allConversions = conversions + phoneCalls.
      // 2. If source CSV contains an explicit All Conversions metric, preserve that source value exactly.
      // 3. If source does not contain All Conversions, use documented fallback behavior and clearly mark
      //    that the value was derived/fallback data (allConversionsDerived: true).
      // 4. Keep these metrics completely separate: Leads, Conversions, Phone Calls, All Conversions.
      let allConversions = null;
      let allConversionsDerived = false;

      if (mapping.allConversions && row[mapping.allConversions] !== undefined && row[mapping.allConversions] !== null && row[mapping.allConversions] !== '') {
        allConversions = this.sanitizeNumber(row[mapping.allConversions]);
        allConversionsDerived = false;
        hasExplicitAllConvAny = true;
      } else if (row._hasSourceAllConv) {
        allConversions = row[mapping.allConversions];
        allConversionsDerived = false;
        hasExplicitAllConvAny = true;
      } else {
        // Documented fallback: Default cleanly to recorded primary conversions
        // Clearly marked as derived/fallback data. NEVER add conversions + phoneCalls.
        allConversions = conversions;
        allConversionsDerived = true;
      }

      // Estimate impressions if missing
      if (!impressions && clicks > 0) {
        impressions = Math.round(clicks * 18); // ~5.5% CTR estimate
      }

      // Compute CPC if missing or 0
      if ((cpc === null || cpc === 0) && clicks > 0) {
        cpc = parseFloat((spend / clicks).toFixed(2));
      }

      // Compute CPA (Cost / Conv) if missing or 0
      if ((cpa === null || cpa === 0) && conversions > 0) {
        cpa = Math.round(spend / conversions);
      }

      // Compute Cost / All Conv if missing or 0
      if ((costPerAllConv === null || costPerAllConv === 0) && allConversions > 0) {
        costPerAllConv = Math.round(spend / allConversions);
      }

      // CTR
      const ctr = impressions > 0 ? parseFloat(((clicks / impressions) * 100).toFixed(2)) : 0;

      // Conversion Rate
      const conversionRate = clicks > 0 ? parseFloat(((conversions / clicks) * 100).toFixed(2)) : 0;

      // Detect Channel (Search vs PMax vs Display)
      let channel = 'Search';
      const lowerName = name.toLowerCase();
      const rawChannel = (row[mapping.channel] || '').toLowerCase();
      if (rawChannel.includes('pmax') || lowerName.includes('pmax') || lowerName.includes('performance max')) {
        channel = 'PMax';
      } else if (rawChannel.includes('display') || lowerName.includes('display')) {
        channel = 'Display';
      }

      // Detect specialty/location
      let specialty = (row[mapping.specialty] || '').trim();
      if (!specialty) {
        if (lowerName.includes('kilpauk')) specialty = 'Kilpauk Multispeciality';
        else if (lowerName.includes('chetpet')) specialty = 'Chetpet Centre';
        else if (lowerName.includes('tondiarpet')) specialty = 'Tondiarpet Centre';
        else if (lowerName.includes('knee')) specialty = 'Orthopaedics & Knee';
        else if (lowerName.includes('oncology') || lowerName.includes('tirunelveli')) specialty = 'Oncology';
        else if (lowerName.includes('headache') || lowerName.includes('migraine')) specialty = 'Neurology';
        else if (lowerName.includes('package')) specialty = 'Preventive Health';
        else specialty = 'General';
      }

      // Efficiency Classification
      let classification = 'moderate';
      let mainIssue = '';
      if (conversions >= 2 && cpa !== null && cpa <= 5500) {
        classification = 'strong';
      } else if ((cpa !== null && cpa > 15000) || conversions === 0 || (cpc && cpc > 50)) {
        classification = 'weak';
        if (conversions === 0 && cpc > 40) mainIssue = `Zero conversions with high ₹${cpc} CPC`;
        else if (cpa && cpa > 30000) mainIssue = `Severe CPA of ₹${cpa.toLocaleString('en-IN')}`;
        else if (phoneCalls > 20 && conversions <= 2) mainIssue = `${phoneCalls} calls with low verified conversions`;
      }

      aggSpend += spend;
      aggImpressions += impressions;
      aggClicks += clicks;
      aggLeads += leads;
      aggConversions += conversions;
      aggPhoneCalls += phoneCalls;
      aggAllConversions += allConversions;

      campaigns.push({
        id: 'camp_csv_' + idx + '_' + Math.random().toString(36).substr(2, 4),
        name,
        channel,
        specialty,
        spend,
        impressions,
        clicks,
        cpc: cpc || 0,
        ctr,
        leads,
        conversions,
        phoneCalls,
        allConversions,
        allConversionsDerived,
        cpa,
        costPerAllConv,
        conversionRate,
        classification,
        rank: idx + 1,
        mainIssue
      });
    });

    // Re-rank campaigns: strong first, then conversions desc
    campaigns.sort((a, b) => {
      if (a.classification === 'strong' && b.classification !== 'strong') return -1;
      if (a.classification !== 'strong' && b.classification === 'strong') return 1;
      return (b.conversions || 0) - (a.conversions || 0);
    });
    campaigns.forEach((c, i) => c.rank = i + 1);

    // Derived overall metrics (CRITICAL: NEVER AVERAGE RATIOS)
    const overallCtr = aggImpressions > 0 ? parseFloat(((aggClicks / aggImpressions) * 100).toFixed(2)) : 0;
    const overallCpc = aggClicks > 0 ? parseFloat((aggSpend / aggClicks).toFixed(2)) : 0;
    const overallCpa = aggConversions > 0 ? Math.round(aggSpend / aggConversions) : null;
    const overallCostPerAllConv = aggAllConversions > 0 ? Math.round(aggSpend / aggAllConversions) : null;
    const conversionRate = aggClicks > 0 ? parseFloat(((aggConversions / aggClicks) * 100).toFixed(2)) : 0;

    const reportId = 'vs_rep_' + period.periodId;
    const allocatedBudget = metadata.allocatedBudget || (aggSpend * 1.35);

    return {
      reportId,
      periodName: period.periodLabel,
      period,
      granularity: validation.granularity,
      granularityDescription: validation.granularityDescription,
      uploadedAt: new Date().toISOString(),
      sourceType: 'csv',
      sourceFileName: fileName,
      status: validation.status,
      budgetSummary: {
        allocated: Math.round(allocatedBudget),
        spent: Math.round(aggSpend),
        remaining: Math.max(0, Math.round(allocatedBudget - aggSpend)),
        dailyRunRate: Math.round(aggSpend / 7),
        spendRatePercent: Math.min(100, parseFloat(((aggSpend / allocatedBudget) * 100).toFixed(1)))
      },
      metrics: {
        spend: Math.round(aggSpend),
        impressions: aggImpressions,
        clicks: aggClicks,
        ctr: overallCtr,
        cpc: overallCpc,
        leads: aggLeads,
        conversions: aggConversions,
        phoneCalls: aggPhoneCalls,
        allConversions: aggAllConversions,
        allConversionsDerived: !hasExplicitAllConvAny,
        allConversionsNote: hasExplicitAllConvAny
          ? 'Preserved exact source value from CSV All Conversions column.'
          : 'Source CSV did not include All Conversions. Defaulted to recorded conversions (derived fallback). Not combined with phone calls.',
        cpa: overallCpa,
        costPerAllConv: overallCostPerAllConv,
        conversionRate
      },
      campaigns,
      validation
    };
  }

  /**
   * Process multiple CSV files simultaneously
   * @param {File[]|string[]} files
   * @param {import('./models.js').Report[]} [existingReports]
   * @returns {Promise<Array<{ file: File|string, report: import('./models.js').Report|null, validation: import('./models.js').ValidationResult, error?: string }>>}
   */
  static async parseMultipleCsvs(files, existingReports = []) {
    const results = [];

    for (const file of files) {
      const fileName = typeof file === 'string' ? 'report.csv' : (file.name || 'report.csv');
      try {
        const parsed = await this.parseRawCsv(file);
        const headers = parsed.data && parsed.data.length > 0 ? Object.keys(parsed.data[0]) : [];
        const validation = this.validateCsv(parsed.data, headers, existingReports, fileName);

        if (!validation.isValid) {
          results.push({
            file,
            fileName,
            report: null,
            validation,
            error: validation.errors.join('; ')
          });
          continue;
        }

        const report = this.normalizeReportData(parsed, {
          fileName,
          existingReports
        });

        results.push({
          file,
          fileName,
          report,
          validation: report.validation || validation,
          isDuplicate: validation.isDuplicate,
          existingReportId: validation.existingReportId
        });
      } catch (err) {
        results.push({
          file,
          fileName,
          report: null,
          validation: {
            isValid: false,
            status: 'Failed',
            rowCount: 0,
            campaignCount: 0,
            errors: [err.message || 'Fatal parse failure'],
            warnings: [],
            infos: [],
            isDuplicate: false
          },
          error: err.message
        });
      }
    }

    return results;
  }

  /**
   * Generate downloadable sample CSV content
   */
  static getSampleCsvContent() {
    return `Date,Campaign Name,Channel,Specialty,Spend,Impressions,Clicks,Avg CPC,Leads,Conversions,Phone Calls,All Conversions,CPA
2026-08-15 to 2026-08-21,Kilpauk PMax,PMax,Kilpauk Multispeciality,34501,78500,3909,8.83,14,14.0,19,33,2464
2026-08-15 to 2026-08-21,Chetpet PMax,PMax,Chetpet Centre,36136,198400,10670,3.39,8,8.0,27,35,4517
2026-08-15 to 2026-08-21,Knee Ready PMax,PMax,Orthopaedics & Knee,13271,165000,7021,1.89,5,5.0,8,13,2654
2026-08-15 to 2026-08-21,Health Package Tondiarpet,PMax,Preventive Health,11041,89000,3927,2.81,2,2.0,16,18,5520
2026-08-15 to 2026-08-21,Headache & Migraine Screening,PMax,Neurology,10763,142000,6258,1.72,2,2.7,5,7,4036
2026-08-15 to 2026-08-21,Kilpauk Multispeciality Search,Search,Kilpauk Multispeciality,70082,52000,4784,14.65,4,4.0,5,9,17521
2026-08-15 to 2026-08-21,Tondiarpet PMax,PMax,Tondiarpet Centre,37018,245000,13881,2.67,1,1.8,68,69,20192
2026-08-15 to 2026-08-21,Knee Ready Search,Search,Orthopaedics & Knee,37875,4800,499,75.90,0,0.0,4,4,N/A
2026-08-15 to 2026-08-21,Tirunelveli Oncology Search,Search,Oncology,56131,3900,462,121.50,1,1.0,9,10,56131`;
  }

  /**
   * Trigger immediate download of sample CSV template
   */
  static downloadSampleCsv() {
    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(this.getSampleCsvContent());
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', csvContent);
    downloadAnchor.setAttribute('download', 'VS_Hospitals_Ads_Template.csv');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }
}

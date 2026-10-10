/**
 * CANIT Skope - Industrial-Grade CSV & Excel Ingestion Engine
 * Multi-Format Cross-Tab Matrix & Normalized Ingestion
 */

import { PeriodEngine } from './period-engine.js';

export class CsvEngine {
  static FORMATS = {
    STANDARD: 'Standard Normalized',
    CROSS_TAB: 'CANIT Skope KPI Cross-Tab'
  };

  static KPI_SYNONYMS = {
    spend: [
      'amount', 'amount spent', 'spent', 'cost', 'spend', 'total cost', 'total spend',
      'amount spent (inr)', 'amount spent (usd)', 'cost (inr)', 'cost (usd)', 'budget spent',
      'amount(inr)', 'amount (inr)', 'amount (₹)', 'amount spent (₹)', 'total amount spent',
      'actual spend', 'ad spend', 'spend (inr)'
    ],
    clicks: [
      'clicks', 'click count', 'interactions', 'link clicks', 'clicks (all)', 'total clicks',
      'link click', 'clicks (link)', 'click'
    ],
    cpc: [
      'cpc', 'avg cpc', 'cost / click', 'avg. cpc', 'cpc (cost per link click)', 'cpc (all)',
      'cost per click', 'cpc (inr)', 'avg cpc (inr)', 'avg. cost / click', 'average cpc', 'cost / link click'
    ],
    leads: [
      'leads', 'form leads', 'patient leads', 'on-facebook leads', 'leads (form)',
      'messaging conversations started', 'link clicks', 'results', 'inquiries', 'lead',
      'total leads', 'form inquiries', 'lead submissions', 'conversions (leads)'
    ],
    phoneCalls: [
      'phone calls', 'calls', 'phone inquiries', 'call interactions', 'phone call',
      'click to call', 'call leads', 'phone leads'
    ],
    views: [
      'views', 'impressions', 'impr', 'impr.', 'reach', 'total reach', 'unique reach',
      'reaches', 'impression count', 'total impressions', 'reach (people)'
    ],
    sourceResults: [
      'results', 'result', 'all results', 'total results'
    ],
    conversions: [
      'conversions', 'conv', 'recorded conversions', 'results', 'primary conversions',
      'conv.', 'total conversions', 'conversions count'
    ],
    allConversions: [
      'all conv', 'all conversions', 'all conv.', 'total conv', 'total conversions',
      'all_conversions', 'all conv (recorded)', 'all conversion'
    ],
    budget: [
      'allocated budget', 'allocated', 'budget', 'allocated budget (inr)', 'monthly budget',
      'budget (inr)', 'campaign budget', 'allocated (inr)', 'budget allocated', 'allocated cost'
    ],
    cpl: [
      'cpl', 'cost per lead', 'cost / lead', 'cpl (inr)', 'cost / form lead', 'avg cpl',
      'cost per acquired lead', 'cpl (cost per lead)'
    ],
    cpr: [
      'cpr', 'cost per result', 'cost per 1,000 impressions (cpm)', 'cpm', 'cost / result'
    ],
    revenue: [
      'conversion value', 'conv value', 'conv. value', 'revenue', 'purchase value',
      'total conversion value', 'total conv value', 'sales', 'ad-attributed revenue',
      'ad attributed revenue', 'conversion value (inr)', 'total value', 'order value'
    ],
    roas: [
      'roas', 'conv. value / cost', 'conv value / cost', 'return on ad spend',
      'conversion value / cost', 'roas (return on ad spend)', 'purchase roas'
    ]
  };

  static COLUMN_SYNONYMS = {
    name: [
      'campaign', 'campaign name', 'campaign_name', 'campaignname', 'ad group', 'adgroup',
      'ad name', 'ad set name', 'adset name', 'campaigns', 'campaign title',
      'ad-type', 'ad type', 'ad_type', 'adtype', 'ad-type / campaign', 'campaign / ad-type',
      'ad set', 'adset', 'ad set / campaign', 'ad'
    ],
    spend: [
      'spend', 'cost', 'total cost', 'amount', 'amount spent', 'inr', 'cost (inr)', 'spent',
      'amount spent (inr)', 'amount spent (usd)', 'cost (usd)', 'budget spent', 'total spend',
      'amount (inr)', 'amount(inr)', 'amount (₹)'
    ],
    impressions: [
      'impressions', 'impr', 'impr.', 'views', 'impression count', 'total impressions',
      'reach', 'total reach', 'unique reach'
    ],
    clicks: [
      'clicks', 'click count', 'interactions', 'link clicks', 'clicks (all)', 'total clicks',
      'link click'
    ],
    cpc: [
      'cpc', 'avg cpc', 'cost / click', 'avg. cpc', 'cost per click', 'avg cpc (inr)',
      'avg. cost / click', 'cpc (cost per link click)', 'cpc (all)', 'average cpc'
    ],
    ctr: [
      'ctr', 'click through rate', 'click-through rate', 'ctr %', 'ctr (all)',
      'ctr (link click-through rate)', 'link click-through rate', 'click-through rate (ctr)'
    ],
    leads: [
      'leads', 'form leads', 'patient leads', 'inquiries', 'web leads', 'lead',
      'on-facebook leads', 'leads (form)', 'messaging conversations started', 'lead submissions'
    ],
    conversions: [
      'conversions', 'conv', 'recorded conversions', 'results', 'primary conversions',
      'conv.', 'total conversions', 'conversions count', 'all results'
    ],
    phoneCalls: [
      'phone calls', 'calls', 'call count', 'phone inquiries', 'phone leads',
      'call interactions', 'phone call', 'click to call', 'phone call leads'
    ],
    allConversions: [
      'all conv', 'all conv.', 'all conversions', 'total conv', 'total conversions',
      'all_conversions', 'all conv (recorded)', 'all conversion'
    ],
    cpa: [
      'cpa', 'cost / conv', 'cost per conversion', 'cost per acquisition', 'cost / conv.',
      'cost per result', 'cost / result', 'cpr', 'cost per conv'
    ],
    costPerAllConv: [
      'cost / all conv', 'cost / all conv.', 'cost per all conv', 'cost per all conversion'
    ],
    revenue: [
      'conversion value', 'conv. value', 'conv value', 'total conv value', 'total conversion value',
      'all conv. value', 'all conv value', 'revenue', 'purchase value', 'purchase conversion value',
      'sales', 'ad-attributed revenue', 'ad attributed revenue', 'total sales', 'order value', 'value'
    ],
    roas: [
      'roas', 'return on ad spend', 'conv. value / cost', 'conv value / cost',
      'conversion value / cost', 'all conv. value / cost', 'purchase roas', 'roas (return on ad spend)'
    ],
    specialty: ['specialty', 'location', 'specialty / loc', 'service', 'department', 'centre', 'center'],
    channel: ['channel', 'type', 'campaign type', 'strategy', 'advertising channel'],
    platform: ['platform', 'advertising platform', 'ad platform', 'network', 'publisher', 'source'],
    date: PeriodEngine.DATE_SYNONYMS
  };

  static NEGATIVE_EXCLUSIONS = {
    spend: ['cpc', 'cpa', 'cpl', 'cpm', '/', 'per conv', 'per click', 'per result', 'rate', 'avg', 'roas', 'return'],
    impressions: ['cpm', 'share', 'rate', '%', 'lost'],
    clicks: ['cpc', 'cost', 'rate', 'ctr', '%', '/', 'per click'],
    cpc: ['ctr', '%', 'conversions', 'impressions'],
    ctr: ['cpc', 'cpa', 'spend', 'cost'],
    leads: ['cpl', 'cost', 'rate', '%', '/', 'cost per lead'],
    conversions: ['cost', 'cpa', 'rate', '%', '/', 'cost / conv', 'cost per conv', 'conv. rate', 'cost per result', 'conv. value', 'value', 'revenue'],
    phoneCalls: ['impression', 'ptr', '%'],
    cpa: ['cpc', 'ctr', '%'],
    revenue: ['/', 'per', 'rate', 'cpc', 'cpa', 'cpr', '%', 'cost']
  };

  /**
   * Detect whether CSV is standard row-per-campaign or cross-tab KPI report
   * @param {string[]} headers
   * @param {Object[]} [rawRows]
   * @returns {string}
   */
  static detectCsvFormat(headers, rawRows = []) {
    if (!headers || headers.length < 3) return this.FORMATS.STANDARD;

    const col0 = (headers[0] || '').trim().toLowerCase();
    const col1 = (headers[1] || '').trim().toLowerCase();

    const isCampaignSynonym = [
      'campaign', 'campaign name', 'campaign_name', 'campaignname', 'campaigns',
      'ad-type', 'ad type', 'ad_type', 'adtype', 'ad-type / campaign', 'campaign / ad-type',
      'ad set', 'adset', 'ad group', 'adgroup', 'ad name', 'ad set name'
    ].some(syn => col0 === syn || col0.includes(syn));

    const isKpiSynonym = [
      'kpi', 'kpis', 'metric', 'metrics', 'kpi / metric', 'metric / kpi'
    ].some(syn => col1 === syn || col1.includes(syn));

    // Check if period columns exist (e.g. Dec 2025, Jan 2026, Mar 2026, Aug 1 - 7 2026, etc.)
    let validPeriodCols = 0;
    for (let i = 2; i < headers.length; i++) {
      if (PeriodEngine.parsePeriodHeader(headers[i])) {
        validPeriodCols++;
      }
    }

    if (validPeriodCols >= 1) {
      if (isKpiSynonym || isCampaignSynonym) {
        return this.FORMATS.CROSS_TAB;
      }
      // Also check if col1 has KPI row values like "allocated budget", "amount spent", etc.
      if (rawRows && rawRows.length > 0) {
        const hasKpiValues = rawRows.slice(0, 15).some(row => {
          const val = (row[headers[1]] || '').trim().toLowerCase();
          return Object.values(this.KPI_SYNONYMS).some(list => list.includes(val));
        });
        if (hasKpiValues) {
          return this.FORMATS.CROSS_TAB;
        }
      }
    }

    return this.FORMATS.STANDARD;
  }

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

      // 1. Exact match first
      for (const syn of synonyms) {
        foundIndex = lowerHeaders.findIndex(h => h === syn);
        if (foundIndex !== -1) break;
      }

      // 2. Partial match if exact failed, respecting negative exclusions
      if (foundIndex === -1) {
        const exclusions = this.NEGATIVE_EXCLUSIONS[targetKey] || [];
        for (const syn of synonyms) {
          foundIndex = lowerHeaders.findIndex(h => {
            if (!h.includes(syn)) return false;
            if (exclusions.some(neg => h.includes(neg))) return false;
            return true;
          });
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
   * Find the true header row index in raw parsed CSV rows (ignoring metadata/title lines)
   * @param {Array<string[]>} allRows
   * @returns {number}
   */
  static findHeaderRowIndex(allRows) {
    if (!allRows || allRows.length === 0) return 0;

    const maxScan = Math.min(allRows.length, 25);
    const KEYWORDS = [
      'campaign', 'campaign name', 'campaign_name', 'campaignname', 'ad group', 'adgroup',
      'ad-type', 'ad type', 'ad_type', 'ad set', 'adset',
      'kpi', 'kpis', 'metric', 'metrics', 'spend', 'cost', 'amount', 'amount spent', 'spent',
      'impressions', 'impr', 'reach', 'clicks', 'conversions', 'conv', 'leads',
      'ctr', 'cpc', 'cpa', 'cpl', 'results', 'phone calls', 'calls', 'date', 'day'
    ];

    let bestRowIdx = 0;
    let bestScore = 0;

    for (let i = 0; i < maxScan; i++) {
      const row = allRows[i];
      if (!row || !Array.isArray(row) || row.length < 2) continue;

      let score = 0;
      for (const cell of row) {
        const cellStr = String(cell || '').trim().toLowerCase();
        if (!cellStr) continue;

        if (KEYWORDS.some(kw => cellStr === kw || cellStr.includes(kw))) {
          score++;
        } else if (PeriodEngine.parsePeriodHeader(cellStr)) {
          score += 2;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestRowIdx = i;
      }
    }

    return bestScore >= 2 ? bestRowIdx : 0;
  }

  /**
   * Parse raw CSV file content or string with PapaParse or SheetJS for Excel
   */
  static async parseRawCsv(fileOrString) {
    // 1. Check if input is a File/Blob with Excel format (.xlsx / .xls)
    if (typeof File !== 'undefined' && fileOrString instanceof File) {
      const isExcel = /\.(xlsx|xls)$/i.test(fileOrString.name);
      if (isExcel && typeof XLSX !== 'undefined') {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = e => {
            try {
              const data = new Uint8Array(e.target.result);
              const workbook = XLSX.read(data, { type: 'array' });
              const targetSheetName = workbook.SheetNames.find(n => /kpi/i.test(n)) || workbook.SheetNames[0];
              const worksheet = workbook.Sheets[targetSheetName];
              const allRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });

              if (!allRows || allRows.length === 0) {
                resolve({ data: [], headers: [], errors: [] });
                return;
              }

              const headerRowIdx = CsvEngine.findHeaderRowIndex(allRows);
              const rawHeaders = allRows[headerRowIdx] || [];
              const headers = rawHeaders.map(h => String(h || '').trim());
              const parsedRows = [];

              for (let i = headerRowIdx + 1; i < allRows.length; i++) {
                const r = allRows[i];
                if (!r || r.length === 0 || r.every(c => !c || !String(c).trim())) continue;

                const col0 = String(r[0] || '').trim().toLowerCase();
                const isSummaryFooter = (/^(total:?|subtotal:?|account total|summary|results from)\b/i.test(col0));
                if (isSummaryFooter && headers[1] && !/kpi|metric/i.test(headers[1])) {
                  continue;
                }

                const rowObj = {};
                headers.forEach((h, idx) => {
                  rowObj[h] = r[idx] !== undefined ? String(r[idx]).trim() : '';
                });
                parsedRows.push(rowObj);
              }
              resolve({ data: parsedRows, headers, errors: [] });
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = err => reject(err);
          reader.readAsArrayBuffer(fileOrString);
        });
      }
    }

    return new Promise((resolve, reject) => {
      if (typeof Papa !== 'undefined') {
        Papa.parse(fileOrString, {
          header: false,
          skipEmptyLines: 'greedy',
          dynamicTyping: false,
          complete: results => {
            if (results.errors && results.errors.length > 0 && (!results.data || results.data.length === 0)) {
              reject(new Error(results.errors[0].message || 'Malformed CSV format.'));
              return;
            }
            const allRows = results.data || [];
            if (allRows.length === 0) {
              resolve({ data: [], headers: [], errors: results.errors || [] });
              return;
            }

            const headerRowIdx = CsvEngine.findHeaderRowIndex(allRows);
            const rawHeaders = allRows[headerRowIdx] || [];
            const headers = rawHeaders.map(h => String(h || '').trim());
            const parsedRows = [];

            for (let i = headerRowIdx + 1; i < allRows.length; i++) {
              const r = allRows[i];
              if (!r || r.length === 0 || r.every(c => !c || !String(c).trim())) continue;

              const col0 = String(r[0] || '').trim().toLowerCase();
              const isSummaryFooter = (/^(total:?|subtotal:?|account total|summary|results from)\b/i.test(col0));
              if (isSummaryFooter && headers[1] && !/kpi|metric/i.test(headers[1])) {
                continue;
              }

              const rowObj = {};
              headers.forEach((h, idx) => {
                rowObj[h] = r[idx] !== undefined ? String(r[idx]).trim() : '';
              });
              parsedRows.push(rowObj);
            }
            resolve({ data: parsedRows, headers, errors: results.errors || [] });
          },
          error: err => reject(err)
        });
        return;
      }

      // Built-in fallback parser if PapaParse is not globally available
      try {
        const text = typeof fileOrString === 'string' ? fileOrString : '';
        const lines = text.split(/\r?\n/);
        const allRows = [];

        for (const line of lines) {
          if (!line.trim()) continue;
          const cols = [];
          let inQuote = false;
          let entry = '';
          for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"') {
              inQuote = !inQuote;
            } else if (c === ',' && !inQuote) {
              cols.push(entry.trim());
              entry = '';
            } else {
              entry += c;
            }
          }
          cols.push(entry.trim());
          allRows.push(cols);
        }

        if (allRows.length === 0) {
          resolve({ data: [], headers: [], errors: [] });
          return;
        }

        const headerRowIdx = CsvEngine.findHeaderRowIndex(allRows);
        const headers = (allRows[headerRowIdx] || []).map(h => String(h || '').trim());
        const parsedRows = [];

        for (let i = headerRowIdx + 1; i < allRows.length; i++) {
          const r = allRows[i];
          if (!r || r.length === 0 || r.every(c => !c || !String(c).trim())) continue;

          const col0 = String(r[0] || '').trim().toLowerCase();
          const isSummaryFooter = (/^(total:?|subtotal:?|account total|summary|results from)\b/i.test(col0));
          if (isSummaryFooter && headers[1] && !/kpi|metric/i.test(headers[1])) {
            continue;
          }

          const rowObj = {};
          headers.forEach((h, idx) => {
            rowObj[h] = r[idx] !== undefined ? String(r[idx]).trim() : '';
          });
          parsedRows.push(rowObj);
        }

        resolve({ data: parsedRows, headers, errors: [] });
      } catch (err) {
        reject(err);
      }
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

    const format = this.detectCsvFormat(headers, rawRows);

    if (format === this.FORMATS.CROSS_TAB) {
      const periodColumns = headers.slice(2).filter(h => PeriodEngine.parsePeriodHeader(h) !== null);
      if (periodColumns.length === 0) {
        errors.push('No valid reporting period columns detected in KPI Cross-Tab headers.');
      }

      // Check for Spend / Cost / Budget KPI row
      const hasSpendRow = rawRows.some(row => {
        const kpi = (row[headers[1]] || '').trim().toLowerCase();
        return this.KPI_SYNONYMS.spend.some(syn => kpi === syn || kpi.includes(syn) || syn.includes(kpi)) ||
               this.KPI_SYNONYMS.budget.some(syn => kpi === syn || kpi.includes(syn) || syn.includes(kpi));
      });

      if (!hasSpendRow) {
        errors.push('Required KPI row missing: Amount spent / Spent / Allocated Budget.');
      }

      const distinctCampaigns = new Set();
      rawRows.forEach(row => {
        const c = (row[headers[0]] || '').trim();
        const k = (row[headers[1]] || '').trim();
        if (/^total/i.test(c) || /^summary/i.test(c)) return;
        if (c && k) distinctCampaigns.add(c.toLowerCase());
      });

      const detectedPeriod = periodColumns.length > 0 ? PeriodEngine.parsePeriodHeader(periodColumns[0]) : null;

      infos.push(`Detected format: ${this.FORMATS.CROSS_TAB}`);
      infos.push(`Found ${periodColumns.length} reporting period columns across ${rawRows.length} rows.`);

      const status = errors.length > 0 ? 'Failed' : (warnings.length > 0 ? 'Needs Attention' : 'Ready');

      return {
        isValid: errors.length === 0,
        status,
        format,
        rowCount: rawRows.length,
        campaignCount: Math.max(1, distinctCampaigns.size),
        granularity: 'period',
        granularityDescription: 'CANIT Skope KPI Cross-Tab pre-aggregated reporting periods',
        allConversionsDerived: false,
        errors,
        warnings,
        infos,
        detectedPeriod,
        isDuplicate: false,
        existingReportId: null
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

    const granularity = PeriodEngine.detectDataGranularity(rawRows, mapping);
    infos.push(granularity.description);

    if (!mapping.impressions) {
      warnings.push("Missing 'Impressions' column; impression counts will be estimated from clicks.");
    }
    if (!mapping.clicks) {
      warnings.push("Missing 'Clicks' column; interaction counts default to 0.");
    }

    let allConversionsDerived = false;
    if (!mapping.allConversions) {
      allConversionsDerived = true;
      warnings.push("Source CSV does not contain an 'All Conversions' column. 'allConversions' was derived using documented fallback (defaulted to recorded conversions; not combined with phone calls).");
    }

    const detectedPeriod = PeriodEngine.determineReportingPeriod(rawRows, mapping.date, fileName);
    if (!mapping.date) {
      warnings.push(`No explicit date column found in CSV rows. Inferred period as ${detectedPeriod.periodLabel} from file context.`);
    } else {
      infos.push(`Detected reporting period: ${detectedPeriod.periodLabel}`);
    }

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

    const period = validation.detectedPeriod || PeriodEngine.determineReportingPeriod(rawRows, mapping.date, fileName);
    const granularity = PeriodEngine.detectDataGranularity(rawRows, mapping);
    let rowsToProcess = [];

    if (granularity.type === 'daily') {
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
    let aggRevenue = 0;
    let hasExplicitAllConvAny = false;

    rowsToProcess.forEach((row, idx) => {
      const name = (row[mapping.name] || `Campaign ${idx + 1}`).trim();
      if (!name) return;

      const spend = this.sanitizeNumber(row[mapping.spend]) || 0;
      const clicks = this.sanitizeNumber(row[mapping.clicks]) || 0;
      let impressions = this.sanitizeNumber(row[mapping.impressions]) || 0;
      let cpc = mapping.cpc && row[mapping.cpc] !== undefined ? this.sanitizeNumber(row[mapping.cpc], null) : null;
      const leads = this.sanitizeNumber(row[mapping.leads]) || 0;
      const conversions = this.sanitizeNumber(row[mapping.conversions]) || 0;
      const phoneCalls = this.sanitizeNumber(row[mapping.phoneCalls]) || 0;
      let cpa = mapping.cpa && row[mapping.cpa] !== undefined ? this.sanitizeNumber(row[mapping.cpa], null) : null;
      let costPerAllConv = mapping.costPerAllConv && row[mapping.costPerAllConv] !== undefined ? this.sanitizeNumber(row[mapping.costPerAllConv], null) : null;

      let revenue = mapping.revenue && row[mapping.revenue] !== undefined ? (this.sanitizeNumber(row[mapping.revenue]) || 0) : (row.revenue !== undefined ? (this.sanitizeNumber(row.revenue) || 0) : 0);
      let roas = mapping.roas && row[mapping.roas] !== undefined ? this.sanitizeNumber(row[mapping.roas], null) : null;
      if (spend > 0 && revenue > 0) {
        roas = parseFloat((revenue / spend).toFixed(2));
      } else if (roas !== null && roas > 0 && revenue === 0 && spend > 0) {
        revenue = Math.round(spend * roas);
      }

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
        allConversions = conversions;
        allConversionsDerived = true;
      }

      if (!impressions && clicks > 0) {
        impressions = Math.round(clicks * 18);
      }

      if ((cpc === null || cpc === 0) && clicks > 0) {
        cpc = parseFloat((spend / clicks).toFixed(2));
      }

      if ((cpa === null || cpa === 0) && conversions > 0) {
        cpa = Math.round(spend / conversions);
      }

      if ((costPerAllConv === null || costPerAllConv === 0) && allConversions > 0) {
        costPerAllConv = Math.round(spend / allConversions);
      }

      const ctr = impressions > 0 ? parseFloat(((clicks / impressions) * 100).toFixed(2)) : 0;
      const conversionRate = clicks > 0 ? parseFloat(((conversions / clicks) * 100).toFixed(2)) : 0;

      let channel = 'Search';
      const lowerName = name.toLowerCase();
      const rawChannel = (row[mapping.channel] || '').toLowerCase();
      if (rawChannel.includes('pmax') || lowerName.includes('pmax') || lowerName.includes('performance max')) {
        channel = 'PMax';
      } else if (rawChannel.includes('display') || lowerName.includes('display')) {
        channel = 'Display';
      } else if (rawChannel.includes('youtube') || lowerName.includes('youtube') || rawChannel.includes('video')) {
        channel = 'YouTube';
      } else if (rawChannel.includes('meta') || rawChannel.includes('facebook') || rawChannel.includes('instagram') || lowerName.includes('instant form')) {
        channel = 'Meta';
      }

      let platform = 'unknown';
      const rawPlatform = mapping.platform && row[mapping.platform] ? String(row[mapping.platform]).trim().toLowerCase() : '';
      if (rawPlatform) {
        if (rawPlatform.includes('google') || rawPlatform.includes('adwords')) {
          platform = 'google';
        } else if (rawPlatform.includes('meta') || rawPlatform.includes('facebook') || rawPlatform.includes('instagram')) {
          platform = 'meta';
        } else {
          platform = rawPlatform;
        }
      } else if (rawChannel.includes('google') || rawChannel.includes('adwords') || rawChannel.includes('youtube')) {
        platform = 'google';
      } else if (rawChannel.includes('meta') || rawChannel.includes('facebook') || rawChannel.includes('instagram') || channel === 'Meta') {
        platform = 'meta';
      } else if (metadata.platform) {
        platform = String(metadata.platform).toLowerCase();
      } else {
        platform = 'unknown';
      }

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

      let classification = 'moderate';
      let mainIssue = '';
      if (conversions >= 2 && cpa !== null && cpa <= 5500) {
        classification = 'strong';
      } else if ((cpa !== null && cpa > 15000) || (spend > 3000 && conversions === 0) || (cpc && cpc > 50)) {
        classification = 'weak';
        if (conversions === 0 && cpc > 40) mainIssue = `Zero conversions with ₹${cpc} CPC`;
        else if (cpa && cpa > 30000) mainIssue = `High CPA of ₹${cpa.toLocaleString('en-IN')}`;
        else if (phoneCalls > 20 && conversions <= 2) mainIssue = `${phoneCalls} calls with low verified conversions`;
      }

      aggSpend += spend;
      aggImpressions += impressions;
      aggClicks += clicks;
      aggLeads += leads;
      aggConversions += conversions;
      aggPhoneCalls += phoneCalls;
      aggAllConversions += allConversions;
      aggRevenue += revenue;

      campaigns.push({
        id: 'camp_csv_' + idx + '_' + Math.random().toString(36).substr(2, 4),
        name,
        platform,
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
        revenue: Math.round(revenue),
        roas,
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

    campaigns.sort((a, b) => {
      if (a.classification === 'strong' && b.classification !== 'strong') return -1;
      if (a.classification !== 'strong' && b.classification === 'strong') return 1;
      return (b.conversions || 0) - (a.conversions || 0);
    });
    campaigns.forEach((c, i) => c.rank = i + 1);

    const overallCtr = aggImpressions > 0 ? parseFloat(((aggClicks / aggImpressions) * 100).toFixed(2)) : 0;
    const overallCpc = aggClicks > 0 ? parseFloat((aggSpend / aggClicks).toFixed(2)) : 0;
    const overallCpa = aggConversions > 0 ? Math.round(aggSpend / aggConversions) : null;
    const overallCostPerAllConv = aggAllConversions > 0 ? Math.round(aggSpend / aggAllConversions) : null;
    const conversionRate = aggClicks > 0 ? parseFloat(((aggConversions / aggClicks) * 100).toFixed(2)) : 0;
    const overallRoas = aggSpend > 0 && aggRevenue > 0 ? parseFloat((aggRevenue / aggSpend).toFixed(2)) : null;

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
        revenue: Math.round(aggRevenue),
        roas: overallRoas,
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
   * Parse a CANIT Skope KPI Cross-Tab CSV/Excel dataset into an array of Report objects (one per detected period)
   * @param {Object} parsedData - PapaParse results
   * @param {Object} metadata - { fileName, existingReports, allocatedBudget }
   * @returns {import('./models.js').Report[]}
   */
  static parseKpiCrossTab(parsedData, metadata = {}) {
    const rawRows = parsedData.data;
    if (!rawRows || rawRows.length === 0) {
      throw new Error('CSV file contains no data rows.');
    }

    const headers = Object.keys(rawRows[0]);
    const fileName = metadata.fileName || 'KPIs_KPIs.csv';

    // 1. Detect period columns
    const periodColumns = [];
    for (let c = 2; c < headers.length; c++) {
      const p = PeriodEngine.parsePeriodHeader(headers[c]);
      if (p) {
        periodColumns.push({ colIndex: c, header: headers[c], period: p });
      }
    }

    if (periodColumns.length === 0) {
      throw new Error('No valid reporting period columns found in cross-tab CSV.');
    }

    const SECTION_PATTERNS = [
      { pattern: /^\s*google\s*search\s*$/i, platform: 'google', channel: 'Search' },
      { pattern: /^\s*(google\s*pmax|performance\s*max)\s*$/i, platform: 'google', channel: 'PMax' },
      { pattern: /^\s*youtube(\s+ads)?\s*$/i, platform: 'google', channel: 'YouTube' },
      { pattern: /^\s*google(\s+ads)?\s*$/i, platform: 'google', channel: 'Search' },
      { pattern: /^\s*(meta|facebook|fb|instagram)(\s+ads)?\s*$/i, platform: 'meta', channel: 'Meta' }
    ];

    const periodDataMap = {};
    periodColumns.forEach(p => {
      periodDataMap[p.header] = new Map();
    });

    let currentCampaign = '';
    let currentSection = 'Meta';
    let currentPlatform = 'meta';
    let currentChannel = 'Meta';
    let currentCampaignId = '';
    let campCounter = 0;

    for (let r = 0; r < rawRows.length; r++) {
      const row = rawRows[r];
      const col0 = (row[headers[0]] || '').trim();
      const col1 = (row[headers[1]] || '').trim();

      // 1. Ignore summary rows such as Total, Total Spent
      if (/^total/i.test(col0) || /^summary/i.test(col0)) {
        continue;
      }

      // 2. Dynamic Section & Platform header detection (when col1 is empty or strictly a platform heading)
      const isSectionHeader = !col1 && SECTION_PATTERNS.some(s => s.pattern.test(col0));
      if (isSectionHeader) {
        const matched = SECTION_PATTERNS.find(s => s.pattern.test(col0));
        currentPlatform = matched.platform;
        currentChannel = matched.channel;
        currentSection = col0;
        currentCampaign = '';
        currentCampaignId = '';
        continue;
      }

      // 3. Campaign name fill-down (deterministic, dynamic section inheritance)
      if (col0) {
        currentCampaign = col0;
        campCounter++;
        if (/instant form|fb|ig|meta|facebook/i.test(col0) && currentPlatform !== 'google') {
          currentPlatform = 'meta';
          currentChannel = 'Meta';
        } else if (/search|pmax|adwords|google/i.test(col0) && currentPlatform === 'unknown') {
          currentPlatform = 'google';
          currentChannel = 'Search';
        }
        currentCampaignId = `camp_${campCounter}_${currentCampaign.replace(/[^a-zA-Z0-9]/g, '_')}`;
      }

      if (!currentCampaign || !col1 || !currentCampaignId) continue;

      // Map KPI label
      let kpiKey = null;
      const lowerKpi = col1.toLowerCase();
      for (const [key, syns] of Object.entries(this.KPI_SYNONYMS)) {
        if (syns.some(s => lowerKpi === s || lowerKpi.includes(s) || s.includes(lowerKpi))) {
          kpiKey = key;
          break;
        }
      }

      if (!kpiKey) continue;

      // Determine specialty
      let specialty = 'General';
      const lowerCamp = currentCampaign.toLowerCase();
      if (lowerCamp.includes('kilpauk')) specialty = 'Kilpauk Multispeciality';
      else if (lowerCamp.includes('chetpet')) specialty = 'Chetpet Centre';
      else if (lowerCamp.includes('tondiarpet')) specialty = 'Tondiarpet Centre';
      else if (lowerCamp.includes('knee')) specialty = 'Orthopaedics & Knee';
      else if (lowerCamp.includes('oncology') || lowerCamp.includes('tirunelveli')) specialty = 'Oncology';
      else if (lowerCamp.includes('headache') || lowerCamp.includes('migraine')) specialty = 'Neurology';
      else if (lowerCamp.includes('package')) specialty = 'Preventive Health';

      // Record metrics into each period
      periodColumns.forEach(p => {
        const valRaw = row[p.header];
        const val = this.sanitizeNumber(valRaw, null);

        const map = periodDataMap[p.header];
        if (!map.has(currentCampaignId)) {
          map.set(currentCampaignId, {
            id: currentCampaignId,
            name: currentCampaign,
            platform: currentPlatform,
            channel: currentChannel,
            specialty,
            section: currentSection,
            metrics: {}
          });
        }
        if (val !== null) {
          map.get(currentCampaignId).metrics[kpiKey] = val;
        }
      });
    }

    // Build Report object for each period
    const reports = [];

    periodColumns.forEach(p => {
      const map = periodDataMap[p.header];
      const campaignEntries = Array.from(map.values());

      const campaigns = [];
      let aggSpend = 0;
      let aggClicks = 0;
      let aggImpressions = 0;
      let aggLeads = 0;
      let aggConversions = 0;
      let aggPhoneCalls = 0;
      let aggResults = 0;
      let aggAllConversions = 0;
      let aggBudget = 0;
      let aggRevenue = 0;

      campaignEntries.forEach((c, idx) => {
        const m = c.metrics;
        const spend = m.spend || 0;
        const clicks = m.clicks || 0;
        const leads = m.leads || 0;
        const phoneCalls = m.phoneCalls || 0;
        let impressions = m.views || 0;
        const sourceResults = m.sourceResults !== undefined ? m.sourceResults : null;
        const conversions = m.conversions || (leads > 0 ? leads : 0);
        const budget = m.budget || 0;
        let revenue = m.revenue || 0;
        let roas = m.roas !== undefined ? m.roas : null;

        if (spend > 0 && revenue > 0) {
          roas = parseFloat((revenue / spend).toFixed(2));
        } else if (roas !== null && roas > 0 && revenue === 0 && spend > 0) {
          revenue = Math.round(spend * roas);
        }

        // Skip campaign if completely inactive in this period
        if (spend === 0 && clicks === 0 && leads === 0 && phoneCalls === 0 && budget === 0 && (!sourceResults || sourceResults === 0)) {
          return;
        }

        if (!impressions && clicks > 0) {
          impressions = Math.round(clicks * 18);
        }

        let cpc = null;
        if (spend > 0 && clicks > 0) {
          cpc = parseFloat((spend / clicks).toFixed(2));
        } else if (m.cpc !== undefined && m.cpc !== null) {
          cpc = m.cpc;
        }

        let allConversions = m.allConversions !== undefined ? m.allConversions : conversions;
        let allConversionsDerived = m.allConversions === undefined;

        let cpa = conversions > 0 ? Math.round(spend / conversions) : (m.cpl || null);
        let costPerAllConv = allConversions > 0 ? Math.round(spend / allConversions) : null;
        const ctr = impressions > 0 ? parseFloat(((clicks / impressions) * 100).toFixed(2)) : 0;
        const conversionRate = clicks > 0 ? parseFloat(((conversions / clicks) * 100).toFixed(2)) : 0;

        let classification = 'moderate';
        if (conversions >= 2 && cpa !== null && cpa <= 5500) classification = 'strong';
        else if ((cpa !== null && cpa > 15000) || (spend > 3000 && conversions === 0)) classification = 'weak';

        aggSpend += spend;
        aggClicks += clicks;
        aggImpressions += impressions;
        aggLeads += leads;
        aggPhoneCalls += phoneCalls;
        aggConversions += conversions;
        if (sourceResults) aggResults += sourceResults;
        aggAllConversions += allConversions;
        aggBudget += budget;
        aggRevenue += revenue;

        campaigns.push({
          id: c.id,
          name: c.name,
          platform: c.platform || 'meta',
          channel: c.channel || 'Meta',
          specialty: c.specialty,
          section: c.section,
          spend,
          budget,
          impressions,
          clicks,
          cpc: cpc || 0,
          ctr,
          leads,
          conversions,
          phoneCalls,
          sourceResults,
          revenue: Math.round(revenue),
          roas,
          allConversions,
          allConversionsDerived,
          cpa,
          costPerAllConv,
          conversionRate,
          classification,
          rank: idx + 1
        });
      });

      // If period has zero campaigns with data, skip generating report
      if (campaigns.length === 0) {
        return;
      }

      campaigns.sort((a, b) => b.spend - a.spend);
      campaigns.forEach((c, i) => c.rank = i + 1);

      const overallCpc = aggClicks > 0 ? parseFloat((aggSpend / aggClicks).toFixed(2)) : 0;
      const overallCpa = aggConversions > 0 ? Math.round(aggSpend / aggConversions) : null;
      const overallCostPerAllConv = aggAllConversions > 0 ? Math.round(aggSpend / aggAllConversions) : null;
      const overallCtr = aggImpressions > 0 ? parseFloat(((aggClicks / aggImpressions) * 100).toFixed(2)) : 0;
      const conversionRate = aggClicks > 0 ? parseFloat(((aggConversions / aggClicks) * 100).toFixed(2)) : 0;
      const overallRoas = aggSpend > 0 && aggRevenue > 0 ? parseFloat((aggRevenue / aggSpend).toFixed(2)) : null;
      const allocatedBudget = aggBudget > 0 ? aggBudget : Math.round(aggSpend * 1.35);

      const report = {
        reportId: 'vs_rep_' + p.period.periodId,
        periodName: p.period.periodLabel,
        period: p.period,
        granularity: 'period',
        granularityDescription: 'CANIT Skope KPI Cross-Tab pre-aggregated reporting period',
        uploadedAt: new Date().toISOString(),
        sourceType: 'csv-crosstab',
        sourceFileName: fileName,
        status: 'Ready',
        budgetSummary: {
          allocated: Math.round(allocatedBudget),
          spent: Math.round(aggSpend),
          remaining: Math.max(0, Math.round(allocatedBudget - aggSpend)),
          dailyRunRate: Math.round(aggSpend / (p.period.isMonthlyAggregate ? 28 : 7)),
          spendRatePercent: Math.min(100, parseFloat(((aggSpend / allocatedBudget) * 100).toFixed(1)))
        },
        metrics: {
          spend: Math.round(aggSpend),
          totalSpend: Math.round(aggSpend),
          impressions: aggImpressions,
          clicks: aggClicks,
          ctr: overallCtr,
          cpc: overallCpc,
          leads: aggLeads,
          conversions: aggConversions,
          sourceResults: aggResults,
          phoneCalls: aggPhoneCalls,
          revenue: Math.round(aggRevenue),
          roas: overallRoas,
          allConversions: aggAllConversions,
          allConversionsDerived: true,
          cpa: overallCpa,
          costPerAllConv: overallCostPerAllConv,
          conversionRate
        },
        campaigns,
        validation: {
          isValid: true,
          status: 'Ready',
          rowCount: rawRows.length,
          campaignCount: campaigns.length,
          errors: [],
          warnings: [],
          infos: [`Processed ${campaigns.length} active campaigns for ${p.period.periodLabel}.`],
          detectedPeriod: p.period,
          isDuplicate: false
        }
      };

      reports.push(report);
    });

    return reports;
  }

  /**
   * Process multiple CSV or Excel files simultaneously
   * @param {File[]|string[]} files
   * @param {import('./models.js').Report[]} [existingReports]
   * @returns {Promise<Array<{ file: File|string, fileName: string, report: import('./models.js').Report|null, validation: import('./models.js').ValidationResult, success: boolean, isDuplicate: boolean, existingReportId?: string, error?: string }>>}
   */
  static async parseMultipleCsvs(files, existingReports = []) {
    const results = [];

    for (const file of files) {
      const fileName = typeof file === 'string' ? 'report.csv' : (file.name || 'report.csv');
      try {
        const parsed = await this.parseRawCsv(file);
        const headers = parsed.data && parsed.data.length > 0 ? Object.keys(parsed.data[0]) : [];
        const format = this.detectCsvFormat(headers, parsed.data);

        // Format: CANIT Skope KPI Cross-Tab
        if (format === this.FORMATS.CROSS_TAB) {
          const validation = this.validateCsv(parsed.data, headers, existingReports, fileName);
          if (!validation.isValid) {
            results.push({
              file,
              fileName,
              report: null,
              validation,
              success: false,
              isDuplicate: false,
              error: validation.errors.join('; ')
            });
            continue;
          }

          const crossTabReports = this.parseKpiCrossTab(parsed, {
            fileName,
            existingReports
          });

          if (crossTabReports.length === 0) {
            results.push({
              file,
              fileName,
              report: null,
              validation: {
                isValid: false,
                status: 'Failed',
                rowCount: parsed.data.length,
                campaignCount: 0,
                errors: ['No active periods with ad spend or campaign data found in sheet.'],
                warnings: [],
                infos: []
              },
              success: false,
              isDuplicate: false,
              error: 'No active periods with ad spend or campaign data found in sheet.'
            });
            continue;
          }

          for (const rep of crossTabReports) {
            const dupMatch = existingReports.find(r => {
              if (!r.period || !rep.period) return false;
              if (r.sourceType === 'system') return false;
              return r.period.periodId === rep.period.periodId ||
                     (r.period.startDate === rep.period.startDate && r.period.endDate === rep.period.endDate);
            });

            results.push({
              file,
              fileName: `${fileName} · ${rep.period.periodLabel}`,
              report: rep,
              validation: {
                isValid: true,
                status: 'Ready',
                rowCount: parsed.data.length,
                campaignCount: rep.campaigns.length,
                errors: [],
                warnings: dupMatch ? [`Reporting period already exists (${rep.period.periodLabel}). Choose to replace or keep existing.`] : [],
                infos: [`Processed ${rep.campaigns.length} campaigns for ${rep.period.periodLabel}.`],
                detectedPeriod: rep.period,
                isDuplicate: !!dupMatch,
                existingReportId: dupMatch ? dupMatch.reportId : null
              },
              success: true,
              isDuplicate: !!dupMatch,
              existingReportId: dupMatch ? dupMatch.reportId : null
            });
          }
          continue;
        }

        // Standard CSV format
        const validation = this.validateCsv(parsed.data, headers, existingReports, fileName);

        if (!validation.isValid) {
          results.push({
            file,
            fileName,
            report: null,
            validation,
            success: false,
            isDuplicate: false,
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
          success: true,
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
          success: false,
          isDuplicate: false,
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
    return `Date,Campaign Name,Channel,Specialty,Spend,Impressions,Clicks,Avg CPC,Leads,Conversions,Phone Calls,All Conversions,CPA,Revenue,ROAS
2026-08-15 to 2026-08-21,Kilpauk PMax,PMax,Kilpauk Multispeciality,34501,78500,3909,8.83,14,14.0,19,33,2464,185000,5.36
2026-08-15 to 2026-08-21,Chetpet PMax,PMax,Chetpet Centre,36136,198400,10670,3.39,8,8.0,27,35,4517,162000,4.48
2026-08-15 to 2026-08-21,Knee Ready PMax,PMax,Orthopaedics & Knee,13271,165000,7021,1.89,5,5.0,8,13,2654,72000,5.43
2026-08-15 to 2026-08-21,Health Package Tondiarpet,PMax,Preventive Health,11041,89000,3927,2.81,2,2.0,16,18,5520,38000,3.44
2026-08-15 to 2026-08-21,Headache & Migraine Screening,PMax,Neurology,10763,142000,6258,1.72,2,2.7,5,7,4036,44000,4.09
2026-08-15 to 2026-08-21,Kilpauk Multispeciality Search,Search,Kilpauk Multispeciality,70082,52000,4784,14.65,4,4.0,5,9,17521,195000,2.78
2026-08-15 to 2026-08-21,Tondiarpet PMax,PMax,Tondiarpet Centre,37018,245000,13881,2.67,1,1.8,68,69,20192,85000,2.30
2026-08-15 to 2026-08-21,Knee Ready Search,Search,Orthopaedics & Knee,37875,4800,499,75.90,0,0.0,4,4,N/A,0,0.00
2026-08-15 to 2026-08-21,Tirunelveli Oncology Search,Search,Oncology,56131,3900,462,121.50,1,1.0,9,10,56131,25000,0.45`;
  }

  /**
   * Trigger immediate download of sample CSV template
   */
  static downloadSampleCsv() {
    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(this.getSampleCsvContent());
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', csvContent);
    downloadAnchor.setAttribute('download', 'CANIT_Display_Ads_Template.csv');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }
}

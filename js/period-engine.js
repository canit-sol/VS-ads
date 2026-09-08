/**
 * VS Ads Intelligence - Date & Reporting Period Intelligence Engine
 * Phase 2: Data Engine & Reporting Period Intelligence
 */

import { MONTH_NAMES, MONTH_SHORT_NAMES } from './models.js';

export class PeriodEngine {
  static DATE_SYNONYMS = [
    'date', 'day', 'week', 'reporting period', 'reporting_period',
    'period', 'start date', 'end date', 'start_date', 'end_date',
    'time', 'day of week', 'day_of_week'
  ];

  /**
   * Detect date-bearing column header from CSV headers
   * @param {string[]} headers
   * @returns {string|null}
   */
  static detectDateColumn(headers) {
    if (!headers || !headers.length) return null;
    const lowerHeaders = headers.map(h => (h || '').trim().toLowerCase());

    for (const syn of this.DATE_SYNONYMS) {
      const idx = lowerHeaders.findIndex(h => h === syn || h.includes(syn));
      if (idx !== -1) return headers[idx];
    }
    return null;
  }

  /**
   * Parse various date string formats into a JS Date object
   * Supports: ISO (YYYY-MM-DD), UK/India (DD/MM/YYYY, DD-MM-YYYY), US (MM/DD/YYYY), Text (15 Aug 2026, Aug 15 2026)
   * @param {string|Date} val
   * @returns {Date|null}
   */
  static parseSingleDate(val) {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val.getTime())) return val;

    let str = String(val).trim();
    if (!str) return null;

    // Handle ISO: YYYY-MM-DD
    const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10) - 1;
      const day = parseInt(isoMatch[3], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }

    // Handle UK/India: DD/MM/YYYY or DD-MM-YYYY
    const ddmmyyyyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (ddmmyyyyMatch) {
      const day = parseInt(ddmmyyyyMatch[1], 10);
      const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
      const year = parseInt(ddmmyyyyMatch[3], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }

    // Handle Text: "15 Aug 2026", "Aug 15, 2026", "15-Aug-2026"
    const textMonthRegex = /([a-z]{3,9})/i;
    const monthMatch = str.match(textMonthRegex);
    if (monthMatch) {
      const monthStr = monthMatch[1].toLowerCase();
      const monthIndex = MONTH_NAMES.findIndex(m => m.toLowerCase().startsWith(monthStr)) !== -1
        ? MONTH_NAMES.findIndex(m => m.toLowerCase().startsWith(monthStr))
        : MONTH_SHORT_NAMES.findIndex(m => m.toLowerCase() === monthStr);

      if (monthIndex !== -1) {
        const yearMatch = str.match(/(\d{4})/);
        const dayMatch = str.match(/\b(\d{1,2})\b/);
        const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
        const day = dayMatch ? parseInt(dayMatch[1], 10) : 1;
        const d = new Date(year, monthIndex, day);
        if (!isNaN(d.getTime())) return d;
      }
    }

    // Native Date fallback
    const nativeParsed = new Date(str);
    if (!isNaN(nativeParsed.getTime())) {
      return nativeParsed;
    }

    return null;
  }

  /**
   * Parse a date range string like "Aug 15 - Aug 21, 2026", "2026-08-15 to 2026-08-21", or "Aug 1 - 7, 2026"
   * @param {string} rangeStr
   * @returns {{ start: Date, end: Date }|null}
   */
  static parseDateRangeString(rangeStr) {
    if (!rangeStr || typeof rangeStr !== 'string') return null;

    const trimmed = rangeStr.trim();
    // Do not mistake a single ISO date (YYYY-MM-DD) or DD-MM-YYYY for a range
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed) || /^\d{1,2}-\d{1,2}-\d{4}$/.test(trimmed)) {
      return null;
    }

    let parts = null;
    if (/\s+to\s+/i.test(trimmed)) {
      parts = trimmed.split(/\s+to\s+/i);
    } else if (/[–—]/.test(trimmed)) {
      parts = trimmed.split(/\s*[–—]\s*/);
    } else if (/\.\./.test(trimmed)) {
      parts = trimmed.split(/\s*\.\.\s*/);
    } else if (/\s+-\s+/.test(trimmed)) {
      parts = trimmed.split(/\s+-\s+/);
    } else if (/^[A-Za-z]{3,9}\s+\d{1,2}\s*-\s*\d{1,2}(?:,\s*\d{4})?$/i.test(trimmed)) {
      // Handles compact "Aug 1-7" or "Aug 1-7, 2026"
      const m = trimmed.match(/^([A-Za-z]{3,9}\s+\d{1,2})\s*-\s*(\d{1,2}(?:,\s*\d{4})?)$/i);
      if (m) parts = [m[1], m[2]];
    }

    if (!parts || parts.length < 2) return null;

    const start = this.parseSingleDate(parts[0]);
    let end = this.parseSingleDate(parts[1]);

    // If end date omitted year/month (e.g. "Aug 1 - 7, 2026" or "Aug 15 - 21")
    if (start && (!end || isNaN(end.getTime()))) {
      const yearMatch = trimmed.match(/(\d{4})/);
      const year = yearMatch ? parseInt(yearMatch[1], 10) : start.getFullYear();
      const dayMatch = parts[1].match(/(\d{1,2})/);
      if (dayMatch) {
        end = new Date(year, start.getMonth(), parseInt(dayMatch[1], 10));
      }
    }

    if (start && end && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
      return { start, end };
    }
    return null;
  }

  /**
   * Parse a column header representing a reporting period or month
   * Handles date ranges (e.g. "July 1 - 5 2026", "August 1 - 28, 2026", "Sept 1 - 6, 2026")
   * and month-only aggregates (e.g. "July 2026").
   * @param {string} headerStr
   * @returns {import('./models.js').ReportingPeriod|null}
   */
  static parsePeriodHeader(headerStr) {
    if (!headerStr || typeof headerStr !== 'string') return null;
    const trimmed = headerStr.trim();
    if (!trimmed) return null;

    // Detect month name
    const textMonthRegex = /\b(january|february|march|april|may|june|july|august|september|sept|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b/i;
    const mMatch = trimmed.match(textMonthRegex);
    if (!mMatch) return null;

    const mRaw = mMatch[1].toLowerCase();
    let monthIndex = MONTH_NAMES.findIndex(m => m.toLowerCase().startsWith(mRaw.slice(0, 3)));
    if (monthIndex === -1) {
      monthIndex = MONTH_SHORT_NAMES.findIndex(m => m.toLowerCase() === mRaw.slice(0, 3));
    }
    if (monthIndex === -1) return null;

    const monthName = MONTH_NAMES[monthIndex];
    const monthShort = MONTH_SHORT_NAMES[monthIndex];

    // Detect year
    const yearMatch = trimmed.match(/\b(20\d{2})\b/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : 2026;

    // Check if month-only aggregate (e.g. "July 2026")
    const withoutMonthYear = trimmed.replace(textMonthRegex, '').replace(/\b20\d{2}\b/, '').replace(/[,.\s]/g, '');
    if (!withoutMonthYear) {
      const startDate = new Date(year, monthIndex, 1);
      const lastDay = new Date(year, monthIndex + 1, 0).getDate();
      const endDate = new Date(year, monthIndex, lastDay);
      const periodId = `${year}_M${String(monthIndex + 1).padStart(2, '0')}_MONTH`;
      return {
        periodId,
        year,
        month: monthName,
        monthNumber: monthIndex + 1,
        weekNumber: 0,
        startDate: this.toISODate(startDate),
        endDate: this.toISODate(endDate),
        periodLabel: `Monthly Summary · ${monthName} ${year}`,
        isMonthlyAggregate: true
      };
    }

    // Check day range (e.g. "1 - 5", "6 - 12", "1 - 28")
    const rangeMatch = trimmed.match(/\b(\d{1,2})\s*(?:[-–—]|to)\s*(\d{1,2})\b/i);
    if (rangeMatch) {
      const startDay = parseInt(rangeMatch[1], 10);
      const endDay = parseInt(rangeMatch[2], 10);

      const startDate = new Date(year, monthIndex, startDay);
      const endDate = new Date(year, monthIndex, endDay);

      // Multi-week or month aggregate (e.g. "August 1 - 28, 2026")
      const isMultiWeek = (endDay - startDay) >= 20;

      let weekNumber = 1;
      let periodId;
      let periodLabel;

      if (isMultiWeek) {
        periodId = `${year}_M${String(monthIndex + 1).padStart(2, '0')}_AGG${endDay}`;
        periodLabel = `${monthShort} ${startDay}–${endDay}, ${year} (Aggregate)`;
      } else {
        if (endDay <= 9) weekNumber = 1;
        else if (startDay >= 6 && endDay <= 16) weekNumber = 2;
        else if (startDay >= 13 && endDay <= 23) weekNumber = 3;
        else if (startDay >= 20 && endDay <= 29) weekNumber = 4;
        else weekNumber = 5;

        periodId = `${year}_M${String(monthIndex + 1).padStart(2, '0')}_W${String(weekNumber).padStart(2, '0')}`;
        periodLabel = `Week ${weekNumber} · ${monthShort} ${startDay}–${endDay}, ${year}`;
      }

      return {
        periodId,
        year,
        month: monthName,
        monthNumber: monthIndex + 1,
        weekNumber: isMultiWeek ? 0 : weekNumber,
        startDate: this.toISODate(startDate),
        endDate: this.toISODate(endDate),
        periodLabel,
        isMonthlyAggregate: isMultiWeek
      };
    }

    return null;
  }

  /**
   * Classify day of month into standard 7-day reporting weeks
   * Days 1-7: Week 1
   * Days 8-14: Week 2
   * Days 15-21: Week 3
   * Days 22-28: Week 4
   * Days 29+: Week 5
   * @param {number} dayOfMonth
   * @returns {number} 1 to 5
   */
  static classifyWeekNumber(dayOfMonth) {
    if (dayOfMonth <= 7) return 1;
    if (dayOfMonth <= 14) return 2;
    if (dayOfMonth <= 21) return 3;
    if (dayOfMonth <= 28) return 4;
    return 5;
  }

  /**
   * Format ISO date string "YYYY-MM-DD"
   * @param {Date} date
   * @returns {string}
   */
  static toISODate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Extract reporting period metadata from parsed CSV rows or filename fallback
   * @param {Object[]} rawRows
   * @param {string|null} dateColumn
   * @param {string} [fileName]
   * @returns {import('./models.js').ReportingPeriod}
   */
  static determineReportingPeriod(rawRows, dateColumn, fileName = '') {
    let parsedDates = [];
    let detectedRange = null;

    if (dateColumn && rawRows && rawRows.length > 0) {
      for (const row of rawRows) {
        const rawVal = row[dateColumn];
        if (!rawVal) continue;

        // Check if row contains a range
        const range = this.parseDateRangeString(String(rawVal));
        if (range) {
          detectedRange = range;
          break;
        }

        // Single date
        const d = this.parseSingleDate(rawVal);
        if (d) parsedDates.push(d);
      }
    }

    let startDate, endDate;

    if (detectedRange) {
      startDate = detectedRange.start;
      endDate = detectedRange.end;
    } else if (parsedDates.length > 0) {
      parsedDates.sort((a, b) => a.getTime() - b.getTime());
      startDate = parsedDates[0];
      endDate = parsedDates[parsedDates.length - 1];

      // If all rows had the same single date or only 1 day, assume 7-day period starting that date
      if (startDate.getTime() === endDate.getTime()) {
        endDate = new Date(startDate.getTime() + 6 * 86400000);
      }
    } else {
      // Fallback: Check filename for dates or week numbers
      const fromFilename = this.extractPeriodFromFilename(fileName);
      if (fromFilename) {
        startDate = fromFilename.startDate;
        endDate = fromFilename.endDate;
      } else {
        // Safe default: Previous 7 days
        const now = new Date();
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        startDate = new Date(endDate.getTime() - 6 * 86400000);
      }
    }

    const year = startDate.getFullYear();
    const monthNumber = startDate.getMonth() + 1;
    const monthName = MONTH_NAMES[startDate.getMonth()];
    const startDay = startDate.getDate();
    const endDay = endDate.getDate();
    const weekNumber = this.classifyWeekNumber(startDay);

    const startShortMonth = MONTH_SHORT_NAMES[startDate.getMonth()];
    const endShortMonth = MONTH_SHORT_NAMES[endDate.getMonth()];

    let periodLabel;
    if (startShortMonth === endShortMonth) {
      periodLabel = `Week ${weekNumber} · ${startShortMonth} ${startDay}–${endDay}, ${year}`;
    } else {
      periodLabel = `Week ${weekNumber} · ${startShortMonth} ${startDay} – ${endShortMonth} ${endDay}, ${year}`;
    }

    const periodId = `${year}_M${String(monthNumber).padStart(2, '0')}_W${String(weekNumber).padStart(2, '0')}`;

    return {
      periodId,
      year,
      month: monthName,
      monthNumber,
      weekNumber,
      startDate: this.toISODate(startDate),
      endDate: this.toISODate(endDate),
      periodLabel,
      isMonthlyAggregate: false
    };
  }

  /**
   * Fallback: Extract week number or date hints from file name
   * @param {string} fileName
   * @returns {{ startDate: Date, endDate: Date }|null}
   */
  static extractPeriodFromFilename(fileName) {
    if (!fileName) return null;
    const lower = fileName.toLowerCase();

    // Check for "Week 1", "Week 2", "Week 3", "W1", "W2", "W3"
    const weekMatch = lower.match(/(?:week[_\s-]?|w)(\d)/i);
    const monthMatch = lower.match(/(aug|sep|oct|nov|dec|jan|feb|mar|apr|may|jun|jul)/i);
    const yearMatch = lower.match(/(20\d\d)/);

    const year = yearMatch ? parseInt(yearMatch[1], 10) : 2026;
    let monthIdx = 7; // Default August (index 7) for VS Hospitals baseline

    if (monthMatch) {
      const mStr = monthMatch[1].toLowerCase();
      const idx = MONTH_SHORT_NAMES.findIndex(m => m.toLowerCase() === mStr);
      if (idx !== -1) monthIdx = idx;
    }

    if (weekMatch) {
      const wNum = parseInt(weekMatch[1], 10);
      let startDay = 1;
      if (wNum === 2) startDay = 8;
      else if (wNum === 3) startDay = 15;
      else if (wNum === 4) startDay = 22;
      else if (wNum >= 5) startDay = 29;

      const startDate = new Date(year, monthIdx, startDay);
      const endDate = new Date(year, monthIdx, Math.min(startDay + 6, 31));
      return { startDate, endDate };
    }

    // Check for date range like "Aug_1_7" or "15_21"
    const rangeMatch = lower.match(/(\d{1,2})[_\s-]+(\d{1,2})/);
    if (rangeMatch) {
      const d1 = parseInt(rangeMatch[1], 10);
      const d2 = parseInt(rangeMatch[2], 10);
      if (d1 >= 1 && d1 <= 31 && d2 >= 1 && d2 <= 31) {
        return {
          startDate: new Date(year, monthIdx, d1),
          endDate: new Date(year, monthIdx, d2)
        };
      }
    }

    return null;
  }

  /**
   * Explicitly detect whether CSV contains:
   * A. Daily-level records (multiple dated rows for the same campaign across the reporting period)
   * OR
   * B. Already-aggregated period-level records (1 record/metrics set already representing the period)
   * 
   * @param {Object[]} rawRows
   * @param {Object} mapping - Column mapping
   * @returns {{
   *   type: 'daily' | 'period_level',
   *   totalRows: number,
   *   uniqueCampaigns: number,
   *   hasMultipleDatesPerCampaign: boolean,
   *   description: string
   * }}
   */
  static detectDataGranularity(rawRows, mapping) {
    if (!rawRows || rawRows.length === 0) {
      return {
        type: 'period_level',
        totalRows: 0,
        uniqueCampaigns: 0,
        hasMultipleDatesPerCampaign: false,
        description: 'Empty dataset.'
      };
    }

    const campaignKey = mapping.name;
    const dateKey = mapping.date;

    const campaignDates = new Map();
    let validRowCount = 0;

    rawRows.forEach(row => {
      const rawName = row[campaignKey];
      if (!rawName) return;
      const name = String(rawName).trim().toLowerCase();
      if (!name) return;

      validRowCount++;
      if (!campaignDates.has(name)) {
        campaignDates.set(name, new Set());
      }

      if (dateKey && row[dateKey]) {
        campaignDates.get(name).add(String(row[dateKey]).trim());
      }
    });

    const uniqueCampaigns = campaignDates.size;
    let hasMultipleDatesPerCampaign = false;

    for (const [name, dates] of campaignDates.entries()) {
      if (dates.size > 1) {
        hasMultipleDatesPerCampaign = true;
        break;
      }
    }

    // Explicit Decision Rule:
    // Case A: Daily-level records:
    // - Explicit date column exists AND at least one campaign has entries on >1 distinct date
    //   OR multiple rows exist for the same campaign (validRowCount > uniqueCampaigns).
    // Case B: Already-aggregated period-level records:
    // - Exactly 1 row per campaign (validRowCount === uniqueCampaigns).
    const isDaily = hasMultipleDatesPerCampaign || (validRowCount > uniqueCampaigns && uniqueCampaigns > 0);

    const type = isDaily ? 'daily' : 'period_level';
    const description = isDaily
      ? `Detected Daily-Level Records: ${validRowCount} rows across ${uniqueCampaigns} unique campaigns with multiple entries. Aggregating daily rows by campaign for the reporting period.`
      : `Detected Already-Aggregated Period-Level Records: ${uniqueCampaigns} unique campaigns across ${validRowCount} rows (1 record per campaign). Using supplied campaign metrics directly without re-aggregating.`;

    return {
      type,
      totalRows: validRowCount,
      uniqueCampaigns,
      hasMultipleDatesPerCampaign,
      description
    };
  }

  /**
   * Aggregate daily records by campaign without double-counting
   * @param {Object[]} rawRows
   * @param {Object} columnMapping
   * @param {Function} sanitizeNumberFn
   * @returns {Object[]}
   */
  static aggregateDailyRowsByCampaign(rawRows, columnMapping, sanitizeNumberFn) {
    const campaignGroups = new Map();

    rawRows.forEach((row, idx) => {
      const rawName = row[columnMapping.name];
      if (!rawName) return;
      const cleanName = String(rawName).trim();
      if (!cleanName) return;

      const key = cleanName.toLowerCase();
      const spend = sanitizeNumberFn(row[columnMapping.spend]) || 0;
      const impressions = sanitizeNumberFn(row[columnMapping.impressions]) || 0;
      const clicks = sanitizeNumberFn(row[columnMapping.clicks]) || 0;
      const leads = sanitizeNumberFn(row[columnMapping.leads]) || 0;
      const conversions = sanitizeNumberFn(row[columnMapping.conversions]) || 0;
      const phoneCalls = sanitizeNumberFn(row[columnMapping.phoneCalls]) || 0;
      
      // Preserve explicit source All Conversions if provided
      const rawAllConv = columnMapping.allConversions ? sanitizeNumberFn(row[columnMapping.allConversions]) : null;

      if (!campaignGroups.has(key)) {
        campaignGroups.set(key, {
          name: cleanName,
          channel: row[columnMapping.channel] || '',
          specialty: row[columnMapping.specialty] || '',
          spend,
          impressions,
          clicks,
          leads,
          conversions,
          phoneCalls,
          allConversions: rawAllConv !== null ? rawAllConv : null,
          hasSourceAllConv: rawAllConv !== null,
          rowCount: 1
        });
      } else {
        const existing = campaignGroups.get(key);
        existing.spend += spend;
        existing.impressions += impressions;
        existing.clicks += clicks;
        existing.leads += leads;
        existing.conversions += conversions;
        existing.phoneCalls += phoneCalls;
        if (rawAllConv !== null) {
          existing.allConversions = (existing.allConversions || 0) + rawAllConv;
          existing.hasSourceAllConv = true;
        }
        existing.rowCount += 1;
      }
    });

    return Array.from(campaignGroups.values());
  }

  /**
   * Calculate Monthly Aggregate Report from Weekly Reports
   * Strictly adheres to mathematical aggregation rules:
   * - SUM for spend, impressions, clicks, leads, conversions, phoneCalls, allConversions
   * - Never average ratios! CTR = clicks / impressions, CPC = spend / clicks, CPA = spend / conversions
   * @param {import('./models.js').Report[]} weeklyReports
   * @param {number} year
   * @param {string|number} month
   * @returns {import('./models.js').Report|null}
   */
  static calculateMonthlySummary(weeklyReports, year, month) {
    if (!weeklyReports || !weeklyReports.length) return null;

    // Filter reports for this year and month, excluding any existing monthly aggregates to prevent double counting
    const monthStr = typeof month === 'number' ? MONTH_NAMES[month - 1] : month;
    const matchingReports = weeklyReports.filter(r => {
      const p = r.period;
      if (!p) return false;
      if (p.isMonthlyAggregate) return false; // never aggregate an aggregate!
      const yearMatches = Number(p.year) === Number(year);
      const monthMatches = p.month.toLowerCase() === String(monthStr).toLowerCase() ||
                           Number(p.monthNumber) === (MONTH_NAMES.findIndex(m => m.toLowerCase() === String(monthStr).toLowerCase()) + 1);
      return yearMatches && monthMatches;
    });

    if (matchingReports.length === 0) return null;

    // Sort matching reports chronologically
    matchingReports.sort((a, b) => new Date(a.period.startDate).getTime() - new Date(b.period.startDate).getTime());

    let aggSpend = 0;
    let aggImpressions = 0;
    let aggClicks = 0;
    let aggLeads = 0;
    let aggConversions = 0;
    let aggPhoneCalls = 0;
    let aggAllConversions = 0;
    let hasSourceAllConvInAny = false;

    // Campaign aggregation map
    const campaignMap = new Map();

    matchingReports.forEach(rep => {
      aggSpend += (rep.metrics.spend || rep.budgetSummary.spent || 0);
      aggImpressions += (rep.metrics.impressions || 0);
      aggClicks += (rep.metrics.clicks || 0);
      aggLeads += (rep.metrics.leads || 0);
      aggConversions += (rep.metrics.conversions || 0);
      aggPhoneCalls += (rep.metrics.phoneCalls || 0);

      if (rep.metrics.allConversions !== undefined && rep.metrics.allConversions !== null) {
        aggAllConversions += rep.metrics.allConversions;
        hasSourceAllConvInAny = true;
      }

      // Merge campaign data
      (rep.campaigns || []).forEach(camp => {
        const cKey = (camp.name || '').trim().toLowerCase();
        if (!cKey) return;

        if (!campaignMap.has(cKey)) {
          campaignMap.set(cKey, {
            id: 'camp_monthly_' + cKey.replace(/[^a-z0-9]/g, '_'),
            name: camp.name,
            channel: camp.channel,
            specialty: camp.specialty,
            spend: camp.spend || 0,
            impressions: camp.impressions || 0,
            clicks: camp.clicks || 0,
            leads: camp.leads || 0,
            conversions: camp.conversions || 0,
            phoneCalls: camp.phoneCalls || 0,
            allConversions: camp.allConversions || (camp.conversions || 0),
            hasExplicitAllConv: camp.allConversions !== undefined && camp.allConversions !== null,
            notes: camp.notes || ''
          });
        } else {
          const item = campaignMap.get(cKey);
          item.spend += (camp.spend || 0);
          item.impressions += (camp.impressions || 0);
          item.clicks += (camp.clicks || 0);
          item.leads += (camp.leads || 0);
          item.conversions += (camp.conversions || 0);
          item.phoneCalls += (camp.phoneCalls || 0);
          if (camp.allConversions !== undefined && camp.allConversions !== null) {
            item.allConversions += camp.allConversions;
            item.hasExplicitAllConv = true;
          } else {
            item.allConversions += (camp.conversions || 0);
          }
          if (camp.notes && !item.notes.includes(camp.notes)) {
            item.notes = (item.notes ? item.notes + ' ' : '') + camp.notes;
          }
        }
      });
    });

    // If no report had explicit All Conversions, fallback to recorded conversions
    if (!hasSourceAllConvInAny) {
      aggAllConversions = aggConversions;
    }

    // Recompute derived ratios mathematically (CRITICAL: NEVER AVERAGE RATIOS)
    const overallCtr = aggImpressions > 0 ? parseFloat(((aggClicks / aggImpressions) * 100).toFixed(2)) : 0;
    const overallCpc = aggClicks > 0 ? parseFloat((aggSpend / aggClicks).toFixed(2)) : 0;
    const overallCpa = aggConversions > 0 ? Math.round(aggSpend / aggConversions) : null;
    const overallCostPerAllConv = aggAllConversions > 0 ? Math.round(aggSpend / aggAllConversions) : null;
    const overallConvRate = aggClicks > 0 ? parseFloat(((aggConversions / aggClicks) * 100).toFixed(2)) : 0;

    // Process campaign derived metrics and classifications
    const aggregatedCampaigns = Array.from(campaignMap.values()).map(c => {
      const cCtr = c.impressions > 0 ? parseFloat(((c.clicks / c.impressions) * 100).toFixed(2)) : 0;
      const cCpc = c.clicks > 0 ? parseFloat((c.spend / c.clicks).toFixed(2)) : 0;
      const cCpa = c.conversions > 0 ? Math.round(c.spend / c.conversions) : null;
      const cCostPerAll = c.allConversions > 0 ? Math.round(c.spend / c.allConversions) : null;
      const cConvRate = c.clicks > 0 ? parseFloat(((c.conversions / c.clicks) * 100).toFixed(2)) : 0;

      let classification = 'moderate';
      let mainIssue = '';
      if (c.conversions >= 2 && cCpa !== null && cCpa <= 5500) {
        classification = 'strong';
      } else if ((cCpa !== null && cCpa > 15000) || c.conversions === 0 || cCpc > 50) {
        classification = 'weak';
        if (c.conversions === 0 && cCpc > 40) mainIssue = `Zero conversions with high ₹${cCpc} CPC`;
        else if (cCpa && cCpa > 30000) mainIssue = `Severe CPA of ₹${cCpa.toLocaleString('en-IN')}`;
        else if (c.phoneCalls > 20 && c.conversions <= 2) mainIssue = `${c.phoneCalls} calls with low verified conversions`;
      }

      return {
        id: c.id,
        name: c.name,
        channel: c.channel,
        specialty: c.specialty,
        spend: c.spend,
        impressions: c.impressions,
        clicks: c.clicks,
        ctr: cCtr,
        cpc: cCpc,
        leads: c.leads,
        conversions: c.conversions,
        phoneCalls: c.phoneCalls,
        allConversions: c.allConversions,
        cpa: cCpa,
        costPerAllConv: cCostPerAll,
        conversionRate: cConvRate,
        classification,
        mainIssue,
        notes: c.notes
      };
    });

    // Rank campaigns: Strong first, then conversions desc
    aggregatedCampaigns.sort((a, b) => {
      if (a.classification === 'strong' && b.classification !== 'strong') return -1;
      if (a.classification !== 'strong' && b.classification === 'strong') return 1;
      return (b.conversions || 0) - (a.conversions || 0);
    });
    aggregatedCampaigns.forEach((c, idx) => c.rank = idx + 1);

    const firstReport = matchingReports[0];
    const lastReport = matchingReports[matchingReports.length - 1];
    const startDate = firstReport.period.startDate;
    const endDate = lastReport.period.endDate;
    const monthIndex = MONTH_NAMES.findIndex(m => m.toLowerCase() === String(monthStr).toLowerCase());
    const mNum = monthIndex !== -1 ? monthIndex + 1 : 8;

    const periodId = `${year}_M${String(mNum).padStart(2, '0')}_FULL`;
    const periodLabel = `${monthStr} ${year} · Monthly Aggregate (${matchingReports.length} Weeks)`;

    // Budget derivation: Sum of allocated or benchmark
    const totalAllocated = matchingReports.reduce((acc, r) => acc + (r.budgetSummary.allocated || 0), 0);
    const allocated = totalAllocated > 0 ? totalAllocated : Math.round(aggSpend * 1.35);

    return {
      reportId: `vs_rep_${periodId}`,
      periodName: periodLabel,
      period: {
        periodId,
        year: Number(year),
        month: monthStr,
        monthNumber: mNum,
        weekNumber: null,
        startDate,
        endDate,
        periodLabel,
        isMonthlyAggregate: true
      },
      uploadedAt: new Date().toISOString(),
      sourceFileName: `${monthStr}_${year}_Monthly_Summary.csv`,
      sourceType: 'aggregated',
      status: 'Ready',
      budgetSummary: {
        allocated,
        spent: Math.round(aggSpend),
        remaining: Math.max(0, Math.round(allocated - aggSpend)),
        dailyRunRate: Math.round(aggSpend / Math.max(1, (new Date(endDate) - new Date(startDate)) / 86400000)),
        spendRatePercent: Math.min(100, parseFloat(((aggSpend / allocated) * 100).toFixed(1)))
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
        cpa: overallCpa,
        costPerAllConv: overallCostPerAllConv,
        conversionRate: overallConvRate
      },
      campaigns: aggregatedCampaigns,
      validation: {
        isValid: true,
        status: 'Ready',
        rowCount: aggregatedCampaigns.length,
        campaignCount: aggregatedCampaigns.length,
        errors: [],
        warnings: [],
        infos: [`Aggregated across ${matchingReports.length} reporting weeks for ${monthStr} ${year}`]
      }
    };
  }
}

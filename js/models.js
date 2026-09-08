/**
 * VS Ads Intelligence - Normalized Data Models & Interfaces
 * Phase 2: Data Engine & Reporting Period Intelligence
 */

/**
 * @typedef {Object} ReportingPeriod
 * @property {string} periodId - Unique deterministic period identifier (e.g. "2026_M08_W03", "2026_M08_FULL")
 * @property {number} year - e.g. 2026
 * @property {string} month - e.g. "August"
 * @property {number} monthNumber - 1 to 12
 * @property {number|null} weekNumber - 1 to 5 (null for monthly aggregates)
 * @property {string} startDate - ISO "YYYY-MM-DD"
 * @property {string} endDate - ISO "YYYY-MM-DD"
 * @property {string} periodLabel - e.g. "Week 3 · Aug 15–21, 2026" or "August 2026 · Monthly Aggregate"
 * @property {boolean} isMonthlyAggregate - true if aggregated over multiple weeks
 */

/**
 * @typedef {Object} CampaignMetric
 * @property {string} id - Unique campaign metric ID
 * @property {string} name - Normalized campaign name (e.g. "Kilpauk PMax")
 * @property {'google'|'meta'|'unknown'} platform - Advertising platform ('google' | 'meta' | 'unknown')
 * @property {'Search'|'PMax'|'YouTube'|'Meta'|'Display'|'Other'} channel - Advertising channel type
 * @property {string} [section] - Source section header name
 * @property {string} specialty - Medical specialty or location (e.g. "Kilpauk Multispeciality")
 * @property {number} spend - Total spend in INR (₹)
 * @property {number} impressions - Impression count
 * @property {number} clicks - Interaction count
 * @property {number} ctr - Click-through rate (%) = (clicks / impressions) * 100
 * @property {number} cpc - Cost per click (₹) = spend / clicks
 * @property {number} leads - Direct patient lead inquiries
 * @property {number} conversions - Verified recorded primary conversions
 * @property {number} phoneCalls - Direct phone call inquiries
 * @property {number} allConversions - All conversions (from explicit source column, or fallback)
 * @property {boolean} allConversionsDerived - true if source CSV omitted allConversions and fallback was used
 * @property {number|null} cpa - Cost per conversion (₹) = spend / conversions
 * @property {number|null} costPerAllConv - Cost per all conversions (₹) = spend / allConversions
 * @property {number} conversionRate - Conversion rate (%) = (conversions / clicks) * 100
 * @property {'strong'|'weak'|'moderate'} classification - Efficiency classification
 * @property {number} [rank] - Ordered efficiency rank
 * @property {string} [mainIssue] - Identified diagnosis or issue summary
 * @property {string} [notes] - Strategic notes or observations
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Whether file meets minimum viability
 * @property {'Ready'|'Needs Attention'|'Failed'} status - Overall quality status
 * @property {number} rowCount - Total rows parsed
 * @property {number} campaignCount - Distinct campaigns detected
 * @property {'daily'|'period_level'} granularity - Detected data granularity
 * @property {string} granularityDescription - Explanation of granularity decision
 * @property {boolean} allConversionsDerived - true if allConversions fell back to conversions
 * @property {string[]} errors - Fatal errors preventing ingestion
 * @property {string[]} warnings - Non-fatal data anomalies or missing optional fields
 * @property {string[]} infos - Descriptive operational metadata
 * @property {ReportingPeriod} [detectedPeriod] - Inferred reporting period
 * @property {boolean} isDuplicate - Whether this reporting period is already in store
 * @property {string} [existingReportId] - ID of existing report if duplicate
 */

/**
 * @typedef {Object} Report
 * @property {string} reportId - Unique report identifier (e.g. "vs_rep_2026_w3")
 * @property {ReportingPeriod} period - Structured reporting period metadata
 * @property {string} uploadedAt - ISO datetime string
 * @property {string} sourceFileName - Original file name
 * @property {'csv'|'sample'|'system'|'aggregated'} sourceType - Origin of dataset
 * @property {'Ready'|'Needs Attention'|'Failed'} status - Data validation status
 * @property {Object} budgetSummary
 * @property {number} budgetSummary.allocated - Total cycle budget
 * @property {number} budgetSummary.spent - Period spend
 * @property {number} budgetSummary.remaining - Remaining cycle budget
 * @property {number} budgetSummary.dailyRunRate - Spend / period duration in days
 * @property {number} budgetSummary.spendRatePercent - (spent / allocated) * 100
 * @property {Object} metrics - Overall account metrics
 * @property {number} metrics.spend
 * @property {number} metrics.impressions
 * @property {number} metrics.clicks
 * @property {number} metrics.ctr
 * @property {number} metrics.cpc
 * @property {number} metrics.leads
 * @property {number} metrics.conversions
 * @property {number} metrics.phoneCalls
 * @property {number} metrics.allConversions
 * @property {number|null} metrics.cpa
 * @property {number|null} metrics.costPerAllConv
 * @property {number} metrics.conversionRate
 * @property {CampaignMetric[]} campaigns - Normalized campaign records
 * @property {ValidationResult} [validation] - Validation breakdown
 */

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const MONTH_SHORT_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

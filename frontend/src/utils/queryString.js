/**
 * Query string utilities for handling URL parameters
 */

/**
 * Parse a query string into an object
 * @param {string} query The query string (without the leading '?')
 * @returns {Object} Parsed query parameters
 */
export function parseQuery(query) {
  if (!query) return {};
  if (query.startsWith('?')) query = query.substring(1);
  
  return query
    .split('&')
    .reduce((params, param) => {
      const [key, value] = param.split('=');
      if (key) {
        params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
      }
      return params;
    }, {});
}

/**
 * Stringify an object into a query string
 * @param {Object} params The parameters object
 * @returns {string} Query string (without the leading '?')
 */
export function stringifyQuery(params) {
  if (!params || typeof params !== 'object') return '';
  
  return Object.entries(params)
    .filter(([, value]) => value != null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

/**
 * Parse a date range query parameter
 * @param {string} rangeStr The range string (e.g., "today", "last7")
 * @returns {[Date, Date]} Start and end date objects
 */
export function qsRangeBare(rangeStr) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (rangeStr) {
    case 'today':
      return [today, new Date(today.getTime() + 86400000 - 1)]; // Today 00:00:00 to 23:59:59
      
    case 'yesterday':
      const yesterday = new Date(today.getTime() - 86400000);
      return [yesterday, new Date(today.getTime() - 1)]; // Yesterday 00:00:00 to 23:59:59
      
    case 'last7':
      return [new Date(today.getTime() - 6 * 86400000), new Date(today.getTime() + 86400000 - 1)]; // Last 7 days including today
      
    case 'last30':
      return [new Date(today.getTime() - 29 * 86400000), new Date(today.getTime() + 86400000 - 1)]; // Last 30 days including today
      
    case 'thisMonth':
      return [new Date(today.getFullYear(), today.getMonth(), 1), new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59)];
      
    case 'lastMonth':
      return [
        new Date(today.getFullYear(), today.getMonth() - 1, 1),
        new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59)
      ];
      
    default:
      // If it's a custom range in format 'YYYY-MM-DD,YYYY-MM-DD'
      if (rangeStr && rangeStr.includes(',')) {
        const [start, end] = rangeStr.split(',');
        try {
          const startDate = new Date(start);
          const endDate = new Date(end);
          if (!isNaN(startDate) && !isNaN(endDate)) {
            // Set end date to end of day
            endDate.setHours(23, 59, 59, 999);
            return [startDate, endDate];
          }
        } catch (e) {
          console.error('Error parsing custom date range:', e);
        }
      }
      
      // Default to today if invalid
      return [today, new Date(today.getTime() + 86400000 - 1)];
  }
}

/**
 * Parse a date range query parameter and format as a string
 * @param {string} rangeStr The range string
 * @returns {string} Formatted range string
 */
export function qsRangeFormatted(rangeStr) {
  const [start, end] = qsRangeBare(rangeStr);
  return `${formatDate(start)} - ${formatDate(end)}`;
}

/**
 * Format a date as YYYY-MM-DD
 * @param {Date} date The date to format
 * @returns {string} Formatted date
 */
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

export default {
  parseQuery,
  stringifyQuery,
  qsRangeBare,
  qsRangeFormatted
};

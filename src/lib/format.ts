/**
 * Shared number-formatting helpers.
 *
 * The app's UI text is Arabic (RTL) but numeric values must render with
 * Western/English digits (0-9) and thousands separators for readability.
 * We deliberately use the `'en-US'` locale (which yields "50,000") rather
 * than an Arabic locale (which would yield Arabic-Indic digits "٥٠٬٠٠٠").
 */

const EN_LOCALE = 'en-US'

/** Format an integer/number with English digits and thousands separators. */
export function formatNumber(value: number): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '0'
  return Math.round(value).toLocaleString(EN_LOCALE)
}

/**
 * Format a currency amount (Syrian Lira) with English digits + separators.
 * Returns e.g. "50,000 ل.س" (suffix is appended by the caller in most
 * screens, so this helper just returns the plain formatted number).
 */
export function formatCurrency(value: number): string {
  return formatNumber(value)
}

/** Format a number of days (used in duration labels) with separators. */
export function formatDays(value: number): string {
  return formatNumber(value)
}

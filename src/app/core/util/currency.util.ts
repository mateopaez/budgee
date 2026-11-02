import type { Cents } from '../models/money.model';

/** Largest amount one transaction may carry: $1,000,000.00. */
export const MAX_AMOUNT_CENTS = 100_000_000;

/** Amounts above this ask for confirmation before saving: $10,000.00. */
export const LARGE_AMOUNT_CENTS = 1_000_000;

export interface MoneyFormatOptions {
  /** Show cents. When false the value is rounded to whole dollars. */
  readonly decimals?: boolean;
  /** Prefix positive values with a plus sign, used for income rows. */
  readonly signed?: boolean;
  /** Compact large values as 1.8K or 1.2M, used inside the calendar cells. */
  readonly compact?: boolean;
  readonly locale?: string;
  readonly currency?: string;
}

/**
 * Formats cents as Canadian dollars. All display formatting flows through here
 * so a preference change reaches every screen at once.
 */
export function formatMoney(cents: Cents, options: MoneyFormatOptions = {}): string {
  const {
    decimals = false,
    signed = false,
    compact = false,
    locale = 'en-CA',
    currency = 'CAD',
  } = options;

  const negative = cents < 0;
  const magnitude = Math.abs(cents) / 100;

  let body: string;
  if (compact && magnitude >= 1_000_000) {
    body = `$${trimTrailingZero((magnitude / 1_000_000).toFixed(1))}M`;
  } else if (compact && magnitude >= 1000) {
    const thousands = magnitude / 1000;
    body = `$${trimTrailingZero(thousands.toFixed(1))}K`;
  } else {
    body = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals ? 2 : 0,
      maximumFractionDigits: decimals ? 2 : 0,
      currencyDisplay: 'narrowSymbol',
    }).format(magnitude);
  }

  // A true minus sign (U+2212), which screen readers announce as "minus".
  if (negative) return `\u2212${body}`;
  if (signed) return `+${body}`;
  return body;
}

function trimTrailingZero(value: string): string {
  return value.endsWith('.0') ? value.slice(0, -2) : value;
}

/** Parses free typed input such as "1,234.50" or "$12" into cents. */
export function parseMoneyToCents(input: string): Cents | null {
  const cleaned = input.replace(/[^0-9.,-]/g, '').replace(/,/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export function centsToInputString(cents: Cents): string {
  return (cents / 100).toFixed(2);
}

/** Keeps digits and a single decimal point, with at most two decimal places. */
export function sanitizeAmountInput(raw: string): string {
  let result = '';
  let seenPoint = false;
  let decimals = 0;
  for (const char of raw) {
    if (char >= '0' && char <= '9') {
      if (seenPoint) {
        if (decimals === 2) continue;
        decimals += 1;
      }
      result += char;
    } else if (char === '.' && !seenPoint) {
      seenPoint = true;
      result += char;
    }
  }
  return result;
}

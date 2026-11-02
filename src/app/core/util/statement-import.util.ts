import type { Transaction } from '../models/transaction.model';
import { addDays } from './date.util';
import { sameMerchant } from './similar-transactions.util';

/** One row read from a bank statement, before it becomes a transaction. */
export interface StatementRow {
  /** Position in the file, starting at 1 for the first data row. */
  readonly line: number;
  readonly date: string;
  readonly description: string;
  readonly amountCents: number;
  /** Charges leave the wallet. Credits, such as refunds and payments, come in. */
  readonly direction: 'charge' | 'credit';
}

export interface ParsedStatement {
  readonly rows: readonly StatementRow[];
  /** Data rows that could not be read, by line number. */
  readonly skippedLines: readonly number[];
  /**
   * True when the file has one signed amount column. Banks disagree on whether
   * charges are positive or negative there, so the screen offers a swap.
   */
  readonly singleAmountColumn: boolean;
}

/** How close an existing transaction's date must be to count as the same one. */
const DUPLICATE_DAY_WINDOW = 3;

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const HEADER_NAMES = {
  date: ['date', 'transaction date', 'trans date', 'posted date', 'posting date'],
  description: ['description', 'merchant', 'name', 'details', 'payee', 'transaction'],
  amount: ['amount', 'amount cad', 'amount ($)', 'cad$'],
  debit: ['debit', 'debits', 'withdrawal', 'withdrawals', 'charges', 'purchases'],
  credit: ['credit', 'credits', 'deposit', 'deposits', 'payments'],
} as const;

/** Splits CSV text into rows of cells, honouring quotes and quoted commas. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const source = text.replace(/^﻿/, '');
  for (let i = 0; i < source.length; i++) {
    const char = source[i]!;
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++;
      row.push(cell.trim());
      if (row.some((value) => value)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some((value) => value)) rows.push(row);
  return rows;
}

/**
 * Reads dates such as 2026-10-05, 10/05/2026, 5 Oct 2026 or Oct 5, 2026.
 * Slashed dates are month first, as Canadian banks export them, unless
 * `dayFirst` is set.
 */
export function parseStatementDate(raw: string, dayFirst = false): string | null {
  const value = raw.trim().toLowerCase();
  let year: number;
  let month: number;
  let day: number;

  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(value);
  const slashed = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/.exec(value);
  const named =
    /^(\d{1,2})[\s-]([a-z]{3})[a-z]*\.?[\s-],?\s*(\d{4})$/.exec(value) ??
    /^([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(value);

  if (iso) {
    [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (slashed) {
    const [first, second] = [Number(slashed[1]), Number(slashed[2])];
    [month, day] = dayFirst ? [second, first] : [first, second];
    year = Number(slashed[3]);
    if (year < 100) year += 2000;
  } else if (named) {
    const dayFirstText = /^\d/.test(named[1]!);
    const monthName = dayFirstText ? named[2]! : named[1]!;
    month = MONTHS.indexOf(monthName) + 1;
    day = Number(dayFirstText ? named[1] : named[2]);
    year = Number(named[3]);
  } else {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (month < 1 || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

/** Reads amounts such as 12.40, $1,240.00, -12.40 or (12.40). Null when blank or unreadable. */
export function parseStatementAmount(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;
  const negative = /^\(.*\)$/.test(value) || /^-|-$/.test(value.replace(/[$\s]/g, ''));
  const digits = value.replace(/[^0-9.]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(digits) && !/^\.\d{1,2}$/.test(digits)) return null;
  const cents = Math.round(Number(digits) * 100);
  return negative ? -cents : cents;
}

interface Columns {
  readonly date: number;
  readonly description: number;
  readonly amount?: number;
  readonly debit?: number;
  readonly credit?: number;
}

function columnsFromHeader(header: readonly string[]): Columns | null {
  const names = header.map((cell) => cell.trim().toLowerCase());
  const find = (options: readonly string[]) => names.findIndex((name) => options.includes(name));
  const date = find(HEADER_NAMES.date);
  const description = find(HEADER_NAMES.description);
  if (date === -1 || description === -1) return null;
  const amount = find(HEADER_NAMES.amount);
  const debit = find(HEADER_NAMES.debit);
  const credit = find(HEADER_NAMES.credit);
  if (debit !== -1 || credit !== -1) {
    return {
      date,
      description,
      ...(debit !== -1 ? { debit } : {}),
      ...(credit !== -1 ? { credit } : {}),
    };
  }
  return amount === -1 ? null : { date, description, amount };
}

/**
 * Files without a header, like TD's "date, description, debit, credit,
 * balance": the date is the first column of dates, the description the first
 * column of text, then a debit and credit pair or a single amount.
 */
function columnsFromData(rows: readonly (readonly string[])[], dayFirst: boolean): Columns | null {
  const sample = rows.slice(0, 20);
  const width = Math.max(...sample.map((row) => row.length));
  const share = (test: (cell: string) => boolean, column: number) =>
    sample.filter((row) => test(row[column] ?? '')).length / sample.length;
  const isAmountOrBlank = (cell: string) => !cell.trim() || parseStatementAmount(cell) !== null;

  let date = -1;
  for (let c = 0; c < width && date === -1; c++) {
    if (share((cell) => parseStatementDate(cell, dayFirst) !== null, c) >= 0.8) date = c;
  }
  if (date === -1) return null;

  let description = -1;
  for (let c = 0; c < width && description === -1; c++) {
    if (
      c !== date &&
      share((cell) => /[a-z]/i.test(cell) && parseStatementDate(cell) === null, c) >= 0.8
    ) {
      description = c;
    }
  }
  if (description === -1) return null;

  const numeric: number[] = [];
  for (let c = description + 1; c < width; c++) {
    if (share(isAmountOrBlank, c) === 1 && share((cell) => cell.trim() !== '', c) > 0)
      numeric.push(c);
  }
  if (numeric.length === 0) return null;
  // Debit and credit columns take turns being blank. A first column that is
  // always filled is a single signed amount, and anything after it is the
  // running balance, which is not a transaction.
  const alwaysFilled = share((cell) => cell.trim() !== '', numeric[0]!) === 1;
  if (numeric.length === 1 || alwaysFilled) return { date, description, amount: numeric[0]! };
  return { date, description, debit: numeric[0]!, credit: numeric[1]! };
}

/** Slashed dates are day first when any of them has a first number over 12. */
function looksDayFirst(rows: readonly (readonly string[])[]): boolean {
  return rows.some((row) =>
    row.some((cell) => {
      const match = /^(\d{1,2})[/-](\d{1,2})[/-]\d{2,4}$/.exec(cell.trim());
      return match !== null && Number(match[1]) > 12;
    }),
  );
}

/** Reads a CSV statement into charges and credits. */
export function parseStatement(text: string): ParsedStatement {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], skippedLines: [], singleAmountColumn: false };

  const dayFirst = looksDayFirst(table);
  const fromHeader = columnsFromHeader(table[0]!);
  const data = fromHeader ? table.slice(1) : table;
  const columns = fromHeader ?? columnsFromData(data, dayFirst);
  if (!columns)
    return { rows: [], skippedLines: data.map((_, i) => i + 1), singleAmountColumn: false };

  const rows: StatementRow[] = [];
  const skippedLines: number[] = [];
  data.forEach((cells, index) => {
    const line = index + 1;
    const date = parseStatementDate(cells[columns.date] ?? '', dayFirst);
    const description = (cells[columns.description] ?? '').replace(/\s+/g, ' ').trim();
    let signed: number | null = null;
    if (columns.amount !== undefined) {
      signed = parseStatementAmount(cells[columns.amount] ?? '');
    } else {
      const debit =
        columns.debit !== undefined ? parseStatementAmount(cells[columns.debit] ?? '') : null;
      const credit =
        columns.credit !== undefined ? parseStatementAmount(cells[columns.credit] ?? '') : null;
      if (debit) signed = Math.abs(debit);
      else if (credit) signed = -Math.abs(credit);
    }
    if (!date || !description || !signed) {
      skippedLines.push(line);
      return;
    }
    rows.push({
      line,
      date,
      description,
      amountCents: Math.abs(signed),
      direction: signed > 0 ? 'charge' : 'credit',
    });
  });

  const singleAmountColumn = columns.amount !== undefined;
  // Most lines on a card statement are charges, so when most signed amounts
  // are negative, negative means a charge in this file.
  const mostlyNegative = rows.filter((row) => row.direction === 'credit').length > rows.length / 2;
  return {
    rows: singleAmountColumn && mostlyNegative ? swapDirections(rows) : rows,
    skippedLines,
    singleAmountColumn,
  };
}

/** Swaps charges and credits, for files that show charges as negative amounts. */
export function swapDirections(rows: readonly StatementRow[]): StatementRow[] {
  return rows.map((row) => ({
    ...row,
    direction: row.direction === 'charge' ? 'credit' : 'charge',
  }));
}

/** Credit card payments are usually already recorded as money leaving the bank account. */
export function isCardPayment(row: StatementRow): boolean {
  return (
    row.direction === 'credit' && /\b(payment|paiement|thank you|merci)\b/i.test(row.description)
  );
}

/**
 * Pairs each statement row with a transaction already in the wallet: same
 * amount and direction, a date within a few days, and either the same date or
 * a similar name. Each existing transaction pairs with one row at most, so two
 * real $5 coffees on one day are not both hidden by one saved coffee.
 */
export function findDuplicates(
  rows: readonly StatementRow[],
  existing: readonly Transaction[],
  walletId: string,
): ReadonlySet<number> {
  const pool = existing.filter((tx) =>
    tx.type === 'expense'
      ? tx.fromWalletId === walletId
      : tx.type === 'income' && tx.toWalletId === walletId,
  );
  const used = new Set<string>();
  const duplicates = new Set<number>();
  for (const row of rows) {
    const type = row.direction === 'charge' ? 'expense' : 'income';
    const earliest = addDays(row.date, -DUPLICATE_DAY_WINDOW);
    const latest = addDays(row.date, DUPLICATE_DAY_WINDOW);
    const match = pool.find(
      (tx) =>
        !used.has(tx.id) &&
        tx.type === type &&
        tx.amountCents === row.amountCents &&
        tx.date >= earliest &&
        tx.date <= latest &&
        (tx.date === row.date || sameMerchant(tx.merchant, row.description)),
    );
    if (match) {
      used.add(match.id);
      duplicates.add(row.line);
    }
  }
  return duplicates;
}

/**
 * Every monetary value in Budgee is stored as an integer number of cents so
 * that budget math never suffers from floating point drift. Formatting to a
 * display string is the only place where a decimal value is produced.
 */
export type Cents = number;

/**
 * Budgets are Canadian dollars. Imported USD rows are kept out of those totals.
 * There is no conversion between the two.
 */
export type CurrencyCode = 'CAD' | 'USD';

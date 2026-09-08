/**
 * Every monetary value in Budgee is stored as an integer number of cents so
 * that budget math never suffers from floating point drift. Formatting to a
 * display string is the only place where a decimal value is produced.
 */
export type Cents = number;

/** The MVP is Canadian dollars only, but the preference is modelled as a type. */
export type CurrencyCode = 'CAD';

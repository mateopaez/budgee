import type { Cents } from './money.model';

export type RecurringCadence = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

/**
 * A recurring payment is *detected* from transaction history rather than
 * declared by the user. It is presented as recurring spending to review, never
 * as a recommendation to cancel.
 */
export interface RecurringPayment {
  readonly id: string;
  readonly merchant: string;
  readonly categoryId: string;
  /** Typical amount of one occurrence. */
  readonly amountCents: Cents;
  readonly cadence: RecurringCadence;
  /** Normalised monthly cost, used for the "yearly bills" total. */
  readonly monthlyCents: Cents;
  readonly lastChargedOn: string;
  readonly nextDueOn: string;
  readonly occurrences: number;
  readonly transactionIds: readonly string[];
}

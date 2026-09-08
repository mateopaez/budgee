import type { Cents } from './money.model';
import type { IconName } from '../../shared/ui/icon-set';

/**
 * A wallet is any place money can sit: a spending account, a savings pot, a
 * credit card or cash. Wallets are provider agnostic on purpose so a future
 * aggregation provider can map onto them without changing the domain.
 */
export type WalletKind = 'spending' | 'savings' | 'debt' | 'cash';

export interface Wallet {
  readonly id: string;
  readonly name: string;
  readonly kind: WalletKind;
  readonly openingBalanceCents: Cents;
  readonly color: string;
  readonly icon: IconName;
  readonly archived?: boolean;
}

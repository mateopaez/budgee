import type { IconName } from '../../shared/ui/icon-set';

/** Categories are grouped into "head categories" such as Food or Household. */
export interface CategoryGroup {
  readonly id: string;
  readonly name: string;
  /** CSS colour token value used for charts, rings and chips. */
  readonly color: string;
  readonly order: number;
}

export type CategoryKind = 'expense' | 'income' | 'transfer';

export interface Category {
  readonly id: string;
  readonly name: string;
  readonly groupId: string;
  readonly kind: CategoryKind;
  readonly icon: IconName;
  /** Colour of the category mark. Falls back to the group colour when absent. */
  readonly color: string;
  /** System categories cannot be deleted, only renamed. */
  readonly system?: boolean;
  readonly archived?: boolean;
}

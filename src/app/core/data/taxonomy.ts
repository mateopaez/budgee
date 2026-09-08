import type { Category, CategoryGroup } from '../models/category.model';

/**
 * Default category taxonomy. Every seeded and manually created workspace starts
 * from this list; the user can rename, add or archive entries afterwards.
 */

export const GROUP_IDS = {
  household: 'grp_household',
  food: 'grp_food',
  transport: 'grp_transport',
  lifestyle: 'grp_lifestyle',
  entertainment: 'grp_entertainment',
  misc: 'grp_misc',
  income: 'grp_income',
} as const;

export const DEFAULT_GROUPS: readonly CategoryGroup[] = [
  { id: GROUP_IDS.household, name: 'Household', color: 'var(--color-cat-housing)', order: 1 },
  { id: GROUP_IDS.food, name: 'Food', color: 'var(--color-cat-food)', order: 2 },
  { id: GROUP_IDS.transport, name: 'Transportation', color: 'var(--color-cat-transport)', order: 3 },
  { id: GROUP_IDS.lifestyle, name: 'Lifestyle', color: 'var(--color-cat-lifestyle)', order: 4 },
  {
    id: GROUP_IDS.entertainment,
    name: 'Entertainment',
    color: 'var(--color-cat-entertainment)',
    order: 5,
  },
  { id: GROUP_IDS.misc, name: 'Miscellaneous', color: 'var(--color-cat-misc)', order: 6 },
  { id: GROUP_IDS.income, name: 'Income', color: 'var(--color-cat-income)', order: 7 },
];

export const CATEGORY_IDS = {
  rent: 'cat_rent',
  internet: 'cat_internet',
  insurance: 'cat_insurance',
  utilities: 'cat_utilities',
  supplies: 'cat_supplies',
  groceries: 'cat_groceries',
  restaurant: 'cat_restaurant',
  coffee: 'cat_coffee',
  gas: 'cat_gas',
  parking: 'cat_parking',
  transit: 'cat_transit',
  healthcare: 'cat_healthcare',
  gym: 'cat_gym',
  clothes: 'cat_clothes',
  gifts: 'cat_gifts',
  subscription: 'cat_subscription',
  cinema: 'cat_cinema',
  electronics: 'cat_electronics',
  misc: 'cat_misc',
  bankCost: 'cat_bank_cost',
  studentLoan: 'cat_student_loan',
  unknown: 'cat_unknown',
  salary: 'cat_salary',
  interest: 'cat_interest',
  refund: 'cat_refund',
  savings: 'cat_savings',
  transfer: 'cat_transfer',
} as const;

export const DEFAULT_CATEGORIES: readonly Category[] = [
  // Household
  { id: CATEGORY_IDS.rent, name: 'Rent', groupId: GROUP_IDS.household, kind: 'expense', icon: 'home', color: 'var(--color-cat-housing)' },
  { id: CATEGORY_IDS.internet, name: 'Internet', groupId: GROUP_IDS.household, kind: 'expense', icon: 'wifi', color: 'var(--color-cat-housing)' },
  { id: CATEGORY_IDS.insurance, name: 'Insurance', groupId: GROUP_IDS.household, kind: 'expense', icon: 'lock', color: 'var(--color-cat-housing)' },
  { id: CATEGORY_IDS.utilities, name: 'Utilities', groupId: GROUP_IDS.household, kind: 'expense', icon: 'zap', color: 'var(--color-cat-housing)' },
  { id: CATEGORY_IDS.supplies, name: 'Home supplies', groupId: GROUP_IDS.household, kind: 'expense', icon: 'box', color: 'var(--color-cat-housing)' },
  // Food
  { id: CATEGORY_IDS.groceries, name: 'Groceries', groupId: GROUP_IDS.food, kind: 'expense', icon: 'cart', color: 'var(--color-cat-food)' },
  { id: CATEGORY_IDS.restaurant, name: 'Restaurant', groupId: GROUP_IDS.food, kind: 'expense', icon: 'utensils', color: 'var(--color-cat-food)' },
  { id: CATEGORY_IDS.coffee, name: 'Coffee', groupId: GROUP_IDS.food, kind: 'expense', icon: 'cup', color: 'var(--color-cat-food)' },
  // Transport
  { id: CATEGORY_IDS.gas, name: 'Gas', groupId: GROUP_IDS.transport, kind: 'expense', icon: 'fuel', color: 'var(--color-cat-transport)' },
  { id: CATEGORY_IDS.parking, name: 'Parking', groupId: GROUP_IDS.transport, kind: 'expense', icon: 'parking', color: 'var(--color-cat-transport)' },
  { id: CATEGORY_IDS.transit, name: 'Transit', groupId: GROUP_IDS.transport, kind: 'expense', icon: 'car', color: 'var(--color-cat-transport)' },
  // Lifestyle
  { id: CATEGORY_IDS.healthcare, name: 'Healthcare', groupId: GROUP_IDS.lifestyle, kind: 'expense', icon: 'pill', color: 'var(--color-cat-health)' },
  { id: CATEGORY_IDS.gym, name: 'Gym', groupId: GROUP_IDS.lifestyle, kind: 'expense', icon: 'dumbbell', color: 'var(--color-cat-lifestyle)' },
  { id: CATEGORY_IDS.clothes, name: 'Clothes', groupId: GROUP_IDS.lifestyle, kind: 'expense', icon: 'shirt', color: 'var(--color-cat-lifestyle)' },
  { id: CATEGORY_IDS.gifts, name: 'Gifts', groupId: GROUP_IDS.lifestyle, kind: 'expense', icon: 'gift', color: 'var(--color-cat-lifestyle)' },
  // Entertainment
  { id: CATEGORY_IDS.subscription, name: 'Subscription', groupId: GROUP_IDS.entertainment, kind: 'expense', icon: 'play', color: 'var(--color-cat-entertainment)' },
  { id: CATEGORY_IDS.cinema, name: 'Cinema', groupId: GROUP_IDS.entertainment, kind: 'expense', icon: 'film', color: 'var(--color-cat-entertainment)' },
  { id: CATEGORY_IDS.electronics, name: 'Electronics', groupId: GROUP_IDS.entertainment, kind: 'expense', icon: 'phone', color: 'var(--color-cat-entertainment)' },
  // Miscellaneous
  { id: CATEGORY_IDS.misc, name: 'Miscellaneous', groupId: GROUP_IDS.misc, kind: 'expense', icon: 'box', color: 'var(--color-cat-misc)', system: true },
  { id: CATEGORY_IDS.bankCost, name: 'Bank cost', groupId: GROUP_IDS.misc, kind: 'expense', icon: 'bank', color: 'var(--color-cat-misc)' },
  { id: CATEGORY_IDS.studentLoan, name: 'Student loan', groupId: GROUP_IDS.misc, kind: 'expense', icon: 'graduation', color: 'var(--color-cat-misc)' },
  { id: CATEGORY_IDS.unknown, name: 'Unknown', groupId: GROUP_IDS.misc, kind: 'expense', icon: 'help', color: 'var(--color-cat-misc)', system: true },
  // Income and transfers
  { id: CATEGORY_IDS.salary, name: 'Salary', groupId: GROUP_IDS.income, kind: 'income', icon: 'banknote', color: 'var(--color-cat-income)' },
  { id: CATEGORY_IDS.interest, name: 'Interest', groupId: GROUP_IDS.income, kind: 'income', icon: 'trend', color: 'var(--color-cat-income)' },
  { id: CATEGORY_IDS.refund, name: 'Refund', groupId: GROUP_IDS.income, kind: 'income', icon: 'refresh', color: 'var(--color-cat-income)', system: true },
  { id: CATEGORY_IDS.savings, name: 'Savings', groupId: GROUP_IDS.income, kind: 'transfer', icon: 'piggy', color: 'var(--color-cat-savings)' },
  { id: CATEGORY_IDS.transfer, name: 'Transfer', groupId: GROUP_IDS.misc, kind: 'transfer', icon: 'swap', color: 'var(--color-cat-misc)', system: true },
];

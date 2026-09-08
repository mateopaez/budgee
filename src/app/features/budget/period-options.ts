import type { BudgetPeriodType } from '../../core/models';
import type { PickerOption } from '../../shared/ui/option-picker-sheet';

export const PERIOD_TYPE_OPTIONS: PickerOption[] = [
  { id: 'monthly', label: 'Monthly budget' },
  { id: 'weekly', label: 'Weekly budget' },
  { id: 'biweekly', label: 'Biweekly budget' },
  { id: 'semiMonthly', label: 'Semi-monthly budget' },
  { id: 'yearly', label: 'Yearly budget' },
];

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function ordinal(day: number): string {
  if (day === 1) return 'First day of the month';
  const suffix =
    day % 10 === 1 && day !== 11
      ? 'st'
      : day % 10 === 2 && day !== 12
        ? 'nd'
        : day % 10 === 3 && day !== 13
          ? 'rd'
          : 'th';
  return `${day}${suffix}`;
}

export function monthlyStartOptions(): PickerOption[] {
  return Array.from({ length: 28 }, (_, i) => ({ id: `${i + 1}`, label: ordinal(i + 1) }));
}

export function weekdayOptions(prefix = 'Every '): PickerOption[] {
  return WEEKDAYS.map((name, index) => ({ id: `${index}`, label: `${prefix}${name}` }));
}

export function semiMonthlyOptions(): PickerOption[] {
  return [
    { id: '1,16', label: '1st and 16th' },
    { id: '1,15', label: '1st and 15th' },
    { id: '5,20', label: '5th and 20th' },
    { id: '10,25', label: '10th and 25th' },
  ];
}

export function monthOptions(): PickerOption[] {
  return MONTHS.map((name, index) => ({ id: `${index + 1}`, label: name }));
}

/** Human label for whichever start setting the chosen period type uses. */
export function startLabelFor(
  periodType: BudgetPeriodType,
  values: {
    monthlyStartDay: number;
    weekStartsOn: number;
    semiMonthlyDays: readonly [number, number];
    yearlyStartMonth: number;
  },
): { title: string; value: string } | null {
  switch (periodType) {
    case 'monthly':
      return { title: 'Monthly start day', value: ordinal(values.monthlyStartDay) };
    case 'weekly':
      return { title: 'Weekly start day', value: `Every ${WEEKDAYS[values.weekStartsOn]}` };
    case 'biweekly':
      return {
        title: 'Biweekly start date',
        value: `Every other ${WEEKDAYS[values.weekStartsOn]}`,
      };
    case 'semiMonthly':
      return {
        title: 'Semi-monthly days',
        value: `${ordinal(values.semiMonthlyDays[0])} and ${ordinal(values.semiMonthlyDays[1])}`,
      };
    case 'yearly':
      return { title: 'Yearly start month', value: MONTHS[values.yearlyStartMonth - 1] };
  }
}

export function periodTypeLabel(periodType: BudgetPeriodType): string {
  return PERIOD_TYPE_OPTIONS.find((o) => o.id === periodType)?.label ?? 'Monthly budget';
}

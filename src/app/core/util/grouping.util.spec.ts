import { makeTransaction } from '../testing/factories';
import { buildMonthCalendar, cumulativeSpend, groupByDay, totalsByCategory } from './grouping.util';

describe('grouping utilities', () => {
  const transactions = [
    makeTransaction({ id: 'a', date: '2026-09-08', amountCents: 4_000 }),
    makeTransaction({ id: 'b', date: '2026-09-08', amountCents: 1_500, type: 'income' }),
    makeTransaction({ id: 'c', date: '2026-09-05', amountCents: 2_000 }),
  ];

  it('groups by day newest first and nets income against expenses', () => {
    const days = groupByDay(transactions);
    expect(days.map((d) => d.date)).toEqual(['2026-09-08', '2026-09-05']);
    expect(days[0].transactions).toHaveLength(2);
    expect(days[0].netCents).toBe(1_500 - 4_000);
    expect(days[1].netCents).toBe(-2_000);
  });

  it('builds a month grid with leading blanks and per day totals', () => {
    const cells = buildMonthCalendar('2026-09-01', transactions, '2026-09-08');
    // 2026-09-01 is a Tuesday, so two blank cells come first.
    expect(cells.slice(0, 2).every((c) => c.date === null)).toBe(true);
    expect(cells).toHaveLength(2 + 30);

    const eighth = cells.find((c) => c.date === '2026-09-08');
    expect(eighth?.spentCents).toBe(4_000);
    expect(eighth?.incomeCents).toBe(1_500);

    const ninth = cells.find((c) => c.date === '2026-09-09');
    expect(ninth?.spentCents).toBe(0);
    expect(ninth?.inFuture).toBe(true);
  });

  it('keeps excluded transactions out of the calendar', () => {
    const cells = buildMonthCalendar(
      '2026-09-01',
      [makeTransaction({ date: '2026-09-03', amountCents: 9_900, excludedFromBudget: true })],
      '2026-09-08',
    );
    expect(cells.find((c) => c.date === '2026-09-03')?.spentCents).toBe(0);
  });

  it('accumulates spend across the range', () => {
    const points = cumulativeSpend('2026-09-01', '2026-09-09', transactions);
    expect(points).toHaveLength(8);
    expect(points[3].cumulativeCents).toBe(0);
    expect(points[4].cumulativeCents).toBe(2_000);
    expect(points[7].cumulativeCents).toBe(6_000);
  });

  it('ranks categories by total', () => {
    const totals = totalsByCategory(
      [
        makeTransaction({ categoryId: 'cat_a', amountCents: 1_000 }),
        makeTransaction({ categoryId: 'cat_b', amountCents: 5_000 }),
        makeTransaction({ categoryId: 'cat_a', amountCents: 3_000 }),
      ],
      'expense',
    );
    expect(totals).toEqual([
      { categoryId: 'cat_b', totalCents: 5_000 },
      { categoryId: 'cat_a', totalCents: 4_000 },
    ]);
  });
});

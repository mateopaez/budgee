import {
  addDays,
  addMonths,
  diffDays,
  isWithin,
  monthLabel,
  relativeDayLabel,
  startOfMonth,
  startOfWeek,
} from './date.util';

describe('date utilities', () => {
  it('adds days across a month boundary', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('clamps the day when adding months', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-09-15', 3)).toBe('2026-12-15');
  });

  it('counts whole days between dates', () => {
    expect(diffDays('2026-09-01', '2026-09-08')).toBe(7);
    expect(diffDays('2026-09-08', '2026-09-01')).toBe(-7);
  });

  it('treats the range as half open', () => {
    expect(isWithin('2026-09-01', '2026-09-01', '2026-10-01')).toBe(true);
    expect(isWithin('2026-10-01', '2026-09-01', '2026-10-01')).toBe(false);
  });

  it('finds the start of the month and week', () => {
    expect(startOfMonth('2026-09-17')).toBe('2026-09-01');
    // 2026-09-17 is a Thursday, so the Sunday before it is the 13th.
    expect(startOfWeek('2026-09-17', 0)).toBe('2026-09-13');
    expect(startOfWeek('2026-09-17', 1)).toBe('2026-09-14');
  });

  it('labels months and relative days', () => {
    expect(monthLabel('2026-09-08')).toBe('September 2026');
    expect(relativeDayLabel('2026-09-08', '2026-09-08')).toBe('Today');
    expect(relativeDayLabel('2026-09-07', '2026-09-08')).toBe('Yesterday');
    expect(relativeDayLabel('2026-09-02', '2026-09-08')).toBe('Wed, Sep 2');
  });
});

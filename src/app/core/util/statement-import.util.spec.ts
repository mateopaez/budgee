import { makeTransaction } from '../testing/factories';
import {
  findDuplicates,
  isCardPayment,
  parseCsv,
  parseStatement,
  parseStatementAmount,
  parseStatementDate,
} from './statement-import.util';

describe('statement import', () => {
  it('splits CSV cells, keeping quoted commas and quotes', () => {
    expect(parseCsv('a,"b, c","say ""hi"""\r\n\r\n1,2,3')).toEqual([
      ['a', 'b, c', 'say "hi"'],
      ['1', '2', '3'],
    ]);
  });

  it('reads the date formats banks export', () => {
    expect(parseStatementDate('2026-10-05')).toBe('2026-10-05');
    expect(parseStatementDate('10/05/2026')).toBe('2026-10-05');
    expect(parseStatementDate('10/05/2026', true)).toBe('2026-05-10');
    expect(parseStatementDate('5 Oct 2026')).toBe('2026-10-05');
    expect(parseStatementDate('Oct 5, 2026')).toBe('2026-10-05');
    expect(parseStatementDate('02/30/2026')).toBeNull();
    expect(parseStatementDate('NO FRILLS')).toBeNull();
  });

  it('reads amounts with symbols, commas and either negative style', () => {
    expect(parseStatementAmount('$1,240.00')).toBe(124_000);
    expect(parseStatementAmount('-12.40')).toBe(-1_240);
    expect(parseStatementAmount('(12.40)')).toBe(-1_240);
    expect(parseStatementAmount('')).toBeNull();
    expect(parseStatementAmount('abc')).toBeNull();
  });

  it('reads a headerless TD file and ignores the balance column', () => {
    const csv = [
      '10/02/2026,NO FRILLS #3512 TORONTO ON,45.20,,1045.20',
      '10/04/2026,"SPOTIFY, P1234",11.99,,1057.19',
      '10/09/2026,PAYMENT - THANK YOU,,500.00,557.19',
    ].join('\n');
    const { rows, skippedLines } = parseStatement(csv);
    expect(skippedLines).toEqual([]);
    expect(rows.map((row) => [row.date, row.description, row.amountCents, row.direction])).toEqual([
      ['2026-10-02', 'NO FRILLS #3512 TORONTO ON', 4_520, 'charge'],
      ['2026-10-04', 'SPOTIFY, P1234', 1_199, 'charge'],
      ['2026-10-09', 'PAYMENT - THANK YOU', 50_000, 'credit'],
    ]);
    expect(isCardPayment(rows[2]!)).toBe(true);
  });

  it('reads a file with a header and one signed amount column', () => {
    const csv = [
      'Transaction Date,Description,Amount',
      '2026-10-02,Metro,-30.00',
      '2026-10-03,Shell,-50.00',
      '2026-10-05,Refund Metro,12.00',
      'not a date,Something,1.00',
    ].join('\n');
    const parsed = parseStatement(csv);
    expect(parsed.singleAmountColumn).toBe(true);
    expect(parsed.skippedLines).toEqual([4]);
    expect(parsed.rows.map((row) => row.direction)).toEqual(['charge', 'charge', 'credit']);
  });

  it('pairs each saved transaction with one statement row at most', () => {
    const { rows } = parseStatement(
      [
        '10/02/2026,Tim Hortons,5.00,,',
        '10/02/2026,Tim Hortons,5.00,,',
        '10/03/2026,Metro,30.00,,',
      ].join('\n'),
    );
    const existing = [
      makeTransaction({
        id: 'a',
        date: '2026-10-02',
        merchant: 'TIM HORTONS #22',
        amountCents: 500,
        fromWalletId: 'mc',
      }),
      makeTransaction({
        id: 'b',
        date: '2026-10-04',
        merchant: 'Metro Toronto',
        amountCents: 3_000,
        fromWalletId: 'mc',
      }),
      makeTransaction({
        id: 'c',
        date: '2026-10-03',
        merchant: 'Metro',
        amountCents: 3_000,
        fromWalletId: 'visa',
      }),
    ];
    expect([...findDuplicates(rows, existing, 'mc')]).toEqual([1, 3]);
  });
});

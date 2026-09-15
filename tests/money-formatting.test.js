import { describe, expect, it } from 'vitest';
import { convertMoneyToMinorUnits, formatMoney } from '@theme/money-formatting';

describe('convertMoneyToMinorUnits', () => {
  it('parses a plain US-formatted amount into cents', () => {
    expect(convertMoneyToMinorUnits('10.00', 'USD')).toBe(1000);
  });

  it('parses a US-formatted amount with thousands separators', () => {
    expect(convertMoneyToMinorUnits('1,000.50', 'USD')).toBe(100050);
  });

  it('parses a European-formatted amount (. thousands, , decimal)', () => {
    expect(convertMoneyToMinorUnits('1.000,50', 'EUR')).toBe(100050);
  });

  it('parses a multi-group thousands separated amount', () => {
    expect(convertMoneyToMinorUnits('2,000,000.50', 'USD')).toBe(200000050);
  });

  it('treats a value with no decimal-length-matching group as a whole number', () => {
    expect(convertMoneyToMinorUnits('2,000,000', 'USD')).toBe(200000000);
  });

  it('supports zero-decimal currencies (JPY)', () => {
    expect(convertMoneyToMinorUnits('1,500', 'JPY')).toBe(1500);
  });

  it('supports currencies with 3 decimal places (KWD)', () => {
    expect(convertMoneyToMinorUnits('9,500', 'KWD')).toBe(9500);
  });

  it('is case-insensitive for the currency code', () => {
    expect(convertMoneyToMinorUnits('10.00', 'usd')).toBe(1000);
  });

  it('pads a short fractional part to the currency precision', () => {
    // "10.5" USD -> 10 dollars and 5 tenths -> 1050 cents
    expect(convertMoneyToMinorUnits('10.5', 'USD')).toBe(1050);
  });

  it('returns null for an empty string', () => {
    expect(convertMoneyToMinorUnits('', 'USD')).toBeNull();
  });

  it('returns null for a whitespace-only string', () => {
    expect(convertMoneyToMinorUnits('   ', 'USD')).toBeNull();
  });

  it('returns null when there are no digits at all', () => {
    expect(convertMoneyToMinorUnits('$-.', 'USD')).toBeNull();
  });

  it('returns null for a non-numeric string', () => {
    expect(convertMoneyToMinorUnits('abc', 'USD')).toBeNull();
  });

  it('ignores currency symbols mixed into the value', () => {
    expect(convertMoneyToMinorUnits('$10.00', 'USD')).toBe(1000);
  });
});

describe('formatMoney', () => {
  it.each([
    ['formats a plain amount using the default template', 1000, '{{amount}}', 'USD', '10.00'],
    ['formats a currency symbol template', 150000, '${{amount}}', 'USD', '$1,500.00'],
    ['formats amount_no_decimals, rounding to the nearest whole unit', 150099, '{{amount_no_decimals}}', 'USD', '1,501'],
    ['formats amount_with_comma_separator', 150050, '{{amount_with_comma_separator}}', 'USD', '1.500,50'],
    [
      'formats amount_no_decimals_with_comma_separator (thousands=".", no decimals)',
      150050,
      '{{amount_no_decimals_with_comma_separator}}',
      'USD',
      '1.501',
    ],
    [
      'formats amount_no_decimals_with_space_separator',
      150050,
      '{{amount_no_decimals_with_space_separator}}',
      'USD',
      '1 501',
    ],
    ['formats amount_with_space_separator', 150050, '{{amount_with_space_separator}}', 'USD', '1 500,50'],
    [
      'formats amount_with_period_and_space_separator',
      150050,
      '{{amount_with_period_and_space_separator}}',
      'USD',
      '1 500.50',
    ],
    ['formats amount_with_apostrophe_separator', 150050, '{{amount_with_apostrophe_separator}}', 'USD', "1'500.50"],
    ['substitutes the currency placeholder', 1000, '{{amount}} {{currency}}', 'USD', '10.00 USD'],
    ['handles zero-decimal currencies (JPY) with the default template', 1500, '{{amount}}', 'JPY', '1,500'],
    ['handles zero amounts', 0, '{{amount}}', 'USD', '0.00'],
    [
      'falls back to the default amount formatting for an unrecognized placeholder',
      1000,
      '{{unknown_placeholder}}',
      'USD',
      '10.00',
    ],
    ['is case-insensitive for the currency code', 1000, '{{amount}}', 'usd', '10.00'],
  ])('%s', (_name, amount, template, currency, expected) => {
    expect(formatMoney(amount, template, currency)).toBe(expected);
  });
});

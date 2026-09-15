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
  it('formats a plain amount using the default template', () => {
    expect(formatMoney(1000, '{{amount}}', 'USD')).toBe('10.00');
  });

  it('formats a currency symbol template', () => {
    expect(formatMoney(150000, '${{amount}}', 'USD')).toBe('$1,500.00');
  });

  it('formats amount_no_decimals, rounding to the nearest whole unit', () => {
    expect(formatMoney(150099, '{{amount_no_decimals}}', 'USD')).toBe('1,501');
  });

  it('formats amount_with_comma_separator', () => {
    expect(formatMoney(150050, '{{amount_with_comma_separator}}', 'USD')).toBe('1.500,50');
  });

  it('formats amount_no_decimals_with_comma_separator (thousands=".", no decimals)', () => {
    expect(formatMoney(150050, '{{amount_no_decimals_with_comma_separator}}', 'USD')).toBe('1.501');
  });

  it('formats amount_no_decimals_with_space_separator', () => {
    expect(formatMoney(150050, '{{amount_no_decimals_with_space_separator}}', 'USD')).toBe('1 501');
  });

  it('formats amount_with_space_separator', () => {
    expect(formatMoney(150050, '{{amount_with_space_separator}}', 'USD')).toBe('1 500,50');
  });

  it('formats amount_with_period_and_space_separator', () => {
    expect(formatMoney(150050, '{{amount_with_period_and_space_separator}}', 'USD')).toBe('1 500.50');
  });

  it('formats amount_with_apostrophe_separator', () => {
    expect(formatMoney(150050, '{{amount_with_apostrophe_separator}}', 'USD')).toBe("1'500.50");
  });

  it('substitutes the currency placeholder', () => {
    expect(formatMoney(1000, '{{amount}} {{currency}}', 'USD')).toBe('10.00 USD');
  });

  it('handles zero-decimal currencies (JPY) with the default template', () => {
    expect(formatMoney(1500, '{{amount}}', 'JPY')).toBe('1,500');
  });

  it('handles zero amounts', () => {
    expect(formatMoney(0, '{{amount}}', 'USD')).toBe('0.00');
  });

  it('falls back to the default amount formatting for an unrecognized placeholder', () => {
    expect(formatMoney(1000, '{{unknown_placeholder}}', 'USD')).toBe('10.00');
  });

  it('is case-insensitive for the currency code', () => {
    expect(formatMoney(1000, '{{amount}}', 'usd')).toBe('10.00');
  });
});

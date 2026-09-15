import { describe, expect, it, vi } from 'vitest';
import { cartPerformance } from '@theme/performance';

describe('cartPerformance', () => {
  it('creates a starting performance mark prefixed with the metric name', () => {
    const mark = cartPerformance.createStartingMarker('my-benchmark');
    expect(mark.name).toBe('cart-performance:my-benchmark:start');
  });

  it('measures from an event using the event timeStamp as the start time', () => {
    const measureSpy = vi.spyOn(performance, 'measure');
    const event = new Event('click');

    cartPerformance.measureFromEvent('note-update', event);

    expect(measureSpy).toHaveBeenCalledWith(
      'cart-performance:note-update',
      'cart-performance:note-update:start',
      'cart-performance:note-update:end'
    );
  });

  it('measures from a previously created marker', () => {
    const marker = cartPerformance.createStartingMarker('from-marker');
    const measureSpy = vi.spyOn(performance, 'measure');

    cartPerformance.measureFromMarker(marker);

    expect(measureSpy).toHaveBeenCalledWith(
      'cart-performance:from-marker',
      'cart-performance:from-marker:start',
      'cart-performance:from-marker:end'
    );
  });

  it('wraps a callback with start/end marks and measures the duration', () => {
    const callback = vi.fn();
    const measureSpy = vi.spyOn(performance, 'measure');

    cartPerformance.measure('wrapped', callback);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(measureSpy).toHaveBeenCalledWith(
      'wrapped',
      'cart-performance:wrapped:start',
      'cart-performance:wrapped:end'
    );
  });
});

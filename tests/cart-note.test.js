import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@theme/cart-note';

function makeCartNote() {
  document.body.innerHTML = '<cart-note><textarea></textarea></cart-note>';
  return {
    el: document.querySelector('cart-note'),
    textarea: document.querySelector('textarea'),
  };
}

function inputEventFor(textarea, value) {
  textarea.value = value;
  const event = new Event('input');
  Object.defineProperty(event, 'target', { value: textarea });
  return event;
}

describe('cart-note', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.Theme = { routes: { cart_update_url: '/cart/update.js' } };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('registers the custom element', () => {
    expect(customElements.get('cart-note')).toBeDefined();
  });

  it('debounces rapid input and only sends the latest note value', async () => {
    const { textarea, el } = makeCartNote();

    el.updateCartNote(inputEventFor(textarea, 'first'));
    el.updateCartNote(inputEventFor(textarea, 'second'));
    el.updateCartNote(inputEventFor(textarea, 'final note'));

    await vi.advanceTimersByTimeAsync(200);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('/cart/update.js');
    expect(JSON.parse(options.body)).toEqual({ note: 'final note' });
  });

  it('sends a POST request with the JSON fetch config', async () => {
    const { textarea, el } = makeCartNote();

    el.updateCartNote(inputEventFor(textarea, 'hello'));
    await vi.advanceTimersByTimeAsync(200);

    const [, options] = globalThis.fetch.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('ignores events whose target is not a textarea', async () => {
    const { el } = makeCartNote();
    const event = new Event('input');
    Object.defineProperty(event, 'target', { value: document.createElement('div') });

    el.updateCartNote(event);
    await vi.advanceTimersByTimeAsync(200);

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('aborts a pending request when a newer edit comes in', async () => {
    const { textarea, el } = makeCartNote();
    const capturedSignals = [];
    globalThis.fetch = vi.fn((url, options) => {
      capturedSignals.push(options.signal);
      return new Promise(() => {}); // never resolves
    });

    el.updateCartNote(inputEventFor(textarea, 'first'));
    await vi.advanceTimersByTimeAsync(200);
    const firstSignal = capturedSignals[0];
    expect(firstSignal.aborted).toBe(false);

    el.updateCartNote(inputEventFor(textarea, 'second'));
    await vi.advanceTimersByTimeAsync(200);

    expect(firstSignal.aborted).toBe(true);
    expect(capturedSignals[1].aborted).toBe(false);
  });

  it('does not throw and still measures performance when the fetch fails', async () => {
    const { textarea, el } = makeCartNote();
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    el.updateCartNote(inputEventFor(textarea, 'hello'));
    await vi.advanceTimersByTimeAsync(200);
    await Promise.resolve();

    expect(errorSpy).toHaveBeenCalledWith('Failed to update cart note:', expect.any(Error));
  });

  it('does not log an AbortError as a failure', async () => {
    const { textarea, el } = makeCartNote();
    const abortError = new DOMException('aborted', 'AbortError');
    globalThis.fetch = vi.fn().mockRejectedValue(abortError);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    el.updateCartNote(inputEventFor(textarea, 'hello'));
    await vi.advanceTimersByTimeAsync(200);
    await Promise.resolve();

    expect(errorSpy).not.toHaveBeenCalled();
  });
});

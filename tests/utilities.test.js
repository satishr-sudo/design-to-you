import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clamp,
  closest,
  debounce,
  throttle,
  normalizeString,
  fetchConfig,
  isClickedOutside,
  isPointWithinElement,
  isMobileBreakpoint,
  isDesktopBreakpoint,
  isTouchDevice,
  isLowPowerDevice,
  supportsViewTransitions,
  parseIntOrDefault,
  getViewParameterValue,
  preventDefault,
  getVisibleElements,
  getIOSVersion,
  onDocumentReady,
  onDocumentLoaded,
  changeMetaThemeColor,
  resetShimmer,
  center,
  start,
  ResizeNotifier,
  oncePerEditorSession,
} from '@theme/utilities';

describe('clamp', () => {
  it('returns the value when within bounds', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps to the minimum', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('clamps to the maximum', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('handles min and max being equal', () => {
    expect(clamp(5, 3, 3)).toBe(3);
  });
});

describe('closest', () => {
  it('finds the closest value to the target', () => {
    expect(closest([1, 5, 10], 6)).toBe(5);
  });

  it('returns the exact match when present', () => {
    expect(closest([1, 5, 10], 10)).toBe(10);
  });

  it('handles a single-element array', () => {
    expect(closest([7], 100)).toBe(7);
  });

  it('picks the first closest value when there is a tie', () => {
    expect(closest([4, 6], 5)).toBe(4);
  });
});

describe('parseIntOrDefault', () => {
  it('parses a numeric string', () => {
    expect(parseIntOrDefault('42', 0)).toBe(42);
  });

  it('returns the default for null', () => {
    expect(parseIntOrDefault(null, 7)).toBe(7);
  });

  it('returns the default for undefined', () => {
    expect(parseIntOrDefault(undefined, 7)).toBe(7);
  });

  it('returns the default for an empty string', () => {
    expect(parseIntOrDefault('', 7)).toBe(7);
  });

  it('returns the default for a non-numeric string', () => {
    expect(parseIntOrDefault('abc', 7)).toBe(7);
  });

  it('preserves an explicit 0 value rather than treating it as falsy', () => {
    expect(parseIntOrDefault('0', 99)).toBe(0);
  });

  it('accepts a numeric input directly', () => {
    expect(parseIntOrDefault(15, 0)).toBe(15);
  });

  it('supports a null default value', () => {
    expect(parseIntOrDefault(undefined, null)).toBeNull();
  });
});

describe('normalizeString', () => {
  it('lower-cases the string', () => {
    expect(normalizeString('HELLO')).toBe('hello');
  });

  it('strips diacritics', () => {
    expect(normalizeString('café')).toBe('cafe');
  });

  it('handles an empty string', () => {
    expect(normalizeString('')).toBe('');
  });
});

describe('debounce', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('delays invocation until after the wait period', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(199);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('only invokes once for rapid successive calls', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced();
    debounced();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('passes through the latest arguments', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 50);

    debounced('first');
    debounced('second');

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledWith('second');
  });

  it('cancels a pending call', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 50);

    debounced();
    debounced.cancel();

    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('throttle', () => {
  it('invokes immediately on the first call', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled('a');
    expect(fn).toHaveBeenCalledWith('a');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('ignores calls that happen before the delay elapses', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled();
    now += 50;
    throttled();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('invokes again once the delay has elapsed', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled();
    now += 150;
    throttled();

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('cancel() resets the throttle window so the next call fires immediately', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled();
    throttled.cancel();
    now += 1;
    throttled();

    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('fetchConfig', () => {
  it('defaults to a JSON POST request', () => {
    const config = fetchConfig();

    expect(config.method).toBe('POST');
    expect(config.headers['Content-Type']).toBe('application/json');
    expect(config.headers['Accept']).toBe('application/json');
  });

  it('merges custom headers', () => {
    const config = fetchConfig('json', { headers: { 'X-Custom': '1' } });
    expect(config.headers['X-Custom']).toBe('1');
  });

  it('removes the Content-Type header and adds XHR header for the javascript type', () => {
    const config = fetchConfig('javascript');

    expect(config.headers['Content-Type']).toBeUndefined();
    expect(config.headers['X-Requested-With']).toBe('XMLHttpRequest');
    expect(config.headers['Accept']).toBe('application/javascript');
  });

  it('passes the body through', () => {
    const config = fetchConfig('json', { body: '{"a":1}' });
    expect(config.body).toBe('{"a":1}');
  });
});

describe('isClickedOutside', () => {
  it('returns false when the click target is inside the element', () => {
    const parent = document.createElement('div');
    const child = document.createElement('span');
    parent.appendChild(child);
    document.body.appendChild(parent);

    const event = new MouseEvent('click');
    Object.defineProperty(event, 'target', { value: child });

    expect(isClickedOutside(event, parent)).toBe(false);
  });

  it('returns true when the click target is outside the element', () => {
    const parent = document.createElement('div');
    const outside = document.createElement('span');
    document.body.append(parent, outside);

    const event = new MouseEvent('click');
    Object.defineProperty(event, 'target', { value: outside });

    expect(isClickedOutside(event, parent)).toBe(true);
  });

  it('falls back to point-based detection when the target is a dialog element', () => {
    const dialog = document.createElement('dialog');
    document.body.appendChild(dialog);
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({ left: 0, right: 100, top: 0, bottom: 100 });

    const insideEvent = new MouseEvent('click', { clientX: 50, clientY: 50 });
    Object.defineProperty(insideEvent, 'target', { value: dialog });
    expect(isClickedOutside(insideEvent, dialog)).toBe(false);

    const outsideEvent = new MouseEvent('click', { clientX: 500, clientY: 500 });
    Object.defineProperty(outsideEvent, 'target', { value: dialog });
    expect(isClickedOutside(outsideEvent, dialog)).toBe(true);
  });
});

describe('isPointWithinElement', () => {
  it('returns true for a point inside the element bounds', () => {
    const el = document.createElement('div');
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ left: 10, right: 50, top: 10, bottom: 50 });

    expect(isPointWithinElement(20, 20, el)).toBe(true);
  });

  it('returns false for a point outside the element bounds', () => {
    const el = document.createElement('div');
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ left: 10, right: 50, top: 10, bottom: 50 });

    expect(isPointWithinElement(5, 5, el)).toBe(false);
  });

  it('treats the exact boundary as inside', () => {
    const el = document.createElement('div');
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ left: 0, right: 100, top: 0, bottom: 100 });

    expect(isPointWithinElement(0, 0, el)).toBe(true);
    expect(isPointWithinElement(100, 100, el)).toBe(true);
  });
});

describe('breakpoint helpers', () => {
  it('isMobileBreakpoint/isDesktopBreakpoint reflect the large-screen media query', () => {
    globalThis.__setMediaMatches__('(min-width: 750px)', true);
    expect(isDesktopBreakpoint()).toBe(true);
    expect(isMobileBreakpoint()).toBe(false);

    globalThis.__setMediaMatches__('(min-width: 750px)', false);
    expect(isDesktopBreakpoint()).toBe(false);
    expect(isMobileBreakpoint()).toBe(true);
  });
});

describe('isTouchDevice', () => {
  it('returns false when the browser exposes no touch APIs (jsdom default)', () => {
    expect(isTouchDevice()).toBe(false);
  });

  it('returns false when ontouchstart exists but there are no touch points', () => {
    window.ontouchstart = null;
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });

    expect(isTouchDevice()).toBe(false);

    delete window.ontouchstart;
  });

  it('returns true when ontouchstart exists and maxTouchPoints is positive', () => {
    window.ontouchstart = null;
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });

    expect(isTouchDevice()).toBe(true);

    delete window.ontouchstart;
  });
});

describe('isLowPowerDevice', () => {
  it('returns true when hardwareConcurrency is low', () => {
    vi.spyOn(navigator, 'hardwareConcurrency', 'get').mockReturnValue(2);
    expect(isLowPowerDevice()).toBe(true);
  });

  it('returns false when hardwareConcurrency is high and no deviceMemory info exists', () => {
    vi.spyOn(navigator, 'hardwareConcurrency', 'get').mockReturnValue(8);
    expect(isLowPowerDevice()).toBe(false);
  });
});

describe('supportsViewTransitions', () => {
  it('returns false when startViewTransition is not defined', () => {
    expect(supportsViewTransitions()).toBe(false);
  });

  it('returns true when startViewTransition is defined', () => {
    document.startViewTransition = () => {};
    expect(supportsViewTransitions()).toBe(true);
    delete document.startViewTransition;
  });
});

describe('getViewParameterValue', () => {
  it('returns null when there is no view parameter', () => {
    expect(getViewParameterValue()).toBeNull();
  });

  it('returns the view parameter value when present', () => {
    window.history.pushState({}, '', '/?view=custom');
    expect(getViewParameterValue()).toBe('custom');
    window.history.pushState({}, '', '/');
  });
});

describe('preventDefault', () => {
  it('calls preventDefault on the given event', () => {
    const event = new Event('click', { cancelable: true });
    const spy = vi.spyOn(event, 'preventDefault');

    preventDefault(event);

    expect(spy).toHaveBeenCalled();
  });
});

describe('getVisibleElements', () => {
  function makeElement(rect) {
    const el = document.createElement('div');
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect);
    return el;
  }

  it('returns an empty array when no elements are given', () => {
    const root = makeElement({ left: 0, right: 100, top: 0, bottom: 100 });
    expect(getVisibleElements(root, undefined)).toEqual([]);
    expect(getVisibleElements(root, [])).toEqual([]);
  });

  it('returns fully-visible elements when ratio is 1 (default)', () => {
    const root = makeElement({ left: 0, right: 100, top: 0, bottom: 100 });
    const inside = makeElement({ left: 10, right: 20, top: 10, bottom: 20, width: 10, height: 10 });
    const outside = makeElement({ left: 200, right: 220, top: 10, bottom: 20, width: 20, height: 10 });

    expect(getVisibleElements(root, [inside, outside])).toEqual([inside]);
  });

  it('applies a partial visibility ratio', () => {
    const root = makeElement({ left: 0, right: 100, top: 0, bottom: 100 });
    // Half of this element (width 20) is within the root bounds (only x=90..100 overlaps, width 10 of 20 = 50%)
    const halfVisible = makeElement({ left: 90, right: 110, top: 10, bottom: 20, width: 20, height: 10 });

    expect(getVisibleElements(root, [halfVisible], 0.5)).toEqual([halfVisible]);
    expect(getVisibleElements(root, [halfVisible], 0.9)).toEqual([]);
  });

  it('restricts visibility checks to the x axis when requested', () => {
    const root = makeElement({ left: 0, right: 100, top: 0, bottom: 100 });
    const offScreenY = makeElement({ left: 10, right: 20, top: -50, bottom: -10, width: 10, height: 40 });

    expect(getVisibleElements(root, [offScreenY], 1, 'x')).toEqual([offScreenY]);
    expect(getVisibleElements(root, [offScreenY], 1, 'y')).toEqual([]);
  });
});

describe('getIOSVersion', () => {
  it('returns null on a non-iOS user agent', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    expect(getIOSVersion()).toBeNull();
  });

  it('parses the major and minor version on iOS', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X)'
    );
    expect(getIOSVersion()).toEqual({ fullString: '16.4', major: 16, minor: 4 });
  });

  it('defaults minor to 0 when only a major version is present', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPad; CPU OS 17 like Mac OS X)');
    expect(getIOSVersion()).toEqual({ fullString: '17', major: 17, minor: 0 });
  });
});

describe('onDocumentReady', () => {
  it('invokes the callback immediately when the DOM is already interactive/complete', () => {
    const callback = vi.fn();
    onDocumentReady(callback);
    expect(callback).toHaveBeenCalled();
  });
});

describe('onDocumentLoaded', () => {
  it('invokes the callback immediately when the document is complete', () => {
    const callback = vi.fn();
    onDocumentLoaded(callback);
    expect(callback).toHaveBeenCalled();
  });
});

describe('changeMetaThemeColor', () => {
  it('updates an existing theme-color meta tag', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);

    changeMetaThemeColor('rgb(1,2,3)');

    expect(meta.getAttribute('content')).toBe('rgb(1,2,3)');
    meta.remove();
  });

  it('does nothing when there is no meta tag', () => {
    expect(() => changeMetaThemeColor('red')).not.toThrow();
  });

  it('does nothing when color is falsy', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', 'original');
    document.head.appendChild(meta);

    changeMetaThemeColor('');

    expect(meta.getAttribute('content')).toBe('original');
    meta.remove();
  });
});

describe('resetShimmer', () => {
  it('removes the shimmer attribute from all matching descendants', () => {
    const container = document.createElement('div');
    container.innerHTML = '<span shimmer></span><span shimmer></span><span></span>';
    document.body.appendChild(container);

    resetShimmer(container);

    expect(container.querySelectorAll('[shimmer]').length).toBe(0);
  });

  it('defaults to document.body when no container is given', () => {
    document.body.innerHTML = '<div shimmer></div>';
    resetShimmer();
    expect(document.body.querySelectorAll('[shimmer]').length).toBe(0);
  });
});

describe('center and start', () => {
  it('computes the center point of an element', () => {
    const el = document.createElement('div');
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ left: 10, top: 20, width: 100, height: 50 });

    expect(center(el)).toEqual({ x: 60, y: 45 });
    expect(center(el, 'x')).toBe(60);
    expect(center(el, 'y')).toBe(45);
  });

  it('computes the start point of an element', () => {
    const el = document.createElement('div');
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ left: 10, top: 20, width: 100, height: 50 });

    expect(start(el)).toEqual({ x: 10, y: 20 });
    expect(start(el, 'x')).toBe(10);
  });
});

describe('ResizeNotifier', () => {
  it('invokes the callback for resizes after the initial one', () => {
    const callback = vi.fn();
    const notifier = new ResizeNotifier(callback);

    // First invocation is swallowed as "initial"
    notifier.callback([{}]);
    expect(callback).not.toHaveBeenCalled();

    // Second invocation is treated as a real resize
    notifier.callback([{}]);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('disconnect() re-arms the initial-call swallowing', () => {
    const callback = vi.fn();
    const notifier = new ResizeNotifier(callback);

    notifier.callback([{}]); // swallowed
    notifier.callback([{}]); // real
    expect(callback).toHaveBeenCalledTimes(1);

    notifier.disconnect();

    notifier.callback([{}]); // swallowed again after disconnect
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

describe('oncePerEditorSession', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('calls the callback immediately when not in the theme editor', () => {
    globalThis.Shopify = { designMode: false };
    const el = document.createElement('div');
    const callback = vi.fn();

    oncePerEditorSession(el, 'my-key', callback);
    oncePerEditorSession(el, 'my-key', callback);

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('calls the callback once per session key when in the theme editor', () => {
    globalThis.Shopify = { designMode: true };
    const el = document.createElement('div');
    el.dataset.shopifyEditorSection = JSON.stringify({ id: 'section-1' });
    const callback = vi.fn();

    oncePerEditorSession(el, 'my-key', callback);
    oncePerEditorSession(el, 'my-key', callback);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('treats different editor section ids as different sessions', () => {
    globalThis.Shopify = { designMode: true };
    const elA = document.createElement('div');
    elA.dataset.shopifyEditorSection = JSON.stringify({ id: 'section-a' });
    const elB = document.createElement('div');
    elB.dataset.shopifyEditorSection = JSON.stringify({ id: 'section-b' });
    const callback = vi.fn();

    oncePerEditorSession(elA, 'my-key', callback);
    oncePerEditorSession(elB, 'my-key', callback);

    expect(callback).toHaveBeenCalledTimes(2);
  });
});

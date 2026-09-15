// Global test environment setup for jsdom.
// Provides browser APIs that jsdom does not implement, so production modules
// (written for real browsers) can be imported and exercised as-is in tests.
import { afterEach, beforeEach, vi } from 'vitest';

/**
 * jsdom does not implement matchMedia. Several modules call it at module scope
 * (e.g. `assets/utilities.js`), so it must exist before those modules are imported.
 * Tests can override `matches` per media query via `window.__setMediaMatches__`.
 */
class MockMediaQueryList extends EventTarget {
  constructor(media) {
    super();
    this.media = media;
    this.matches = false;
    this.onchange = null;
  }
  addListener(listener) {
    this.addEventListener('change', listener);
  }
  removeListener(listener) {
    this.removeEventListener('change', listener);
  }
  _setMatches(matches) {
    this.matches = matches;
    const event = new Event('change');
    Object.defineProperty(event, 'matches', { value: matches });
    Object.defineProperty(event, 'media', { value: this.media });
    if (typeof this.onchange === 'function') this.onchange(event);
    this.dispatchEvent(event);
  }
}

const mediaQueryRegistry = new Map();

function matchMediaMock(query) {
  let mql = mediaQueryRegistry.get(query);
  if (!mql) {
    mql = new MockMediaQueryList(query);
    mediaQueryRegistry.set(query, mql);
  }
  return mql;
}

window.matchMedia = window.matchMedia || matchMediaMock;
if (!window.matchMedia.toString().includes('matchMediaMock')) {
  window.matchMedia = matchMediaMock;
}

/** Test helper: force the `matches` state for a given media query string. */
globalThis.__setMediaMatches__ = (query, matches) => {
  const mql = matchMediaMock(query);
  mql._setMatches(matches);
};

/** jsdom does not implement ResizeObserver. */
class MockResizeObserver {
  constructor(callback) {
    this.callback = callback;
    this.observedElements = new Set();
    MockResizeObserver.instances.push(this);
  }
  observe(element) {
    this.observedElements.add(element);
  }
  unobserve(element) {
    this.observedElements.delete(element);
  }
  disconnect() {
    this.observedElements.clear();
  }
  /** Test helper to simulate a resize notification. */
  trigger(entries = []) {
    this.callback(entries, this);
  }
}
MockResizeObserver.instances = [];
globalThis.ResizeObserver = globalThis.ResizeObserver || MockResizeObserver;

/** jsdom does not implement IntersectionObserver. */
class MockIntersectionObserver {
  constructor(callback, options) {
    this.callback = callback;
    this.options = options;
    this.observedElements = new Set();
    MockIntersectionObserver.instances.push(this);
  }
  observe(element) {
    this.observedElements.add(element);
  }
  unobserve(element) {
    this.observedElements.delete(element);
  }
  disconnect() {
    this.observedElements.clear();
  }
  takeRecords() {
    return [];
  }
  /** Test helper to simulate an intersection notification. */
  trigger(entries) {
    this.callback(entries, this);
  }
}
MockIntersectionObserver.instances = [];
globalThis.IntersectionObserver = globalThis.IntersectionObserver || MockIntersectionObserver;

/** jsdom does not implement the Clipboard API. */
if (!navigator.clipboard) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
}

/**
 * jsdom does not implement <dialog>'s showModal()/close(), or the Web Animations API's
 * Element#getAnimations(). Several theme components (assets/dialog.js and its subclasses) rely
 * on both, so provide minimal, spec-approximate behavior: showModal()/close() toggle the `open`
 * attribute (and jsdom already reflects that to the `open` property), and getAnimations()
 * defaults to no running animations so `onAnimationEnd` resolves immediately.
 */
if (typeof HTMLDialogElement !== 'undefined') {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '');
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute('open');
    };
  }
}
if (typeof Element !== 'undefined' && !Element.prototype.getAnimations) {
  Element.prototype.getAnimations = function getAnimations() {
    return [];
  };
}

/** jsdom's window.scrollTo is a stub that logs a noisy "not implemented" warning; replace it. */
window.scrollTo = () => {};

beforeEach(() => {
  // Reset per-test global state that individual test files may set.
  globalThis.Shopify = undefined;
  globalThis.Theme = undefined;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.innerHTML = '';
  MockResizeObserver.instances.length = 0;
  MockIntersectionObserver.instances.length = 0;
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@theme/product-title-truncation';

/**
 * jsdom performs no real layout, so clientHeight/lineHeight/padding are always 0/''.
 * Stub getComputedStyle and clientHeight with realistic values so the line-clamp
 * calculation in #calculateTruncation produces a deterministic, valid result.
 */
function mockLayout(element, { clientHeight = 60, lineHeight = 20, paddingTop = 0, paddingBottom = 0 } = {}) {
  Object.defineProperty(element, 'clientHeight', { value: clientHeight, configurable: true });
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    lineHeight: `${lineHeight}px`,
    paddingTop: `${paddingTop}px`,
    paddingBottom: `${paddingBottom}px`,
  });
}

/**
 * Creates a <product-title> element with layout mocks already in place *before* it is inserted
 * into the document, so the initial synchronous calculation done from connectedCallback
 * (triggered the moment the element is attached) sees the mocked values.
 */
function makeTitle(text = 'A very long product title that might need truncation', layout) {
  document.body.innerHTML = '';
  const title = document.createElement('product-title');
  title.textContent = text;
  mockLayout(title, layout);
  document.body.appendChild(title);
  return title;
}

describe('product-title', () => {
  it('registers the product-title custom element', () => {
    expect(customElements.get('product-title')).toBeDefined();
  });

  describe('with ResizeObserver support', () => {
    it('applies line-clamp styles based on the available height and line height', () => {
      const title = makeTitle();

      // containerHeight 60 / lineHeight 20 => 3 lines
      expect(title.style.webkitLineClamp).toBe('3');
      expect(title.style.display).toBe('-webkit-box');
      expect(title.style.webkitBoxOrient).toBe('vertical');
      expect(title.style.overflow).toBe('hidden');
      expect(title.style.textOverflow).toBe('ellipsis');
    });

    it('does nothing when the title has no text content', () => {
      const title = makeTitle('');

      expect(title.style.webkitLineClamp).toBe('');
    });

    it('clamps to at least 1 line even when the container is very small', () => {
      const title = makeTitle('Title', { clientHeight: 2, lineHeight: 20 });

      expect(title.style.webkitLineClamp).toBe('1');
    });

    it('recalculates truncation when the observed element resizes', () => {
      const title = makeTitle();
      const observer = globalThis.ResizeObserver.instances.at(-1);

      mockLayout(title, { clientHeight: 100, lineHeight: 20 });
      observer.trigger([{ target: title }]);

      expect(title.style.webkitLineClamp).toBe('5');
    });

    it('disconnects the ResizeObserver when removed from the DOM', () => {
      const title = makeTitle();
      const observer = globalThis.ResizeObserver.instances.at(-1);
      const disconnectSpy = vi.spyOn(observer, 'disconnect');

      title.disconnectedCallback();

      expect(disconnectSpy).toHaveBeenCalled();
    });
  });

  describe('without ResizeObserver support (fallback to window resize)', () => {
    let originalResizeObserver;

    beforeEach(() => {
      originalResizeObserver = window.ResizeObserver;
      // @ts-ignore - simulate an older browser without ResizeObserver
      delete window.ResizeObserver;
    });

    afterEach(() => {
      window.ResizeObserver = originalResizeObserver;
    });

    it('falls back to a window resize listener', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      makeTitle();

      expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    });

    it('recalculates truncation on window resize', () => {
      const title = makeTitle();
      mockLayout(title, { clientHeight: 40, lineHeight: 20 });

      window.dispatchEvent(new Event('resize'));

      expect(title.style.webkitLineClamp).toBe('2');
    });

    it('removes the resize listener on disconnect, so it no longer recalculates', () => {
      const title = makeTitle();
      title.disconnectedCallback();

      title.style.webkitLineClamp = '';
      mockLayout(title, { clientHeight: 40, lineHeight: 20 });
      window.dispatchEvent(new Event('resize'));

      // Regression test: previously the resize handler was bound with `.bind(this)` when added,
      // producing a different function reference than the one passed to removeEventListener, so
      // the listener was never actually removed and this assertion would have failed.
      expect(title.style.webkitLineClamp).toBe('');
    });
  });
});
